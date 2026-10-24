import assert from "node:assert/strict";
import test from "node:test";
import { demoData } from "../../lib/demo-data";
import { initialLoans, loanSchedule, loanTotals, postLoanMovement, saveLoan } from "../../lib/loans";
import { configureReserveAccount, monthlyReserveUpdate, reserveAccountTotals, saveReserveAccount, updateReservePreferences } from "../../lib/tax-reserve";
import type { FlowData } from "../../lib/types";
const january = new Date(2026,0,15,12);
const february = new Date(2026,1,15,12);
function fixture(): FlowData {
  const data: FlowData = { ...structuredClone(demoData),transactions:[],funds:[
    {id:"tax",name:"Tax Reserve",kind:"tax",balance:8600,accounts:[{id:"trade",name:"Trade",balance:7600},{id:"other",name:"Other",balance:1000}]},
    {id:"savings",name:"Savings",kind:"savings",balance:2000},
  ] };
  data.loans=initialLoans({...data,loans:undefined});return data;
}
const account = (data:FlowData) => data.funds[0].accounts![0];
const setup = () => configureReserveAccount(fixture(),"tax","trade","mamma-project-draft",january);

test("configuration preserves actual balances and creates no actual or certain repayment",()=>{
  const original=fixture();const next=configureReserveAccount(original,"tax","trade","mamma-project-draft",january);
  assert.equal(account(next).balance,7600);assert.equal(next.funds[0].balance,8600);assert.deepEqual(next.transactions,[]);
  assert.equal(reserveAccountTotals(next,account(next)).theoretical,7600);
  assert.equal(next.loans![0].startDate,"2026-01-01");assert.equal(next.loans![0].startConfirmed,false);
  assert.equal(loanSchedule(next,next.loans![0]).filter(p=>p.kind==="repayment").length,0);
  assert.equal(configureReserveAccount(next,"tax","trade",undefined,january),next);
  assert.equal(original.funds[0].accounts![0].taxReserveTracking,undefined);
});
test("850 theoretical contribution splits into 500 capital and 350 actual cash, once",()=>{
  let next=setup();const monthly=monthlyReserveUpdate(next,account(next),january);
  assert.equal(monthly.theoretical,8450);assert.equal(monthly.principal,500);
  next=saveReserveAccount(next,"tax","trade",{theoretical:monthly.theoretical,principal:monthly.principal,recordMonth:monthly.month},january);
  const totals=reserveAccountTotals(next,account(next));assert.equal(totals.actual,7950);assert.equal(totals.principal,500);assert.equal(totals.theoretical,8450);
  assert.equal(next.funds[0].balance,8950);assert.equal(next.funds[0].accounts![1].balance,1000);
  assert.equal(next.transactions.length,1);assert.equal(next.transactions[0].type,"transfer");assert.equal(next.transactions[0].amount,500);
  assert.equal(next.transactions.filter(t=>t.type==="income"||t.type==="expense").length,0);
  assert.throws(()=>saveReserveAccount(next,"tax","trade",{theoretical:9300,principal:1000,recordMonth:monthly.month},january));
  const repeat=saveReserveAccount(next,"tax","trade",{theoretical:8450,principal:500},january);
  assert.equal(repeat.transactions.length,1);assert.equal(account(repeat).balance,7950);
});
test("two monthly allocations and partial/full repayments keep nominal, cash and capital consistent",()=>{
  let next=saveReserveAccount(setup(),"tax","trade",{theoretical:8450,principal:500,recordMonth:"2026-01"},january);
  next=saveReserveAccount(next,"tax","trade",{theoretical:9300,principal:1000,recordMonth:"2026-02"},february);
  assert.equal(account(next).balance,8300);assert.equal(loanTotals(next,"mamma-project-draft").residual,1000);
  next=saveReserveAccount(next,"tax","trade",{theoretical:9300,principal:700},february);
  assert.equal(account(next).balance,8600);assert.equal(loanTotals(next,"mamma-project-draft").repaid,300);
  next=saveReserveAccount(next,"tax","trade",{theoretical:9300,principal:0},february);
  assert.equal(account(next).balance,9300);assert.equal(loanTotals(next,"mamma-project-draft").residual,0);
});
test("an advance already posted in Loans is not duplicated by the monthly update",()=>{
  let next=setup();next=postLoanMovement(next,"mamma-project-draft",{id:"already",kind:"advance",amount:500,date:"2026-01-10"});
  const monthly=monthlyReserveUpdate(next,account(next),january);assert.equal(monthly.additionalLoan,0);
  assert.equal(monthly.theoretical,8450);assert.equal(monthly.principal,500);
  next=saveReserveAccount(next,"tax","trade",{theoretical:monthly.theoretical,principal:monthly.principal,recordMonth:monthly.month},january);
  assert.equal(account(next).balance,7950);assert.equal(next.transactions.length,1);
  next=postLoanMovement(next,"mamma-project-draft",{id:"returned",kind:"repayment",amount:300,date:"2026-01-15"});
  const totals=reserveAccountTotals(next,account(next));assert.equal(totals.actual,8250);assert.equal(totals.principal,200);assert.equal(totals.theoretical,8450);
});
test("snapshot uses safe cents, persists and leaves unrelated data isolated",()=>{
  const original=setup();const next=saveReserveAccount(original,"tax","trade",{theoretical:8450.01,principal:500.02},january);
  assert.equal(account(next).balance,7949.99);assert.equal(next.funds[0].balance,8949.99);
  const persisted=JSON.parse(JSON.stringify(next)) as FlowData;
  assert.equal(reserveAccountTotals(persisted,account(persisted)).theoretical,8450.01);
  assert.deepEqual(next.salaryProfiles,original.salaryProfiles);assert.deepEqual(next.funds[1],original.funds[1]);assert.equal(account(original).balance,7600);
});
test("invalid totals, duplicate account links and source changes are rejected",()=>{
  const next=setup();assert.throws(()=>saveReserveAccount(next,"tax","trade",{theoretical:100,principal:500},january));
  assert.throws(()=>saveReserveAccount(next,"tax","trade",{theoretical:NaN,principal:0},january));
  assert.throws(()=>configureReserveAccount(next,"tax","other","mamma-project-draft",january));
  assert.throws(()=>saveLoan(next,{...next.loans![0],fundId:"savings",fundAccountId:undefined}));
  assert.equal(account(next).balance,7600);assert.equal(next.transactions.length,0);
});
test("monthly settings remain forecasts; after May no further loan is prefilled",()=>{
  let next=setup();next=updateReservePreferences(next,"tax","trade",{monthlyContribution:850,monthlyLoan:400,endMonth:"2026-05"});
  assert.equal(next.transactions.length,0);assert.equal(account(next).balance,7600);
  assert.equal(monthlyReserveUpdate(next,account(next),january).additionalLoan,400);
  const june=monthlyReserveUpdate(next,account(next),new Date(2026,5,15));assert.equal(june.additionalLoan,0);assert.equal(june.theoretical,8450);
  assert.equal(next.loans![0].monthlyAdvance,400);assert.equal(next.loans![0].advanceEnd,"2026-05-31");
});
test("snapshot advance matches recurring occurrence even before confirmation of draft",()=>{
  let next=saveReserveAccount(setup(),"tax","trade",{theoretical:8450,principal:500},january);
  next=saveLoan(next,{...next.loans![0],startConfirmed:true});
  assert.equal(next.transactions[0].loan?.planId,"mamma-project-draft:monthly:2026-01-01");
  assert.equal(loanSchedule(next,next.loans![0]).filter(p=>p.date.startsWith("2026-01")).length,0);
});

