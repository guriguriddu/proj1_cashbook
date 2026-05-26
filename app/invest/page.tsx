'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Screen, ScreenBody, T, BottomSheet, PrimaryButton } from '@/components/ui';
import { getInvestSettings, saveInvestSettings } from '@/lib/supabase-storage';

// ─── 세금 상수 ───────────────────────────────────────────────────────────────

// 종합소득세 과세표준 구간 (2024년 기준)
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

// 지방소득세 10%
function calcLocalTax(incomeTax: number): number {
  return incomeTax * 0.1;
}

// 건강보험료 (직장가입자 보수외소득 연 2천만 초과분)
// 피부양자: 금융소득 연 1천만 초과 시 탈락
const HEALTH_INS_RATE = 0.0709; // 2024년 직장 근로자 본인 부담 요율
const HEALTH_INS_LONG_CARE = 0.1295; // 장기요양보험 (건보료의 12.95%)

interface TaxResult {
  grossDividend: number;        // 세전 배당금 (원)
  withheld: number;             // 원천징수세 (배당소득세)
  isComprehensive: boolean;     // 종합과세 해당 여부
  comprehensiveTax: number;     // 종합과세 추가납부세액
  localTax: number;             // 지방소득세
  healthIns: number;            // 건보료 추가분
  netDividend: number;          // 실수령액
  effectiveRate: number;        // 실효세율
  losePidayang: boolean;        // 피부양자 탈락 여부
}

// ─── 투자 세금 계산 ──────────────────────────────────────────────────────────

