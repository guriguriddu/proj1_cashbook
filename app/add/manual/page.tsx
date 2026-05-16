'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Screen,
  ScreenBody,
  AppHeader,
  T,
  PrimaryButton,
  FieldRow,
  BottomSheet,
  CatIcon,
} from '@/components/ui';
import { saveExpense, generateId, getTodayDate } from '@/lib/supabase-storage';
import { DEFAULT_CATEGORIES } from '@/constants/categories';
import type { Expense } from '@/types';

export default function ManualAddPage() {
  const router = useRouter();
  const [amount, setAmount] = useState(0);
  const [merchant, setMerchant] = useState('');
  const [catId, setCatId] = useState('food');
  const [date, setDate] = useState(getTodayDate());
  const [memo, setMemo] = useState('');
  const [catSheetOpen, setCatSheetOpen] = useState(false);

  const cat = DEFAULT_CATEGORIES.find((c) => c.id === catId) || DEFAULT_CATEGORIES[0];

  const pressKey = (k: string) => {
    if (k === 'del') {
      setAmount(Math.floor(amount / 10));
    } else if (k === '00') {
      const next = amount * 100;
      if (next < 1_000_000_000) setAmount(next);
    } else {
      const next = amount * 10 + Number(k);
      if (next < 1_000_000_000) setAmount(next);
    }
  };

  const canSave = amount > 0 && merchant.trim().length > 0;

  const handleSave = async () => {
    const expense: Expense = {
      id: generateId(),
      date,
      amount,
      merchant: merchant.trim(),
      category: catId,
      memo: memo.trim(),
      createdAt: new Date().toISOString(),
      source: 'manual',
    };
    await saveExpense(expense);
    router.push('/');
  };

  return (
    <Screen>
      <AppHeader title="직접 입력" onBack={() => router.push('/add')} />
      <ScreenBody padBottom={24}>
        {/* amount hero */}
        <div
          style={{
            padding: '32px 20px 24px',
            textAlign: 'center',
          }}
        >
          <div
            style={{
              fontSize: 13,
              color: T.textSec,
              fontWeight: 500,
              marginBottom: 12,
            }}
          >
            얼마를 썼나요?
          </div>
          <div
            style={{
              fontSize: 44,
              fontWeight: 800,
              letterSpacing: '-0.03em',
              color: amount === 0 ? T.textMuted : T.text,
              fontVariantNumeric: 'tabular-nums',
              display: 'flex',
              alignItems: 'baseline',
              justifyContent: 'center',
              gap: 6,
            }}
          >
            <span
              style={{
                fontSize: 30,
                fontWeight: 700,
                color: amount === 0 ? T.textMuted : T.textSec,
              }}
            >
              ₩
            </span>
            {amount.toLocaleString('ko-KR')}
          </div>
        </div>

        {/* form fields */}
        <div style={{ padding: '0 20px', marginBottom: 16 }}>
          <div
            style={{
              background: T.bgSoft,
              borderRadius: 16,
              overflow: 'hidden',
            }}
          >
            <FieldRow label="사용처" style={{ background: 'transparent' }}>
              <input
                value={merchant}
                onChange={(e) => setMerchant(e.target.value)}
                placeholder="예: 스타벅스"
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
              <button
                onClick={() => setCatSheetOpen(true)}
                style={{
                  border: 0,
                  background: 'transparent',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  fontSize: 15,
                  fontWeight: 600,
                  color: T.text,
                  fontFamily: 'Pretendard, system-ui, sans-serif',
                }}
              >
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 4,
                    background: cat.color,
                    display: 'inline-block',
                  }}
                />
                {cat.name}
                <svg width="14" height="14" viewBox="0 0 14 14">
                  <path
                    d="M4 5l3 3 3-3"
                    stroke={T.textTer}
                    strokeWidth="1.5"
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            </FieldRow>
            <FieldRow label="날짜" style={{ background: 'transparent' }}>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                style={{
                  border: 0,
                  background: 'transparent',
                  textAlign: 'right',
                  fontSize: 15,
                  fontWeight: 600,
                  color: T.text,
                  fontFamily: 'Pretendard, system-ui, sans-serif',
                  outline: 'none',
                }}
              />
            </FieldRow>
            <FieldRow label="메모" style={{ background: 'transparent', borderBottom: 0 }}>
              <input
                value={memo}
                onChange={(e) => setMemo(e.target.value)}
                placeholder="선택사항"
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
          </div>
        </div>

        {/* numpad */}
        <div style={{ padding: '0 12px 12px' }}>
          <Numpad onKey={pressKey} />
        </div>

        {/* save */}
        <div style={{ padding: '8px 20px 16px' }}>
          <PrimaryButton onClick={handleSave} disabled={!canSave}>
            저장
          </PrimaryButton>
        </div>
      </ScreenBody>

      <BottomSheet
        open={catSheetOpen}
        onClose={() => setCatSheetOpen(false)}
        title="카테고리 선택"
        height="70%"
      >
        <CategoryPicker
          catId={catId}
          onPick={(cid) => {
            setCatId(cid);
            setCatSheetOpen(false);
          }}
        />
      </BottomSheet>
    </Screen>
  );
}

