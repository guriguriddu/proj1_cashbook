// 투자/금융소득 세금 계산 (순수 함수 — UI 비의존, 투자탭·목표탭 공용)

// ─── 종합소득세 ───────────────────────────────────────────────────────────────

export const INCOME_TAX_BRACKETS = [
  { limit: 14_000_000, rate: 0.06, deduction: 0 },
  { limit: 50_000_000, rate: 0.15, deduction: 1_260_000 },
  { limit: 88_000_000, rate: 0.24, deduction: 5_760_000 },
  { limit: 150_000_000, rate: 0.35, deduction: 15_440_000 },
  { limit: 300_000_000, rate: 0.38, deduction: 19_940_000 },
  { limit: 500_000_000, rate: 0.40, deduction: 25_940_000 },
  { limit: 1_000_000_000, rate: 0.42, deduction: 35_940_000 },
  { limit: Infinity, rate: 0.45, deduction: 65_940_000 },
];

export function calcIncomeTax(taxable: number): number {
  for (const b of INCOME_TAX_BRACKETS) {
    if (taxable <= b.limit) return Math.max(0, taxable * b.rate - b.deduction);
  }
  return 0;
}

export function calcLocalTax(incomeTax: number): number {
  return incomeTax * 0.1;
}

const HEALTH_INS_RATE = 0.0709;
const HEALTH_INS_LONG_CARE = 0.1295;

// ─── 배당소득세 (금융소득종합과세 비교과세) ─────────────────────────────────────

