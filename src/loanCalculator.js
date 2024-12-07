import { convertToEUR } from './currencyConverter';

// Napredni izračuni za refinanciranje kredita

// Izračun mjesečne rate kredita
export function calculateMonthlyPayment(principal, annualInterestRate, months) {
  // Pretvaramo sve parametre u brojeve i osiguravamo da nisu NaN
  principal = Number(principal) || 0;
  annualInterestRate = Number(annualInterestRate) || 0;
  months = Number(months) || 0;

  const monthlyInterestRate = annualInterestRate / 100 / 12;
  
  if (monthlyInterestRate === 0) {
    return Number(convertToEUR(principal / months));
  }
  
  const monthlyPayment = principal * 
    (monthlyInterestRate * Math.pow(1 + monthlyInterestRate, months)) / 
    (Math.pow(1 + monthlyInterestRate, months) - 1);
  
  return Number(convertToEUR(monthlyPayment.toFixed(2)));  // Zaokružujemo na 2 decimale
}

// Izračun amortizacijskog plana
export function generateAmortizationSchedule(principal, annualInterestRate, months) {
  const monthlyInterestRate = annualInterestRate / 100 / 12;
  const numberOfPayments = months;
  const monthlyPayment = calculateMonthlyPayment(principal, annualInterestRate, months);
  
  let remainingBalance = principal;
  const schedule = [];

  for (let month = 1; month <= numberOfPayments; month++) {
    const interestPayment = remainingBalance * monthlyInterestRate;
    const principalPayment = monthlyPayment - interestPayment;
    
    schedule.push({
      month,
      year: Math.ceil(month / 12),
      payment: Number(convertToEUR(monthlyPayment)),
      principalPayment: Number(convertToEUR(principalPayment)),
      interestPayment: Number(convertToEUR(interestPayment)),
      remainingBalance: Number(convertToEUR(Math.max(remainingBalance - principalPayment, 0)))
    });

    remainingBalance -= principalPayment;
  }

  return schedule;
}

// Izračun ukupnih troškova kredita
export function calculateLoanCosts(principal, annualInterestRate, months, additionalFees = 0) {
  const monthlyPayment = calculateMonthlyPayment(principal, annualInterestRate, months);
  const totalPayments = monthlyPayment * months;
  const totalInterest = totalPayments - Number(convertToEUR(principal));

  return {
    principal: Number(convertToEUR(principal)),
    monthlyPayment,
    totalPayments,
    totalInterest,
    additionalFees: Number(convertToEUR(additionalFees)),
    totalCost: totalPayments + Number(convertToEUR(additionalFees))
  };
}

// Izračun break-even točke
export function calculateBreakEvenPoint(currentLoan, newLoan, refinancingCosts) {
  const monthlySavings = currentLoan.monthlyPayment - newLoan.monthlyPayment;
  
  if (monthlySavings <= 0) return null;

  const breakEvenMonths = Math.ceil(refinancingCosts / monthlySavings);
  
  return {
    months: breakEvenMonths,
    years: breakEvenMonths / 12
  };
}

// Generiranje opcija refinanciranja
export function generateRefinancingOptions(
  currentLoan, 
  desiredLoanTermMonths = null,  // Novi parametar za željeni rok otplate
  customOption = null // Novi parametar za korisničku opciju
) {
  // Pretvaramo sve vrijednosti u brojeve
  const remainingDebt = Number(currentLoan.remainingDebt) || 0;
  const currentTermMonths = Number(currentLoan.repaymentTerm) || 0;
  const currentRate = Number(currentLoan.interestRate) || 0;
  const currentMonthlyPayment = Number(currentLoan.monthlyPayment) || 0;
  
  // Koristimo željeni rok otplate ili trenutni rok
  const newTermMonths = Number(desiredLoanTermMonths) || currentTermMonths;

  console.log('🔍 Dijagnostički podaci:', {
    remainingDebt,
    currentTermMonths,
    currentRate,
    currentMonthlyPayment,
    newTermMonths
  });

  const bankRates = [
    { 
      bank: 'Erste Bank', 
      interestRate: 4.2,
      refinancingCosts: 500,
      description: 'Najpovoljnija ponuda za refinanciranje',
      costsDescription: `
        Troškovi refinanciranja uključuju:
        • Naknada za obradu zahtjeva: 300€
        • Procjena vrijednosti nekretnine: 150€
        • Solemnizacija ugovora: 50€
        Ukupno: 500€
      `
    },
    { 
      bank: 'Zagrebačka Banka', 
      interestRate: 4.5,
      refinancingCosts: 600,
      description: 'Stabilna ponuda s umjerenom kamatom',
      costsDescription: `
        Troškovi refinanciranja uključuju:
        • Naknada za obradu zahtjeva: 350€
        • Procjena vrijednosti nekretnine: 200€
        • Solemnizacija ugovora: 50€
        Ukupno: 600€
      `
    },
    { 
      bank: 'PBZ', 
      interestRate: 4.7,
      refinancingCosts: 550,
      description: 'Fleksibilni uvjeti refinanciranja',
      costsDescription: `
        Troškovi refinanciranja uključuju:
        • Naknada za obradu zahtjeva: 325€
        • Procjena vrijednosti nekretnine: 175€
        • Solemnizacija ugovora: 50€
        Ukupno: 550€
      `
    }
  ];

  // Ako postoji custom opcija, dodaj je na početak liste
  if (customOption) {
    bankRates.unshift({
      bank: customOption.bank || 'Vlastita opcija',
      interestRate: Number(customOption.interestRate) || 0,
      refinancingCosts: Number(customOption.refinancingCosts) || 500,
      description: 'Vaša vlastita opcija refinanciranja'
    });
  }

  return bankRates.map(bank => {
    // Nova rata se računa standardnom formulom za anuitet
    const newMonthlyPayment = calculateMonthlyPayment(
      remainingDebt,
      bank.interestRate,
      newTermMonths
    );

    const refinancingCosts = bank.refinancingCosts;
    
    const currentLoanCosts = {
      monthlyPayment: currentMonthlyPayment,
      totalPayments: currentMonthlyPayment * currentTermMonths,
      totalCost: currentMonthlyPayment * currentTermMonths
    };

    const newLoanCosts = {
      monthlyPayment: newMonthlyPayment,
      totalPayments: newMonthlyPayment * newTermMonths,
      totalCost: (newMonthlyPayment * newTermMonths) + refinancingCosts
    };

    const breakEvenPoint = calculateBreakEvenPoint(
      { monthlyPayment: currentMonthlyPayment },
      { monthlyPayment: newMonthlyPayment },
      refinancingCosts
    );

    const totalSavings = currentLoanCosts.totalCost - newLoanCosts.totalCost;

    return {
      ...bank,
      monthlyPayment: newMonthlyPayment,
      currentLoanCosts,
      newLoanCosts,
      breakEvenPoint,
      totalSavings,
      amortizationSchedule: generateAmortizationSchedule(
        remainingDebt,
        bank.interestRate,
        newTermMonths
      )
    };
  });
}
