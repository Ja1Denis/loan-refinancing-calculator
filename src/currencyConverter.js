// Trenutni tečaj EUR/HRK (aproksimativno)
const EXCHANGE_RATE = 7.53;

export function convertToEUR(amount) {
  return Number(amount);  // Samo vraćamo iznos jer je već u eurima
}

export function convertToHRK(amount) {
  return (amount * EXCHANGE_RATE).toFixed(2);
}

export function formatCurrency(amount, currency = 'EUR') {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: currency
  }).format(amount);
}
