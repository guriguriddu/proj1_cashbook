'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Screen, ScreenBody, T, BottomSheet, PrimaryButton } from '@/components/ui';
import { getInvestSettings, saveInvestSettings, getCategoryBudgetForMonth, getCurrentMonth } from '@/lib/supabase-storage';
import { useBudget, useGoalSettings } from '@/hooks/useSupabaseData';

// ─── 세금 상수 ───────────────────────────────────────────────────────────────

const INCOME_TAX_BRACKETS = [
  { limit: 14_000_000, rate: 0.06, deduction: 0 },
  { limit: 50_000_000, rate: 0.15, deduction: 1_260_000 },
  { limit: 88_000_000, rate: 0.24, deduction: 5_760_000 },
  { limit: 150_000_000, rate: 0.35, deduction: 15_440_000 },
  { limit: 300_000_000, rate: 0.38, deduction: 19_940_000 },
  { limit: 500_000_000, rate: 0.40, deduction: 25_940_000 },
  { limit: 1_000_000_000, rate: 0.42, deduction: 35_940_000 },
  { limit: Infinity, rate: 0.45, deduction: 65_940_000 },
];

function calcIncomeTax(taxable: number): number {
  for (const b of INCOME_TAX_BRACKETS) {
    if (taxable <= b.limit) return Math.max(0, taxable * b.rate - b.deduction);
  }
  return 0;
}

function calcLocalTax(incomeTax: number): number {
  return incomeTax * 0.1;
}

const HEALTH_INS_RATE = 0.0709;
const HEALTH_INS_LONG_CARE = 0.1295;

interface TaxResult {
  grossDividend: number;
  withheld: number;
  isComprehensive: boolean;
  comprehensiveTax: number;
  localTax: number;
  healthIns: number;
  netDividend: number;
  effectiveRate: number;
  losePidayang: boolean;
}

function calcDividendTax(params: {
  grossDividend: number;
  otherFinancialIncome: number;
  laborIncome: number;
  isDomestic: boolean;
  isHealthInsured: boolean;
  isPidayang: boolean;
}): TaxResult {
  const { grossDividend, otherFinancialIncome, laborIncome, isDomestic, isHealthInsured, isPidayang } = params;
  const withholdRate = isDomestic ? 0.154 : 0.15;
  const withheld = Math.floor(grossDividend * withholdRate);
  const totalFinancial = grossDividend + otherFinancialIncome;
  const COMPREHENSIVE_THRESHOLD = 20_000_000;

  let comprehensiveTax = 0;
  let localTax = 0;

  if (totalFinancial > COMPREHENSIVE_THRESHOLD) {
    const excessFinancial = totalFinancial - COMPREHENSIVE_THRESHOLD;
    const separateTax = COMPREHENSIVE_THRESHOLD * 0.14;
    const totalTaxable = laborIncome + excessFinancial;
    const comprehensiveTotal = calcIncomeTax(totalTaxable);
    const laborOnly = calcIncomeTax(laborIncome);
    const additionalComprehensive = comprehensiveTotal - laborOnly;
    const alreadyWithheld14 = separateTax + COMPREHENSIVE_THRESHOLD * 0 + excessFinancial * 0.14;
    comprehensiveTax = Math.max(0, additionalComprehensive - (alreadyWithheld14 - separateTax));
    localTax = calcLocalTax(comprehensiveTax);
  }

  const losePidayang = isPidayang && totalFinancial > 10_000_000;
  let healthIns = 0;
  if (isHealthInsured && !isPidayang) {
    if (totalFinancial > COMPREHENSIVE_THRESHOLD) {
      const excessForHealth = totalFinancial - COMPREHENSIVE_THRESHOLD;
      const healthBase = excessForHealth * HEALTH_INS_RATE;
      healthIns = Math.floor(healthBase * (1 + HEALTH_INS_LONG_CARE));
    }
  } else if (losePidayang) {
    const healthBase = totalFinancial * HEALTH_INS_RATE;
    healthIns = Math.floor(healthBase * (1 + HEALTH_INS_LONG_CARE));
  }

  const totalTax = withheld + comprehensiveTax + localTax + healthIns;
  const netDividend = grossDividend - totalTax;
  const effectiveRate = grossDividend > 0 ? totalTax / grossDividend : 0;

  return {
    grossDividend, withheld,
    isComprehensive: totalFinancial > COMPREHENSIVE_THRESHOLD,
    comprehensiveTax, localTax, healthIns,
    netDividend, effectiveRate, losePidayang,
  };
}

interface CapGainResult {
  gain: number;
  transactionTax: number;
  isTaxExempt: boolean;
  deduction: number;
  taxable: number;
  tax: number;
  net: number;
  effectiveRate: number;
}

function calcCapitalGainTax(params: {
  gain: number;
  salePrice: number;
  isDomestic: boolean;
  isMajorShareholder: boolean;
  market: 'kospi' | 'kosdaq' | 'overseas';
}): CapGainResult {
  const { gain, salePrice, isDomestic, isMajorShareholder, market } = params;
  // 증권거래세(농특세 포함): 2025년부터 코스피·코스닥 모두 0.15%. 해외는 없음.
  const txTaxRate = market === 'kospi' ? 0.0015 : market === 'kosdaq' ? 0.0015 : 0;
  const transactionTax = Math.floor(salePrice * txTaxRate);

  if (isDomestic && !isMajorShareholder) {
    return { gain, transactionTax, isTaxExempt: true, deduction: 0, taxable: 0, tax: 0, net: gain - transactionTax, effectiveRate: 0 };
  }

  let tax = 0;
  let deduction = 0;

  if (isDomestic && isMajorShareholder) {
    const BRACKET = 300_000_000;
    if (gain <= BRACKET) {
      tax = Math.floor(gain * 0.22);
    } else {
      tax = Math.floor(BRACKET * 0.22 + (gain - BRACKET) * 0.275);
    }
  } else {
    deduction = Math.min(2_500_000, gain);
    const taxable = Math.max(0, gain - 2_500_000);
    tax = Math.floor(taxable * 0.22);
  }

  const taxable = Math.max(0, gain - deduction);
  const net = gain - tax - transactionTax;
  const totalOut = tax + transactionTax;
  const effectiveRate = gain > 0 ? totalOut / gain : 0;
  return { gain, transactionTax, isTaxExempt: false, deduction, taxable, tax, net, effectiveRate };
}

function formatWon(n: number): string {
  const abs = Math.abs(Math.floor(n));
  if (abs >= 100_000_000) {
    const eok = Math.floor(abs / 100_000_000);
    const man = Math.floor((abs % 100_000_000) / 10_000);
    return man > 0 ? `${eok}억 ${man.toLocaleString()}만원` : `${eok}억원`;
  }
  if (abs >= 10_000) return `${Math.floor(abs / 10_000).toLocaleString()}만원`;
  return `${abs.toLocaleString()}원`;
}

function fmtPct(r: number): string {
  return (r * 100).toFixed(1) + '%';
}

