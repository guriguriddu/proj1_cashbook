'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Screen, ScreenBody, T, BottomSheet, PrimaryButton } from '@/components/ui';
import { getInvestSettings, saveInvestSettings, getExpenses } from '@/lib/supabase-storage';
import {
  calcIncomeTax, calcDividendTax, calcCapitalGainTax,
  formatWon, fmtPct,
  calcYearendDeduction,
  summarizeSpendByPay,
  type YearendInputs,
  type SpendByPay,
} from '@/lib/invest-tax';
import { SectionCard, InputRow, ToggleRow, ResultRow, InfoBanner, NumberEditSheet } from '@/components/invest-ui';

// ─── 타입 ────────────────────────────────────────────────────────────────────

type Tab = 'overview' | 'tax';
type TaxType = 'stock' | 'deposit' | 'etf' | 'bond' | 'saving' | 'yearend';

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

  const [tab, setTab] = useState<Tab>('overview');
  const [taxType, setTaxType] = useState<TaxType>('stock');

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

  // 올해 가계부에서 결제수단별 소비 자동 집계 → 계산기 자동 채움 (이후 사용자가 수정 가능)
  const currentYear = new Date().getFullYear();
  const [spendByPay, setSpendByPay] = useState<SpendByPay | null>(null);

  useEffect(() => {
    getExpenses().then((items) => {
      const s = summarizeSpendByPay(items, currentYear);
      setSpendByPay(s);
      setYearendInputs((p) => ({ ...p, creditCard: s.credit, checkCard: s.check, transit: s.transit }));
    });
  }, [currentYear]);

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

  const [editingField, setEditingField] = useState<string | null>(null);

  // 예금·적금 / ETF·펀드 / 채권 / 절세계좌 입력값
  const [depositInputs, setDepositInputs] = useState({ interest: 1_000_000, isHealthInsured: true, isPidayang: false });
  const [etfInputs, setEtfInputs] = useState({ isDomesticStock: true, distribution: 1_000_000, capitalGain: 5_000_000 });
  const [bondInputs, setBondInputs] = useState({ coupon: 1_000_000, isHealthInsured: true, isPidayang: false });
  const [isaInputs, setIsaInputs] = useState({ profit: 5_000_000, isSeomin: false });
  const [pensionInputs, setPensionInputs] = useState({ contribution: 6_000_000, salaryUnder5500: true });

  const yearendResult = calcYearendDeduction(
    yearendInputs.totalSalary > 0 ? yearendInputs : { ...yearendInputs, totalSalary: laborIncome }
  );
  const effectiveSalary = yearendInputs.totalSalary > 0 ? yearendInputs.totalSalary : laborIncome;

  // 연말정산 추천 (신용+체크가 총급여 25% 문턱을 넘었는지)
  const yeThreshold = Math.floor(effectiveSalary * 0.25);
  const deductibleSpend = yearendInputs.creditCard + yearendInputs.checkCard;
  const belowThreshold = deductibleSpend < yeThreshold;
  const remainToThreshold = Math.max(0, yeThreshold - deductibleSpend);

  // 계산
  const divResult = calcDividendTax({ ...divInputs, laborIncome });
  const capResult = calcCapitalGainTax(capInputs);

  // 예금·채권: 이자도 금융소득(15.4%) — calcDividendTax(isDomestic=true) 재사용
  const depositResult = calcDividendTax({ grossDividend: depositInputs.interest, otherFinancialIncome: 0, laborIncome, isDomestic: true, isHealthInsured: depositInputs.isHealthInsured, isPidayang: depositInputs.isPidayang });
  const bondResult = calcDividendTax({ grossDividend: bondInputs.coupon, otherFinancialIncome: 0, laborIncome, isDomestic: true, isHealthInsured: bondInputs.isHealthInsured, isPidayang: bondInputs.isPidayang });
  // ETF: 국내주식형은 분배금만 과세(매매차익 비과세), 기타형은 분배금+매매차익 모두 배당과세
  const etfResult = (() => {
    const taxableBase = etfInputs.isDomesticStock ? etfInputs.distribution : etfInputs.distribution + etfInputs.capitalGain;
    const div = calcDividendTax({ grossDividend: taxableBase, otherFinancialIncome: 0, laborIncome, isDomestic: true, isHealthInsured: true, isPidayang: false });
    const tax = taxableBase - div.netDividend;
    const totalGross = etfInputs.distribution + etfInputs.capitalGain;
    return { taxableBase, tax, net: totalGross - tax };
  })();
  // ISA: 순이익 200만(서민 400만) 비과세 + 초과 9.9% 분리과세
  const isaResult = (() => {
    const exempt = isaInputs.isSeomin ? 4_000_000 : 2_000_000;
    const taxable = Math.max(0, isaInputs.profit - exempt);
    const tax = Math.floor(taxable * 0.099);
    const normalTax = Math.floor(isaInputs.profit * 0.154);
    return { exempt, taxable, tax, saved: Math.max(0, normalTax - tax) };
  })();
  // 연금저축+IRP: 합산 900만 한도, 총급여 5,500만 이하 16.5% / 초과 13.2% 세액공제
  const pensionResult = (() => {
    const eligible = Math.min(pensionInputs.contribution, 9_000_000);
    const rate = pensionInputs.salaryUnder5500 ? 0.165 : 0.132;
    return { eligible, rate, credit: Math.floor(eligible * rate) };
  })();

  // 총괄: 각 칩 입력을 합산해 금융소득 종합과세 1회 판정 (단일 풀)
  const overview = (() => {
    const interest = depositInputs.interest + bondInputs.coupon;        // 이자 (예금+채권쿠폰)
    const dividend = divInputs.grossDividend + etfResult.taxableBase;   // 배당 (주식+ETF 분배·기타매매)
    const totalFinancial = interest + dividend;
    // 합산 금융소득에 종합과세 1회 적용 (국내 15.4% 기준 근사)
    const fin = calcDividendTax({ grossDividend: totalFinancial, otherFinancialIncome: 0, laborIncome, isDomestic: true, isHealthInsured: divInputs.isHealthInsured, isPidayang: divInputs.isPidayang });
    const financialTaxTotal = totalFinancial - fin.netDividend;          // 원천+종합+지방+건보 합
    const capTaxTotal = capResult.tax + capResult.transactionTax;        // 해외주식 양도세+거래세
    const totalTax = financialTaxTotal + capTaxTotal;
    const totalSaving = isaResult.saved + pensionResult.credit;          // ISA 절세 + 연금 세액공제
    return {
      interest, dividend, totalFinancial, isComprehensive: fin.isComprehensive,
      withheld: fin.withheld, comprehensiveTax: fin.comprehensiveTax, localTax: fin.localTax, healthIns: fin.healthIns,
      financialTaxTotal, capTaxTotal, totalTax, totalSaving,
    };
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
    depositInterest: {
      label: '연간 이자 (세전)', value: depositInputs.interest, unit: '원', step: 500_000,
      set: (v) => setDepositInputs(p => ({ ...p, interest: v })),
      presets: [{ value: 1_000_000, label: '100만' }, { value: 5_000_000, label: '500만' }, { value: 10_000_000, label: '1,000만' }, { value: 20_000_000, label: '2,000만' }],
    },
    etfDistribution: {
      label: 'ETF 분배금 (세전)', value: etfInputs.distribution, unit: '원', step: 500_000,
      set: (v) => setEtfInputs(p => ({ ...p, distribution: v })),
      presets: [{ value: 0, label: '0' }, { value: 1_000_000, label: '100만' }, { value: 3_000_000, label: '300만' }, { value: 5_000_000, label: '500만' }],
    },
    etfCapitalGain: {
      label: 'ETF 매매차익 (세전)', value: etfInputs.capitalGain, unit: '원', step: 1_000_000,
      set: (v) => setEtfInputs(p => ({ ...p, capitalGain: v })),
      presets: [{ value: 0, label: '0' }, { value: 5_000_000, label: '500만' }, { value: 10_000_000, label: '1,000만' }, { value: 30_000_000, label: '3,000만' }],
    },
    bondCoupon: {
      label: '연간 쿠폰 이자 (세전)', value: bondInputs.coupon, unit: '원', step: 500_000,
      set: (v) => setBondInputs(p => ({ ...p, coupon: v })),
      presets: [{ value: 1_000_000, label: '100만' }, { value: 3_000_000, label: '300만' }, { value: 5_000_000, label: '500만' }, { value: 10_000_000, label: '1,000만' }],
    },
    isaProfit: {
      label: 'ISA 만기 순이익', value: isaInputs.profit, unit: '원', step: 1_000_000,
      set: (v) => setIsaInputs(p => ({ ...p, profit: v })),
      presets: [{ value: 2_000_000, label: '200만' }, { value: 4_000_000, label: '400만' }, { value: 10_000_000, label: '1,000만' }, { value: 20_000_000, label: '2,000만' }],
    },
    pensionContribution: {
      label: '연 납입액 (연금저축+IRP)', value: pensionInputs.contribution, unit: '원', step: 500_000,
      set: (v) => setPensionInputs(p => ({ ...p, contribution: v })),
      presets: [{ value: 3_000_000, label: '300만' }, { value: 6_000_000, label: '600만' }, { value: 9_000_000, label: '900만' }],
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
    { id: 'overview', label: '총괄' },
    { id: 'tax', label: '세금 계산' },
  ];
  const ASSET_CHIPS: { id: TaxType; label: string }[] = [
    { id: 'stock', label: '주식' },
    { id: 'deposit', label: '예금·적금' },
    { id: 'etf', label: 'ETF·펀드' },
    { id: 'bond', label: '채권' },
    { id: 'saving', label: '절세계좌' },
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
        {/* ── 총괄 탭 ── */}
        {tab === 'overview' && (
          <div style={{ padding: '12px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* 요약 카드 */}
            <div style={{ background: T.text, borderRadius: 18, padding: 20 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.6)', marginBottom: 6 }}>
                연간 금융소득 (이자+배당)
              </div>
              <div style={{ fontSize: 30, fontWeight: 800, color: '#fff', letterSpacing: '-0.03em', fontVariantNumeric: 'tabular-nums', marginBottom: 8 }}>
                {formatWon(overview.totalFinancial)}
              </div>
              <span style={{
                fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 999,
                background: overview.isComprehensive ? 'rgba(248,113,113,0.2)' : 'rgba(52,211,153,0.2)',
                color: overview.isComprehensive ? '#FCA5A5' : '#6EE7B7',
              }}>
                {overview.isComprehensive ? '종합과세 대상 (2천만 초과)' : '분리과세 (2천만 이하)'}
              </span>
            </div>

            <SectionCard title="금융소득 합산">
              <ResultRow label="이자 (예금·적금 + 채권 쿠폰)" value={formatWon(overview.interest)} />
              <ResultRow label="배당 (주식 + ETF 분배·기타매매)" value={formatWon(overview.dividend)} />
              <div style={{ height: 1, background: T.divider, margin: '4px 0' }} />
              <ResultRow label="합계 금융소득" value={formatWon(overview.totalFinancial)} big />
            </SectionCard>

            <SectionCard title="예상 세금">
              <ResultRow label="원천징수 (15.4%)" value={formatWon(overview.withheld)} color={T.danger} />
              {overview.comprehensiveTax > 0 && <ResultRow label="종합소득세 추가납부" value={formatWon(overview.comprehensiveTax)} color={T.danger} />}
              {overview.localTax > 0 && <ResultRow label="지방소득세" value={formatWon(overview.localTax)} color={T.danger} />}
              {overview.healthIns > 0 && <ResultRow label="건보료 추가분" value={formatWon(overview.healthIns)} color={T.warn} />}
              {overview.capTaxTotal > 0 && <ResultRow label="해외주식 양도세 + 거래세" value={formatWon(overview.capTaxTotal)} color={T.danger} />}
              <div style={{ height: 1, background: T.divider, margin: '4px 0' }} />
              <ResultRow label="총 예상 세금" value={formatWon(overview.totalTax)} color={T.danger} big />
            </SectionCard>

            {overview.totalSaving > 0 && (
              <SectionCard title="절세 (환급)">
                {isaResult.saved > 0 && <ResultRow label="ISA 일반계좌 대비 절세" value={formatWon(isaResult.saved)} color={T.accent} />}
                {pensionResult.credit > 0 && <ResultRow label="연금저축·IRP 세액공제 (환급)" value={formatWon(pensionResult.credit)} color={T.accent} />}
                <div style={{ height: 1, background: T.divider, margin: '4px 0' }} />
                <ResultRow label="총 절세·환급" value={formatWon(overview.totalSaving)} color={T.accent} big />
              </SectionCard>
            )}

            <InfoBanner tone="neutral">
              각 <b>세금 계산</b> 칩(예금·주식·ETF·채권·절세)에서 입력한 값을 합산해 금융소득 종합과세를 <b>한 번에</b> 판정했어요.
              상단 <b>세전 소득</b> 버튼에 근로소득을 넣으면 종합과세 계산이 더 정확해져요.
            </InfoBanner>
          </div>
        )}

        {/* ── 세금 계산 탭 ── */}
        {tab === 'tax' && (
          <>
            {/* 자산종류 칩 (가로 스크롤) */}
            <div style={{ padding: '12px 0 4px', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
              <div style={{ display: 'flex', gap: 8, padding: '0 20px', width: 'max-content' }}>
                {ASSET_CHIPS.map(c => (
                  <button
                    key={c.id}
                    onClick={() => setTaxType(c.id)}
                    style={{
                      flexShrink: 0, padding: '8px 16px', borderRadius: 999,
                      border: `1px solid ${taxType === c.id ? T.text : T.divider}`,
                      background: taxType === c.id ? T.text : 'transparent',
                      color: taxType === c.id ? '#fff' : T.textSec,
                      fontSize: 13, fontWeight: taxType === c.id ? 700 : 600,
                      cursor: 'pointer', letterSpacing: '-0.01em', whiteSpace: 'nowrap', transition: 'all .15s',
                    }}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 예금·적금 */}
            {taxType === 'deposit' && (
              <div style={{ padding: '8px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                <SectionCard title="입력">
                  <InputRow label="연간 이자 (세전)" value={formatWon(depositInputs.interest)} onTap={() => setEditingField('depositInterest')} />
                  <ToggleRow label="직장 건강보험 가입" value={depositInputs.isHealthInsured} onChange={v => setDepositInputs(p => ({ ...p, isHealthInsured: v }))} />
                  <ToggleRow label="피부양자" value={depositInputs.isPidayang} onChange={v => setDepositInputs(p => ({ ...p, isPidayang: v }))} noBorder />
                </SectionCard>
                <SectionCard title="세금 내역">
                  <ResultRow label="이자소득세 원천징수 (15.4%)" value={formatWon(depositResult.withheld)} color={T.danger} />
                  {depositResult.isComprehensive && <ResultRow label="종합소득세 추가납부" value={formatWon(depositResult.comprehensiveTax)} color={T.danger} />}
                  {depositResult.isComprehensive && depositResult.localTax > 0 && <ResultRow label="지방소득세" value={formatWon(depositResult.localTax)} color={T.danger} />}
                  {depositResult.healthIns > 0 && <ResultRow label="건보료" value={formatWon(depositResult.healthIns)} color={T.warn} />}
                  <div style={{ height: 1, background: T.divider, margin: '4px 0' }} />
                  <ResultRow label="세후 실수령 이자" value={formatWon(depositResult.netDividend)} color={T.accent} big />
                  <ResultRow label="실효세율" value={fmtPct(depositResult.effectiveRate)} color={T.textSec} />
                </SectionCard>
                <InfoBanner tone="neutral">예금·적금 이자는 이자소득세 15.4% 원천징수. 이자+배당 합계 연 2천만원 초과 시 종합과세 대상이에요.</InfoBanner>
              </div>
            )}

            {/* ETF·펀드 */}
            {taxType === 'etf' && (
              <div style={{ padding: '8px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                <SectionCard title="ETF·펀드 유형">
                  <ToggleRow label="국내 주식형 ETF" value={etfInputs.isDomesticStock} onChange={v => setEtfInputs(p => ({ ...p, isDomesticStock: v }))} noBorder />
                </SectionCard>
                <InfoBanner tone="neutral">
                  {etfInputs.isDomesticStock
                    ? '국내 주식형 ETF: 매매차익 비과세, 분배금만 배당세 15.4%.'
                    : '기타형(해외·채권·원자재) ETF: 분배금 + 매매차익 모두 배당소득세 15.4% (종합과세 대상).'}
                </InfoBanner>
                <SectionCard title="입력 (세전)">
                  <InputRow label="분배금" value={formatWon(etfInputs.distribution)} onTap={() => setEditingField('etfDistribution')} />
                  <InputRow label={etfInputs.isDomesticStock ? '매매차익 (비과세)' : '매매차익'} value={formatWon(etfInputs.capitalGain)} onTap={() => setEditingField('etfCapitalGain')} noBorder />
                </SectionCard>
                <SectionCard title="세금 내역">
                  {etfInputs.isDomesticStock && (
                    <div style={{ padding: 16, background: T.accentSoft }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: T.accent }}>매매차익 비과세 ✓</div>
                    </div>
                  )}
                  <ResultRow label="과세 대상 (배당소득)" value={formatWon(etfResult.taxableBase)} />
                  <ResultRow label="배당소득세" value={formatWon(etfResult.tax)} color={T.danger} />
                  <div style={{ height: 1, background: T.divider, margin: '4px 0' }} />
                  <ResultRow label="세후 실수령" value={formatWon(etfResult.net)} color={T.accent} big />
                </SectionCard>
              </div>
            )}

            {/* 채권 */}
            {taxType === 'bond' && (
              <div style={{ padding: '8px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                <SectionCard title="입력">
                  <InputRow label="연간 쿠폰 이자 (세전)" value={formatWon(bondInputs.coupon)} onTap={() => setEditingField('bondCoupon')} />
                  <ToggleRow label="직장 건강보험 가입" value={bondInputs.isHealthInsured} onChange={v => setBondInputs(p => ({ ...p, isHealthInsured: v }))} />
                  <ToggleRow label="피부양자" value={bondInputs.isPidayang} onChange={v => setBondInputs(p => ({ ...p, isPidayang: v }))} noBorder />
                </SectionCard>
                <SectionCard title="쿠폰 이자 세금">
                  <ResultRow label="이자소득세 원천징수 (15.4%)" value={formatWon(bondResult.withheld)} color={T.danger} />
                  {bondResult.isComprehensive && <ResultRow label="종합소득세 추가납부" value={formatWon(bondResult.comprehensiveTax)} color={T.danger} />}
                  {bondResult.healthIns > 0 && <ResultRow label="건보료" value={formatWon(bondResult.healthIns)} color={T.warn} />}
                  <div style={{ height: 1, background: T.divider, margin: '4px 0' }} />
                  <ResultRow label="세후 실수령 이자" value={formatWon(bondResult.netDividend)} color={T.accent} big />
                </SectionCard>
                <SectionCard title="채권 매매차익">
                  <div style={{ padding: 16, background: T.accentSoft }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: T.accent, marginBottom: 4 }}>개인 매매차익 비과세 ✓</div>
                    <div style={{ fontSize: 13, color: T.accent, fontWeight: 500 }}>개인투자자의 채권 매매차익은 비과세예요 (금투세 폐지로 유지).</div>
                  </div>
                </SectionCard>
              </div>
            )}

            {/* 절세계좌 (ISA · 연금) */}
            {taxType === 'saving' && (
              <div style={{ padding: '8px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                <SectionCard title="ISA (개인종합자산관리계좌)">
                  <ToggleRow label="서민형 (총급여 5천↓ / 종소 3.8천↓)" value={isaInputs.isSeomin} onChange={v => setIsaInputs(p => ({ ...p, isSeomin: v }))} />
                  <InputRow label="만기 순이익 (이자+배당+매매)" value={formatWon(isaInputs.profit)} onTap={() => setEditingField('isaProfit')} noBorder />
                </SectionCard>
                <SectionCard title="ISA 절세">
                  <ResultRow label={`비과세 한도 (${isaInputs.isSeomin ? '서민형 400만' : '일반 200만'})`} value={`−${formatWon(isaResult.exempt)}`} color={T.accent} />
                  <ResultRow label="과세 대상" value={formatWon(isaResult.taxable)} />
                  <ResultRow label="분리과세 (9.9%)" value={formatWon(isaResult.tax)} color={T.danger} />
                  <div style={{ height: 1, background: T.divider, margin: '4px 0' }} />
                  <ResultRow label="일반계좌 대비 절세액" value={formatWon(isaResult.saved)} color={T.accent} big />
                </SectionCard>
                <SectionCard title="연금저축 · IRP 세액공제">
                  <ToggleRow label="총급여 5,500만 이하 (공제율 16.5%)" value={pensionInputs.salaryUnder5500} onChange={v => setPensionInputs(p => ({ ...p, salaryUnder5500: v }))} />
                  <InputRow label="연 납입액 (연금저축+IRP)" value={formatWon(pensionInputs.contribution)} onTap={() => setEditingField('pensionContribution')} noBorder />
                </SectionCard>
                <SectionCard title="연금 세액공제 (환급)">
                  <ResultRow label="공제 대상 (합산 한도 900만)" value={formatWon(pensionResult.eligible)} />
                  <ResultRow label="공제율" value={fmtPct(pensionResult.rate)} color={T.textSec} />
                  <div style={{ height: 1, background: T.divider, margin: '4px 0' }} />
                  <ResultRow label="예상 세액공제 (연말정산 환급)" value={formatWon(pensionResult.credit)} color={T.accent} big />
                </SectionCard>
                <InfoBanner tone="neutral">ISA: 순이익 200만(서민 400만) 비과세 + 초과분 9.9% 분리과세. 연금저축+IRP 합산 연 900만까지 세액공제(13.2~16.5%).</InfoBanner>
              </div>
            )}

            {/* 주식: 배당세 */}
            {taxType === 'stock' && (
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

            {/* 주식: 양도소득세 */}
            {taxType === 'stock' && (
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

        {/* ── 세금계산: 연말정산 칩 ── */}
        {tab === 'tax' && taxType === 'yearend' && (
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

            {/* 올해 가계부 기반 결제수단별 사용액 */}
            {spendByPay && spendByPay.total > 0 && (
              <SectionCard title={`${currentYear}년 결제수단별 사용액 (가계부)`}>
                {[
                  { label: '신용카드', val: spendByPay.credit, color: T.textSec },
                  { label: '체크카드 · 현금영수증', val: spendByPay.check, color: T.accent },
                  { label: '대중교통', val: spendByPay.transit, color: '#059669' },
                ].map((r) => (
                  <div key={r.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 16px', borderBottom: `1px solid ${T.divider}` }}>
                    <span style={{ fontSize: 14, fontWeight: 600, color: T.text }}>{r.label}</span>
                    <span style={{ fontSize: 15, fontWeight: 700, color: r.color, fontVariantNumeric: 'tabular-nums' }}>{formatWon(r.val)}</span>
                  </div>
                ))}
                {spendByPay.other > 0 && (
                  <div style={{ padding: '13px 16px', borderBottom: `1px solid ${T.divider}` }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: 14, fontWeight: 600, color: T.textTer }}>분류 불가 (간편결제·계좌이체)</span>
                      <span style={{ fontSize: 15, fontWeight: 700, color: T.textTer, fontVariantNumeric: 'tabular-nums' }}>{formatWon(spendByPay.other)}</span>
                    </div>
                    <div style={{ fontSize: 11, color: T.textTer, marginTop: 4, lineHeight: 1.5 }}>
                      간편결제·계좌이체는 실제 결제 카드를 알 수 없어 제외됐어요. 연결된 카드 기준으로 아래 계산기에서 직접 더해주세요.
                    </div>
                  </div>
                )}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 16px' }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: T.textSec }}>합계</span>
                  <span style={{ fontSize: 16, fontWeight: 800, color: T.text, fontVariantNumeric: 'tabular-nums' }}>{formatWon(spendByPay.total)}</span>
                </div>
              </SectionCard>
            )}

            {/* 맞춤 추천 */}
            {effectiveSalary > 0 && spendByPay && spendByPay.total > 0 && (
              <div style={{
                background: belowThreshold ? T.bgSoft : T.accentSoft,
                borderRadius: 16, padding: '14px 16px',
                fontSize: 13, lineHeight: 1.65, color: T.text,
              }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: belowThreshold ? T.textSec : T.accent, marginBottom: 4 }}>
                  💡 맞춤 추천
                </div>
                {belowThreshold ? (
                  <>
                    아직 <b>총급여의 25%</b>({formatWon(yeThreshold)})를 못 채웠어요. 여기까진 어떤 카드든 공제가 없으니
                    <b> 혜택 좋은 신용카드</b>로 쓰는 게 유리해요.{' '}
                    공제를 받으려면 <b>{formatWon(remainToThreshold)}</b>를 더 써서 25% 구간을 넘겨야 해요.
                  </>
                ) : (
                  <>
                    <b>공제 구간 진입!</b> 25%({formatWon(yeThreshold)})를 넘겼어요. 지금부터 쓰는 돈은
                    <b> 체크카드·현금영수증이 30%</b>로 신용카드(15%)보다 <b>2배</b> 공제돼요.{' '}
                    앞으로는 체크카드·현금영수증 위주로 — 1만원당 약 1,500원 더 공제받아요.
                  </>
                )}
              </div>
            )}

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
