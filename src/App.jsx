import React, { useState, useEffect, useCallback } from 'react'
import { generateRefinancingOptions, calculateMonthlyPayment, calculateLoanCosts } from './loanCalculator'
import { 
  LineChart, Line,
  BarChart, Bar, 
  XAxis, YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Legend
} from 'recharts'
import { 
  FaMoneyBillWave, 
  FaPercentage, 
  FaClock, 
  FaCalculator,
  FaCheckCircle,
  FaTimesCircle
} from 'react-icons/fa'
import { formatCurrency } from './currencyConverter'
import { bankRates } from './bankRates';
import { generateAmortizationSchedule } from './loanCalculator';

// Komponenta za informativni tooltip
const InfoTooltip = ({ title, description }) => {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <div className="relative inline-block ml-2">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="text-blue-500 hover:text-blue-700 focus:outline-none"
      >
        <svg 
          xmlns="http://www.w3.org/2000/svg" 
          className="h-5 w-5" 
          viewBox="0 0 20 20" 
          fill="currentColor"
        >
          <path 
            fillRule="evenodd" 
            d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" 
            clipRule="evenodd" 
          />
        </svg>
      </button>

      {isOpen && (
        <div 
          className="absolute z-10 w-64 p-4 bg-white border border-gray-200 rounded-lg shadow-lg"
          style={{ top: '100%', left: '50%', transform: 'translateX(-50%)' }}
        >
          <h4 className="font-bold mb-2">{title}</h4>
          <p className="text-sm text-gray-600">{description}</p>
          <button 
            onClick={() => setIsOpen(false)}
            className="mt-2 text-sm text-blue-500 hover:text-blue-700"
          >
            Zatvori
          </button>
        </div>
      )}
    </div>
  )
}

// Tooltip za Break-even točku
const BreakEvenTooltip = () => (
  <InfoTooltip 
    title="Break-even točka" 
    description={`
      Break-even točka je trenutak kada uštede od refinanciranja pokrivaju početne troškove.

      Primjer:
      - Početni troškovi refinanciranja: 500€
      - Mjesečna ušteda: 50€
      - Break-even točka: 10 mjeseci (500€ / 50€)

      Nakon ove točke počinjete stvarno štedjeti novac.
      Što je break-even točka kraća, refinanciranje je povoljnije.
    `}
  />
)

// Tooltip za troškove refinanciranja
const RefinancingCostsTooltip = ({ costsDescription }) => (
  <InfoTooltip 
    title="Troškovi refinanciranja" 
    description={costsDescription || `
      Troškovi refinanciranja obično uključuju:
      • Naknadu za obradu zahtjeva
      • Procjenu vrijednosti nekretnine
      • Solemnizaciju ugovora
      
      Točan iznos ovisi o banci i uvjetima refinanciranja.
    `}
  />
)

// Tooltip za ukupni trošak
const TotalCostTooltip = ({ monthlyPayment, months, refinancingCosts }) => (
  <InfoTooltip 
    title="Ukupni trošak kredita" 
    description={`
      Ukupni trošak uključuje:
      • Sve mjesečne rate: ${formatCurrency(monthlyPayment)} × ${months} mjeseci = ${formatCurrency(monthlyPayment * months)}
      • Troškovi refinanciranja: ${formatCurrency(refinancingCosts)}
      
      Ukupno: ${formatCurrency((monthlyPayment * months) + refinancingCosts)}
    `}
  />
)

const AMORTIZATION_DESCRIPTION = `Amortizacijski plan prikazuje detaljan raspored otplate kredita kroz vrijeme. 
Svaki redak pokazuje:
- Datum dospijeća rate
- Iznos rate
- Dio rate koji ide na glavnicu
- Dio rate koji ide na kamate
- Preostali saldo kredita

Koristan je za razumijevanje kako se kredit otplaćuje i koliko ukupno plaćate kroz godine.`

