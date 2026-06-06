import * as XLSX from 'xlsx';
import type { Expense } from '@/types';

// 뱅샐 대분류 → 앱 카테고리 ID
const CAT_MAP: Record<string, string> = {
  '식비': 'food',
  '카페/간식': 'cafe',
  '술/유흥': 'food',
  '패션/쇼핑': 'shopping',
  '온라인쇼핑': 'shopping',
  '뷰티/미용': 'shopping',
  '생활': 'shopping',
  '교통': 'transport',
  '주거/통신': 'telecom',
  '교육/학습': 'education',
  '여행/숙박': 'travel',
  '의료/건강': 'other',
  '문화/여가': 'other',
  '경조/선물': 'other',
  '반려동물': 'other',
  '금융': 'other',
  '미분류': 'other',
};

export type RowStatus =
  | 'include'           // 일반 지출 → 가져올 항목
  | 'dutch_pay'         // n빵 감지됨 → 가져올 항목 (순금액)
  | 'transfer_nudge'    // 이체(타인) → 확인필요, 기본 선택
  | 'finance_nudge'     // 금융 지출 → 확인필요, 기본 선택
  | 'charge_nudge'      // 간편결제 충전(실결제 못 찾음) → 확인필요, 기본 미선택
  | 'duplicate_suspect' // 중복 의심 → 확인필요, 기본 미선택
  | 'refund_cancel'     // 환불로 상계됨 → 제외
  | 'refund_partial'    // 부분환불(금액불일치) → 확인필요, 기본 미선택
  | 'excluded';         // 제외

export interface ParsedRow {
  idx: number;
  date: string;
  merchant: string;
  amount: number;
  category: string;
  payMethod: string;
  rawType: string;
  rawBigCat: string;
  rawSmallCat: string;
  status: RowStatus;
  excludeReason?: string;
  nudgeMessage?: string;
  selected: boolean;
  refundPartnerIdx?: number;
  dupExpenseId?: string;
  learnedCategory?: boolean;       // 과거 분류 학습으로 카테고리 자동 적용됨
  overseasSettled?: boolean;       // 해외결제 실청구액으로 금액 교체됨
  overseasOriginalAmount?: number; // 교체 전(가결제) 금액
  chargeLinkedIdx?: number;        // 충전↔실결제 연결 상대 행 idx
  dutchPay?: {
    originalAmount: number;
    receivedTotal: number;
    myShare: number;
    peopleCount: number;
  };
}

export interface ExcelParseResult {
  toInclude: ParsedRow[];
  needsReview: ParsedRow[];
  excluded: ParsedRow[];
  months: string[]; // 파일 내 존재하는 월 목록 (YYYY-MM)
}

// Excel serial date → YYYY-MM-DD
function serialToDate(serial: number): string {
  const ms = Math.round((serial - 25569) * 86400 * 1000);
  const d = new Date(ms);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// 가맹점명 정규화 (학습/중복 매칭 공용)
function normMerchant(s: string): string {
  return s.trim().toLowerCase().replace(/[\s()]/g, '').replace(/주식회사|㈜/g, '');
}

function merchantSimilar(a: string, b: string): boolean {
  const na = normMerchant(a);
  const nb = normMerchant(b);
  if (!na || !nb) return false;
  return na === nb || na.includes(nb) || nb.includes(na);
}

// 해외결제 실청구(확정환율) 항목 가맹점 패턴
const OVERSEAS_SETTLE = /비자해외|마스터해외|해외승인대금|해외이용대금|해외매입|해외매출|해외승인/;

function daysApart(a: string, b: string): number {
  return Math.abs((new Date(a).getTime() - new Date(b).getTime()) / 86400000);
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

// n빵 감지: food 지출 + 7일 내 입금 이체에서 N등분 패턴 탐색
function findDutchPay(
  expenseAmount: number,
  expenseDate: string,
  pool: { date: string; amount: number; used: boolean }[]
): { N: number; transfers: typeof pool; receivedTotal: number } | null {
  const deadline = addDays(expenseDate, 7);
  const candidates = pool.filter(
    (t) => !t.used && t.date >= expenseDate && t.date <= deadline
  );
  if (candidates.length === 0) return null;

  let best: { N: number; transfers: typeof pool; receivedTotal: number } | null = null;

  for (let N = 2; N <= 8; N++) {
    const perPerson = expenseAmount / N;
    const tolerance = perPerson * 0.15;
    const matching = candidates.filter((t) => Math.abs(t.amount - perPerson) <= tolerance);

    if (matching.length === 0) continue;

    const receivedTotal = matching.reduce((s, t) => s + t.amount, 0);
    // 받은 금액이 전체의 30% 이상이어야 의미 있는 n빵
    if (receivedTotal < expenseAmount * 0.3) continue;

    // 더 많은 매칭이 있는 N을 우선
    if (!best || matching.length > best.transfers.length) {
      best = { N, transfers: matching, receivedTotal };
    }
  }

  return best;
}

// 파일에서 존재하는 월 목록만 추출
export function detectMonths(buffer: ArrayBuffer): string[] {
  const wb = XLSX.read(buffer, { type: 'array' });
  const ws = wb.Sheets['가계부 내역'];
  if (!ws) return [];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1 }).slice(1) as unknown[][];
  const months = new Set<string>();
  rows.forEach((row) => {
    const serial = row[0];
    if (typeof serial !== 'number' || serial < 40000) return;
    const dateStr = serialToDate(serial);
    months.add(dateStr.slice(0, 7));
  });
  return [...months].sort().reverse();
}