function solveMonthlyRate(pv: number, pmt: number, fv: number, n: number): number {
  if (n <= 0) return 0;
  if (fv <= pv + pmt * n) return 0;
  let lo = 1e-8, hi = 1.0;
  for (let i = 0; i < 100; i++) {
    const mid = (lo + hi) / 2;
    const factor = Math.pow(1 + mid, n);
    const calc = pv * factor + (pmt * (factor - 1)) / mid;
    if (calc < fv) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}

// ─── 연말정산 계산 ────────────────────────────────────────────────────────────

interface YearendInputs {
  totalSalary: number;
  creditCard: number;
  checkCard: number;
  traditional: number;
  transit: number;
}

function calcYearendDeduction(inputs: YearendInputs) {
  const { totalSalary, creditCard, checkCard, traditional, transit } = inputs;
  const threshold = Math.floor(totalSalary * 0.25);

  // 신용카드로 threshold 먼저 소진
  const creditAfterThreshold = Math.max(0, creditCard - threshold);
  const remainingThreshold = Math.max(0, threshold - creditCard);
  const checkAfterThreshold = Math.max(0, checkCard - remainingThreshold);

  const creditDeduction = Math.floor(creditAfterThreshold * 0.15);
  const checkDeduction = Math.floor(checkAfterThreshold * 0.30);
  const traditionalDeduction = Math.floor(traditional * 0.40);
  const transitDeduction = Math.floor(transit * 0.40);

  const baseLimit = totalSalary <= 70_000_000 ? 3_000_000 : totalSalary <= 120_000_000 ? 2_500_000 : 2_000_000;
  const baseDeduction = Math.min(creditDeduction + checkDeduction, baseLimit);
  const extraTraditional = Math.min(traditionalDeduction, 1_000_000);
  const extraTransit = Math.min(transitDeduction, 1_000_000);
  const totalDeduction = baseDeduction + extraTraditional + extraTransit;

  return {
    threshold, creditDeduction, checkDeduction,
    traditionalDeduction, transitDeduction,
    baseLimit, baseDeduction, extraTraditional, extraTransit,
    totalDeduction, remainingThreshold,
  };
}

// ─── 타입 ────────────────────────────────────────────────────────────────────

type Tab = 'simulation' | 'tax' | 'yearend';
type SimMode = 'forward' | 'goal';
type TaxType = 'quick' | 'dividend' | 'capital';

// ─── 메인 페이지 ─────────────────────────────────────────────────────────────

export default function InvestPage() {
  const router = useRouter();

  const [investSettings, setInvestSettings] = useState({
    annualSalary: 0,
    bonusIncome: 0,
    useCustomSalary: true,
  });
  const [salarySheetOpen, setSalarySheetOpen] = useState(false);

  useEffect(() => {
    getInvestSettings().then(s => {
      setInvestSettings({ ...s, useCustomSalary: true });
    });
  }, []);

  const laborIncome = investSettings.annualSalary + investSettings.bonusIncome;

  // 탭/모드 상태 (URL 파라미터에서 초기화)
  const [tab, setTab] = useState<Tab>(() => {
    if (typeof window !== 'undefined') {
      const t = new URLSearchParams(window.location.search).get('tab');
      if (t === 'dividend' || t === 'capital') return 'tax';
    }
    return 'simulation';
  });

  const [simMode, setSimMode] = useState<SimMode>(() => {
    if (typeof window !== 'undefined') {
      const t = new URLSearchParams(window.location.search).get('tab');
      if (t === 'goal') return 'goal';
    }
    return 'forward';
  });

  const [taxType, setTaxType] = useState<TaxType>(() => {
    if (typeof window !== 'undefined') {
      const t = new URLSearchParams(window.location.search).get('tab');
      if (t === 'capital') return 'capital';
      if (t === 'quick') return 'quick';
    }
    return 'quick';
  });

  // 국장/미장 빠른 세금 계산
  const [quickInputs, setQuickInputs] = useState({
    krDividend: 0,
    usGain: 0,
    usDividend: 0,
  });

  // 연말정산 계산기
  const [yearendInputs, setYearendInputs] = useState<YearendInputs>({
    totalSalary: 0,
    creditCard: 0,
    checkCard: 0,
    traditional: 0,
    transit: 0,
  });

  // 배당 계산기 입력값
  const [divInputs, setDivInputs] = useState({
    grossDividend: 5_000_000,
    otherFinancialIncome: 0,
    isDomestic: false,
    isHealthInsured: true,
    isPidayang: false,
  });

  // 양도소득세 계산기
  const [capInputs, setCapInputs] = useState({
    gain: 10_000_000,
    salePrice: 50_000_000,
    isDomestic: false,
    isMajorShareholder: false,
    market: 'overseas' as 'kospi' | 'kosdaq' | 'overseas',
  });

  // 투자 시뮬레이션 입력값
  const [simInputs, setSimInputs] = useState({
    principal: 10_000_000,
    monthlyAdd: 500_000,
    annualReturn: 7,
    years: 10,
    dividendYield: 3,
    isDomestic: false,
    isHealthInsured: true,
    isPidayang: false,
  });

  const [editingField, setEditingField] = useState<string | null>(null);

  // 국장/미장 빠른 계산
  const quickResult = (() => {
    const krDividendTax = Math.floor(quickInputs.krDividend * 0.154);
    const usGainTaxable = Math.max(0, quickInputs.usGain - 2_500_000);
    const usGainTax = Math.floor(usGainTaxable * 0.22);
    const usDividendTax = Math.floor(quickInputs.usDividend * 0.15);
    const total = krDividendTax + usGainTax + usDividendTax;
    const netGain = quickInputs.usGain - usGainTax;
    const netDividend = (quickInputs.krDividend + quickInputs.usDividend) - krDividendTax - usDividendTax;
    return { krDividendTax, usGainTaxable, usGainTax, usDividendTax, total, netGain, netDividend };
  })();

  const yearendResult = calcYearendDeduction(
    yearendInputs.totalSalary > 0 ? yearendInputs : { ...yearendInputs, totalSalary: laborIncome }
  );
  const effectiveSalary = yearendInputs.totalSalary > 0 ? yearendInputs.totalSalary : laborIncome;

  // 계산
  const divResult = calcDividendTax({ ...divInputs, laborIncome });
  const capResult = calcCapitalGainTax(capInputs);

  const simResult = (() => {
    const { principal, monthlyAdd, annualReturn, years, dividendYield, isDomestic, isHealthInsured, isPidayang } = simInputs;
    const monthlyRate = annualReturn / 100 / 12;
    const months = years * 12;
    let balance = principal;
    let totalInvested = principal;
    let totalDividendGross = 0;
    let totalDividendNet = 0;

    for (let m = 0; m < months; m++) {
      balance += monthlyAdd;
      totalInvested += monthlyAdd;
      const monthlyDiv = balance * (dividendYield / 100 / 12);
      const divTax = calcDividendTax({ grossDividend: monthlyDiv, otherFinancialIncome: 0, laborIncome, isDomestic, isHealthInsured, isPidayang });
      totalDividendGross += monthlyDiv;
      totalDividendNet += divTax.netDividend;
      balance = balance * (1 + monthlyRate - dividendYield / 100 / 12) + divTax.netDividend;
    }

    const totalCapitalGainGross = Math.max(0, balance - totalInvested);
    const capTax = calcCapitalGainTax({
      gain: totalCapitalGainGross,
      salePrice: balance,
      isDomestic: simInputs.isDomestic,
      isMajorShareholder: false,
      market: simInputs.isDomestic ? 'kospi' : 'overseas',
    });

    const finalBalance = balance - capTax.tax;
    const totalReturn = finalBalance - totalInvested;
    const effectiveAnnualReturn = totalInvested > 0 ? (Math.pow(finalBalance / totalInvested, 1 / years) - 1) * 100 : 0;

    return { totalInvested, finalBalance, totalReturn, totalDividendGross, totalDividendNet, totalCapitalGainGross, capitalGainTax: capTax.tax, effectiveAnnualReturn };
  })();

  const fieldDefs: Record<string, {
    label: string; value: number; unit: string; step: number; min?: number; max?: number;
    set: (v: number) => void; presets?: { value: number; label: string }[];
  }> = {
    grossDividend: {
      label: '연간 배당금 (세전)', value: divInputs.grossDividend, unit: '원', step: 500_000,
      set: (v) => setDivInputs(p => ({ ...p, grossDividend: v })),
      presets: [{ value: 1_000_000, label: '100만' }, { value: 5_000_000, label: '500만' }, { value: 10_000_000, label: '1,000만' }, { value: 20_000_000, label: '2,000만' }],
    },
    otherFinancialIncome: {
      label: '기타 금융소득 (이자 등)', value: divInputs.otherFinancialIncome, unit: '원', step: 500_000,
      set: (v) => setDivInputs(p => ({ ...p, otherFinancialIncome: v })),
      presets: [{ value: 0, label: '없음' }, { value: 1_000_000, label: '100만' }, { value: 5_000_000, label: '500만' }],
    },
    capitalGain: {
      label: '양도차익 (세전·매도가−매수가−거래비용)', value: capInputs.gain, unit: '원', step: 1_000_000,
      set: (v) => setCapInputs(p => ({ ...p, gain: v })),
      presets: [{ value: 2_500_000, label: '250만' }, { value: 5_000_000, label: '500만' }, { value: 10_000_000, label: '1,000만' }, { value: 50_000_000, label: '5,000만' }],
    },
    salePrice: {
      label: '매도금액 (증권거래세 계산용)', value: capInputs.salePrice, unit: '원', step: 1_000_000,
      set: (v) => setCapInputs(p => ({ ...p, salePrice: v })),
      presets: [{ value: 10_000_000, label: '1,000만' }, { value: 30_000_000, label: '3,000만' }, { value: 50_000_000, label: '5,000만' }, { value: 100_000_000, label: '1억' }],
    },
    simPrincipal: {
      label: '초기 투자금', value: simInputs.principal, unit: '원', step: 1_000_000,
      set: (v) => setSimInputs(p => ({ ...p, principal: v })),
      presets: [{ value: 5_000_000, label: '500만' }, { value: 10_000_000, label: '1,000만' }, { value: 30_000_000, label: '3,000만' }, { value: 50_000_000, label: '5,000만' }],
    },
    simMonthlyAdd: {
      label: '월 추가 투자금', value: simInputs.monthlyAdd, unit: '원', step: 100_000,
      set: (v) => setSimInputs(p => ({ ...p, monthlyAdd: v })),
      presets: [{ value: 200_000, label: '20만' }, { value: 500_000, label: '50만' }, { value: 1_000_000, label: '100만' }],
    },
    simAnnualReturn: {
      label: '연간 수익률', value: simInputs.annualReturn, unit: '%', step: 1, min: 0, max: 30,
      set: (v) => setSimInputs(p => ({ ...p, annualReturn: v })),
      presets: [{ value: 5, label: '5%' }, { value: 7, label: '7%' }, { value: 10, label: '10%' }, { value: 12, label: '12%' }],
    },
    simYears: {
      label: '투자 기간', value: simInputs.years, unit: '년', step: 1, min: 1, max: 40,
      set: (v) => setSimInputs(p => ({ ...p, years: v })),
      presets: [{ value: 5, label: '5년' }, { value: 10, label: '10년' }, { value: 20, label: '20년' }, { value: 30, label: '30년' }],
    },
    simDividendYield: {
      label: '배당 수익률', value: simInputs.dividendYield, unit: '%', step: 0.5, min: 0, max: 20,
      set: (v) => setSimInputs(p => ({ ...p, dividendYield: v })),
      presets: [{ value: 0, label: '0%' }, { value: 2, label: '2%' }, { value: 3, label: '3%' }, { value: 5, label: '5%' }],
    },
    krDividend: {
      label: '국장 배당금 (세전)', value: quickInputs.krDividend, unit: '원', step: 500_000,
      set: (v) => setQuickInputs(p => ({ ...p, krDividend: v })),
      presets: [{ value: 0, label: '없음' }, { value: 1_000_000, label: '100만' }, { value: 5_000_000, label: '500만' }, { value: 10_000_000, label: '1,000만' }],
    },
    usGain: {
      label: '미장 양도차익 (매도가−매수가)', value: quickInputs.usGain, unit: '원', step: 1_000_000,
      set: (v) => setQuickInputs(p => ({ ...p, usGain: v })),
      presets: [{ value: 0, label: '없음' }, { value: 2_500_000, label: '250만' }, { value: 5_000_000, label: '500만' }, { value: 10_000_000, label: '1,000만' }],
    },
    usDividend: {
      label: '미장 배당금 (세전)', value: quickInputs.usDividend, unit: '원', step: 500_000,
      set: (v) => setQuickInputs(p => ({ ...p, usDividend: v })),
      presets: [{ value: 0, label: '없음' }, { value: 1_000_000, label: '100만' }, { value: 5_000_000, label: '500만' }, { value: 10_000_000, label: '1,000만' }],
    },
    yearendSalary: {
      label: '연간 총급여 (세전)', value: yearendInputs.totalSalary || laborIncome, unit: '원', step: 1_000_000,
      set: (v) => setYearendInputs(p => ({ ...p, totalSalary: v })),
      presets: [{ value: 30_000_000, label: '3,000만' }, { value: 50_000_000, label: '5,000만' }, { value: 70_000_000, label: '7,000만' }, { value: 100_000_000, label: '1억' }],
    },
    yearendCredit: {
      label: '연간 신용카드 사용액', value: yearendInputs.creditCard, unit: '원', step: 500_000,
      set: (v) => setYearendInputs(p => ({ ...p, creditCard: v })),
      presets: [{ value: 0, label: '없음' }, { value: 5_000_000, label: '500만' }, { value: 10_000_000, label: '1,000만' }, { value: 20_000_000, label: '2,000만' }],
    },
    yearendCheck: {
      label: '연간 체크카드+현금영수증', value: yearendInputs.checkCard, unit: '원', step: 500_000,
      set: (v) => setYearendInputs(p => ({ ...p, checkCard: v })),
      presets: [{ value: 0, label: '없음' }, { value: 3_000_000, label: '300만' }, { value: 5_000_000, label: '500만' }, { value: 10_000_000, label: '1,000만' }],
    },
    yearendTraditional: {
      label: '전통시장 사용액', value: yearendInputs.traditional, unit: '원', step: 100_000,
      set: (v) => setYearendInputs(p => ({ ...p, traditional: v })),
      presets: [{ value: 0, label: '없음' }, { value: 500_000, label: '50만' }, { value: 1_000_000, label: '100만' }, { value: 2_500_000, label: '250만' }],
    },
    yearendTransit: {
      label: '대중교통 사용액', value: yearendInputs.transit, unit: '원', step: 100_000,
      set: (v) => setYearendInputs(p => ({ ...p, transit: v })),
      presets: [{ value: 0, label: '없음' }, { value: 500_000, label: '50만' }, { value: 1_000_000, label: '100만' }, { value: 2_000_000, label: '200만' }],
    },
  };

  const TABS: { id: Tab; label: string }[] = [
    { id: 'simulation', label: '투자 시뮬' },
    { id: 'tax', label: '세금 계산' },
    { id: 'yearend', label: '연말정산' },
  ];

  return (
    <Screen>
      {/* 헤더 */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '60px 20px 8px', position: 'sticky', top: 0, background: T.bg, zIndex: 5,
      }}>
        <span style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em' }}>투자</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* 세전 소득 입력 버튼 */}
          <button
            onClick={() => setSalarySheetOpen(true)}
            style={{
              padding: '6px 12px', borderRadius: 999, border: `1px solid ${laborIncome > 0 ? T.divider : T.warn}`,
              background: laborIncome > 0 ? T.bgMuted : T.warnSoft,
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5,
            }}
          >
            <span style={{ fontSize: 11, fontWeight: 600, color: laborIncome > 0 ? T.textSec : '#92400E' }}>
              세전 소득
            </span>
            <span style={{ fontSize: 12, fontWeight: 700, color: laborIncome > 0 ? T.text : '#92400E', fontVariantNumeric: 'tabular-nums' }}>
              {laborIncome > 0 ? formatWon(laborIncome) : '미입력'}
            </span>
          </button>
          <button
            onClick={() => router.push('/mypage')}
            style={{ width: 36, height: 36, border: 0, background: 'transparent', borderRadius: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
              <circle cx="11" cy="7.5" r="3.5" stroke={T.text} strokeWidth="1.8" />
              <path d="M3.5 18.5c0-3 3.4-5.5 7.5-5.5s7.5 2.5 7.5 5.5" stroke={T.text} strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </div>

      {/* 메인 탭 (2개) */}
      <div style={{ padding: '4px 20px 0', display: 'flex', gap: 0, background: T.bg }}>
        <div style={{ display: 'flex', flex: 1, background: T.bgMuted, borderRadius: 12, padding: 4 }}>
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                flex: 1, padding: '9px 0', borderRadius: 8, border: 0,
                background: tab === t.id ? T.bg : 'transparent',
                color: tab === t.id ? T.text : T.textTer,
                fontSize: 14, fontWeight: tab === t.id ? 700 : 600,
                cursor: 'pointer', letterSpacing: '-0.01em',
                boxShadow: tab === t.id ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
                transition: 'all .15s',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <ScreenBody>
        {/* ── 투자 시뮬 탭 ── */}
        {tab === 'simulation' && (
          <>
            {/* 모드 세그먼트 컨트롤 */}
            <div style={{ padding: '12px 20px 4px' }}>
              <div style={{ display: 'flex', background: T.bgSoft, borderRadius: 10, padding: 3, border: `1px solid ${T.divider}` }}>
                {([
                  { id: 'forward' as SimMode, label: '💰 얼마가 될까' },
                  { id: 'goal' as SimMode, label: '🎯 목표 역산' },
                ] as { id: SimMode; label: string }[]).map(m => (
                  <button
                    key={m.id}
                    onClick={() => setSimMode(m.id)}
                    style={{
                      flex: 1, padding: '9px 0', borderRadius: 7, border: 0,
                      background: simMode === m.id ? T.text : 'transparent',
                      color: simMode === m.id ? '#fff' : T.textSec,
                      fontSize: 13, fontWeight: simMode === m.id ? 700 : 600,
                      cursor: 'pointer', letterSpacing: '-0.01em',
                      transition: 'all .15s',
                    }}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 투자 시뮬 (얼마가 될까) */}
            {simMode === 'forward' && (
              <div style={{ padding: '8px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                <SectionCard title="투자 조건">
                  <InputRow label="초기 투자금" value={formatWon(simInputs.principal)} onTap={() => setEditingField('simPrincipal')} />
                  <InputRow label="월 추가 투자" value={formatWon(simInputs.monthlyAdd)} onTap={() => setEditingField('simMonthlyAdd')} />
                  <InputRow label="연간 수익률" value={`${simInputs.annualReturn}%`} onTap={() => setEditingField('simAnnualReturn')} />
                  <InputRow label="배당 수익률" value={`${simInputs.dividendYield}%`} onTap={() => setEditingField('simDividendYield')} />
                  <InputRow label="투자 기간" value={`${simInputs.years}년`} onTap={() => setEditingField('simYears')} />
                  <ToggleRow label="국내 주식" value={simInputs.isDomestic} onChange={v => setSimInputs(p => ({ ...p, isDomestic: v }))} />
                  <ToggleRow label="직장 건강보험" value={simInputs.isHealthInsured} onChange={v => setSimInputs(p => ({ ...p, isHealthInsured: v }))} />
                  <ToggleRow label="피부양자" value={simInputs.isPidayang} onChange={v => setSimInputs(p => ({ ...p, isPidayang: v }))} noBorder />
                </SectionCard>

                <div style={{ background: T.text, borderRadius: 18, padding: 20 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.6)', marginBottom: 8 }}>
                    {simInputs.years}년 후 세후 평가액
                  </div>
                  <div style={{ fontSize: 32, fontWeight: 800, color: '#fff', letterSpacing: '-0.03em', fontVariantNumeric: 'tabular-nums', marginBottom: 4 }}>
                    {formatWon(simResult.finalBalance)}
                  </div>
                  <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', fontWeight: 500 }}>
                    실질 연평균 수익률 {simResult.effectiveAnnualReturn.toFixed(1)}% (세후)
                  </div>
                </div>

                <SectionCard title="수익 내역">
                  <ResultRow label="총 투자금" value={formatWon(simResult.totalInvested)} />
                  <ResultRow label="총 배당금 (세전)" value={formatWon(simResult.totalDividendGross)} />
                  <ResultRow label="배당세 후 실수령" value={formatWon(simResult.totalDividendNet)} color={T.accent} />
                  <ResultRow label="양도차익" value={formatWon(simResult.totalCapitalGainGross)} />
                  <ResultRow label="양도소득세" value={formatWon(simResult.capitalGainTax)} color={T.danger} />
                  <div style={{ height: 1, background: T.divider, margin: '4px 0' }} />
                  <ResultRow label="세후 총 수익" value={formatWon(simResult.totalReturn)} color={T.accent} big />
                </SectionCard>

                {/* 목표 역산으로 유도 */}
                <button
                  onClick={() => setSimMode('goal')}
                  style={{
                    border: `1px solid ${T.divider}`, background: T.bg, borderRadius: 14, padding: '14px 16px',
                    cursor: 'pointer', width: '100%', textAlign: 'left', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  }}
                >
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: T.text, letterSpacing: '-0.01em', marginBottom: 2 }}>
                      🎯 목표 역산으로 확인
                    </div>
                    <div style={{ fontSize: 12, color: T.textSec, fontWeight: 500 }}>
                      목표 달성을 위해 필요한 수익률 계산
                    </div>
                  </div>
                  <svg width="6" height="10" viewBox="0 0 6 10" fill="none">
                    <path d="M1 1l4 4-4 4" stroke={T.textTer} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>

                <InfoBanner tone="neutral">
                  배당은 매월 재투자하는 것으로 계산해요. 실제 세금은 소득 상황에 따라 달라질 수 있어요.
                </InfoBanner>
              </div>
            )}

            {/* 목표 역산 */}
            {simMode === 'goal' && (
              <GoalReverseSection
                laborIncome={laborIncome}
                onSwitchToSim={() => setSimMode('forward')}
              />
            )}
          </>
        )}

        {/* ── 세금 계산 탭 ── */}
        {tab === 'tax' && (
          <>
            {/* 세금 종류 세그먼트 컨트롤 */}
            <div style={{ padding: '12px 20px 4px' }}>
              <div style={{ display: 'flex', background: T.bgSoft, borderRadius: 10, padding: 3, border: `1px solid ${T.divider}` }}>
                {([
                  { id: 'quick' as TaxType, label: '국장/미장' },
                  { id: 'dividend' as TaxType, label: '배당세' },
                  { id: 'capital' as TaxType, label: '양도소득세' },
                ] as { id: TaxType; label: string }[]).map(m => (
                  <button
                    key={m.id}
                    onClick={() => setTaxType(m.id)}
                    style={{
                      flex: 1, padding: '9px 0', borderRadius: 7, border: 0,
                      background: taxType === m.id ? T.text : 'transparent',
                      color: taxType === m.id ? '#fff' : T.textSec,
                      fontSize: 12, fontWeight: taxType === m.id ? 700 : 600,
                      cursor: 'pointer', letterSpacing: '-0.01em',
                      transition: 'all .15s',
                    }}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 국장/미장 빠른 세금 */}
            {taxType === 'quick' && (
              <div style={{ padding: '8px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                <SectionCard title="국장 (코스피·코스닥·ETF)">
                  <InputRow label="배당금 (세전)" value={formatWon(quickInputs.krDividend)} onTap={() => setEditingField('krDividend')} noBorder />
                </SectionCard>

                <SectionCard title="미장 (미국·해외)">
                  <InputRow label="양도차익 (매도가 − 매수가)" value={formatWon(quickInputs.usGain)} onTap={() => setEditingField('usGain')} />
                  <InputRow label="배당금 (세전)" value={formatWon(quickInputs.usDividend)} onTap={() => setEditingField('usDividend')} noBorder />
                </SectionCard>

                <SectionCard title="예상 세금">
                  {quickInputs.krDividend > 0 && (
                    <ResultRow label="국장 배당세 (15.4% 원천징수)" value={formatWon(quickResult.krDividendTax)} color={T.danger} />
                  )}
                  {quickInputs.usGain > 0 && (
                    <>
                      <ResultRow label="미장 양도세 기본공제 250만" value={`−${formatWon(Math.min(quickInputs.usGain, 2_500_000))}`} color={T.accent} />
                      <ResultRow label="미장 양도세 (22%)" value={formatWon(quickResult.usGainTax)} color={quickResult.usGainTax > 0 ? T.danger : T.textSec} />
                    </>
                  )}
                  {quickInputs.usDividend > 0 && (
                    <ResultRow label="미장 배당세 (15% 원천징수)" value={formatWon(quickResult.usDividendTax)} color={T.danger} />
                  )}
                  <div style={{ height: 1, background: T.divider, margin: '4px 0' }} />
                  <ResultRow label="총 예상 세금" value={formatWon(quickResult.total)} color={T.danger} big />
                  {(quickInputs.krDividend + quickInputs.usDividend) > 0 && (
                    <ResultRow label="세후 배당금 실수령" value={formatWon(quickResult.netDividend)} color={T.accent} />
                  )}
                  {quickInputs.usGain > 0 && (
                    <ResultRow label="세후 양도차익 실수령" value={formatWon(quickResult.netGain)} color={T.accent} />
                  )}
                </SectionCard>

                <InfoBanner tone="neutral">
                  국장 소액주주는 양도세 없음. 미장은 연간 손익통산 후 250만 공제, 22%(지방세 포함) 부과.<br />
                  배당은 원천징수되며, 배당+이자 합계 2천만 초과 시 종합과세 대상이에요.<br />
                  정확한 계산은 아래 <b>배당세</b> · <b>양도소득세</b> 탭을 이용하세요.
                </InfoBanner>
              </div>
            )}

            {/* 배당세 */}
            {taxType === 'dividend' && (
              <div style={{ padding: '8px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                <SectionCard title="입력">
                  <InputRow label="연간 배당금 (세전)" value={formatWon(divInputs.grossDividend)} onTap={() => setEditingField('grossDividend')} />
                  <InputRow label="기타 금융소득 (이자 등)" value={formatWon(divInputs.otherFinancialIncome)} onTap={() => setEditingField('otherFinancialIncome')} />
                  <ToggleRow label="국내 주식" value={divInputs.isDomestic} onChange={v => setDivInputs(p => ({ ...p, isDomestic: v }))} />
                  <ToggleRow label="직장 건강보험 가입" value={divInputs.isHealthInsured} onChange={v => setDivInputs(p => ({ ...p, isHealthInsured: v }))} />
                  <ToggleRow label="피부양자" value={divInputs.isPidayang} onChange={v => setDivInputs(p => ({ ...p, isPidayang: v }))} noBorder />
                </SectionCard>

                <SectionCard title="세금 내역">
                  <ResultRow label={`원천징수 (${divInputs.isDomestic ? '15.4%' : '15%'})`} value={formatWon(divResult.withheld)} color={T.danger} />
                  {divResult.isComprehensive && (
                    <ResultRow label="종합소득세 추가납부" value={formatWon(divResult.comprehensiveTax)} color={T.danger} />
                  )}
                  {divResult.isComprehensive && divResult.localTax > 0 && (
                    <ResultRow label="지방소득세" value={formatWon(divResult.localTax)} color={T.danger} />
                  )}
                  {divResult.healthIns > 0 && (
                    <ResultRow label={divResult.losePidayang ? '건보료 (피부양자 탈락)' : '건보료 추가분'} value={formatWon(divResult.healthIns)} color={T.warn} />
                  )}
                  <div style={{ height: 1, background: T.divider, margin: '4px 0' }} />
                  <ResultRow label="실수령 배당금" value={formatWon(divResult.netDividend)} color={T.accent} big />
                  <ResultRow label="실효세율" value={fmtPct(divResult.effectiveRate)} color={T.textSec} />
                </SectionCard>

                {divResult.isComprehensive && (
                  <InfoBanner tone="warn">
                    금융소득이 연 2천만원을 초과해 종합과세 대상이에요. 다음 해 5월에 종합소득세를 신고해야 합니다.
                  </InfoBanner>
                )}
                {divResult.losePidayang && (
                  <InfoBanner tone="danger">
                    금융소득이 연 1천만원을 초과해 건강보험 피부양자 자격을 잃을 수 있어요.
                  </InfoBanner>
                )}
                <InfoBanner tone="neutral">
                  종합과세 여부는 금융소득(배당+이자) 합계가 연 2천만원을 초과하는지로 판단해요.
                  상단 <b>세전 소득</b> 버튼에서 근로소득을 입력하면 종합과세 계산이 정확해져요.
                </InfoBanner>
              </div>
            )}

            {/* 양도소득세 */}
            {taxType === 'capital' && (
              <div style={{ padding: '8px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                <InfoBanner tone="neutral">
                  💡 세금 계산 기준은 모두 <b>세전(gross)</b>이에요.<br />
                  양도세 = 세전 양도차익(매도가 − 매수가 − 거래비용)에 부과
                </InfoBanner>

                <SectionCard title="주식 종류">
                  <ToggleRow
                    label="국내 주식 (코스피·코스닥·ETF)"
                    value={capInputs.isDomestic}
                    onChange={v => setCapInputs(p => ({ ...p, isDomestic: v, market: v ? 'kospi' : 'overseas' }))}
                  />
                  {capInputs.isDomestic && (
                    <>
                      <div style={{ padding: '12px 16px', borderBottom: `1px solid ${T.divider}` }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: T.textSec, marginBottom: 8 }}>시장 선택</div>
                        <div style={{ display: 'flex', gap: 8 }}>
                          {(['kospi', 'kosdaq'] as const).map(m => (
                            <button
                              key={m}
                              onClick={() => setCapInputs(p => ({ ...p, market: m }))}
                              style={{
                                flex: 1, padding: '8px 0', borderRadius: 10, border: 0, cursor: 'pointer',
                                background: capInputs.market === m ? T.text : T.bgMuted,
                                color: capInputs.market === m ? '#fff' : T.textSec,
                                fontSize: 13, fontWeight: 600,
                              }}
                            >
                              {m === 'kospi' ? '코스피 (0.15%)' : '코스닥 (0.20%)'}
                            </button>
                          ))}
                        </div>
                      </div>
                      <ToggleRow
                        label="대주주 (종목 10억↑ 또는 지분 1%↑)"
                        value={capInputs.isMajorShareholder}
                        onChange={v => setCapInputs(p => ({ ...p, isMajorShareholder: v }))}
                        noBorder
                      />
                    </>
                  )}
                </SectionCard>

                <SectionCard title="입력 (세전 기준)">
                  <InputRow
                    label="양도차익 (매도가 − 매수가 − 거래비용)"
                    value={formatWon(capInputs.gain)}
                    onTap={() => setEditingField('capitalGain')}
                  />
                  <InputRow
                    label={capInputs.isDomestic ? '매도금액 (증권거래세 계산용)' : '매도금액 (증권거래세 없음)'}
                    value={formatWon(capInputs.salePrice)}
                    onTap={() => setEditingField('salePrice')}
                    noBorder
                  />
                </SectionCard>

                {capResult.isTaxExempt ? (
                  <SectionCard title="세금 내역">
                    <div style={{ padding: 16, background: T.accentSoft }}>
                      <div style={{ fontSize: 15, fontWeight: 700, color: T.accent, marginBottom: 4 }}>매매차익 비과세 ✓</div>
                      <div style={{ fontSize: 13, color: T.accent, fontWeight: 500 }}>소액주주는 국내 주식 양도세가 없어요.</div>
                    </div>
                    {capResult.transactionTax > 0 && (
                      <>
                        <ResultRow
                          label={`증권거래세 (${capInputs.market === 'kospi' ? '0.15%' : '0.20%'}, 매도금액 기준)`}
                          value={formatWon(capResult.transactionTax)}
                          color={T.danger}
                        />
                        <div style={{ height: 1, background: T.divider, margin: '4px 0' }} />
                        <ResultRow label="실수령 차익" value={formatWon(capResult.net)} color={T.accent} big />
                      </>
                    )}
                  </SectionCard>
                ) : (
                  <SectionCard title="세금 내역">
                    {!capInputs.isDomestic && (
                      <ResultRow label="기본 공제 (연간 250만)" value={`−${formatWon(capResult.deduction)}`} color={T.accent} />
                    )}
                    <ResultRow label="과세표준" value={formatWon(capResult.taxable)} />
                    {capInputs.isDomestic && capInputs.isMajorShareholder ? (
                      <ResultRow label="양도소득세 (3억↓ 22% / 초과 27.5%) + 지방세" value={formatWon(capResult.tax)} color={T.danger} />
                    ) : (
                      <ResultRow label="양도소득세 20% + 지방소득세 2%" value={formatWon(capResult.tax)} color={T.danger} />
                    )}
                    {capResult.transactionTax > 0 && (
                      <ResultRow label={`증권거래세 (${capInputs.market === 'kospi' ? '0.15%' : '0.20%'})`} value={formatWon(capResult.transactionTax)} color={T.danger} />
                    )}
                    <div style={{ height: 1, background: T.divider, margin: '4px 0' }} />
                    <ResultRow label="실수령 차익" value={formatWon(capResult.net)} color={T.accent} big />
                    <ResultRow label="실효세율 (차익 대비)" value={fmtPct(capResult.effectiveRate)} color={T.textSec} />
                  </SectionCard>
                )}

                <InfoBanner tone="neutral">
                  해외 주식 250만 공제는 연간 손익통산 후 적용돼요.<br />
                  신고: 다음 해 5월 종합소득세 신고 시 자진 신고해야 해요.
                </InfoBanner>
              </div>
            )}
          </>
        )}

        {/* ── 연말정산 탭 ── */}
        {tab === 'yearend' && (
          <div style={{ padding: '8px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>

            {/* 전략 가이드 */}
            <div style={{ background: T.text, borderRadius: 18, padding: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,0.6)', marginBottom: 12 }}>
                카드 전략 핵심
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[
                  { step: '1', text: '총급여 25%까지는', sub: '어떤 결제수단이든 공제 없음 → 신용카드로 포인트/혜택 챙기기', color: '#60A5FA' },
                  { step: '2', text: '25% 초과분부터', sub: '체크카드·현금영수증 30% 공제 > 신용카드 15% — 체크카드가 2배 유리', color: '#34D399' },
                  { step: '3', text: '전통시장·대중교통', sub: '별도 40% 공제 (한도 각 100만) — 무조건 영수증 챙기기', color: '#FBBF24' },
                ].map(s => (
                  <div key={s.step} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                    <div style={{ width: 22, height: 22, borderRadius: 11, background: s.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
                      <span style={{ fontSize: 11, fontWeight: 800, color: '#000' }}>{s.step}</span>
                    </div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>{s.text}</div>
                      <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.65)', lineHeight: 1.5, marginTop: 2 }}>{s.sub}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 공제율 비교표 */}
            <SectionCard title="결제수단별 공제율">
              {[
                { label: '신용카드', rate: '15%', note: '공제율 낮음 → 25%까지 써서 혜택만', color: T.textSec },
                { label: '체크카드 · 현금영수증', rate: '30%', note: '핵심 구간', color: T.accent },
                { label: '전통시장', rate: '40%', note: '별도 한도 100만', color: '#059669' },
                { label: '대중교통', rate: '40%', note: '별도 한도 100만', color: '#059669' },
              ].map((r, i, arr) => (
                <div key={r.label} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '13px 16px',
                  borderBottom: i < arr.length - 1 ? `1px solid ${T.divider}` : 'none',
                }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: T.text }}>{r.label}</div>
                    <div style={{ fontSize: 11, color: T.textTer, marginTop: 2 }}>{r.note}</div>
                  </div>
                  <span style={{ fontSize: 20, fontWeight: 800, color: r.color, fontVariantNumeric: 'tabular-nums' }}>{r.rate}</span>
                </div>
              ))}
            </SectionCard>

            {/* 공제액 계산기 */}
            <SectionCard title="공제액 계산기">
              <InputRow label="연간 총급여 (세전)" value={formatWon(effectiveSalary)} onTap={() => setEditingField('yearendSalary')} />
              <InputRow label="신용카드 사용액" value={formatWon(yearendInputs.creditCard)} onTap={() => setEditingField('yearendCredit')} />
              <InputRow label="체크카드 + 현금영수증" value={formatWon(yearendInputs.checkCard)} onTap={() => setEditingField('yearendCheck')} />
              <InputRow label="전통시장" value={formatWon(yearendInputs.traditional)} onTap={() => setEditingField('yearendTraditional')} />
              <InputRow label="대중교통" value={formatWon(yearendInputs.transit)} onTap={() => setEditingField('yearendTransit')} noBorder />
            </SectionCard>

            {effectiveSalary > 0 && (
              <SectionCard title="예상 소득공제액">
                <ResultRow label={`공제 미적용 구간 (총급여 25%)`} value={formatWon(yearendResult.threshold)} color={T.textSec} />
                <div style={{ height: 1, background: T.divider, margin: '4px 0' }} />
                {yearendInputs.creditCard > 0 && <ResultRow label="신용카드 공제 (15%)" value={formatWon(yearendResult.creditDeduction)} color={T.accent} />}
                {yearendInputs.checkCard > 0 && <ResultRow label="체크카드·현금 공제 (30%)" value={formatWon(yearendResult.checkDeduction)} color={T.accent} />}
                {yearendInputs.traditional > 0 && <ResultRow label="전통시장 공제 (40%)" value={formatWon(yearendResult.extraTraditional)} color={T.accent} />}
                {yearendInputs.transit > 0 && <ResultRow label="대중교통 공제 (40%)" value={formatWon(yearendResult.extraTransit)} color={T.accent} />}
                {yearendResult.baseDeduction >= yearendResult.baseLimit && (
                  <div style={{ padding: '6px 16px' }}>
                    <span style={{ fontSize: 11, color: T.warn, fontWeight: 600 }}>기본 공제한도 {formatWon(yearendResult.baseLimit)} 도달</span>
                  </div>
                )}
                <div style={{ height: 1, background: T.divider, margin: '4px 0' }} />
                <ResultRow label="총 소득공제" value={formatWon(yearendResult.totalDeduction)} color={T.accent} big />
              </SectionCard>
            )}

            <InfoBanner tone="neutral">
              공제 한도: 총급여 7천만↓ 300만 · 7천만~1.2억 250만 · 1.2억↑ 200만원 (기본) + 전통시장·대중교통 각 100만 별도.<br />
              실제 절세액은 본인 소득세율에 따라 다르며, 근로소득공제·인적공제 등 다른 공제가 먼저 적용돼요.
            </InfoBanner>
          </div>
        )}

        <div style={{ height: 20 }} />
      </ScreenBody>

      {/* 연봉 수정 시트 */}
      {salarySheetOpen && (
        <SalarySheet
          annualSalary={investSettings.annualSalary + investSettings.bonusIncome}
          onClose={() => setSalarySheetOpen(false)}
          onSave={(annualSalary, bonusIncome, useCustom) => {
            const next = { annualSalary, bonusIncome, useCustomSalary: useCustom };
            setInvestSettings(next);
            saveInvestSettings(next);
            setSalarySheetOpen(false);
          }}
        />
      )}

      {/* 숫자 입력 시트 */}
      {editingField && fieldDefs[editingField] && (() => {
        const f = fieldDefs[editingField];
        return (
          <NumberEditSheet
            title={f.label} value={f.value} unit={f.unit} step={f.step}
            min={f.min} max={f.max} presets={f.presets}
            onClose={() => setEditingField(null)}
            onSave={(v) => { f.set(v); setEditingField(null); }}
          />
        );
      })()}
    </Screen>
  );
}

// ─── UI 컴포넌트 ─────────────────────────────────────────────────────────────

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 13, fontWeight: 700, color: T.textTer, padding: '0 4px 8px', letterSpacing: '-0.01em' }}>{title}</div>
      <div style={{ background: T.bg, border: `1px solid ${T.divider}`, borderRadius: 16, overflow: 'hidden' }}>
        {children}
      </div>
    </div>
  );
}

function InputRow({ label, value, onTap, noBorder }: { label: string; value: string; onTap: () => void; noBorder?: boolean }) {
  return (
    <button
      onClick={onTap}
      style={{
        width: '100%', border: 0, background: 'transparent',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 16px', cursor: 'pointer', textAlign: 'left',
        borderBottom: noBorder ? 'none' : `1px solid ${T.divider}`,
      }}
    >
      <span style={{ fontSize: 14, fontWeight: 600, color: T.text, letterSpacing: '-0.01em' }}>{label}</span>
      <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: T.text, fontVariantNumeric: 'tabular-nums' }}>{value}</span>
        <svg width="6" height="10" viewBox="0 0 6 10" fill="none">
          <path d="M1 1l4 4-4 4" stroke={T.textTer} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    </button>
  );
}

function ToggleRow({ label, value, onChange, noBorder }: { label: string; value: boolean; onChange: (v: boolean) => void; noBorder?: boolean }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '14px 16px',
      borderBottom: noBorder ? 'none' : `1px solid ${T.divider}`,
    }}>
      <span style={{ fontSize: 14, fontWeight: 600, color: T.text, letterSpacing: '-0.01em' }}>{label}</span>
      <button
        onClick={() => onChange(!value)}
        style={{
          width: 44, height: 26, borderRadius: 13, border: 0, cursor: 'pointer',
          background: value ? T.accent : T.bgMuted,
          position: 'relative', transition: 'background .2s', flexShrink: 0,
        }}
      >
        <div style={{
          position: 'absolute', top: 3, left: value ? 21 : 3,
          width: 20, height: 20, borderRadius: 10, background: '#fff',
          transition: 'left .2s', boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
        }} />
      </button>
    </div>
  );
}

function ResultRow({ label, value, color, big }: { label: string; value: string; color?: string; big?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: big ? '14px 16px' : '10px 16px' }}>
      <span style={{ fontSize: big ? 14 : 13, fontWeight: big ? 700 : 600, color: T.textSec, letterSpacing: '-0.01em' }}>{label}</span>
      <span style={{ fontSize: big ? 17 : 14, fontWeight: 700, color: color || T.text, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em' }}>{value}</span>
    </div>
  );
}

function InfoBanner({ children, tone }: { children: React.ReactNode; tone: 'warn' | 'danger' | 'neutral' }) {
  const colors = {
    warn: { bg: T.warnSoft, fg: '#92400E' },
    danger: { bg: T.dangerSoft, fg: '#991B1B' },
    neutral: { bg: T.bgMuted, fg: T.textSec },
  }[tone];
  return (
    <div style={{ background: colors.bg, borderRadius: 12, padding: '12px 14px', fontSize: 12, color: colors.fg, lineHeight: 1.6, fontWeight: 500 }}>
      {children}
    </div>
  );
}

function NumberEditSheet({ title, value, onClose, onSave, unit = '원', min = 0, max, presets, step = 10000 }: {
  title: string; value: number; onClose: () => void; onSave: (v: number) => void;
  unit?: string; min?: number; max?: number; presets?: { value: number; label: string }[]; step?: number;
}) {
  const [v, setV] = useState(value);
  const isMoney = unit === '원';
  const displayed = isMoney ? Number(v || 0).toLocaleString('ko-KR') : String(v);

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/[^\d.]/g, '');
    const n = Math.max(min ?? 0, Number(raw) || 0);
    setV(max != null ? Math.min(max, n) : n);
  };

  const bump = (d: number) => {
    const next = Math.max(min ?? 0, v + d);
    setV(max != null ? Math.min(max, next) : next);
  };

  return (
    <BottomSheet open onClose={onClose} title={title} height="55%">
      <div style={{ padding: '0 20px 24px' }}>
        <div style={{ padding: '20px 0', textAlign: 'center', borderBottom: `1px solid ${T.divider}` }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: 4, fontVariantNumeric: 'tabular-nums' }}>
            {isMoney && <span style={{ fontSize: 20, fontWeight: 700, color: T.textSec }}>₩</span>}
            <input
              type="text" inputMode="numeric" value={displayed} onChange={onInputChange}
              style={{
                border: 0, background: 'transparent', textAlign: 'center',
                fontFamily: 'Pretendard, system-ui, sans-serif',
                fontSize: 30, fontWeight: 800, color: T.text,
                width: `${Math.max(3, displayed.length)}ch`, minWidth: 80, maxWidth: 240, outline: 'none', padding: 0,
              }}
            />
            <span style={{ fontSize: 18, fontWeight: 700, color: T.textSec }}>{unit}</span>
          </div>
          {isMoney && v >= 10_000 && (
            <div style={{ marginTop: 6, fontSize: 13, color: T.textTer }}>
              {v >= 100_000_000 ? Math.floor(v / 100_000_000) + '억 ' + Math.floor((v % 100_000_000) / 10_000) + '만원' : Math.floor(v / 10_000) + '만원'}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8, padding: '20px 0 8px' }}>
          {[-step * 10, -step, +step, +step * 10].map((d) => (
            <button key={d} onClick={() => bump(d)} style={{
              flex: 1, padding: '10px 0', border: 0, borderRadius: 10,
              background: T.bgMuted, color: T.text, fontFamily: 'Pretendard, system-ui, sans-serif',
              fontSize: 13, fontWeight: 600, cursor: 'pointer', fontVariantNumeric: 'tabular-nums',
            }}>
              {d > 0 ? '+' : '−'}{isMoney ? (Math.abs(d) >= 10000 ? `${Math.abs(d) / 10000}만` : Math.abs(d).toLocaleString()) : Math.abs(d)}
            </button>
          ))}
        </div>
        {presets && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 12 }}>
            {presets.map((p) => (
              <button key={p.value} onClick={() => setV(p.value)} style={{
                border: 0, padding: '8px 14px', borderRadius: 999,
                background: v === p.value ? T.accentSoft : T.bgSoft,
                color: v === p.value ? T.accent : T.text,
                fontFamily: 'Pretendard, system-ui, sans-serif', fontSize: 13, fontWeight: 600, cursor: 'pointer',
              }}>
                {p.label}
              </button>
            ))}
          </div>
        )}
        <div style={{ marginTop: 24 }}>
          <PrimaryButton onClick={() => onSave(v)}>적용</PrimaryButton>
        </div>
      </div>
    </BottomSheet>
  );
}