function calcDividendTax(params: {
  grossDividend: number;
  otherFinancialIncome: number; // 배당 외 금융소득 (이자 등)
  laborIncome: number;          // 근로소득 (종합과세 합산용)
  isDomestic: boolean;          // 국내 주식 여부
  isHealthInsured: boolean;     // 직장 건강보험 가입 여부
  isPidayang: boolean;          // 피부양자 여부
}): TaxResult {
  const { grossDividend, otherFinancialIncome, laborIncome, isDomestic, isHealthInsured, isPidayang } = params;

  // 원천징수세율: 국내 15.4%, 해외 15% (조약 기준)
  const withholdRate = isDomestic ? 0.154 : 0.15;
  const withheld = Math.floor(grossDividend * withholdRate);

  // 금융소득 총합
  const totalFinancial = grossDividend + otherFinancialIncome;
  const COMPREHENSIVE_THRESHOLD = 20_000_000; // 2천만원

  let comprehensiveTax = 0;
  let localTax = 0;

  if (totalFinancial > COMPREHENSIVE_THRESHOLD) {
    // 2천만 초과분 → 종합과세 (근로소득과 합산)
    const excessFinancial = totalFinancial - COMPREHENSIVE_THRESHOLD;
    // 기준: 2천만 이하 분리과세(14%) + 초과분 종합과세
    const separateTax = COMPREHENSIVE_THRESHOLD * 0.14;

    // 종합소득 = 근로소득 + 금융소득 초과분
    const totalTaxable = laborIncome + excessFinancial;
    const comprehensiveTotal = calcIncomeTax(totalTaxable);
    const laborOnly = calcIncomeTax(laborIncome);

    // 추가납부세액 = (종합과세 합산세액 - 근로소득세) - 분리과세세액 차이
    const additionalComprehensive = comprehensiveTotal - laborOnly;
    // 이미 원천징수분과 비교해서 추가납부액 산정
    const alreadyWithheld14 = separateTax + COMPREHENSIVE_THRESHOLD * 0 + excessFinancial * 0.14;
    comprehensiveTax = Math.max(0, additionalComprehensive - (alreadyWithheld14 - separateTax));

    localTax = calcLocalTax(comprehensiveTax);
  }

  // 건강보험료
  // 피부양자: 금융소득 연 1천만 초과 시 탈락
  const losePidayang = isPidayang && totalFinancial > 10_000_000;
  let healthIns = 0;

  if (isHealthInsured && !isPidayang) {
    // 직장가입자: 보수외소득 연 2천만 초과 시 추가 건보료
    if (totalFinancial > COMPREHENSIVE_THRESHOLD) {
      const excessForHealth = totalFinancial - COMPREHENSIVE_THRESHOLD;
      const healthBase = excessForHealth * HEALTH_INS_RATE;
      healthIns = Math.floor(healthBase * (1 + HEALTH_INS_LONG_CARE));
    }
  } else if (losePidayang) {
    // 피부양자 탈락 → 지역가입자 전환 예상 건보료 (금융소득 기준 개략)
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

// ─── 양도소득세 계산 ──────────────────────────────────────────────────────────

interface CapGainResult {
  gain: number;
  transactionTax: number;      // 증권거래세 (국내 소액주주)
  isTaxExempt: boolean;        // 국내 소액주주 비과세
  deduction: number;
  taxable: number;
  tax: number;                 // 양도소득세 + 지방소득세
  net: number;
  effectiveRate: number;
}

function calcCapitalGainTax(params: {
  gain: number;
  salePrice: number;           // 매도금액 (증권거래세 계산용)
  isDomestic: boolean;
  isMajorShareholder: boolean; // 국내 대주주 여부
  market: 'kospi' | 'kosdaq' | 'overseas';
}): CapGainResult {
  const { gain, salePrice, isDomestic, isMajorShareholder, market } = params;

  // 증권거래세 (국내만, 매도금액 기준 세전)
  const txTaxRate = market === 'kospi' ? 0.0015 : market === 'kosdaq' ? 0.002 : 0;
  const transactionTax = Math.floor(salePrice * txTaxRate);

  if (isDomestic && !isMajorShareholder) {
    // 소액주주: 매매차익 비과세
    return { gain, transactionTax, isTaxExempt: true, deduction: 0, taxable: 0, tax: 0, net: gain - transactionTax, effectiveRate: 0 };
  }

  let tax = 0;
  let deduction = 0;

  if (isDomestic && isMajorShareholder) {
    // 대주주: 과세표준 3억 이하 22%, 초과분 27.5%
    const BRACKET = 300_000_000;
    if (gain <= BRACKET) {
      tax = Math.floor(gain * 0.22);
    } else {
      tax = Math.floor(BRACKET * 0.22 + (gain - BRACKET) * 0.275);
    }
  } else {
    // 해외 주식·ETF: 250만 공제 후 22%
    deduction = Math.min(2_500_000, gain);
    const taxable = Math.max(0, gain - 2_500_000);
    tax = Math.floor(taxable * 0.22); // 20% 양도세 + 2% 지방소득세
  }

  const taxable = Math.max(0, gain - deduction);
  const net = gain - tax - transactionTax;
  const totalOut = tax + transactionTax;
  const effectiveRate = gain > 0 ? totalOut / gain : 0;
  return { gain, transactionTax, isTaxExempt: false, deduction, taxable, tax, net, effectiveRate };
}

// ─── 포맷 헬퍼 ──────────────────────────────────────────────────────────────

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

// ─── 메인 페이지 ─────────────────────────────────────────────────────────────

type Tab = 'dividend' | 'capital' | 'simulation';

export default function InvestPage() {
  const router = useRouter();
  // 연봉 설정 (세전 직접 입력)
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

  // 종합소득세 기준 근로소득 (세전 연간 총소득)
  const laborIncome = investSettings.annualSalary + investSettings.bonusIncome;

  const [tab, setTab] = useState<Tab>('dividend');

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
    annualReturn: 7,   // %
    years: 10,
    dividendYield: 3,  // %
    isDomestic: false,
    isHealthInsured: true,
    isPidayang: false,
  });

  const [editingField, setEditingField] = useState<string | null>(null);

  // 배당세 계산
  const divResult = calcDividendTax({ ...divInputs, laborIncome });

  // 양도소득세 계산
  const capResult = calcCapitalGainTax(capInputs);

  // 투자 시뮬레이션 계산
  const simResult = (() => {
    const { principal, monthlyAdd, annualReturn, years, dividendYield, isDomestic, isHealthInsured, isPidayang } = simInputs;
    const monthlyRate = annualReturn / 100 / 12;
    const months = years * 12;

    // 복리 계산 (배당 재투자 포함)
    let balance = principal;
    let totalInvested = principal;
    let totalDividendGross = 0;
    let totalDividendNet = 0;
    let totalCapitalGainGross = 0;

    for (let m = 0; m < months; m++) {
      balance += monthlyAdd;
      totalInvested += monthlyAdd;
      const monthlyDiv = balance * (dividendYield / 100 / 12);
      const divTax = calcDividendTax({
        grossDividend: monthlyDiv,
        otherFinancialIncome: 0,
        laborIncome,
        isDomestic,
        isHealthInsured,
        isPidayang,
      });
      totalDividendGross += monthlyDiv;
      totalDividendNet += divTax.netDividend;
      // 성장분 (배당 제외 자본이득)
      balance = balance * (1 + monthlyRate - dividendYield / 100 / 12) + divTax.netDividend;
    }

    totalCapitalGainGross = Math.max(0, balance - totalInvested);
    const capTax = calcCapitalGainTax({
      gain: totalCapitalGainGross,
      salePrice: balance,
      isDomestic: simInputs.isDomestic,
      isMajorShareholder: false,
      market: simInputs.isDomestic ? 'kospi' : 'overseas',
    });

    const finalBalance = balance - capTax.tax;
    const totalReturn = finalBalance - totalInvested;
    const effectiveAnnualReturn = totalInvested > 0
      ? (Math.pow(finalBalance / totalInvested, 1 / years) - 1) * 100
      : 0;

    return {
      totalInvested,
      finalBalance,
      totalReturn,
      totalDividendGross,
      totalDividendNet,
      totalCapitalGainGross,
      capitalGainTax: capTax.tax,
      effectiveAnnualReturn,
    };
  })();

  const TABS: { id: Tab; label: string }[] = [
    { id: 'dividend', label: '배당세 계산' },
    { id: 'capital', label: '양도소득세' },
    { id: 'simulation', label: '투자 시뮬' },
  ];

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
  };

  return (
    <Screen>
      {/* 헤더 */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '60px 20px 8px', position: 'sticky', top: 0, background: T.bg, zIndex: 5,
      }}>
        <span style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em' }}>투자</span>
        <button
          onClick={() => router.push('/mypage')}
          style={{ width: 40, height: 40, border: 0, background: 'transparent', borderRadius: 20, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
            <circle cx="11" cy="7.5" r="3.5" stroke={T.text} strokeWidth="1.8" />
            <path d="M3.5 18.5c0-3 3.4-5.5 7.5-5.5s7.5 2.5 7.5 5.5" stroke={T.text} strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {/* 탭 */}
      <div style={{ display: 'flex', gap: 6, padding: '8px 20px 4px', overflowX: 'auto' }}>
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              flexShrink: 0, padding: '8px 16px', borderRadius: 999, border: 0,
              background: tab === t.id ? T.text : T.bgMuted,
              color: tab === t.id ? '#fff' : T.textSec,
              fontSize: 13, fontWeight: 600, cursor: 'pointer', letterSpacing: '-0.01em',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      <ScreenBody>
        {/* ── 배당세 계산 ── */}
        {tab === 'dividend' && (
          <div style={{ padding: '12px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* 근로소득 기준 카드 */}
            <button
              onClick={() => setSalarySheetOpen(true)}
              style={{
                width: '100%', background: laborIncome > 0 ? T.bg : T.warnSoft,
                border: `1px solid ${laborIncome > 0 ? T.divider : T.warn}`,
                borderRadius: 16, padding: '14px 16px',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                cursor: 'pointer', textAlign: 'left',
              }}
            >
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: T.textTer, marginBottom: 2 }}>
                  세전 근로소득 (종합과세 합산용)
                </div>
                {laborIncome > 0 ? (
                  <div style={{ fontSize: 16, fontWeight: 700, color: T.text, fontVariantNumeric: 'tabular-nums' }}>
                    {formatWon(laborIncome)}
                  </div>
                ) : (
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#92400E' }}>
                    세전 연봉을 입력해주세요 (종합과세 계산 필요)
                  </div>
                )}
              </div>
              <span style={{
                flexShrink: 0, padding: '6px 12px', borderRadius: 999,
                background: T.bgMuted, color: T.text, fontSize: 12, fontWeight: 600, marginLeft: 12,
              }}>
                {laborIncome > 0 ? '수정' : '입력'}
              </span>
            </button>

            {/* 입력 카드 */}
            <SectionCard title="입력">
              <InputRow label="연간 배당금 (세전)" value={formatWon(divInputs.grossDividend)} onTap={() => setEditingField('grossDividend')} />
              <InputRow label="기타 금융소득 (이자 등)" value={formatWon(divInputs.otherFinancialIncome)} onTap={() => setEditingField('otherFinancialIncome')} />
              <ToggleRow label="국내 주식" value={divInputs.isDomestic} onChange={v => setDivInputs(p => ({ ...p, isDomestic: v }))} />
              <ToggleRow label="직장 건강보험 가입" value={divInputs.isHealthInsured} onChange={v => setDivInputs(p => ({ ...p, isHealthInsured: v }))} />
              <ToggleRow label="피부양자" value={divInputs.isPidayang} onChange={v => setDivInputs(p => ({ ...p, isPidayang: v }))} noBorder />
            </SectionCard>

            {/* 결과 카드 */}
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

            {/* 알림 배너 */}
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
              근로소득은 위 "수정" 버튼에서 세전 연봉·성과금을 직접 입력할 수 있어요.
            </InfoBanner>
          </div>
        )}

        {/* ── 양도소득세 ── */}
        {tab === 'capital' && (
          <div style={{ padding: '12px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* 세전 기준 안내 */}
            <InfoBanner tone="neutral">
              💡 세금 계산 기준은 모두 <b>세전(gross)</b>이에요.<br />
              양도세 = 세전 양도차익(매도가 − 매수가 − 거래비용)에 부과<br />
              배당세 = 세전 배당금에서 원천징수 후 지급
            </InfoBanner>

            {/* 국내/해외 선택 */}
            <SectionCard title="주식 종류">
              <ToggleRow
                label="국내 주식 (코스피·코스닥·ETF)"
                value={capInputs.isDomestic}
                onChange={v => setCapInputs(p => ({ ...p, isDomestic: v, market: v ? 'kospi' : 'overseas' }))}
              />
              {capInputs.isDomestic && (
                <>
                  {/* 시장 선택 */}
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
                          {m === 'kospi' ? '코스피 (거래세 0.15%)' : '코스닥 (거래세 0.20%)'}
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

            {/* 입력 */}
            <SectionCard title={`입력 (세전 기준)`}>
              <InputRow
                label="양도차익 (매도가 − 매수가 − 거래비용)"
                value={formatWon(capInputs.gain)}
                onTap={() => setEditingField('capitalGain')}
              />
              {capInputs.isDomestic && (
                <InputRow
                  label="매도금액 (증권거래세 계산용)"
                  value={formatWon(capInputs.salePrice)}
                  onTap={() => setEditingField('salePrice')}
                  noBorder
                />
              )}
              {!capInputs.isDomestic && (
                <InputRow
                  label="매도금액 (증권거래세 없음)"
                  value={formatWon(capInputs.salePrice)}
                  onTap={() => setEditingField('salePrice')}
                  noBorder
                />
              )}
            </SectionCard>

            {/* 결과 */}
            {capResult.isTaxExempt ? (
              <SectionCard title="세금 내역">
                <div style={{ padding: '16px', background: T.accentSoft, margin: '0' }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: T.accent, marginBottom: 4 }}>매매차익 비과세 ✓</div>
                  <div style={{ fontSize: 13, color: T.accent, fontWeight: 500 }}>소액주주는 국내 주식 양도세가 없어요.</div>
                </div>
                {capResult.transactionTax > 0 && (
                  <>
                    <ResultRow
                      label={`증권거래세 (${capInputs.market === 'kospi' ? '0.15%' : '0.20%'}, 매도금액 기준·세전)`}
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
                  <ResultRow label="기본 공제 (연간 250만·세전 차익 기준)" value={`−${formatWon(capResult.deduction)}`} color={T.accent} />
                )}
                <ResultRow label="과세표준" value={formatWon(capResult.taxable)} />
                {capInputs.isDomestic && capInputs.isMajorShareholder ? (
                  <ResultRow label="양도소득세 (3억↓ 22% / 초과 27.5%) + 지방세" value={formatWon(capResult.tax)} color={T.danger} />
                ) : (
                  <ResultRow label="양도소득세 20% + 지방소득세 2%" value={formatWon(capResult.tax)} color={T.danger} />
                )}
                {capResult.transactionTax > 0 && (
                  <ResultRow
                    label={`증권거래세 (${capInputs.market === 'kospi' ? '0.15%' : '0.20%'})`}
                    value={formatWon(capResult.transactionTax)}
                    color={T.danger}
                  />
                )}
                <div style={{ height: 1, background: T.divider, margin: '4px 0' }} />
                <ResultRow label="실수령 차익" value={formatWon(capResult.net)} color={T.accent} big />
                <ResultRow label="실효세율 (차익 대비)" value={fmtPct(capResult.effectiveRate)} color={T.textSec} />
              </SectionCard>
            )}

            <InfoBanner tone="neutral">
              해외 주식 250만 공제는 연간 손익통산 후 적용돼요 (손실 종목과 합산 가능).<br />
              신고: 다음 해 5월 종합소득세 신고 시 자진 신고해야 해요.<br />
              국내 ETF 매매차익은 소액주주 기준 비과세이나, 채권형·레버리지 ETF는 다를 수 있어요.
            </InfoBanner>
          </div>
        )}

        {/* ── 투자 시뮬레이션 ── */}
        {tab === 'simulation' && (
          <div style={{ padding: '12px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
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

            {/* 결과 요약 */}
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

            <InfoBanner tone="neutral">
              배당은 매월 재투자하는 것으로 계산해요. 실제 세금은 소득 상황에 따라 달라질 수 있어요.
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
            title={f.label}
            value={f.value}
            unit={f.unit}
            step={f.step}
            min={f.min}
            max={f.max}
            presets={f.presets}
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
              style={{
                flex: 1, border: 0, background: 'transparent', outline: 'none',
                fontSize: 18, fontWeight: 700, color: T.text, fontVariantNumeric: 'tabular-nums',
                fontFamily: 'Pretendard, system-ui, sans-serif',
              }}
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