const CUMULATIVE_SAVINGS_DESCRIPTION = `Grafikon kumulativne uštede uspoređuje:
- Ukupne troškove trenutnog kredita
- Ukupne troškove refinanciranog kredita
- Uštedu kroz godine

Pozitivna kumulativna ušteda znači da refinanciranje donosi financijske prednosti. 
Što je veći zeleni stupac (ušteda), to je refinanciranje povoljnije.`

// Vlastita slider komponenta
const CustomSlider = ({ 
  min = 0.3, 
  max = 30, 
  step = 0.1, 
  value, 
  onChange, 
  onChangeStart, 
  onChangeEnd, 
  label = 'Trajanje kredita',
  description = 'Odaberite željeno trajanje novog kredita'
}) => {
  return (
    <div className="mb-6">
      <div className="flex justify-between items-center mb-2">
        <label className="block text-sm font-medium text-gray-700">
          {label}
        </label>
        <span className="text-sm text-gray-500">
          {value} god.
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        onMouseDown={onChangeStart}
        onMouseUp={onChangeEnd}
        className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
      />
      <p className="mt-1 text-sm text-gray-500">
        {description}
      </p>
    </div>
  )
}

function App() {
  const [currentLoan, setCurrentLoan] = useState({
    remainingDebt: '',
    interestRate: '',
    repaymentTerm: '', // Sad je u mjesecima
    monthlyPayment: '',
    displayYears: ''
  })

  const [refinancingOptions, setRefinancingOptions] = useState([])
  const [bestOption, setBestOption] = useState(null)
  const [cumulativeSavingsData, setCumulativeSavingsData] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [desiredLoanTerm, setDesiredLoanTerm] = useState(10)
  const [amortizationData, setAmortizationData] = useState([])
  const [selectedBank, setSelectedBank] = useState(null);

  const [customOption, setCustomOption] = useState({
    bank: '',
    interestRate: ''
  });

  const [isSliderActive, setIsSliderActive] = useState(false);

  const handleCustomOptionChange = (e) => {
    const { name, value } = e.target;
    setCustomOption(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleLoanTermChange = (value) => {
    // Pretvaranje godina u mjesece za interno čuvanje
    const termMonths = Math.round(value * 12);
    
    setCurrentLoan(prev => ({
      ...prev,
      repaymentTerm: termMonths,
      displayYears: value // Čuvanje izvornog unosa godina
    }));
    
    // Ažuriranje željenog roka otplate za refinanciranje
    setDesiredLoanTerm(value);
  };

  const handleSliderStart = () => {
    setIsSliderActive(true);
  };

  const handleSliderEnd = () => {
    setIsSliderActive(false);
    calculateSavings();
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    
    // Za sva polja dozvoli unos brojeva i prazno polje
    if (value === '' || !isNaN(Number(value))) {
      let updates = {};

      // Specijalni tretman za rok otplate - pretvaranje godina u mjesece
      if (name === 'repaymentTerm') {
        updates = {
          [name]: value * 12, // Pretvaranje godina u mjesece
          displayYears: value // Čuvanje izvornog unosa godina
        };
        
        // Ažuriranje željenog roka otplate
        setDesiredLoanTerm(Number(value));
      } else {
        updates = { [name]: value };
      }

      setCurrentLoan(prev => {
        const newState = { ...prev, ...updates };

        // Automatski izračunaj mjesečnu ratu ako imamo sve potrebne podatke
        if (newState.remainingDebt && newState.interestRate && newState.repaymentTerm) {
          const calculatedMonthlyPayment = calculateMonthlyPayment(
            Number(newState.remainingDebt),
            Number(newState.interestRate),
            Number(newState.repaymentTerm)
          );
          newState.monthlyPayment = calculatedMonthlyPayment.toFixed(2);
        }

        return newState;
      });
    }
  }

  useEffect(() => {
    // Izračunaj opcije refinanciranja samo ako imamo sve potrebne podatke i slider nije aktivan
    if (!isSliderActive && currentLoan.remainingDebt && currentLoan.monthlyPayment && currentLoan.repaymentTerm) {
      calculateSavings()
    }
  }, [currentLoan.remainingDebt, currentLoan.monthlyPayment, currentLoan.repaymentTerm, desiredLoanTerm, isSliderActive])

  const calculateSavings = useCallback(() => {
    if (!currentLoan.monthlyPayment || !currentLoan.remainingDebt) return;

    // Pretvaranje godina u mjesece
    const desiredLoanTermMonths = Math.round(desiredLoanTerm * 12);

    console.log('Calculating savings with:', {
      currentLoan,
      desiredLoanTerm,
      desiredLoanTermMonths,
      customOption
    });

    const updatedOptions = generateRefinancingOptions(
      currentLoan, 
      desiredLoanTermMonths,
      customOption.bank && customOption.interestRate ? customOption : null
    );

    console.log('Raw options:', updatedOptions);

    const processedOptions = updatedOptions.map(option => {
      // Koristimo rate iz loanCosts objekata
      const currentMonthlyPayment = option.currentLoanCosts.monthlyPayment;
      const newMonthlyPayment = option.newLoanCosts.monthlyPayment;

      // Koristimo totalCost iz loanCalculator.js
      const currentTotalCost = option.currentLoanCosts.totalCost;
      const newTotalCost = option.newLoanCosts.totalCost;
      const totalSavings = currentTotalCost - newTotalCost;

      // Precizniji izračun mjesečne uštede
      const monthlyNetSavings = currentMonthlyPayment - newMonthlyPayment;

      // Detaljniji izračun break-even točke
      const breakEvenPoint = monthlyNetSavings > 0 
        ? Math.ceil(500 / monthlyNetSavings) // Pretpostavljeni trošak refinanciranja 500€
        : null;

      const optionDetails = {
        ...option,
        totalSavings,
        monthlyNetSavings,
        breakEvenPoint,
        savingsPercentage: (totalSavings / currentTotalCost) * 100
      };

      // Detaljni konzolni log
      console.log(`Detalji refinanciranja za ${option.bank}:`, {
        preostaliDug: Number(currentLoan.remainingDebt).toFixed(2) + '€',
        mjesečnaRata: {
          trenutna: currentMonthlyPayment.toFixed(2) + '€',
          nova: newMonthlyPayment.toFixed(2) + '€',
          ušteda: monthlyNetSavings.toFixed(2) + '€'
        },
        ukupniTrošak: {
          trenutni: currentTotalCost.toFixed(2) + '€',
          novi: newTotalCost.toFixed(2) + '€'
        },
        ukupnaUšteda: totalSavings.toFixed(2) + '€',
        postotakUštede: optionDetails.savingsPercentage.toFixed(2) + '%'
      });

      return optionDetails;
    });

    // Sortiramo opcije po ukupnoj uštedi/trošku (od najbolje do najlošije)
    const sortedOptions = processedOptions.sort((a, b) => b.totalSavings - a.totalSavings);
    console.log('Sorted options:', sortedOptions);
    console.log('Refinancing Options:', sortedOptions.map(option => option.bank));

    // Najbolja opcija je prva nakon sortiranja
    const best = sortedOptions.length > 0 ? sortedOptions[0] : null;
    console.log('Best option:', best);

    // Izračun kumulativne uštede za najbolju opciju
    const cumulativeSavings = best 
      ? calculateCumulativeSavings(currentLoan, best)
      : [];

    setRefinancingOptions(sortedOptions);
    setBestOption(best);
    setCumulativeSavingsData(cumulativeSavings);
  }, [currentLoan, desiredLoanTerm, customOption]);

  // Izračun kumulativne uštede
  const calculateCumulativeSavings = (currentLoan, option) => {
    const currentPrincipal = Number(currentLoan.remainingDebt);
    const currentInterestRate = Number(currentLoan.interestRate);
    const currentTermMonths = Number(currentLoan.repaymentTerm);

    const currentTotalCost = calculateLoanCosts(
      currentPrincipal, 
      currentInterestRate, 
      currentTermMonths
    );

    const newTotalCost = calculateLoanCosts(
      currentPrincipal, 
      option.interestRate, 
      currentTermMonths
    );

    const cumulativeSavingsData = Array.from({length: Math.ceil(currentTermMonths/12)}, (_, index) => ({
      year: index + 1,
      'Trenutni kredit': currentTotalCost.totalCost,
      'Refinanciranje': newTotalCost.totalCost,
      'Kumulativna ušteda': currentTotalCost.totalCost - newTotalCost.totalCost
    }));

    console.log('Cumulative Savings Data:', cumulativeSavingsData);

    return cumulativeSavingsData;
  }

  const generateRefinancingRecommendation = () => {
    if (!bestOption || !currentLoan.monthlyPayment) return null;

    const formattedSavings = new Intl.NumberFormat('hr-HR', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(bestOption.totalSavings);

    return (
      <div className="bg-green-50 border-l-4 border-green-500 p-4 mb-6">
        <div className="flex">
          <div className="flex-shrink-0">
            <FaCheckCircle className="h-5 w-5 text-green-500" />
          </div>
          <div className="ml-3">
            <p className="text-sm leading-5 text-green-700">
              <span className="font-medium">Preporuka</span>
            </p>
            <p className="mt-2 text-sm leading-5 text-green-700">
              {bestOption.totalSavings > 0 ? (
                <>
                  Preporučujemo refinanciranje kroz {bestOption.bank}. 
                  Uštedjet ćete {formatCurrency(bestOption.totalSavings)} kroz novi period otplate od {(desiredLoanTerm).toFixed(1)} godina.
                </>
              ) : (
                <>
                  Refinanciranje kroz {bestOption.bank} s periodom otplate od {(desiredLoanTerm).toFixed(1)} godina 
                  rezultirat će većim ukupnim troškom od {formatCurrency(Math.abs(bestOption.totalSavings))}, 
                  ali će mjesečna rata biti manja za {formatCurrency(Math.abs(bestOption.monthlyNetSavings))}.
                  <RefinancingCostsTooltip costsDescription={bestOption.costsDescription} />
                </>
              )}
            </p>
          </div>
        </div>
      </div>
    );
  }

  const recommendation = generateRefinancingRecommendation();

  useEffect(() => {
    setIsLoading(false)
  }, [])

  useEffect(() => {
    // Dodaj useEffect za praćenje promjena na slideru
    // Pozovi calculateSavings kada se desiredLoanTerm promijeni
    if (currentLoan.remainingDebt && currentLoan.repaymentTerm) {
      calculateSavings()
    }
  }, [calculateSavings, currentLoan.remainingDebt, currentLoan.monthlyPayment, currentLoan.repaymentTerm, desiredLoanTerm])

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6 text-center text-primary">
        Kalkulator Refinanciranja Kredita
      </h1>

      {/* Unos podataka trenutnog kredita */}
      <div className="bg-white p-6 rounded-lg shadow mb-6">
        <h2 className="text-xl font-semibold mb-4 text-primary flex items-center">
          <FaCalculator className="mr-3" /> Podaci o trenutnom kreditu
        </h2>
        <div className="grid md:grid-cols-4 gap-4">
          <div>
            <label className="block mb-2">Preostali dug (€)</label>
            <input 
              type="number" 
              name="remainingDebt"
              value={currentLoan.remainingDebt}
              onChange={handleInputChange}
              className="w-full p-2 border rounded"
              placeholder="Npr. 10000"
            />
          </div>
          <div>
            <label className="block mb-2">Kamatna stopa (%)</label>
            <input 
              type="number" 
              name="interestRate"
              value={currentLoan.interestRate}
              onChange={handleInputChange}
              className="w-full p-2 border rounded"
              placeholder="Npr. 5.5"
              step="0.1"
            />
          </div>
          <div>
            <label className="block mb-2">Rok otplate (godine)</label>
            <input 
              type="number" 
              name="repaymentTerm"
              value={currentLoan.displayYears || ''}
              onChange={handleInputChange}
              className="w-full p-2 border rounded"
              placeholder="Npr. 10"
            />
            {currentLoan.repaymentTerm && (
              <p className="text-sm text-gray-500 mt-1">
                {currentLoan.repaymentTerm / 12} godina = {currentLoan.repaymentTerm} mjeseci
              </p>
            )}
          </div>
          <div>
            <label className="block mb-2">Mjesečna rata (€)</label>
            <input 
              type="number" 
              name="monthlyPayment"
              value={currentLoan.monthlyPayment}
              onChange={handleInputChange}
              className="w-full p-2 border rounded"
              placeholder="Npr. 100"
              min="10"
            />
          </div>
        </div>
      </div>

      {/* Novi custom slider */}
      <CustomSlider 
        min={0.5}
        max={30}
        step={0.1}
        value={currentLoan.displayYears || desiredLoanTerm}
        onChange={handleLoanTermChange}
        onChangeStart={handleSliderStart}
        onChangeEnd={handleSliderEnd}
        label="Željeno trajanje novog kredita"
        description="Odaberite željeno trajanje kredita. Možete odabrati od 4 mjeseca do 30 godina."
      />

      {/* Forma za vlastitu opciju */}
      <div className="bg-blue-50 p-4 rounded-lg mb-6">
        <h3 className="text-lg font-semibold mb-3">Dodaj vlastitu opciju</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Naziv banke
            </label>
            <input
              type="text"
              name="bank"
              value={customOption.bank}
              onChange={handleCustomOptionChange}
              placeholder="Npr. Moja banka"
              className="w-full p-2 border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Kamatna stopa (%)
            </label>
            <input
              type="number"
              name="interestRate"
              value={customOption.interestRate}
              onChange={handleCustomOptionChange}
              placeholder="Npr. 4.5"
              step="0.1"
              min="0"
              className="w-full p-2 border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Pregled opcija refinanciranja */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-xl font-semibold mb-4 text-primary">
          Opcije Refinanciranja
        </h2>
        
        {isLoading ? (
          <p className="text-gray-500 text-center">
            Učitavanje podataka...
          </p>
        ) : bestOption ? (
          <div className="grid md:grid-cols-3 gap-4">
            {refinancingOptions.map((option, index) => (
              <div 
                key={index} 
                className={`p-4 border rounded-lg cursor-pointer ${
                  bestOption === option ? 'bg-green-50 border-green-300' : 'hover:bg-gray-50'
                } ${
                  selectedBank === option.bank ? 'bg-blue-100 border-blue-300' : ''
                }`}
                onClick={() => {
                  const selectedBankDetails = bankRates.find(bank => 
                    bank.bank.toLowerCase().includes(option.bank.toLowerCase()) || 
                    option.bank.toLowerCase().includes(bank.bank.toLowerCase())
                  );
                  
                  if (!selectedBankDetails) {
                    console.error('Bank not found:', option.bank);
                    return;
                  }
                  
                  console.log('Selected Bank Details:', selectedBankDetails);
                  
                  // Generiranje amortizacijskog plana za odabranu banku
                  const currentPrincipal = Number(currentLoan.remainingDebt);
                  const currentInterestRate = Number(currentLoan.interestRate);
                  const currentTermMonths = Number(currentLoan.repaymentTerm);
                  const newInterestRate = Number(option.interestRate);

                  const amortizationData = generateAmortizationSchedule(
                    currentPrincipal, 
                    newInterestRate, 
                    currentTermMonths
                  );

                  console.log('Amortization Schedule Parameters:', {
                    principal: currentPrincipal,
                    interestRate: newInterestRate,
                    termMonths: currentTermMonths
                  });
                  console.log('Generated Amortization Data:', amortizationData);

                  // Generiranje kumulativne uštede
                  const currentTotalCost = calculateLoanCosts(
                    currentPrincipal, 
                    currentInterestRate, 
                    currentTermMonths
                  );

                  const newTotalCost = calculateLoanCosts(
                    currentPrincipal, 
                    newInterestRate, 
                    currentTermMonths
                  );

                  const cumulativeSavingsData = Array.from({length: Math.ceil(currentTermMonths/12)}, (_, index) => ({
                    year: index + 1,
                    'Trenutni kredit': currentTotalCost.totalCost,
                    'Refinanciranje': newTotalCost.totalCost,
                    'Kumulativna ušteda': currentTotalCost.totalCost - newTotalCost.totalCost
                  }));

                  console.log('Cumulative Savings Data:', cumulativeSavingsData);

                  setAmortizationData(amortizationData);
                  setCumulativeSavingsData(cumulativeSavingsData);
                  setSelectedBank(option.bank);
                }}
              >
                {/* Postojeći sadržaj kartice */}
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold text-primary">
                    {option.bank}
                  </h3>
                  <span className="text-sm text-gray-600">
                    Kamatna stopa: {option.interestRate}%
                  </span>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span>Nova mjesečna rata:</span>
                    <strong className="text-green-600">{formatCurrency(option.monthlyPayment)}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Ukupni trošak:</span>
                    <strong className={option.totalSavings > 0 ? 'text-green-600' : 'text-red-600'}>
                      {formatCurrency(option.newLoanCosts.totalCost)}
                    </strong>
                    <TotalCostTooltip 
                      monthlyPayment={option.monthlyPayment} 
                      months={Math.round(desiredLoanTerm * 12)} 
                      refinancingCosts={500} 
                    />
                  </div>
                  <div className="flex justify-between">
                    <span>{option.totalSavings > 0 ? 'Ukupna ušteda:' : 'Dodatni trošak:'}</span>
                    <strong className={option.totalSavings > 0 ? 'text-green-600' : 'text-red-600'}>
                      {formatCurrency(Math.abs(option.totalSavings))}
                    </strong>
                  </div>
                </div>

                <div className="mt-4">
                  <div className="flex justify-between items-center mb-2">
                    <div className="text-gray-700">
                      <div className="flex items-center space-x-4">
                        <div>
                          <div className="text-sm text-gray-500">Trenutna rata</div>
                          <div className="font-medium">{formatCurrency(option.currentLoanCosts.monthlyPayment)}</div>
                        </div>
                        <div className="text-gray-400">→</div>
                        <div>
                          <div className="text-sm text-gray-500">Nova rata</div>
                          <div className="font-medium">{formatCurrency(option.monthlyPayment)}</div>
                        </div>
                      </div>
                      <div className="text-sm mt-2">
                        {option.monthlyPayment < option.currentLoanCosts.monthlyPayment && (
                          <span className="text-green-600">
                            Mjesečna ušteda: {formatCurrency(option.currentLoanCosts.monthlyPayment - option.monthlyPayment)}
                          </span>
                        )}
                        {option.monthlyPayment > option.currentLoanCosts.monthlyPayment && (
                          <span className="text-red-600">
                            Mjesečno povećanje: {formatCurrency(option.monthlyPayment - option.currentLoanCosts.monthlyPayment)}
                          </span>
                        )}
                        {option.monthlyPayment === option.currentLoanCosts.monthlyPayment && (
                          <span className="text-gray-600">
                            Rata ostaje ista
                          </span>
                        )}
                      </div>
                    </div>
                    {option === bestOption ? (
                      <FaCheckCircle className={`text-xl ${option.totalSavings > 0 ? 'text-green-500' : 'text-yellow-500'}`} />
                    ) : (
                      <FaTimesCircle className="text-gray-400 text-xl" />
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-500 text-center">
            Unesite podatke o trenutnom kreditu za izračun
          </p>
        )}

        {bestOption && (
          <div className="mt-6 bg-blue-50 p-4 rounded-lg">
            <div className="flex">
              <div className="flex-shrink-0">
                <FaCheckCircle className={`text-xl ${bestOption.totalSavings > 0 ? 'text-green-500' : 'text-yellow-500'}`} />
              </div>
              <div className="ml-3">
                <h3 className="font-bold text-blue-800 mb-2">
                  Preporuka
                </h3>
                <p className="text-blue-700">
                  {bestOption.totalSavings > 0 ? (
                    <>
                      Preporučujemo refinanciranje kroz {bestOption.bank}. 
                      Uštedjet ćete {formatCurrency(bestOption.totalSavings)} kroz novi period otplate od {(desiredLoanTerm).toFixed(1)} godina.
                    </>
                  ) : (
                    <>
                      Refinanciranje kroz {bestOption.bank} s periodom otplate od {(desiredLoanTerm).toFixed(1)} godina 
                      rezultirat će većim ukupnim troškom od {formatCurrency(Math.abs(bestOption.totalSavings))}, 
                      ali će mjesečna rata biti manja za {formatCurrency(Math.abs(bestOption.monthlyNetSavings))}.
                      <RefinancingCostsTooltip costsDescription={bestOption.costsDescription} />
                    </>
                  )}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Grafovi */}
      {bestOption && (
        <div className="grid md:grid-cols-2 gap-6 mt-6">
          {/* Graf otplate */}
          {amortizationData && amortizationData.length > 0 ? (
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-xl font-semibold mb-4 text-primary">
                Amortizacijski Plan
                <InfoTooltip title="Amortizacijski Plan" description={AMORTIZATION_DESCRIPTION} />
              </h3>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={amortizationData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="month" 
                    label={{ value: 'Mjesec', position: 'insideBottom', offset: -5 }}
                  />
                  <YAxis 
                    label={{ 
                      value: 'Preostali Dug (€)', 
                      angle: -90, 
                      position: 'insideLeft' 
                    }}
                  />
                  <Tooltip 
                    formatter={(value, name) => [
                      `€${value.toFixed(2)}`, 
                      name
                    ]}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="remainingBalance" 
                    stroke="#3B82F6" 
                    strokeWidth={2}
                    name="Preostali Dug"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="text-center text-gray-500 my-4">
              <p>Nema dovoljno podataka za prikaz amortizacijskog plana.</p>
            </div>
          )}

          {/* Graf uštede */}
          {cumulativeSavingsData && cumulativeSavingsData.length > 0 ? (
            <div className="w-full h-[300px]">
              <h3 className="text-lg font-bold mb-4">Kumulativna ušteda kroz godine
                <InfoTooltip title="Kumulativna ušteda" description={CUMULATIVE_SAVINGS_DESCRIPTION} />
              </h3>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={cumulativeSavingsData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="year" 
                    label={{ value: 'Godina', position: 'insideBottom', offset: -5 }}
                  />
                  <YAxis 
                    label={{ value: '€', angle: -90, position: 'insideLeft' }}
                    tickFormatter={(value) => `€${value.toFixed(2)}`}
                  />
                  <Tooltip 
                    formatter={(value, name) => [
                      `€${value.toFixed(2)}`, 
                      name === 'Kumulativna ušteda' ? 'Ušteda' : name
                    ]}
                  />
                  <Legend />
                  <Bar dataKey="Trenutni kredit" fill="#8884d8" />
                  <Bar dataKey="Refinanciranje" fill="#82ca9d" />
                  <Bar dataKey="Kumulativna ušteda" fill="#ffc658" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="text-center text-gray-500 my-4">
              <p>Nema dovoljno podataka za prikaz kumulativne uštede.</p>
              <p>Molimo unesite sve potrebne parametre kredita.</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default App
