import assert from "node:assert/strict";
import test from "node:test";
import { demoData } from "../../lib/demo-data";
import { initialLoans, loanTotals, postLoanMovement, removeLoanMovement, loanSchedule, loanForecast, saveLoan } from "../../lib/loans";
import { applyTransactionToFunds } from "../../lib/fund-mutations";
import { createWorkbookScenario } from "../../lib/planning/assumptions";
import { runProjection } from "../../lib/planning/projection-engine";
import type { FlowData } from "../../lib/types";
function fixture(): FlowData {
 const data: FlowData = { ...structuredClone(demoData), funds:[{id:"bank",name:"Bank",kind:"savings",balance:7600,accounts:[{id:"main",name:"Main",balance:7600}]}],transactions:[],loans:[] };
 data.loans = initialLoans({...data,loans:undefined}).map(l=>({...l,fundId:"bank",fundAccountId:"main"}));
 return data;
}
const move = (id:string,amount:number,kind:"advance"|"repayment"="advance") => ({id,amount,kind,date:"2026-01-01"});
test("two advances and partial repayment move only capital and cash",()=>{
 let d=fixture();const id=d.loans![0].id;
 d=postLoanMovement(d,id,move("a",500));d=postLoanMovement(d,id,move("b",500));d=postLoanMovement(d,id,move("c",300,"repayment"));
 assert.deepEqual({...loanTotals(d,id),movements:[]},{advanced:1000,repaid:300,residual:700,movements:[]});
 assert.equal(d.funds[0].balance,6900);assert.equal(d.funds[0].accounts![0].balance,6900);
 assert.equal(d.transactions.filter(t=>t.type==="income"||t.type==="expense").length,0);
 const restored=removeLoanMovement(d,d.transactions.find(t=>t.loan?.planId==="c")!.id);
 assert.equal(restored.funds[0].balance,6600);assert.equal(loanTotals(restored,id).residual,1000);
});
test("draft and planned movements never mutate balances; persistence preserves references",()=>{
 const d=fixture();assert.equal(loanSchedule(d,d.loans![0]).length,0);
 const next=saveLoan(d,{...d.loans![0],startConfirmed:true});
 assert.equal(loanSchedule(next,next.loans![0]).length,8);assert.equal(next.funds[0].balance,7600);assert.equal(next.transactions.length,0);
 assert.deepEqual(JSON.parse(JSON.stringify(next)),next);assert.equal(d.loans![0].startConfirmed,false);
});
test("existing transaction association neither duplicates nor deducts twice",()=>{
 let d=fixture();const transaction={id:"existing",name:"Advance",amount:500,type:"expense" as const,date:"2026-01-01",fundId:"bank",fundAccountId:"main",createdAt:"2026-01-01"};
 d={...d,funds:applyTransactionToFunds(d.funds,transaction,1),transactions:[transaction]};
 d=postLoanMovement(d,d.loans![0].id,move("association",500),transaction.id);
 assert.equal(d.transactions.length,1);assert.equal(d.funds[0].balance,7100);assert.equal(d.transactions[0].type,"transfer");
 assert.throws(()=>postLoanMovement(d,d.loans![0].id,move("another",500),transaction.id));
 const deleted=removeLoanMovement(d,transaction.id);assert.equal(deleted.funds[0].balance,7600);
});
test("received loans mirror cash direction and reject overpayment",()=>{
 let d=fixture();d.loans![0].type="received";const id=d.loans![0].id;
 d=postLoanMovement(d,id,move("a",500));assert.equal(d.funds[0].balance,8100);
 assert.throws(()=>postLoanMovement(d,id,move("bad",501,"repayment")));
 d=postLoanMovement(d,id,move("b",300,"repayment"));assert.equal(d.funds[0].balance,7800);
});
test("delay shifts quantified repayments without changing plan or balances",()=>{
 const d=fixture();d.loans![0].plan=[{...move("future",300,"repayment"),date:"2027-05-31"}];
 const original=JSON.stringify(d);assert.equal(loanForecast(d,1)[0].date,"2027-06-30");assert.equal(loanForecast(d,3)[0].date,"2027-08-31");assert.equal(JSON.stringify(d),original);
});
test("projection changes liquidity but excludes capital from income and consumption",()=>{
 const base=createWorkbookScenario("test","Test");const before=runProjection(base);
 const after=runProjection({...base,loanCashflows:[{month:base.startMonth,amount:-500,title:"Loan",tax:false}]});
 assert.equal(after.months[0].closingAvailableLiquidity,before.months[0].closingAvailableLiquidity-500);
 assert.equal(after.months[0].totalIncome,before.months[0].totalIncome);assert.equal(after.months[0].totalOutflow,before.months[0].totalOutflow);
 assert.equal(after.months[0].netWorth,before.months[0].netWorth);
});

test("editing actual movement reverses the previous posting once and retains transaction id", async()=>{
 const { editLoanMovement } = await import("../../lib/loans");
 let d=fixture();const id=d.loans![0].id;d=postLoanMovement(d,id,move("a",500));
 const tid=d.transactions[0].id;const next=editLoanMovement(d,tid,move("a",600));
 assert.equal(next.funds[0].balance,7000);assert.equal(next.transactions.length,1);assert.equal(next.transactions[0].id,tid);assert.equal(loanTotals(next,id).residual,600);
 assert.equal(d.funds[0].balance,7100);
});
test("fund link adds no cash movement and tax-account advances reduce real tax liquidity",()=>{
 let d=fixture();d.funds[0].kind="tax";d.loans![0].linkedFundId="bank";
 const before=d.funds[0].balance;d=saveLoan(d,d.loans![0]);assert.equal(d.funds[0].balance,before);
 d=postLoanMovement(d,d.loans![0].id,move("tax",500));assert.equal(d.funds[0].balance,7100);
 assert.equal(loanTotals(d,d.loans![0].id).residual,500);
});

test("tax-funded capital conserves Flow net worth while reducing tax liquidity",()=>{
 const base={...createWorkbookScenario("tax","Tax"),includeTaxInNetWorth:true};
 const before=runProjection(base);
 const after=runProjection({...base,loanCashflows:[{month:base.startMonth,amount:-500,title:"Loan",tax:true}]});
 assert.equal(after.months[0].closingTaxReserve,before.months[0].closingTaxReserve-500);
 assert.equal(after.months[0].netWorth,before.months[0].netWorth);
});
test("cannot delete an advance leaving repayments above disbursed principal",()=>{
 let d=fixture();const id=d.loans![0].id;d=postLoanMovement(d,id,move("a",500));d=postLoanMovement(d,id,move("b",300,"repayment"));
 assert.throws(()=>removeLoanMovement(d,d.transactions.find(t=>t.loan?.kind==="advance")!.id));
});