export function parseExcel(
  buffer: ArrayBuffer,
  month: string,
  existingExpenses: Expense[],
  defaultTransferCategory = 'food'
): ExcelParseResult {
  const wb = XLSX.read(buffer, { type: 'array' });
  const ws = wb.Sheets['가계부 내역'];
  if (!ws) throw new Error('가계부 내역 시트를 찾을 수 없습니다.');

  const rawRows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1 }).slice(1) as unknown[][];

  // 0-pre단계: 학습 — 과거 저장 내역에서 가맹점→카테고리를 기억(최근 값 우선)
  // 회원님이 직접 정한 분류를 같은 가맹점에 자동 적용한다.
  const learnedCatMap = new Map<string, string>();
  existingExpenses
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date)) // 최근 값이 나중에 덮어쓰도록
    .forEach((e) => {
      if (e.merchant && e.category) learnedCatMap.set(normMerchant(e.merchant), e.category);
    });

  // 0단계: 파일 전체에서 입금 이체 수집 (n빵 감지용, 월 필터 없음)
  const incomingPool: { date: string; amount: number; used: boolean }[] = [];
  rawRows.forEach((row) => {
    const serial = row[0];
    if (typeof serial !== 'number' || serial < 40000) return;
    const type = String(row[2] || '');
    const bigCat = String(row[3] || '');
    const amount = Number(row[6]);
    const currency = String(row[7] || 'KRW');
    if (type === '이체' && amount > 0 && currency === 'KRW' && bigCat !== '내계좌이체') {
      incomingPool.push({ date: serialToDate(serial), amount, used: false });
    }
  });

  const parsed: ParsedRow[] = [];

  // 1단계: 행별 1차 분류
  rawRows.forEach((row, idx) => {
    const serial = row[0];
    if (typeof serial !== 'number' || serial < 40000) return;

    const dateStr = serialToDate(serial);
    if (!dateStr.startsWith(month)) return;

    const type = String(row[2] || '');
    const bigCat = String(row[3] || '');
    const smallCat = String(row[4] || '');
    const merchant = String(row[5] || '').trim();
    const amount = Number(row[6]);
    const currency = String(row[7] || 'KRW');
    const payMethod = String(row[8] || '');

    if (!merchant || isNaN(amount)) return;

    const base = { idx, date: dateStr, merchant, payMethod, rawType: type, rawBigCat: bigCat, rawSmallCat: smallCat };

    // 외화 제외
    if (currency !== 'KRW') {
      parsed.push({ ...base, amount: Math.abs(amount), category: 'other', status: 'excluded', excludeReason: '외화 거래', selected: false });
      return;
    }

    // 수입 제외
    if (type === '수입') {
      parsed.push({ ...base, amount: Math.abs(amount), category: 'other', status: 'excluded', excludeReason: '수입 항목', selected: false });
      return;
    }

    if (type === '지출') {
      // 환불(양수 금액)
      if (amount > 0) {
        if (amount <= 5000 || merchant.includes('취소 적립') || merchant.includes('포인트 취소')) {
          parsed.push({ ...base, amount, category: 'other', status: 'excluded', excludeReason: '소액 포인트/적립 취소', selected: false });
        } else {
          parsed.push({ ...base, amount, category: 'other', status: 'refund_partial', nudgeMessage: '환불/취소 항목입니다', selected: false });
        }
        return;
      }

      // 간편결제 충전 — 무조건 제외하지 않고 일단 보류.
      // 같은 날·같은 금액 실제 결제와 연결되면 제외(중복방지), 못 찾으면 확인필요로 남김(아래 단계).
      if (smallCat === '결제/충전') {
        parsed.push({ ...base, amount: Math.abs(amount), category: 'other', status: 'charge_nudge', nudgeMessage: '간편결제 충전입니다. 같은 날 실제 결제가 있으면 자동 제외돼요.', selected: false });
        return;
      }

      const baseCategory = CAT_MAP[bigCat] || 'other';
      const learned = learnedCatMap.get(normMerchant(merchant));
      const category = learned ?? baseCategory;
      const isFinance = bigCat === '금융';

      parsed.push({
        ...base,
        amount: Math.abs(amount),
        category,
        status: isFinance ? 'finance_nudge' : 'include',
        nudgeMessage: isFinance ? '금융 항목입니다. 실소비가 맞다면 가져오세요.' : undefined,
        learnedCategory: !!learned && learned !== baseCategory,
        selected: true,
      });
      return;
    }

    if (type === '이체') {
      // 내계좌이체 제외
      if (bigCat === '내계좌이체') {
        parsed.push({ ...base, amount: Math.abs(amount), category: 'other', status: 'excluded', excludeReason: '내 계좌 간 이체', selected: false });
        return;
      }

      // 투자/저축/카드대금 등 제외
      if (['투자', '저축', '카드대금', '금융수입', '기타수입', '현금'].includes(bigCat)) {
        parsed.push({ ...base, amount: Math.abs(amount), category: 'other', status: 'excluded', excludeReason: `${bigCat} 이체`, selected: false });
        return;
      }

      // 입금 방향 이체 제외
      if (amount > 0) {
        parsed.push({ ...base, amount, category: 'other', status: 'excluded', excludeReason: '입금 이체', selected: false });
        return;
      }

      // 타인 송금 (대분류='이체'): 학습값 있으면 우선, 없으면 defaultTransferCategory(기본 식비), 확인필요
      if (bigCat === '이체') {
        const learnedT = learnedCatMap.get(normMerchant(merchant));
        parsed.push({
          ...base,
          amount: Math.abs(amount),
          category: learnedT ?? defaultTransferCategory,
          status: 'transfer_nudge',
          nudgeMessage: '타인에게 보낸 이체입니다. 더치페이 등 실소비라면 포함하세요.',
          learnedCategory: !!learnedT,
          selected: true,
        });
        return;
      }

      // 나머지 이체 제외
      parsed.push({ ...base, amount: Math.abs(amount), category: 'other', status: 'excluded', excludeReason: `기타 이체 (${bigCat})`, selected: false });
    }
  });

  // 2단계: 환불 페어 매칭
  const refunds = parsed.filter((r) => r.status === 'refund_partial');
  const expenses = parsed.filter((r) => r.status === 'include' || r.status === 'finance_nudge');

  refunds.forEach((refund) => {
    const pairIdx = expenses.findIndex(
      (exp) =>
        exp.merchant === refund.merchant &&
        exp.amount === refund.amount &&
        Math.abs(new Date(exp.date).getTime() - new Date(refund.date).getTime()) <=
          60 * 24 * 60 * 60 * 1000
    );

    if (pairIdx >= 0) {
      const pair = expenses[pairIdx];
      refund.status = 'refund_cancel';
      refund.excludeReason = `${pair.date} 결제분 환불 → 상계 처리`;
      refund.selected = false;
      refund.refundPartnerIdx = pair.idx;

      pair.status = 'refund_cancel';
      pair.excludeReason = `${refund.date} 환불로 상계됨`;
      pair.selected = false;
      pair.refundPartnerIdx = refund.idx;
    }
  });

  // 2.5단계: 충전 ↔ 실제 결제 연결
  // 충전을 무조건 제외하면 실소비가 누락될 수 있으므로, 같은 날·같은 금액의 실제 결제가
  // 있을 때만 충전을 제외(중복방지)하고, 못 찾으면 'charge_nudge'(확인필요)로 남긴다.
  const charges = parsed.filter((r) => r.status === 'charge_nudge');
  const payRows = parsed.filter((r) => r.status === 'include');
  charges.forEach((charge) => {
    const pay = payRows.find(
      (p) =>
        p.amount === charge.amount &&
        p.date === charge.date &&
        p.chargeLinkedIdx === undefined &&
        !/송금|이체/.test(p.merchant) // 타인 송금/이체는 '결제'로 보지 않음
    );
    if (pay) {
      charge.status = 'excluded';
      charge.excludeReason = '실제 결제와 연결 (충전 자동 제외)';
      charge.chargeLinkedIdx = pay.idx;
      pay.chargeLinkedIdx = charge.idx;
    }
  });

  // 3단계: n빵 자동 감지 (식비 2만원 이상)
  parsed
    .filter((r) => r.status === 'include' && r.category === 'food' && r.amount >= 20000)
    .sort((a, b) => a.date.localeCompare(b.date)) // 날짜순으로 처리
    .forEach((row) => {
      const match = findDutchPay(row.amount, row.date, incomingPool);
      if (!match) return;

      match.transfers.forEach((t) => (t.used = true));
      const myShare = row.amount - match.receivedTotal;
      row.dutchPay = {
        originalAmount: row.amount,
        receivedTotal: match.receivedTotal,
        myShare,
        peopleCount: match.N,
      };
      row.amount = myShare;
      row.status = 'dutch_pay';
      row.nudgeMessage = `n빵 감지 · ${match.N}명 · 받은 금액 ${match.receivedTotal.toLocaleString()}원`;
    });

  // 3.5단계: 해외결제 가결제 ↔ 실청구 통합 (보수적)
  // 해외 카드결제는 가결제(추정환율)와 실청구(비자해외승인대금 등, 확정환율)가 둘 다 뜨고
  // 금액이 환율로 조금 다르다. 실청구는 가맹점명이 없으니, 같은 금액(±5%)·날짜(±7일)인
  // 가결제가 정확히 1건일 때만 가결제 금액을 실청구액으로 바꾸고 실청구는 제외한다.
  parsed
    .filter((s) => s.status !== 'excluded' && s.status !== 'refund_cancel' && OVERSEAS_SETTLE.test(s.merchant))
    .forEach((settle) => {
      const candidates = parsed.filter(
        (p) =>
          p !== settle &&
          (p.status === 'include' || p.status === 'dutch_pay') &&
          !p.overseasSettled &&
          !OVERSEAS_SETTLE.test(p.merchant) &&
          settle.amount > 0 &&
          Math.abs(p.amount - settle.amount) / settle.amount <= 0.05 &&
          daysApart(p.date, settle.date) <= 7
      );
      if (candidates.length === 1) {
        const prov = candidates[0];
        prov.overseasSettled = true;
        prov.overseasOriginalAmount = prov.amount;
        prov.amount = settle.amount; // 실청구액으로 교체
        settle.status = 'excluded';
        settle.excludeReason = '해외결제 실청구액으로 통합';
      }
    });

  // 4단계: 기존 DB 중복 체크
  const existingThisMonth = existingExpenses.filter((e) => e.date.startsWith(month));
  parsed
    .filter((r) => ['include', 'dutch_pay', 'finance_nudge', 'transfer_nudge'].includes(r.status))
    .forEach((row) => {
      const dup = existingThisMonth.find(
        (e) => e.date === row.date && e.amount === row.amount && merchantSimilar(e.merchant, row.merchant)
      );
      if (dup) {
        row.status = 'duplicate_suspect';
        row.selected = false;
        row.nudgeMessage = `이미 입력된 내역과 같아 보입니다 (${dup.merchant} / ${dup.date})`;
        row.dupExpenseId = dup.id;
      }
    });

  // 5단계: 결과 분류
  const toInclude = parsed.filter((r) => r.status === 'include' || r.status === 'dutch_pay');
  const needsReview = parsed.filter((r) =>
    ['transfer_nudge', 'finance_nudge', 'charge_nudge', 'duplicate_suspect', 'refund_partial'].includes(r.status)
  );
  const excluded = parsed.filter((r) => r.status === 'excluded' || r.status === 'refund_cancel');
  const months = [...new Set(parsed.map((r) => r.date.slice(0, 7)))].sort().reverse();

  return { toInclude, needsReview, excluded, months };
}
