'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Screen,
  AppHeader,
  ScreenBody,
  T,
  PrimaryButton,
  SecondaryButton,
  MoneyText,
  Badge,
  CatIcon,
  BottomSheet,
  FieldRow,
  DatePicker,
} from '@/components/ui';
import { saveExpenses, generateId, getExpenses } from '@/lib/supabase-storage';
import { formatDateShort, groupByDate } from '@/lib/utils';
import { DEFAULT_CATEGORIES, getCategoryById } from '@/constants/categories';
import type { ExtractedTransaction, Expense } from '@/types';

interface ReviewItem extends ExtractedTransaction {
  excluded: boolean;
  isDuplicate?: boolean;      // 중복 의심 (추출 내 중복)
  duplicateOf?: string;       // 중복 원본 ID
  removedDuplicateCount?: number; // 이 항목에서 제거된 중복 수
  isExistingDuplicate?: boolean;  // DB에 이미 존재하는 내역
  existingExpenseId?: string;     // 기존 DB 내역 ID
  isCancellation?: boolean;   // 취소 내역
  cancelledBy?: string;       // 이 결제를 취소한 내역 ID
  cancels?: string;           // 이 취소가 상쇄하는 결제 ID
  isPaymentTransfer?: boolean;    // 간편결제 충전/이체 내역
  linkedPaymentId?: string;       // 연결된 실제 결제 ID
  linkedTransferId?: string;      // 이 결제와 연결된 충전 ID
}

// 취소 관련 키워드
const CANCEL_KEYWORDS = ['취소', '환불', '반품', '취소완료', '결제취소', '주문취소'];

// 간편결제/쇼핑몰 선불머니 키워드
const PAYMENT_TRANSFER_KEYWORDS = [
  '카카오페이', 'kakaopay', '카카오 페이',
  '네이버페이', 'naverpay', '네이버 페이', 'npay',
  '토스', 'toss', '토스머니',
  '페이코', 'payco',
  '삼성페이', 'samsung pay',
  '애플페이', 'apple pay',
  '무신사머니', '무신사 머니',
  '당근페이', '당근머니',
  '쿠팡페이', '쿠팡 페이',
  '배민페이', '배민머니',
  '마켓컬리', '컬리캐시',
  '지그재그', '에이블리',
  '하나머니', '하나 머니',
  'KB페이', 'kbpay',
  '티머니', 'T-money',
  '캐시비',
];

// 은행 이체 키워드
const BANK_TRANSFER_KEYWORDS = ['이체', '송금', '충전', '입금'];

