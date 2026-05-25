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
  | 'transfer_nudge'    // 이체(타인) → 확인필요, 기본 선택
  | 'finance_nudge'     // 금융 지출 → 확인필요, 기본 선택
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

function merchantSimilar(a: string, b: string): boolean {
  const norm = (s: string) => s.toLowerCase().replace(/[\s()]/g, '').replace(/주식회사|㈜/g, '');
  const na = norm(a);
  const nb = norm(b);
  if (!na || !nb) return false;
  return na === nb || na.includes(nb) || nb.includes(na);
}

// 파일에서 존재하는 월 목록만 추출 (파일 선택 후 월 피커에 사용)
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
  existingExpenses: Expense[]
): ExcelParseResult {
  const wb = XLSX.read(buffer, { type: 'array' });
  const ws = wb.Sheets['가계부 내역'];
  if (!ws) throw new Error('가계부 내역 시트를 찾을 수 없습니다.');

  const rawRows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1 }).slice(1) as unknown[][];
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

      // 간편결제 충전 제외
      if (smallCat === '결제/충전') {
        parsed.push({ ...base, amount: Math.abs(amount), category: 'other', status: 'excluded', excludeReason: '간편결제 충전 (실소비 별도 기록됨)', selected: false });
        return;
      }

      const category = CAT_MAP[bigCat] || 'other';
      const isFinance = bigCat === '금융';

      parsed.push({
        ...base,
        amount: Math.abs(amount),
        category,
        status: isFinance ? 'finance_nudge' : 'include',
        nudgeMessage: isFinance ? '금융 항목입니다. 실소비가 맞다면 가져오세요.' : undefined,
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

      // 타인 송금 (대분류='이체'): 기타 + 넛지, 기본 선택
      if (bigCat === '이체') {
        parsed.push({
          ...base,
          amount: Math.abs(amount),
          category: 'other',
          status: 'transfer_nudge',
          nudgeMessage: '타인에게 보낸 이체입니다. 더치페이 등 실소비라면 포함하세요.',
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
    // 불일치 → refund_partial 그대로 유지 (확인필요 탭)
  });

  // 3단계: 기존 DB 중복 체크
  const existingThisMonth = existingExpenses.filter((e) => e.date.startsWith(month));
  parsed
    .filter((r) => r.status === 'include' || r.status === 'finance_nudge' || r.status === 'transfer_nudge')
    .forEach((row) => {
      const dup = existingThisMonth.find(
        (e) => e.date === row.date && e.amount === row.amount && merchantSimilar(e.merchant, row.merchant)
      );
      if (dup) {
        row.status = 'duplicate_suspect';
        row.selected = false; // 기본 미선택 + 경고
        row.nudgeMessage = `이미 입력된 내역과 같아 보입니다 (${dup.merchant} / ${dup.date})`;
        row.dupExpenseId = dup.id;
      }
    });

  // 4단계: 결과 분류
  const toInclude = parsed.filter((r) => r.status === 'include');
  const needsReview = parsed.filter((r) =>
    ['transfer_nudge', 'finance_nudge', 'duplicate_suspect', 'refund_partial'].includes(r.status)
  );
  const excluded = parsed.filter((r) => r.status === 'excluded' || r.status === 'refund_cancel');
  const months = [...new Set(parsed.map((r) => r.date.slice(0, 7)))].sort().reverse();

  return { toInclude, needsReview, excluded, months };
}
