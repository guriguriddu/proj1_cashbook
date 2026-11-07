// 연말정산 전용 뱅크샐러드 엑셀 파서
// 가계부용 파서(excel-import)와 달리 n빵·이체 추정 없이 "카드로 결제한 원금"을 그대로 읽는다.
// 환불(+)만 차감하고, 세법상 카드 공제 대상이 아닌 항목은 excludeReason을 달아 분리한다.
import * as XLSX from 'xlsx';
import { serialToDate } from '@/lib/excel-import';

export interface YearendItem {
  date: string;
  merchant: string;
  amount: number; // 환불은 음수
  payMethod: string;
  category: string; // 'transport' 등 (대중교통 판별용)
  excludeReason?: string; // 공제 제외로 분류된 사유
}

export interface YearendParseResult {
  items: YearendItem[];
  years: number[]; // 파일에 존재하는 연도 (최신순)
}

// 신용카드 등 소득공제 제외 항목 (보험료·공과금·통신비·세금·통행료·상품권 등)
function excludeReason(bigCat: string, smallCat: string, merchant: string): string | undefined {
  const all = `${bigCat} ${smallCat} ${merchant}`;
  if (bigCat === '금융' || /보험/.test(all)) return '보험·금융';
  if (/국세|지방세|세금|자동차세|재산세|주민세/.test(all)) return '세금';
  if (bigCat === '주거/통신' || /관리비|전기요금|수도요금|도시가스|통신요금/.test(all)) return '주거·통신·공과금';
  if (/하이패스|통행료/.test(all)) return '통행료';
  if (/상품권/.test(all)) return '상품권';
  if (/등록금|유치원|어린이집|대학교/.test(all)) return '교육비';
  return undefined;
}

export function parseYearendFile(buffer: ArrayBuffer): YearendParseResult {
  const wb = XLSX.read(buffer, { type: 'array' });
  const ws = wb.Sheets['가계부 내역'];
  if (!ws) throw new Error('가계부 내역 시트를 찾을 수 없습니다. 뱅크샐러드 엑셀 파일이 맞나요?');

  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1 }).slice(1) as unknown[][];
  const items: YearendItem[] = [];
  const years = new Set<number>();

  for (const row of rows) {
    const serial = row[0];
    if (typeof serial !== 'number' || serial < 40000) continue;
    const date = serialToDate(serial);

    const type = String(row[2] || '');
    const bigCat = String(row[3] || '');
    const smallCat = String(row[4] || '');
    const merchant = String(row[5] || '').trim();
    const amount = Number(row[6]);
    const currency = String(row[7] || 'KRW');
    const payMethod = String(row[8] || '').trim();

    if (type !== '지출' || !merchant || isNaN(amount) || amount === 0) continue;
    if (currency !== 'KRW') continue; // 해외 사용액은 공제 대상 아님
    if (smallCat === '결제/충전') continue; // 충전은 실제 사용 시점에 집계

    // 소액 포인트·적립 취소는 환불로 보지 않음
    if (amount > 0 && (amount <= 5000 || merchant.includes('취소 적립') || merchant.includes('포인트 취소'))) continue;

    years.add(Number(date.slice(0, 4)));
    items.push({
      date,
      merchant,
      amount: -amount, // 지출(−)은 양수 사용액, 환불(+)은 음수로
      payMethod,
      category: bigCat === '교통' ? 'transport' : 'other',
      excludeReason: excludeReason(bigCat, smallCat, merchant),
    });
  }

  return { items, years: [...years].sort((a, b) => b - a) };
}