function Numpad({ onKey }: { onKey: (k: string) => void }) {
  const keys = [
    ['1', '2', '3'],
    ['4', '5', '6'],
    ['7', '8', '9'],
    ['00', '0', 'del'],
  ];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {keys.map((row, i) => (
        <div key={i} style={{ display: 'flex', gap: 4 }}>
          {row.map((k) => (
            <button
              key={k}
              onClick={() => onKey(k)}
              style={{
                flex: 1,
                height: 52,
                border: 0,
                background: 'transparent',
                fontFamily: 'Pretendard, system-ui, sans-serif',
                fontSize: 22,
                fontWeight: 600,
                color: T.text,
                cursor: 'pointer',
                borderRadius: 10,
                transition: 'background .1s',
              }}
              onMouseDown={(e) =>
                ((e.currentTarget as HTMLButtonElement).style.background = T.bgMuted)
              }
              onMouseUp={(e) =>
                ((e.currentTarget as HTMLButtonElement).style.background = 'transparent')
              }
              onMouseLeave={(e) =>
                ((e.currentTarget as HTMLButtonElement).style.background = 'transparent')
              }
            >
              {k === 'del' ? (
                <svg
                  width="22"
                  height="16"
                  viewBox="0 0 22 16"
                  style={{ display: 'inline-block' }}
                >
                  <path
                    d="M7 1h13a1.5 1.5 0 011.5 1.5v11A1.5 1.5 0 0120 15H7L1 8z"
                    fill="none"
                    stroke={T.text}
                    strokeWidth="1.6"
                  />
                  <path
                    d="M11 5l5 5M16 5l-5 5"
                    stroke={T.text}
                    strokeWidth="1.6"
                    strokeLinecap="round"
                  />
                </svg>
              ) : (
                k
              )}
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}

function CategoryPicker({
  catId,
  onPick,
}: {
  catId: string;
  onPick: (cid: string) => void;
}) {
  const categories = DEFAULT_CATEGORIES.filter((c) => c.id !== 'other');

  return (
    <div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 10,
          padding: '0 20px 16px',
        }}
      >
        {categories.map((c) => (
          <button
            key={c.id}
            onClick={() => onPick(c.id)}
            style={{
              border: 0,
              padding: '14px 8px',
              borderRadius: 14,
              cursor: 'pointer',
              background: c.id === catId ? c.color + '18' : T.bgSoft,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 6,
              position: 'relative',
            }}
          >
            <CatIcon catId={c.id} size={36} />
            <div
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: c.id === catId ? c.color : T.textSec,
                letterSpacing: '-0.01em',
              }}
            >
              {c.name}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
