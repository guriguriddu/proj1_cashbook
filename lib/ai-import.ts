import type { Expense } from '@/types';
import type { ParsedRow, ExcelParseResult } from './excel-import';

interface AiTransaction {
  date: string;
  merchant: string;
  amount: number;
  category: string;
  originalCategory?: string;
}

function merchantSimilar(a: string, b: string): boolean {
  const norm = (s: string) => s.toLowerCase().replace(/[\s()]/g, '').replace(/주식회사|㈜/g, '');
  const na = norm(a); const nb = norm(b);
  if (!na || !nb) return false;
  return na === nb || na.includes(nb) || nb.includes(na);
}

export async function parseFileWithAI(
  file: File,
  existingExpenses: Expense[]
): Promise<ExcelParseResult> {
  const formData = new FormData();
  formData.append('file', file);

  const res = await fetch('/api/parse-file', { method: 'POST', body: formData });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || '파일 분석에 실패했습니다');
  }

  const { transactions } = (await res.json()) as { transactions: AiTransaction[] };

  if (!Array.isArray(transactions) || transactions.length === 0) {
    throw new Error('거래 내역을 찾지 못했습니다. 파일을 확인해주세요.');
  }

  let idxCounter = 0;
  const included: ParsedRow[] = [];
  const excluded: ParsedRow[] = [];

  for (const t of transactions) {
    if (!t.date || !t.merchant) continue;
    const abs = Math.abs(t.amount);
    if (abs === 0) continue;

    const row: ParsedRow = {
      idx: idxCounter++,
      date: t.date,
      merchant: t.merchant.trim(),
      amount: abs,
      category: t.category || 'other',
      payMethod: '',
      rawType: t.amount < 0 ? '취소/환불' : '지출',
      rawBigCat: t.originalCategory || '',
      rawSmallCat: '',
      status: 'include' as const,
      selected: true,
    };

    if (t.amount < 0) {
      // 음수 금액 = 취소·환불·역발행 → 제외됨으로 분류
      row.status = 'excluded' as const;
      row.selected = false;
      row.excludeReason = '결제 취소됨';
      excluded.push(row);
    } else {
      included.push(row);
    }
  }

  // 쌍 상쇄 감지: 동일 금액·가맹점 양수/음수 쌍이 있으면 양수 항목도 제외됨으로 이동
  // 음수 항목의 레이블도 "결제 최종 취소됨"으로 업데이트
  const cancelSet = new Set(excluded.map(r => `${r.date}|${r.merchant}|${r.amount}`));
  const parsed: ParsedRow[] = [];
  for (const row of included) {
    const key = `${row.date}|${row.merchant}|${row.amount}`;
    if (cancelSet.has(key)) {
      row.status = 'excluded' as const;
      row.selected = false;
      row.excludeReason = '결제 최종 취소됨';
      excluded.push(row);
      // 음수 원본도 레이블 업데이트
      const cancelOrigin = excluded.find(r => `${r.date}|${r.merchant}|${r.amount}` === key && r.excludeReason === '결제 취소됨');
      if (cancelOrigin) cancelOrigin.excludeReason = '결제 최종 취소됨';
    } else {
      parsed.push(row);
    }
  }

  // Duplicate detection
  parsed.forEach(row => {
    const dup = existingExpenses.find(
      e => e.date === row.date && e.amount === row.amount && merchantSimilar(e.merchant, row.merchant)
    );
    if (dup) {
      row.status = 'duplicate_suspect';
      row.selected = false;
      row.nudgeMessage = `이미 입력된 내역과 같아 보입니다 (${dup.merchant} / ${dup.date})`;
      row.dupExpenseId = dup.id;
    }
  });

  const toInclude = parsed.filter(r => r.status === 'include');
  const needsReview = parsed.filter(r => r.status === 'duplicate_suspect');
  const months = [...new Set([...parsed, ...excluded].map(r => r.date.slice(0, 7)))].sort().reverse();

  return { toInclude, needsReview, excluded, months };
}
