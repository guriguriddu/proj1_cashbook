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

  // Map to ParsedRow
  const parsed: ParsedRow[] = transactions
    .filter(t => t.date && t.merchant && t.amount > 0)
    .map((t, idx) => ({
      idx,
      date: t.date,
      merchant: t.merchant.trim(),
      amount: Math.abs(t.amount),
      category: t.category || 'other',
      payMethod: '',
      rawType: '지출',
      rawBigCat: t.originalCategory || '',
      rawSmallCat: '',
      status: 'include' as const,
      selected: true,
    }));

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
  const excluded: ParsedRow[] = [];
  const months = [...new Set(parsed.map(r => r.date.slice(0, 7)))].sort().reverse();

  return { toInclude, needsReview, excluded, months };
}