test("editing or deleting a linked advance updates actual liquidity once and preserves theoretical total",async()=>{
  const { editLoanMovement,removeLoanMovement }=await import("../../lib/loans");
  let next=saveReserveAccount(setup(),"tax","trade",{theoretical:8450,principal:500},january);
  const id=next.transactions[0].id;
  next=editLoanMovement(next,id,{id:"correction",kind:"advance",date:"2026-01-15",amount:400});
  assert.equal(account(next).balance,8050);assert.equal(reserveAccountTotals(next,account(next)).theoretical,8450);
  next=removeLoanMovement(next,id);assert.equal(account(next).balance,8450);assert.equal(reserveAccountTotals(next,account(next)).principal,0);
  assert.equal(next.transactions.length,0);
});
test("account snapshot cannot silently round amounts with more than two decimals",()=>{
  const next=setup();assert.throws(()=>saveReserveAccount(next,"tax","trade",{theoretical:8450.001,principal:500},january));
  assert.equal(account(next).balance,7600);
});

test("suspending the linked loan stops suggested advances without changing monthly savings",()=>{
  let next=setup();next=saveLoan(next,{...next.loans![0],suspended:true});
  const monthly=monthlyReserveUpdate(next,account(next),january);
  assert.equal(monthly.additionalLoan,0);assert.equal(monthly.contribution,850);assert.equal(next.transactions.length,0);
});