// ─── 목표 역산 섹션 ─────────────────────────────────────────────────────────

function GoalReverseSection({ laborIncome, onSwitchToSim }: { laborIncome: number; onSwitchToSim: () => void }) {
  const router = useRouter();
  const { settings, loading: goalLoading } = useGoalSettings();
  const { budget, loading: budgetLoading } = useBudget();

  const currentMonth = getCurrentMonth();
  const monthlyIncome = settings.monthlyIncome || 4_000_000;
  const targetAmount = settings.goalAmount || 100_000_000;
  const currentAssets = settings.currentAssets || 0;
  const targetMonths = settings.goalMonths || 36;

  const totalBudget = budget
    ? Object.keys({ ...budget.categoryBudgets, ...(budget.monthlyCategoryBudgets?.[currentMonth] ?? {}) }).reduce(
        (sum, catId) => sum + getCategoryBudgetForMonth(budget, currentMonth, catId), 0
      )
    : 0;
  const savingCategoryBudget = budget ? getCategoryBudgetForMonth(budget, currentMonth, 'saving') : 0;
  const monthlyBudget = totalBudget - savingCategoryBudget;
  const monthlySavings = Math.max(0, monthlyIncome - monthlyBudget);
  const gap = Math.max(0, targetAmount - currentAssets);

  if (goalLoading || budgetLoading) {
    return <div style={{ padding: '20px', color: T.textSec, fontSize: 14 }}>로딩 중...</div>;
  }

  const requiredMonthlyRate = solveMonthlyRate(currentAssets, monthlySavings, targetAmount, targetMonths);
  const requiredAnnualRate = (Math.pow(1 + requiredMonthlyRate, 12) - 1) * 100;
  const isAchievableWithSavingsOnly = requiredMonthlyRate < 1e-6;

  const benchmarks = [
    { name: 'S&P 500 (10년 평균)', annualRate: 10, risk: '중', color: '#2563EB' },
    { name: 'QQQ (10년 평균)', annualRate: 14, risk: '중상', color: '#7C3AED' },
    { name: '글로벌 배당 ETF', annualRate: 7, risk: '중하', color: '#059669' },
    { name: '예금·채권 (국내)', annualRate: 3.5, risk: '낮음', color: '#6B7280' },
  ];

  const rateColor = requiredAnnualRate > 25 ? '#F87171' : requiredAnnualRate > 12 ? '#FCD34D' : '#34D399';

  return (
    <div style={{ padding: '8px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <SectionCard title="현재 목표 데이터">
        <ResultRow label="목표 금액" value={formatWon(targetAmount)} />
        <ResultRow label="현재 보유 자산" value={formatWon(currentAssets)} />
        <ResultRow label="남은 금액 (Gap)" value={formatWon(gap)} />
        <ResultRow label="목표 기간" value={`${targetMonths}개월 (${(targetMonths / 12).toFixed(1)}년)`} />
        <ResultRow label="월 저축 가능액" value={formatWon(monthlySavings)} color={monthlySavings > 0 ? T.accent : T.danger} big />
        <div style={{ padding: '8px 16px 12px' }}>
          <button
            onClick={() => router.push('/goals')}
            style={{ border: 0, background: 'transparent', color: T.textTer, fontSize: 12, fontWeight: 600, cursor: 'pointer', padding: 0 }}
          >
            목표 수정하기 →
          </button>
        </div>
      </SectionCard>

      {isAchievableWithSavingsOnly ? (
        <div style={{ background: T.accentSoft, borderRadius: 16, padding: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: T.accent, marginBottom: 6 }}>
            저축만으로 달성 가능해요!
          </div>
          <div style={{ fontSize: 14, color: T.accent, fontWeight: 600, lineHeight: 1.6 }}>
            현재 월 저축액({formatWon(monthlySavings)})으로 목표 기간 내 달성 가능해요.<br />
            투자까지 더하면 더 빠르게 달성하거나 목표를 높일 수 있어요.
          </div>
        </div>
      ) : (
        <div style={{ background: T.text, borderRadius: 18, padding: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.6)', marginBottom: 8 }}>
            목표 달성을 위한 필요 연 수익률 (세전)
          </div>
          <div style={{ fontSize: 40, fontWeight: 800, letterSpacing: '-0.03em', fontVariantNumeric: 'tabular-nums', marginBottom: 4, color: rateColor }}>
            {requiredAnnualRate.toFixed(1)}%
          </div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', fontWeight: 500 }}>
            월 저축 {formatWon(monthlySavings)} + 투자 수익 합산 기준
          </div>
          {requiredAnnualRate > 25 && (
            <div style={{ marginTop: 12, padding: '10px 12px', background: 'rgba(248,113,113,0.15)', borderRadius: 10, fontSize: 12, color: '#FCA5A5', fontWeight: 600, lineHeight: 1.6 }}>
              ⚠️ 연 25% 초과는 현실적으로 달성하기 매우 어려운 수익률이에요.<br />
              목표 금액을 낮추거나 기간을 늘려보세요.
            </div>
          )}
        </div>
      )}

      {!isAchievableWithSavingsOnly && (
        <SectionCard title="벤치마크 비교">
          {benchmarks.map((b, i) => {
            const isEnough = b.annualRate >= requiredAnnualRate;
            const isLast = i === benchmarks.length - 1;
            return (
              <div key={b.name} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '13px 16px',
                borderBottom: isLast ? 'none' : `1px solid ${T.divider}`,
                background: isEnough ? T.accentSoft : 'transparent',
              }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: T.text }}>{b.name}</div>
                  <div style={{ fontSize: 11, color: T.textTer, marginTop: 2 }}>리스크 {b.risk}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 17, fontWeight: 700, color: b.color, fontVariantNumeric: 'tabular-nums' }}>연 {b.annualRate}%</div>
                  <div style={{ fontSize: 11, fontWeight: 700, marginTop: 2, color: isEnough ? T.accent : T.danger }}>
                    {isEnough ? '✓ 달성 가능' : '✗ 부족'}
                  </div>
                </div>
              </div>
            );
          })}
        </SectionCard>
      )}

      {/* 시뮬레이션으로 연결 */}
      <button
        onClick={onSwitchToSim}
        style={{
          border: `1px solid ${T.divider}`, background: T.bg, borderRadius: 14, padding: '14px 16px',
          cursor: 'pointer', width: '100%', textAlign: 'left', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}
      >
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: T.text, marginBottom: 2 }}>
            💰 투자 시뮬레이션으로 확인
          </div>
          <div style={{ fontSize: 12, color: T.textSec, fontWeight: 500 }}>
            수익률 입력 시 세후 예상 수익액 계산
          </div>
        </div>
        <svg width="6" height="10" viewBox="0 0 6 10" fill="none">
          <path d="M1 1l4 4-4 4" stroke={T.textTer} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      <InfoBanner tone="neutral">
        위 수익률은 세전(gross) 기준이에요. 실제 투자 시 배당세·양도세가 추가로 부과돼요.<br />
        과거 수익률이 미래를 보장하지 않으며, 원금 손실이 발생할 수 있어요.
      </InfoBanner>
    </div>
  );
}