export interface TaxResult {
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

export function calcDividendTax(params: {
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
    const alreadyWithheld14 = separateTax + excessFinancial * 0.14;
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

// ─── 양도소득세 ───────────────────────────────────────────────────────────────

export interface CapGainResult {
  gain: number;
  transactionTax: number;
  isTaxExempt: boolean;
  deduction: number;
  taxable: number;
  tax: number;
  net: number;
  effectiveRate: number;
}

export function calcCapitalGainTax(params: {
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

// ─── 포맷·금융 헬퍼 ───────────────────────────────────────────────────────────

export function formatWon(n: number): string {
  const abs = Math.abs(Math.floor(n));
  if (abs >= 100_000_000) {
    const eok = Math.floor(abs / 100_000_000);
    const man = Math.floor((abs % 100_000_000) / 10_000);
    return man > 0 ? `${eok}억 ${man.toLocaleString()}만원` : `${eok}억원`;
  }
  if (abs >= 10_000) return `${Math.floor(abs / 10_000).toLocaleString()}만원`;
  return `${abs.toLocaleString()}원`;
}

export function fmtPct(r: number): string {
  return (r * 100).toFixed(1) + '%';
}

export function solveMonthlyRate(pv: number, pmt: number, fv: number, n: number): number {
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

// ─── 연말정산 ─────────────────────────────────────────────────────────────────

export interface YearendInputs {
  totalSalary: number;
  creditCard: number;
  checkCard: number;
  traditional: number;
  transit: number;
}

// ─── 결제수단 → 소득공제 버킷 분류 ───────────────────────────────────────────
// credit: 신용카드(15%) / check: 체크카드·현금영수증(30%) / transit: 대중교통(40% 추가한도)
// other: 간편결제·계좌이체 등 실제 결제수단 미상(공제 분류 불가)
export type PayBucket = 'credit' | 'check' | 'transit' | 'other';

// 세법상 대중교통: 버스·지하철·기차(KTX/SRT 포함)·교통카드만. 택시·주유·주차·킥보드는 제외.
const PUBLIC_TRANSIT = /지하철|전철|버스|코레일|철도|KTX|SRT|기차|열차|티머니|캐시비|교통카드|후불교통/i;

export function classifyPayMethod(payMethod?: string, category?: string, merchant?: string): PayBucket {
  // 대중교통은 교통비 카테고리 중에서도 실제 대중교통 가맹점만 (택시·주유는 카드 공제율로)
  if (category === 'transport' && merchant && PUBLIC_TRANSIT.test(merchant)) return 'transit';
  const s = (payMethod || '').toLowerCase();
  if (!s) return 'other';
  // 체크카드·현금영수증 (신용보다 먼저 검사 — "체크카드"에 '카드'가 들어가므로)
  // 토스뱅크카드는 '체크' 글자가 없지만 체크카드
  if (/체크|check|현금영수증|현금|토스뱅크카드/.test(s)) return 'check';
  // 신용카드
  if (/카드|card|신용/.test(s)) return 'credit';
  // 간편결제(머니/페이)·계좌이체·통장 등 → 실제 수단 미상
  return 'other';
}

export interface SpendByPay {
  credit: number;
  check: number;
  transit: number;
  other: number;
  total: number;
}

// 특정 연도의 결제수단별 소비 합계
// 분류 불가(간편결제·계좌이체) 결제수단에 사용자가 직접 지정한 버킷
// 'exclude' = 공제 대상 아님으로 확정 (현금영수증 미발급 계좌이체 등)
export type PayOverride = 'credit' | 'check' | 'exclude';

type SpendItem = { amount: number; payMethod?: string; category: string; date: string; merchant?: string };

export function summarizeSpendByPay(
  items: SpendItem[],
  year: number,
  overrides?: Record<string, PayOverride>
): SpendByPay {
  const sum: SpendByPay = { credit: 0, check: 0, transit: 0, other: 0, total: 0 };
  const yp = String(year);
  for (const e of items) {
    if (!e.date.startsWith(yp)) continue;
    let bucket = classifyPayMethod(e.payMethod, e.category, e.merchant);
    if (bucket === 'other') {
      const ov = overrides?.[(e.payMethod || '').trim()];
      if (ov === 'credit' || ov === 'check') bucket = ov;
    }
    sum[bucket] += e.amount;
    sum.total += e.amount;
  }
  return sum;
}

// 분류 불가 항목을 결제수단별로 묶어 반환 (직접 지정 UI용, 금액 큰 순)
export interface OtherPayGroup {
  payMethod: string;
  amount: number;
  count: number;
}

export function groupOtherPayMethods(items: SpendItem[], year: number): OtherPayGroup[] {
  const map = new Map<string, OtherPayGroup>();
  const yp = String(year);
  for (const e of items) {
    if (!e.date.startsWith(yp)) continue;
    if (classifyPayMethod(e.payMethod, e.category, e.merchant) !== 'other') continue;
    const key = (e.payMethod || '').trim();
    const g = map.get(key) ?? { payMethod: key, amount: 0, count: 0 };
    g.amount += e.amount;
    g.count += 1;
    map.set(key, g);
  }
  return [...map.values()].sort((a, b) => b.amount - a.amount);
}

export function calcYearendDeduction(inputs: YearendInputs) {
  const { totalSalary, creditCard, checkCard, traditional, transit } = inputs;
  const threshold = Math.floor(totalSalary * 0.25);

  // 최저사용금액(총급여 25%)은 세법상 신용 → 체크·현금 → 전통시장 → 대중교통 순으로 소진.
  // 총사용액이 문턱에 못 미치면 전통시장·대중교통 포함 공제 0원.
  let remainingThreshold = threshold;
  const afterThreshold = (amount: number) => {
    const consumed = Math.min(amount, remainingThreshold);
    remainingThreshold -= consumed;
    return amount - consumed;
  };
  const creditEligible = afterThreshold(creditCard);
  const checkEligible = afterThreshold(checkCard);
  const traditionalEligible = afterThreshold(traditional);
  const transitEligible = afterThreshold(transit);

  const creditDeduction = Math.floor(creditEligible * 0.15);
  const checkDeduction = Math.floor(checkEligible * 0.30);
  const traditionalDeduction = Math.floor(traditionalEligible * 0.40);
  const transitDeduction = Math.floor(transitEligible * 0.40);

  // 한도(2023 개정): 기본한도 300만(총급여 7천 초과 250만)
  // + 추가한도(전통시장·대중교통 합산) 300만(총급여 7천 초과 200만)
  const under70m = totalSalary <= 70_000_000;
  const baseLimit = under70m ? 3_000_000 : 2_500_000;
  const extraLimit = under70m ? 3_000_000 : 2_000_000;
  const baseDeduction = Math.min(creditDeduction + checkDeduction, baseLimit);
  const extraDeduction = Math.min(traditionalDeduction + transitDeduction, extraLimit);
  const totalDeduction = baseDeduction + extraDeduction;

  return {
    threshold, creditDeduction, checkDeduction,
    traditionalDeduction, transitDeduction,
    baseLimit, extraLimit, baseDeduction, extraDeduction,
    totalDeduction, remainingThreshold,
  };
}