export default function OCRReviewPage() {
  const router = useRouter();
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [excludeConfirm, setExcludeConfirm] = useState<string | null>(null); // 제외 확인 대상 ID
  const [batchEditDate, setBatchEditDate] = useState<string | null>(null); // 일괄 수정할 원래 날짜
  const [showExitConfirm, setShowExitConfirm] = useState(false); // 뒤로가기 확인 모달
  const [uploadedImagePaths, setUploadedImagePaths] = useState<string[]>([]); // 업로드된 이미지 경로

  useEffect(() => {
    setMounted(true);
    const loadData = async () => {
      // sessionStorage에서 추출된 데이터 로드
      const stored = sessionStorage.getItem('ocrTransactions');
      const storedImages = sessionStorage.getItem('uploadedImagePaths');
      if (storedImages) {
        setUploadedImagePaths(JSON.parse(storedImages));
      }
      if (stored) {
        const transactions: ExtractedTransaction[] = JSON.parse(stored);
        // 기존 DB 데이터 가져오기
        const existingExpenses = await getExpenses();
        const processedItems = processTransactions(transactions, existingExpenses);
        setItems(processedItems);
      }
    };
    loadData();
  }, []);

  // 중복 및 취소 내역 감지
  function processTransactions(transactions: ExtractedTransaction[], existingExpenses: Expense[]): ReviewItem[] {
    const items: ReviewItem[] = transactions.map((t) => ({
      ...t,
      excluded: t.isExcluded || false,
    }));

    // 0. 기존 DB 데이터와 중복 확인 (유사 merchant 이름 포함)
    const normMerchant = (s: string) => s.trim().toLowerCase().replace(/[\s()]/g, '').replace(/주식회사|㈜/g, '');
    items.forEach((item) => {
      const existingItem = existingExpenses.find((e) => {
        if (e.date !== item.date || e.amount !== item.amount) return false;
        const na = normMerchant(e.merchant);
        const nb = normMerchant(item.merchant);
        return na === nb || na.includes(nb) || nb.includes(na);
      });
      if (existingItem) {
        item.isExistingDuplicate = true;
        item.existingExpenseId = existingItem.id;
      }
    });

    // 1-pre. 가승인/선승인/임시승인은 쌍 여부와 무관하게 무조건 제외
    // 가승인은 실제 청구가 아닌 임시 승인 — 항상 다른 이름의 실제 청구로 대체됨
    const PREAUTH_KEYWORDS = ['가승인', '선승인', '임시승인'];
    items.forEach((item) => {
      if (!item.excluded && PREAUTH_KEYWORDS.some(kw => item.merchant.includes(kw))) {
        item.excluded = true;
        item.excludeReason = '가승인 (임시 승인, 실제 청구 아님)';
      }
    });

    // 1. 추출 내 중복 감지: 같은 날짜 + 같은 금액 + 같은 사용처
    const seen = new Map<string, string>(); // key -> first item id
    items.forEach((item) => {
      if (item.excluded) return; // 이미 제외된 항목 스킵
      const key = `${item.date}_${item.amount}_${item.merchant.trim().toLowerCase()}`;
      if (seen.has(key)) {
        item.isDuplicate = true;
        item.duplicateOf = seen.get(key);
        const isPreauthPair = PREAUTH_KEYWORDS.some(kw => item.merchant.includes(kw));
        if (isPreauthPair) {
          item.excluded = true;
          item.excludeReason = '결제 최종 취소됨';
          const original = items.find(i => i.id === item.duplicateOf);
          if (original) {
            original.excluded = true;
            original.excludeReason = '결제 최종 취소됨';
            original.isDuplicate = false;
          }
        } else {
          const original = items.find(i => i.id === item.duplicateOf);
          if (original) {
            original.removedDuplicateCount = (original.removedDuplicateCount || 0) + 1;
          }
        }
      } else {
        seen.set(key, item.id);
      }
    });

    // 2. 취소 내역 감지
    items.forEach((item) => {
      const merchantLower = item.merchant.toLowerCase();
      if (CANCEL_KEYWORDS.some((kw) => merchantLower.includes(kw))) {
        item.isCancellation = true;
      }
    });

    // 3. 결제-취소 매칭: 취소 내역과 같은 금액의 결제 내역 찾기
    const cancellations = items.filter((i) => i.isCancellation && !i.excluded);
    const payments = items.filter((i) => !i.isCancellation && !i.excluded);

    cancellations.forEach((cancel) => {
      // 같은 금액의 결제 내역 찾기 (취소보다 이전 날짜)
      const matchingPayment = payments.find(
        (p) =>
          p.amount === cancel.amount &&
          !p.cancelledBy && // 아직 매칭 안된 것
          p.date <= cancel.date // 결제가 취소보다 먼저
      );
      if (matchingPayment) {
        cancel.cancels = matchingPayment.id;
        matchingPayment.cancelledBy = cancel.id;
      }
    });

    // 4. 간편결제 이체 감지 (자동충전 포함 가능성 → 금액 확인 유도)
    items.forEach((item) => {
      const textToCheck = (item.merchant + ' ' + item.rawText).toLowerCase();
      const hasPaymentKeyword = PAYMENT_TRANSFER_KEYWORDS.some((kw) =>
        textToCheck.includes(kw.toLowerCase())
      );
      // 이체/충전 키워드 또는 "내 계좌 →" 패턴
      const hasTransferContext =
        BANK_TRANSFER_KEYWORDS.some((kw) => textToCheck.includes(kw.toLowerCase())) ||
        /내\s*\S*계좌/.test(textToCheck) ||
        textToCheck.includes('→');

      if (hasPaymentKeyword && hasTransferContext) {
        item.isPaymentTransfer = true;
      }
    });

    // 5. 충전-결제 연결: 같은 금액의 충전과 결제를 연결
    const transfers = items.filter((i) => i.isPaymentTransfer && !i.excluded);
    const actualPayments = items.filter((i) => !i.isPaymentTransfer && !i.isCancellation && !i.excluded);

    transfers.forEach((transfer) => {
      // 같은 금액의 결제 내역 찾기 (충전 이후 날짜, 아직 연결 안된 것)
      const matchingPayment = actualPayments.find(
        (p) =>
          p.amount === transfer.amount &&
          !p.linkedTransferId && // 아직 매칭 안된 것
          p.date >= transfer.date // 결제가 충전 이후
      );
      if (matchingPayment) {
        transfer.linkedPaymentId = matchingPayment.id;
        matchingPayment.linkedTransferId = transfer.id;
      }
    });

    return items;
  }

  if (!mounted) {
    return (
      <Screen>
        <div style={{ padding: 20, color: T.textSec }}>로딩 중...</div>
      </Screen>
    );
  }

  // 중복된 원본 ID 세트 (이 ID를 가진 항목 옆에 "!" 표시)
  const duplicatedOriginalIds = new Set(
    items.filter(i => i.isDuplicate && i.duplicateOf).map(i => i.duplicateOf!)
  );
  // isDuplicate 항목은 목록에서 숨기고 원본만 표시
  const active = items.filter((i) => !i.excluded && !i.isDuplicate);
  const total = active.reduce((a, i) => a + i.amount, 0);
  const needsReviewCount = active.filter((i) => i.confidence && i.confidence < 0.8).length;

  // 중복 및 취소 카운트
  const duplicateCount = duplicatedOriginalIds.size;
  const existingDuplicateCount = active.filter((i) => i.isExistingDuplicate).length;
  const cancelPairCount = active.filter((i) => i.cancelledBy || i.cancels).length;
  const transferCount = active.filter((i) => i.isPaymentTransfer).length;
  const linkedTransferCount = active.filter((i) => i.linkedPaymentId || i.linkedTransferId).length;

  // 필수 필드 누락 카운트
  const invalidCount = active.filter((i) => !i.amount || i.amount === 0 || !i.merchant || !i.date).length;

  // 기존 중복 일괄 제외
  const excludeAllExistingDuplicates = () => {
    setItems(items.map((i) => i.isExistingDuplicate ? { ...i, excluded: true } : i));
  };

  // 날짜별 그룹핑
  const byDate: { [date: string]: ReviewItem[] } = {};
  active.forEach((i) => {
    if (!byDate[i.date]) byDate[i.date] = [];
    byDate[i.date].push(i);
  });
  const dates = Object.keys(byDate).sort((a, b) => b.localeCompare(a));

  const excluded = items.filter((i) => i.excluded);

  // 아이템 업데이트
  const update = (id: string, patch: Partial<ReviewItem>) => {
    setItems(items.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  };

  // 날짜 일괄 수정
  const batchUpdateDate = (oldDate: string, newDate: string) => {
    setItems(items.map((i) => (i.date === oldDate ? { ...i, date: newDate } : i)));
    setBatchEditDate(null);
  };

  // 저장
  const handleSave = async () => {
    // 첫 번째 업로드된 이미지 경로 (모든 지출에 연결)
    const imageUrl = uploadedImagePaths.length > 0 ? uploadedImagePaths[0] : undefined;

    const expensesToSave: Expense[] = active.map((t) => ({
      id: generateId(),
      date: t.date,
      amount: t.amount,
      merchant: t.merchant,
      category: t.suggestedCategory === 'exclude' ? 'other' : t.suggestedCategory,
      memo: '',
      createdAt: new Date().toISOString(),
      source: 'ocr' as const,
      imageUrl,
    }));

    if (expensesToSave.length === 0) {
      alert('저장할 지출 내역이 없습니다.');
      return;
    }

    await saveExpenses(expensesToSave);
    sessionStorage.removeItem('ocrTransactions');
    sessionStorage.removeItem('uploadedImagePaths');
    router.push('/');
  };

  return (
    <Screen>
      <AppHeader
        title="추출 결과 검수"
        onBack={() => {
          if (items.length > 0) {
            setShowExitConfirm(true);
          } else {
            router.push('/add/photo');
          }
        }}
      />

      <ScreenBody padBottom={100}>
        {/* 요약 배너 */}
        <div style={{ padding: '16px 20px 12px' }}>
          <div
            style={{
              background: T.accentSoft,
              borderRadius: 16,
              padding: 16,
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 4,
              }}
            >
              <span style={{ fontSize: 13, fontWeight: 600, color: '#166534' }}>
                {active.length}건 인식 완료
              </span>
              <span style={{ fontSize: 11, fontWeight: 600, color: '#166534', opacity: 0.7 }}>
                OCR 결과
              </span>
            </div>
            <MoneyText value={total} size={26} weight={800} color="#0F5132" />
            {/* 경고 메시지들 */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
              {existingDuplicateCount > 0 && (
                <div
                  style={{
                    padding: '10px 12px',
                    borderRadius: 10,
                    background: 'rgba(59,130,246,0.12)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 8,
                    fontSize: 12,
                    fontWeight: 600,
                    color: '#2563EB',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <svg width="14" height="14" viewBox="0 0 14 14">
                      <circle cx="7" cy="7" r="6" stroke="#2563EB" strokeWidth="1.4" fill="none" />
                      <path d="M7 4v4M7 10v.5" stroke="#2563EB" strokeWidth="1.4" strokeLinecap="round" />
                    </svg>
                    {existingDuplicateCount}건 이미 저장된 내역
                  </div>
                  <button
                    onClick={excludeAllExistingDuplicates}
                    style={{
                      border: 0,
                      background: '#2563EB',
                      color: '#fff',
                      padding: '4px 10px',
                      borderRadius: 6,
                      fontSize: 11,
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    모두 제외
                  </button>
                </div>
              )}
              {invalidCount > 0 && (
                <div
                  style={{
                    padding: '10px 12px',
                    borderRadius: 10,
                    background: 'rgba(220,38,38,0.12)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    fontSize: 12,
                    fontWeight: 600,
                    color: '#DC2626',
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 14 14">
                    <circle cx="7" cy="7" r="6" stroke="#DC2626" strokeWidth="1.4" fill="none" />
                    <path d="M7 4v4M7 10v.5" stroke="#DC2626" strokeWidth="1.4" strokeLinecap="round" />
                  </svg>
                  {invalidCount}건 인식 실패 - 탭하여 직접 입력 필요
                </div>
              )}
              {duplicateCount > 0 && (
                <div
                  style={{
                    padding: '10px 12px',
                    borderRadius: 10,
                    background: 'rgba(107,114,128,0.12)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    fontSize: 12,
                    fontWeight: 600,
                    color: '#374151',
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <circle cx="7" cy="7" r="6" stroke="#6B7280" strokeWidth="1.4" />
                    <path d="M4.5 7l2 2 3-3" stroke="#6B7280" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  같은 내역 {duplicateCount}건 중복 발견 — 자동으로 하나씩만 남겼어요
                </div>
              )}
              {cancelPairCount > 0 && (
                <div
                  style={{
                    padding: '10px 12px',
                    borderRadius: 10,
                    background: 'rgba(168,85,247,0.12)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    fontSize: 12,
                    fontWeight: 600,
                    color: '#7C3AED',
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 14 14">
                    <path
                      d="M9 5L5 9M5 5l4 4"
                      stroke="#7C3AED"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                    />
                    <circle cx="7" cy="7" r="6" stroke="#7C3AED" strokeWidth="1.4" fill="none" />
                  </svg>
                  {cancelPairCount}건 취소/환불 매칭 - 둘 다 제외 권장
                </div>
              )}
              {transferCount > 0 && (
                <div
                  style={{
                    padding: '10px 12px',
                    borderRadius: 10,
                    background: 'rgba(245,158,11,0.14)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    fontSize: 12,
                    fontWeight: 600,
                    color: '#92400E',
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 14 14">
                    <path d="M7 1l6.5 11.5h-13L7 1zM7 5.5v3M7 10.5v.5" stroke="#92400E" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                  </svg>
                  {transferCount}건 간편결제 이체 - 자동충전 포함 가능, 금액 직접 확인 필요
                </div>
              )}
              {linkedTransferCount > 0 && (
                <div
                  style={{
                    padding: '10px 12px',
                    borderRadius: 10,
                    background: 'rgba(16,185,129,0.12)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    fontSize: 12,
                    fontWeight: 600,
                    color: '#059669',
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 14 14">
                    <path d="M3 7h8M8 4l3 3-3 3" stroke="#059669" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                  </svg>
                  {linkedTransferCount / 2}건 충전→결제 연결 - 충전 제외 권장
                </div>
              )}
              {needsReviewCount > 0 && (
                <div
                  style={{
                    padding: '10px 12px',
                    borderRadius: 10,
                    background: 'rgba(245,158,11,0.16)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    fontSize: 12,
                    fontWeight: 600,
                    color: '#92400E',
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 14 14">
                    <path
                      d="M7 1l6.5 11.5h-13L7 1zM7 5.5v3M7 10.5v.5"
                      stroke="#92400E"
                      strokeWidth="1.4"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      fill="none"
                    />
                  </svg>
                  {needsReviewCount}건 카테고리 확인 필요
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 도움말 */}
        <div
          style={{
            padding: '4px 20px 8px',
            fontSize: 12,
            color: T.textTer,
            lineHeight: 1.5,
          }}
        >
          항목을 탭하면 수정할 수 있어요. 잘못 인식된 거래는 제외할 수 있어요.
        </div>

        {/* 데이터 없을 때 */}
        {items.length === 0 && (
          <div
            style={{
              padding: '60px 20px',
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: 48, marginBottom: 16 }}>📭</div>
            <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>
              추출된 내역이 없습니다
            </div>
            <div style={{ fontSize: 14, color: T.textSec }}>
              이미지에서 거래 내역을 찾지 못했어요
            </div>
            <button
              onClick={() => router.push('/add/photo')}
              style={{
                marginTop: 20,
                padding: '12px 24px',
                border: 0,
                borderRadius: 12,
                background: T.accent,
                color: '#fff',
                fontSize: 15,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              다시 시도하기
            </button>
          </div>
        )}

        {/* 날짜별 리스트 */}
        {dates.map((d) => (
          <div key={d} style={{ marginBottom: 8 }}>
            <div
              style={{
                padding: '12px 20px 6px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: T.textTer,
                  letterSpacing: '-0.01em',
                }}
              >
                {formatDateLabel(d)}
              </span>
              <button
                onClick={() => setBatchEditDate(d)}
                style={{
                  border: 0,
                  background: 'transparent',
                  color: T.accent,
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: 'pointer',
                  padding: '2px 0',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path
                    d="M2 10h1.5L9 4.5 7.5 3 2 8.5V10zM10.5 3l-1.5 1.5-1.5-1.5L9 1.5 10.5 3z"
                    stroke="currentColor"
                    strokeWidth="1.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                날짜 일괄 수정
              </button>
            </div>
            <div style={{ background: T.bg }}>
              {byDate[d].map((it, idx, arr) => (
                <OCRRow
                  key={it.id}
                  item={it}
                  last={idx === arr.length - 1}
                  onTap={() => setEditing(it.id)}
                  onExclude={() => setExcludeConfirm(it.id)}
                />
              ))}
            </div>
          </div>
        ))}

        {/* 제외된 항목 */}
        {excluded.length > 0 && (() => {
          // '결제 최종 취소됨' 항목들을 페어로 묶기 (같은 merchant+date+amount 기준)
          const cancelledItems = excluded.filter(i => i.excludeReason === '결제 최종 취소됨');
          const otherExcluded = excluded.filter(i => i.excludeReason !== '결제 최종 취소됨');

          // 페어 그룹핑: {key → [item, item?]}
          const pairMap = new Map<string, ReviewItem[]>();
          cancelledItems.forEach(item => {
            const key = `${item.date}|${item.merchant.trim()}|${item.amount}`;
            if (!pairMap.has(key)) pairMap.set(key, []);
            pairMap.get(key)!.push(item);
          });
          const pairs = Array.from(pairMap.values());

          return (
            <div style={{ marginTop: 16, padding: '0 20px 12px' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: T.textTer, marginBottom: 8 }}>
                제외된 {excluded.length}건
              </div>

              {/* 결제 취소 쌍 카드 */}
              {pairs.map((pair) => {
                const rep = pair[0];
                return (
                  <div
                    key={`pair-${rep.id}`}
                    style={{
                      background: '#FFF5F5',
                      border: '1px solid #FFE0E0',
                      borderRadius: 12,
                      padding: '12px 14px',
                      marginBottom: 8,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                      <span style={{
                        fontSize: 10, fontWeight: 700, color: '#E53E3E',
                        background: '#FFE0E0', borderRadius: 4, padding: '2px 7px',
                      }}>
                        결제취소
                      </span>
                      <span style={{ fontSize: 10, color: T.textTer }}>결제 후 취소 · 순액 0원</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <CatIcon catId={rep.suggestedCategory} size={34} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{
                          fontSize: 14, fontWeight: 600, color: T.textSec,
                          textDecoration: 'line-through',
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>
                          {rep.merchant}
                        </div>
                        <div style={{ fontSize: 11, color: T.textTer, marginTop: 3, fontVariantNumeric: 'tabular-nums' }}>
                          +₩{rep.amount.toLocaleString('ko-KR')} → −₩{rep.amount.toLocaleString('ko-KR')} = 0원
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* 기타 제외 항목 */}
              {otherExcluded.length > 0 && (
                <div style={{ background: T.bgSoft, borderRadius: 12, padding: '4px 0' }}>
                  {otherExcluded.map((it) => (
                    <div
                      key={it.id}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        padding: '10px 14px', fontSize: 13, color: T.textTer,
                      }}
                    >
                      <span style={{ flex: 1, overflow: 'hidden' }}>
                        <span style={{
                          display: 'block', overflow: 'hidden', textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap', textDecoration: 'line-through',
                        }}>
                          {it.merchant}
                        </span>
                        {it.excludeReason && (
                          <span style={{ fontSize: 10, color: T.textTer, fontWeight: 500 }}>
                            {it.excludeReason}
                          </span>
                        )}
                      </span>
                      <span style={{ fontVariantNumeric: 'tabular-nums', textDecoration: 'line-through' }}>
                        ₩{it.amount.toLocaleString('ko-KR')}
                      </span>
                      <button
                        onClick={() => update(it.id, { excluded: false })}
                        style={{
                          border: 0, background: 'transparent', cursor: 'pointer',
                          color: T.accent, fontSize: 13, fontWeight: 600, padding: '4px 0',
                        }}
                      >
                        복구
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })()}
      </ScreenBody>

      {/* 하단 저장 버튼 */}
      {items.length > 0 && (
        <div
          style={{
            position: 'fixed',
            left: 0,
            right: 0,
            bottom: 0,
            padding: '12px 20px 28px',
            background: 'linear-gradient(to top, rgba(255,255,255,1) 60%, rgba(255,255,255,0))',
            maxWidth: 512,
            margin: '0 auto',
            zIndex: 100,
          }}
        >
          <PrimaryButton onClick={handleSave} disabled={active.length === 0}>
            {active.length}건 저장하기
          </PrimaryButton>
        </div>
      )}

      {/* 편집 시트 */}
      {editing && (
        <EditTxnSheet
          item={items.find((i) => i.id === editing)!}
          onClose={() => setEditing(null)}
          onChange={(patch) => {
            update(editing, patch);
            setEditing(null);
          }}
          onExclude={() => {
            setEditing(null);
            setExcludeConfirm(editing);
          }}
        />
      )}

      {/* 날짜 일괄 수정 시트 */}
      {batchEditDate && (
        <BatchDateSheet
          currentDate={batchEditDate}
          itemCount={byDate[batchEditDate]?.length || 0}
          onClose={() => setBatchEditDate(null)}
          onApply={(newDate) => batchUpdateDate(batchEditDate, newDate)}
        />
      )}

      {/* 제외 확인 모달 */}
      {excludeConfirm && (() => {
        const target = items.find((i) => i.id === excludeConfirm);
        if (!target) return null;
        return (
          <div
            style={{
              position: 'fixed', inset: 0,
              background: 'rgba(0,0,0,0.5)',
              zIndex: 1000, display: 'flex',
              alignItems: 'center', justifyContent: 'center', padding: 20,
            }}
            onClick={() => setExcludeConfirm(null)}
          >
            <div
              style={{
                background: T.bg, borderRadius: 20,
                padding: '24px 20px 20px',
                width: '100%', maxWidth: 320, textAlign: 'center',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{
                width: 52, height: 52, borderRadius: 26,
                background: 'rgba(239,68,68,0.1)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 14px',
              }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" stroke="#EF4444" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 6 }}>
                이 항목을 제외할까요?
              </div>
              <div style={{ fontSize: 14, color: T.textSec, lineHeight: 1.6, marginBottom: 6 }}>
                <strong style={{ color: T.text }}>{target.merchant}</strong>
              </div>
              <div style={{ fontSize: 14, color: T.textSec, marginBottom: 22 }}>
                ₩{target.amount.toLocaleString('ko-KR')} · 제외된 항목은 하단에서 복구할 수 있어요.
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() => setExcludeConfirm(null)}
                  style={{
                    flex: 1, padding: '14px 0', border: `1px solid ${T.divider}`,
                    borderRadius: 12, background: T.bgMuted, color: T.text,
                    fontSize: 15, fontWeight: 600, cursor: 'pointer',
                  }}
                >
                  취소
                </button>
                <button
                  onClick={() => {
                    update(excludeConfirm, { excluded: true });
                    setExcludeConfirm(null);
                  }}
                  style={{
                    flex: 1, padding: '14px 0', border: 0,
                    borderRadius: 12, background: '#EF4444', color: '#fff',
                    fontSize: 15, fontWeight: 600, cursor: 'pointer',
                  }}
                >
                  제외하기
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* 뒤로가기 확인 모달 */}
      {showExitConfirm && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
          }}
          onClick={() => setShowExitConfirm(false)}
        >
          <div
            style={{
              background: T.bg,
              borderRadius: 20,
              padding: '24px 20px 20px',
              width: '100%',
              maxWidth: 320,
              textAlign: 'center',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: 28,
                background: 'rgba(245,158,11,0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px',
              }}
            >
              <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                <path
                  d="M14 3L25 24H3L14 3Z"
                  stroke="#F59E0B"
                  strokeWidth="2"
                  strokeLinejoin="round"
                  fill="none"
                />
                <path
                  d="M14 11v5M14 19v1"
                  stroke="#F59E0B"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            </div>
            <div
              style={{
                fontSize: 18,
                fontWeight: 700,
                marginBottom: 8,
                letterSpacing: '-0.02em',
              }}
            >
              페이지를 나가시겠어요?
            </div>
            <div
              style={{
                fontSize: 14,
                color: T.textSec,
                lineHeight: 1.5,
                marginBottom: 24,
              }}
            >
              추출된 {items.filter(i => !i.excluded).length}건의 내역이
              <br />
              저장되지 않고 사라져요
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => setShowExitConfirm(false)}
                style={{
                  flex: 1,
                  padding: '14px 0',
                  border: 0,
                  borderRadius: 12,
                  background: T.bgMuted,
                  color: T.text,
                  fontSize: 15,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                계속 검수
              </button>
              <button
                onClick={() => {
                  sessionStorage.removeItem('ocrTransactions');
                  sessionStorage.removeItem('uploadedImagePaths');
                  router.push('/add/photo');
                }}
                style={{
                  flex: 1,
                  padding: '14px 0',
                  border: 0,
                  borderRadius: 12,
                  background: T.danger,
                  color: '#fff',
                  fontSize: 15,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                나가기
              </button>
            </div>
          </div>
        </div>
      )}
    </Screen>
  );
}

// 날짜 포맷 헬퍼
function formatDateLabel(dateStr: string): string {
  const date = new Date(dateStr);
  const days = ['일', '월', '화', '수', '목', '금', '토'];
  return `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일 (${days[date.getDay()]})`;
}

// OCR 행 컴포넌트
function OCRRow({
  item,
  last,
  onTap,
  onExclude,
}: {
  item: ReviewItem;
  last: boolean;
  onTap: () => void;
  onExclude: () => void;
}) {
  const category = getCategoryById(item.suggestedCategory);
  const needsReview = item.confidence && item.confidence < 0.8;
  const hasCancelMatch = item.cancelledBy || item.cancels;
  const hasDuplicateIssue = item.isExistingDuplicate || item.isDuplicate;
  const hasDedupedItems = (item.removedDuplicateCount || 0) > 0;
  const isInvalid = !item.amount || item.amount === 0 || !item.merchant || !item.date;

  // 배경색 및 테두리 결정
  let bgColor = 'transparent';
  let borderColor = 'transparent';
  if (isInvalid) {
    bgColor = 'rgba(220,38,38,0.08)';
    borderColor = '#DC2626';
  } else if (hasDuplicateIssue) {
    bgColor = 'rgba(239,68,68,0.06)';
    borderColor = '#EF4444';
  } else if (item.isPaymentTransfer) {
    bgColor = 'rgba(245,158,11,0.07)';
    borderColor = '#F59E0B';
  } else if (item.linkedTransferId) {
    bgColor = 'rgba(16,185,129,0.06)';
    borderColor = '#10B981';
  }

  return (
    <div
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '14px 20px',
        background: bgColor,
        borderBottom: last ? 'none' : `1px solid ${T.divider}`,
        borderLeft: `3px solid ${borderColor}`,
        position: 'relative',
      }}
    >
      <button
        onClick={onTap}
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          border: 0,
          background: 'transparent',
          cursor: 'pointer',
          textAlign: 'left',
          padding: 0,
        }}
      >
        <CatIcon catId={item.suggestedCategory} size={40} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'baseline',
              gap: 6,
              marginBottom: 2,
            }}
          >
            <div
              style={{
                fontSize: 15,
                fontWeight: 600,
                color: T.text,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                letterSpacing: '-0.01em',
              }}
            >
              {item.merchant}
            </div>
            {isInvalid && <Badge tone="danger" size="sm">입력필요</Badge>}
            {!isInvalid && item.isExistingDuplicate && <Badge tone="blue" size="sm">기존</Badge>}
            {!isInvalid && hasDedupedItems && (
              <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 999, background: '#F3F4F6', color: '#6B7280', border: '1px solid #E5E7EB' }}>
                중복 {item.removedDuplicateCount}건 제거
              </span>
            )}
            {!isInvalid && hasCancelMatch && <Badge tone="purple" size="sm">{item.isCancellation ? '취소' : '취소됨'}</Badge>}
            {!isInvalid && item.isPaymentTransfer && <Badge tone="warn" size="sm">금액확인</Badge>}
            {!isInvalid && item.linkedTransferId && <Badge tone="accent" size="sm">연결됨</Badge>}
            {!isInvalid && needsReview && !hasCancelMatch && !item.isExistingDuplicate && !item.isPaymentTransfer && !hasDedupedItems && <Badge tone="warn" size="sm">확인</Badge>}
          </div>
          <div
            style={{
              fontSize: 12,
              color: T.textTer,
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <span style={{ fontWeight: 600 }}>{category?.name || '기타'}</span>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div
            style={{
              fontSize: 16,
              fontWeight: 700,
              color: T.text,
              fontVariantNumeric: 'tabular-nums',
              letterSpacing: '-0.02em',
            }}
          >
            −₩ {item.amount.toLocaleString('ko-KR')}
          </div>
        </div>
      </button>
      {/* 삭제 버튼 */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onExclude();
        }}
        aria-label="제외"
        style={{
          width: 36,
          height: 36,
          border: 0,
          background: 'transparent',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
          <path
            d="M3 5h12M7 5V3.5a1 1 0 011-1h2a1 1 0 011 1V5M14 5v10a1.5 1.5 0 01-1.5 1.5h-7A1.5 1.5 0 014 15V5"
            stroke={T.textTer}
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M7.5 8v5M10.5 8v5"
            stroke={T.textTer}
            strokeWidth="1.4"
            strokeLinecap="round"
          />
        </svg>
      </button>
    </div>
  );
}

// 편집 바텀시트
function EditTxnSheet({
  item,
  onClose,
  onChange,
  onExclude,
}: {
  item: ReviewItem;
  onClose: () => void;
  onChange: (patch: Partial<ReviewItem>) => void;
  onExclude: () => void;
}) {
  const [merchant, setMerchant] = useState(item.merchant);
  const [amount, setAmount] = useState(item.amount);
  const [date, setDate] = useState(item.date);
  const [catId, setCatId] = useState(item.suggestedCategory);

  const apply = () => {
    onChange({
      merchant,
      amount: Number(amount) || 0,
      date,
      suggestedCategory: catId,
    });
  };

  const category = getCategoryById(catId);

  return (
    <BottomSheet open onClose={onClose} title="거래 편집" height="80%">
      <div style={{ padding: '0 20px 20px' }}>
        {/* 간편결제 자동충전 경고 */}
        {item.isPaymentTransfer && (
          <div
            style={{
              margin: '16px 0 4px',
              padding: '10px 14px',
              background: 'rgba(245,158,11,0.12)',
              borderRadius: 10,
              fontSize: 12,
              color: '#92400E',
              fontWeight: 500,
              lineHeight: 1.5,
              display: 'flex',
              gap: 8,
              alignItems: 'flex-start',
            }}
          >
            <span style={{ flexShrink: 0 }}>⚠️</span>
            <span>
              PAYCO·카카오페이 등 간편결제 이체는 <strong>자동충전 금액이 포함</strong>될 수 있어요.
              실제 사용한 금액으로 직접 수정해주세요.
            </span>
          </div>
        )}

        {/* 금액 입력 */}
        <div
          style={{
            padding: '20px 0 24px',
            textAlign: 'center',
            borderBottom: `1px solid ${T.divider}`,
            marginBottom: 16,
          }}
        >
          <div style={{ fontSize: 12, color: T.textSec, fontWeight: 500, marginBottom: 6 }}>
            금액
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'baseline',
              justifyContent: 'center',
              gap: 4,
              fontSize: 28,
              fontWeight: 800,
              letterSpacing: '-0.02em',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            <span style={{ fontSize: 18, fontWeight: 700, color: T.textSec, flexShrink: 0 }}>₩</span>
            <input
              type="text"
              inputMode="numeric"
              value={Number(amount || 0).toLocaleString('ko-KR')}
              onChange={(e) => {
                const digits = e.target.value.replace(/[^\d]/g, '');
                setAmount(Math.max(0, Math.floor(Number(digits) || 0)));
              }}
              style={{
                border: 0,
                background: 'transparent',
                textAlign: 'center',
                fontFamily: 'Pretendard, system-ui, sans-serif',
                fontSize: 28,
                fontWeight: 800,
                color: T.text,
                fontVariantNumeric: 'tabular-nums',
                letterSpacing: '-0.02em',
                width: '150px',
                outline: 'none',
                padding: 0,
              }}
            />
            <span style={{ fontSize: 16, fontWeight: 700, color: T.textSec, flexShrink: 0 }}>원</span>
          </div>
        </div>

        {/* 필드들 */}
        <div
          style={{
            background: T.bgSoft,
            borderRadius: 14,
            overflow: 'hidden',
            marginBottom: 16,
          }}
        >
          <FieldRow label="사용처" style={{ background: 'transparent' }}>
            <input
              value={merchant}
              onChange={(e) => setMerchant(e.target.value)}
              style={{
                border: 0,
                background: 'transparent',
                textAlign: 'right',
                fontSize: 15,
                fontWeight: 600,
                color: T.text,
                fontFamily: 'Pretendard, system-ui, sans-serif',
                width: '100%',
                outline: 'none',
              }}
            />
          </FieldRow>
          <FieldRow label="카테고리" style={{ background: 'transparent' }}>
            <select
              value={catId}
              onChange={(e) => setCatId(e.target.value)}
              style={{
                border: 0,
                background: 'transparent',
                textAlign: 'right',
                fontSize: 15,
                fontWeight: 600,
                color: T.text,
                fontFamily: 'Pretendard, system-ui, sans-serif',
                outline: 'none',
                cursor: 'pointer',
              }}
            >
              {DEFAULT_CATEGORIES.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.icon} {cat.name}
                </option>
              ))}
            </select>
          </FieldRow>
          <FieldRow label="날짜" style={{ background: 'transparent', borderBottom: 0 }}>
            <DatePicker value={date} onChange={setDate} />
          </FieldRow>
        </div>

        {/* 액션 버튼 */}
        <div style={{ display: 'flex', gap: 8 }}>
          <SecondaryButton
            onClick={onExclude}
            style={{ flex: 1, color: T.danger }}
          >
            제외하기
          </SecondaryButton>
          <PrimaryButton onClick={apply} style={{ flex: 1.4 }}>
            완료
          </PrimaryButton>
        </div>
      </div>
    </BottomSheet>
  );
}

// 날짜 일괄 수정 바텀시트
function BatchDateSheet({
  currentDate,
  itemCount,
  onClose,
  onApply,
}: {
  currentDate: string;
  itemCount: number;
  onClose: () => void;
  onApply: (newDate: string) => void;
}) {
  const [newDate, setNewDate] = useState(currentDate);

  return (
    <BottomSheet open onClose={onClose} title="날짜 일괄 수정" height="auto">
      <div style={{ padding: '0 20px 24px' }}>
        {/* 안내 문구 */}
        <div
          style={{
            padding: '12px 14px',
            background: T.accentSoft,
            borderRadius: 10,
            fontSize: 13,
            color: '#166534',
            marginBottom: 20,
            lineHeight: 1.5,
          }}
        >
          <strong>{formatDateLabel(currentDate)}</strong>의 {itemCount}건 거래를
          <br />
          선택한 날짜로 일괄 변경합니다.
        </div>

        {/* 날짜 선택 */}
        <div
          style={{
            background: T.bgSoft,
            borderRadius: 14,
            padding: '16px',
            marginBottom: 20,
          }}
        >
          <div
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: T.textSec,
              marginBottom: 8,
            }}
          >
            변경할 날짜 선택
          </div>
          <DatePicker value={newDate} onChange={setNewDate} />
        </div>

        {/* 액션 버튼 */}
        <div style={{ display: 'flex', gap: 8 }}>
          <SecondaryButton onClick={onClose} style={{ flex: 1 }}>
            취소
          </SecondaryButton>
          <PrimaryButton
            onClick={() => onApply(newDate)}
            disabled={newDate === currentDate}
            style={{ flex: 1.4 }}
          >
            {itemCount}건 날짜 변경
          </PrimaryButton>
        </div>
      </div>
    </BottomSheet>
  );
}
