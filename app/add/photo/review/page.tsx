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
import { saveExpenses, generateId } from '@/lib/storage';
import { formatDateShort, groupByDate } from '@/lib/utils';
import { DEFAULT_CATEGORIES, getCategoryById } from '@/constants/categories';
import type { ExtractedTransaction, Expense } from '@/types';

interface ReviewItem extends ExtractedTransaction {
  excluded: boolean;
}

export default function OCRReviewPage() {
  const router = useRouter();
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [batchEditDate, setBatchEditDate] = useState<string | null>(null); // 일괄 수정할 원래 날짜

  useEffect(() => {
    setMounted(true);
    // sessionStorage에서 추출된 데이터 로드
    const stored = sessionStorage.getItem('ocrTransactions');
    if (stored) {
      const transactions: ExtractedTransaction[] = JSON.parse(stored);
      setItems(transactions.map((t) => ({ ...t, excluded: t.isExcluded || false })));
    }
  }, []);

  if (!mounted) {
    return (
      <Screen>
        <div style={{ padding: 20, color: T.textSec }}>로딩 중...</div>
      </Screen>
    );
  }

  const active = items.filter((i) => !i.excluded);
  const total = active.reduce((a, i) => a + i.amount, 0);
  const needsReviewCount = active.filter((i) => i.confidence && i.confidence < 0.8).length;

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
  const handleSave = () => {
    const expensesToSave: Expense[] = active.map((t) => ({
      id: generateId(),
      date: t.date,
      amount: t.amount,
      merchant: t.merchant,
      category: t.suggestedCategory === 'exclude' ? 'other' : t.suggestedCategory,
      memo: '',
      createdAt: new Date().toISOString(),
      source: 'ocr' as const,
    }));

    if (expensesToSave.length === 0) {
      alert('저장할 지출 내역이 없습니다.');
      return;
    }

    saveExpenses(expensesToSave);
    sessionStorage.removeItem('ocrTransactions');
    router.push('/');
  };

  return (
    <Screen>
      <AppHeader title="추출 결과 검수" onBack={() => router.push('/add/photo')} />

      <ScreenBody padBottom={120}>
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
            {needsReviewCount > 0 && (
              <div
                style={{
                  marginTop: 12,
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
                {needsReviewCount}건은 카테고리를 확인해주세요
              </div>
            )}
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
                  onExclude={() => update(it.id, { excluded: true })}
                />
              ))}
            </div>
          </div>
        ))}

        {/* 제외된 항목 */}
        {excluded.length > 0 && (
          <div style={{ marginTop: 16, padding: '12px 20px' }}>
            <div
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: T.textTer,
                marginBottom: 8,
              }}
            >
              제외된 {excluded.length}건
            </div>
            <div
              style={{
                background: T.bgSoft,
                borderRadius: 12,
                padding: '4px 0',
              }}
            >
              {excluded.map((it) => (
                <div
                  key={it.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '10px 14px',
                    fontSize: 13,
                    color: T.textTer,
                    textDecoration: 'line-through',
                  }}
                >
                  <span
                    style={{
                      flex: 1,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {it.merchant}
                  </span>
                  <span style={{ fontVariantNumeric: 'tabular-nums' }}>
                    ₩{it.amount.toLocaleString('ko-KR')}
                  </span>
                  <button
                    onClick={() => update(it.id, { excluded: false })}
                    style={{
                      border: 0,
                      background: 'transparent',
                      cursor: 'pointer',
                      color: T.accent,
                      fontSize: 13,
                      fontWeight: 600,
                      padding: '4px 0',
                    }}
                  >
                    복구
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </ScreenBody>

      {/* 하단 저장 버튼 */}
      {items.length > 0 && (
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            padding: '12px 20px 28px',
            background: 'linear-gradient(to top, rgba(255,255,255,1) 60%, rgba(255,255,255,0))',
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
            update(editing, { excluded: true });
            setEditing(null);
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

  return (
    <div
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '12px 20px',
        background: 'transparent',
        borderBottom: last ? 'none' : `1px solid ${T.divider}`,
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
            {needsReview && <Badge tone="warn" size="sm">확인 필요</Badge>}
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
          width: 32,
          height: 32,
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