function SalarySheet({ annualSalary, onClose, onSave }: {
  annualSalary: number;
  onClose: () => void;
  onSave: (annualSalary: number, bonusIncome: number, useCustom: boolean) => void;
}) {
  const [total, setTotal] = useState(annualSalary);
  const fmtInput = (n: number) => n === 0 ? '' : Math.floor(n).toLocaleString('ko-KR');
  const parseInput = (s: string) => Math.max(0, Number(s.replace(/[^\d]/g, '')) || 0);

  return (
    <BottomSheet open onClose={onClose} title="세전 연간 소득" height="50%">
      <div style={{ padding: '0 20px 32px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <InfoBanner tone="neutral">
          원천징수영수증의 <b>총급여</b> 금액을 입력해주세요. 성과금 포함 연간 세전 총소득이에요.
        </InfoBanner>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: T.textTer }}>세전 연간 총소득 (성과금 포함)</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: T.bgMuted, borderRadius: 12, padding: '14px 16px' }}>
            <span style={{ fontSize: 16, fontWeight: 600, color: T.textSec }}>₩</span>
            <input
              type="text" inputMode="numeric"
              value={fmtInput(total)}
              placeholder="예: 52,000,000"
              onChange={e => setTotal(parseInput(e.target.value))}
              style={{ flex: 1, border: 0, background: 'transparent', outline: 'none', fontSize: 18, fontWeight: 700, color: T.text, fontVariantNumeric: 'tabular-nums', fontFamily: 'Pretendard, system-ui, sans-serif' }}
            />
          </div>
          {total >= 10_000 && (
            <div style={{ fontSize: 12, color: T.textTer, paddingLeft: 4 }}>
              {total >= 100_000_000
                ? `${Math.floor(total / 100_000_000)}억 ${Math.floor((total % 100_000_000) / 10_000).toLocaleString()}만원`
                : `${Math.floor(total / 10_000).toLocaleString()}만원`}
            </div>
          )}
        </div>
        <PrimaryButton onClick={() => onSave(total, 0, true)}>적용</PrimaryButton>
      </div>
    </BottomSheet>
  );
}
