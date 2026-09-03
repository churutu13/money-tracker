export function monthlyMortgagePayment(principal: number, annualInterestRate: number, termYears: number) {
  if (principal <= 0 || termYears <= 0) return 0;
  const numberOfPayments = termYears * 12;
  const monthlyRate = annualInterestRate / 12;
  if (monthlyRate === 0) return principal / numberOfPayments;
  return principal * monthlyRate / (1 - Math.pow(1 + monthlyRate, -numberOfPayments));
}

export interface MortgagePeriod {
  payment: number;
  interest: number;
  principal: number;
  closingPrincipal: number;
}

export function amortizeMortgageMonth(openingPrincipal: number, annualInterestRate: number, scheduledPayment: number): MortgagePeriod {
  if (openingPrincipal <= 0) return { payment: 0, interest: 0, principal: 0, closingPrincipal: 0 };
  const interest = openingPrincipal * annualInterestRate / 12;
  const payment = Math.min(scheduledPayment, openingPrincipal + interest);
  const principal = Math.max(0, payment - interest);
  return { payment, interest, principal, closingPrincipal: Math.max(0, openingPrincipal - principal) };
}

export function remainingMortgagePrincipal(principal: number, annualInterestRate: number, termYears: number, paymentsMade: number) {
  const payment = monthlyMortgagePayment(principal, annualInterestRate, termYears);
  let balance = principal;
  for (let index = 0; index < paymentsMade; index += 1) balance = amortizeMortgageMonth(balance, annualInterestRate, payment).closingPrincipal;
  return balance;
}
