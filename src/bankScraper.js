import axios from 'axios';
import cheerio from 'cheerio';

const BANK_URLS = {
  'Erste Bank': 'https://www.erstebank.hr/hr/stanovnistvo/krediti',
  'PBZ': 'https://www.pbz.hr/hr/stanovnistvo/krediti',
  'Zaba': 'https://www.zaba.hr/home/krediti'
};

export async function scrapeBankRates() {
  const bankRates = [];

  for (const [bankName, url] of Object.entries(BANK_URLS)) {
    try {
      const response = await axios.get(url);
      const $ = cheerio.load(response.data);

      // Primjer selektora - trebat će prilagoditi stvarnim stranicama
      const interestRate = parseFloat($('.interest-rate').text()) || 4.5;
      const monthlyPayment = parseFloat($('.monthly-payment').text()) || 750;

      bankRates.push({
        bank: bankName,
        interestRate,
        monthlyPayment
      });
    } catch (error) {
      console.error(`Greška kod scraping-a ${bankName}:`, error);
    }
  }

  return bankRates;
}

// Fallback podaci ako scraping ne uspije
export const fallbackBankRates = [
  { bank: 'Erste Bank', interestRate: 4.2, monthlyPayment: 750 },
  { bank: 'PBZ', interestRate: 4.5, monthlyPayment: 770 },
  { bank: 'Zaba', interestRate: 4.7, monthlyPayment: 790 }
];
