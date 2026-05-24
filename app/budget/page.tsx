'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Screen,
  ScreenBody,
  AppHeader,
  T,
  MoneyText,
  SecondaryButton,
  CatIcon,
  BottomSheet,
  PrimaryButton,
} from '@/components/ui';
import {
  getCurrentMonth,
} from '@/lib/supabase-storage';
import * as storage from '@/lib/supabase-storage';
import { useBudget, useGoalSettings } from '@/hooks/useSupabaseData';
import { DEFAULT_CATEGORIES } from '@/constants/categories';
import type { Budget } from '@/types';

type PeriodType = 'year' | 'half' | 'quarter' | 'month';

// Resolve a period (type + offset from "current") to a display label + actual values.
function periodInfo(type: PeriodType, offset: number) {
  const now = new Date();
  const baseY = now.getFullYear();
  const baseM = now.getMonth() + 1;

  if (type === 'year') {
    const y = baseY + offset;
    return { title: `${y}년 예산`, sub: '연간 예산', short: `${y}년`, year: y };
  }
  if (type === 'half') {
    const currentHalf = baseM <= 6 ? 0 : 1;
    const idx = baseY * 2 + currentHalf + offset;
    const y = Math.floor(idx / 2);
    const h = ((idx % 2) + 2) % 2;
    return {
      title: `${y} ${h === 0 ? '상' : '하'}반기 예산`,
      sub: '6개월 예산',
      short: `${y} ${h === 0 ? '상' : '하'}반기`,
      year: y,
      half: (h + 1) as 1 | 2,
    };
  }
  if (type === 'quarter') {
    const currentQ = Math.ceil(baseM / 3);
    const idx = baseY * 4 + (currentQ - 1) + offset;
    const y = Math.floor(idx / 4);
    const q = (((idx % 4) + 4) % 4) + 1;
    return {
      title: `${y} ${q}분기 예산`,
      sub: '3개월 예산',
      short: `${y} ${q}분기`,
      year: y,
      quarter: q as 1 | 2 | 3 | 4,
    };
  }
  // month
  const idx = baseY * 12 + (baseM - 1) + offset;
  const y = Math.floor(idx / 12);
  const m = (((idx % 12) + 12) % 12) + 1;
  return {
    title: `${y}년 ${m}월 예산`,
    sub: '월 예산',
    short: `${y}년 ${m}월`,
    year: y,
    month: m,
    monthKey: `${y}-${String(m).padStart(2, '0')}`,
  };
}

// 원화 포맷 함수
function formatWonShort(amount: number): string {
  if (amount >= 10000) {
    return (amount / 10000).toFixed(0) + '만원';
  }
  return '₩' + Math.abs(Math.round(amount)).toLocaleString('ko-KR');
}

export default function BudgetPage() {
  const router = useRouter();
  const { budget, loading: budgetLoading, refresh: refreshBudget } = useBudget();
  const { settings } = useGoalSettings();
  const monthlyIncome = settings.monthlyIncome;
  const [period, setPeriod] = useState<PeriodType>('month');
  const [offset, setOffset] = useState(0);
  const [editing, setEditing] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [used, setUsed] = useState(0);
  const [incomeExceeded, setIncomeExceeded] = useState(false);
  const [pendingBudget, setPendingBudget] = useState<Budget | null>(null);

  const currentMonth = getCurrentMonth();

  const changePeriod = (next: PeriodType) => {
    setPeriod(next);
    setOffset(0);
  };

  // 사용 금액 계산 (비동기)
  const info = periodInfo(period, offset);

  useEffect(() => {
    const loadUsed = async () => {
      let total = 0;
      if (period === 'year' && 'year' in info) {
        total = await storage.getYearlyTotal(info.year);
      } else if (period === 'half' && 'half' in info && 'year' in info) {
        total = await storage.getHalfYearTotal(info.year, info.half as 1 | 2);
      } else if (period === 'quarter' && 'quarter' in info && 'year' in info) {
        total = await storage.getQuarterlyTotal(info.year, info.quarter as 1 | 2 | 3 | 4);
      } else if (period === 'month' && 'monthKey' in info && info.monthKey) {
        total = await storage.getMonthlyTotal(info.monthKey);
      }
      setUsed(total);
    };
    loadUsed();
  }, [period, offset]);

  if (budgetLoading || !budget) {
    return (
      <Screen>
        <div style={{ padding: 20, color: T.textSec }}>로딩 중...</div>
      </Screen>
    );
  }

  // Calculate totals
  const monthlyTotal = Object.values(budget.categoryBudgets).reduce(
    (a, v) => a + v,
    0
  );
  const defaultGoal = (type: PeriodType) =>
    type === 'year'
      ? monthlyTotal * 12
      : type === 'half'
      ? monthlyTotal * 6
      : type === 'quarter'
      ? monthlyTotal * 3
      : monthlyTotal;

  const goal = defaultGoal(period);

  const periods = [
    { id: 'year' as const, label: '연간' },
    { id: 'half' as const, label: '반기' },
    { id: 'quarter' as const, label: '분기' },
    { id: 'month' as const, label: '월별' },
  ];

  const categories = DEFAULT_CATEGORIES.filter((c) => c.id !== 'other');

  return (
    <Screen>
      <AppHeader title="목표 · 예산" onBack={() => router.push('/')} />

      {/* period selector */}
      <div style={{ padding: '8px 20px 12px' }}>
        <div
          style={{
            display: 'flex',
            gap: 6,
            padding: 4,
            background: T.bgMuted,
            borderRadius: 12,
          }}
        >
          {periods.map((p) => (
            <button
              key={p.id}
              onClick={() => changePeriod(p.id)}
              style={{
                flex: 1,
                border: period === p.id ? `2px solid ${T.accent}` : '2px solid transparent',
                padding: '8px 0',
                borderRadius: 8,
                background: period === p.id ? T.bg : 'transparent',
                fontFamily: 'Pretendard, system-ui, sans-serif',
                fontSize: 13,
                fontWeight: period === p.id ? 700 : 600,
                color: period === p.id ? T.accent : T.textTer,
                cursor: 'pointer',
                letterSpacing: '-0.01em',
                boxShadow:
                  period === p.id ? '0 2px 6px rgba(0,0,0,0.1)' : 'none',
                transition: 'all .15s',
              }}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* period stepper */}
      <div
        style={{
          padding: '0 20px 12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <StepBtn onClick={() => setOffset(offset - 1)} dir="prev" />
        <div style={{ textAlign: 'center', flex: 1 }}>
          <div
            style={{
              fontSize: 15,
              fontWeight: 700,
              color: T.text,
              letterSpacing: '-0.02em',
            }}
          >
            {info.short}
          </div>
          {offset !== 0 && (
            <button
              onClick={() => setOffset(0)}
              style={{
                border: 0,
                background: 'transparent',
                cursor: 'pointer',
                color: T.accent,
                fontSize: 11,
                fontWeight: 600,
                padding: '2px 0',
                letterSpacing: '-0.01em',
              }}
            >
              현재로 돌아가기
            </button>
          )}
          {offset === 0 && (
            <div
              style={{
                fontSize: 11,
                color: T.textTer,
                fontWeight: 500,
                marginTop: 2,
              }}
            >
              현재
            </div>
          )}
        </div>
        <StepBtn onClick={() => setOffset(offset + 1)} dir="next" />
      </div>

      <ScreenBody>
        {/* Big goal card for selected period */}
        <PeriodGoalCard info={info} goal={goal} used={used} incomeExceeded={incomeExceeded} />

        {/* Category-level monthly budgets */}
        {period === 'month' && (
          <div style={{ padding: '8px 20px 16px' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 8,
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 700, color: T.textTer }}>
                {info.short.split(' ').slice(-1)[0]} 카테고리 예산
              </div>
              <button
                onClick={() => setEditMode(!editMode)}
                style={{
                  border: 0,
                  cursor: 'pointer',
                  background: editMode ? T.accent : 'transparent',
                  color: editMode ? '#fff' : T.accent,
                  fontSize: 13,
                  fontWeight: 700,
                  letterSpacing: '-0.01em',
                  padding: editMode ? '6px 12px' : '6px 0',
                  borderRadius: 999,
                  transition: 'all .15s',
                }}
              >
                {editMode ? '완료' : '수정'}
              </button>
            </div>
            <div
              style={{
                background: T.bg,
                border: `1px solid ${editMode ? T.accent + '55' : T.divider}`,
                borderRadius: 14,
                overflow: 'hidden',
                transition: 'border-color .15s',
              }}
            >
              {categories.map((c, i) => (
                <button
                  key={c.id}
                  onClick={() => {
                    if (editMode) setEditing(c.id);
                  }}
                  disabled={!editMode}
                  style={{
                    width: '100%',
                    border: 0,
                    background: editMode ? T.accentSoft + '40' : 'transparent',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '12px 14px',
                    cursor: editMode ? 'pointer' : 'default',
                    textAlign: 'left',
                    borderBottom:
                      i < categories.length - 1
                        ? `1px solid ${editMode ? T.accent + '22' : T.divider}`
                        : 'none',
                    transition: 'background .15s, border-color .15s',
                  }}
                >
                  <CatIcon catId={c.id} size={36} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 15,
                        fontWeight: 600,
                        letterSpacing: '-0.01em',
                      }}
                    >
                      {c.name}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', marginRight: editMode ? 4 : 0 }}>
                    <div
                      style={{
                        fontSize: 15,
                        fontWeight: 700,
                        color: T.textSec,
                        fontVariantNumeric: 'tabular-nums',
                        letterSpacing: '-0.02em',
                      }}
                    >
                      {((budget.categoryBudgets[c.id] || 0) / 10000).toFixed(0)}
                      만원
                    </div>
                  </div>
                  {editMode && (
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 14 14"
                      fill="none"
                      style={{ flexShrink: 0 }}
                    >
                      <path
                        d="M9.5 1.5l3 3-8 8H1.5v-3l8-8z"
                        stroke={T.accent}
                        strokeWidth="1.6"
                        strokeLinejoin="round"
                      />
                    </svg>
                  )}
                </button>
              ))}
            </div>

            {editMode && (
              <div
                style={{
                  marginTop: 10,
                  fontSize: 12,
                  color: T.textTer,
                  lineHeight: 1.5,
                  padding: '0 4px',
                }}
              >
                수정할 카테고리를 탭하세요.
              </div>
            )}
          </div>
        )}

        <div style={{ padding: '0 20px 8px' }}>
          <SecondaryButton onClick={() => router.push('/')}>저장</SecondaryButton>
        </div>
      </ScreenBody>

      {pendingBudget && (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
            zIndex: 1000, display: 'flex', alignItems: 'center',
            justifyContent: 'center', padding: 20,
          }}
          onClick={() => setPendingBudget(null)}
        >
          <div
            style={{
              background: T.bg, borderRadius: 20,
              padding: '24px 20px 20px', width: '100%', maxWidth: 320,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 8 }}>예산 확인</div>
            <div style={{ fontSize: 14, color: T.textSec, lineHeight: 1.6, marginBottom: 20 }}>
              월 예산 합계가 실수익(₩{monthlyIncome.toLocaleString('ko-KR')})보다 높습니다.<br />
              다시 한 번 확인해주세요.
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <SecondaryButton onClick={() => setPendingBudget(null)} style={{ flex: 1 }}>
                재확인
              </SecondaryButton>
              <PrimaryButton
                onClick={async () => {
                  await storage.saveBudget(pendingBudget);
                  refreshBudget();
                  setIncomeExceeded(true);
                  setPendingBudget(null);
                }}
                style={{ flex: 1, background: T.danger }}
              >
                그대로 적용
              </PrimaryButton>
            </div>
          </div>
        </div>
      )}

      {editing && (
        <CategoryBudgetSheet
          cat={DEFAULT_CATEGORIES.find((c) => c.id === editing)!}
          value={budget.categoryBudgets[editing] || 0}
          onClose={() => setEditing(null)}
          onSave={async (v) => {
            const newBudget: Budget = {
              ...budget,
              categoryBudgets: { ...budget.categoryBudgets, [editing]: v },
            };
            const newTotal = Object.values(newBudget.categoryBudgets).reduce((a, b) => a + b, 0);
            if (monthlyIncome > 0 && newTotal > monthlyIncome) {
              setPendingBudget(newBudget);
              setEditing(null);
            } else {
              await storage.saveBudget(newBudget);
              refreshBudget();
              setEditing(null);
              setIncomeExceeded(false);
            }
          }}
        />
      )}
    </Screen>
  );
}

// ◀ / ▶ stepper buttons
function StepBtn({
  onClick,
  dir,
}: {
  onClick: () => void;
  dir: 'prev' | 'next';
}) {
  return (
    <button
      onClick={onClick}
      aria-label={dir === 'prev' ? '이전' : '다음'}
      style={{
        width: 36,
        height: 36,
        borderRadius: 18,
        border: 0,
        cursor: 'pointer',
        background: T.bgSoft,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <svg
        width="10"
        height="14"
        viewBox="0 0 10 14"
        fill="none"
        style={dir === 'next' ? undefined : { transform: 'rotate(180deg)' }}
      >
        <path
          d="M2 1l6 6-6 6"
          stroke={T.text}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}

// Hero card for the active period
function PeriodGoalCard({
  info,
  goal,
  used,
  incomeExceeded,
}: {
  info: { title: string; sub: string; short: string };
  goal: number;
  used: number;
  incomeExceeded?: boolean;
}) {
  const pct = goal > 0 ? (used / goal) * 100 : 0;
  const remaining = goal - used;

  return (
    <div style={{ padding: '0 20px 16px' }}>
      <div
        style={{
          background: T.text,
          color: '#fff',
          borderRadius: 20,
          padding: 22,
        }}
      >
        {/* 헤더: 기간 + 사용률 */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 12,
          }}
        >
          <div style={{ fontSize: 14, fontWeight: 600, opacity: 0.8 }}>
            {info.short}
          </div>
          <div
            style={{
              padding: '4px 10px',
              borderRadius: 999,
              background: pct > 100 ? 'rgba(252,165,165,0.3)' : 'rgba(134,239,172,0.3)',
              fontSize: 13,
              fontWeight: 700,
              color: pct > 100 ? '#FCA5A5' : '#86EFAC',
            }}
          >
            {pct.toFixed(0)}% 사용
          </div>
        </div>

        {/* 메인: 사용 금액 */}
        <div style={{ marginBottom: 6 }}>
          <MoneyText value={used} size={36} weight={800} color="#fff" />
        </div>

        {/* 서브: 예산 중 */}
        <div
          style={{
            fontSize: 14,
            fontWeight: 500,
            opacity: 0.7,
            marginBottom: 16,
          }}
        >
          예산 {formatWonShort(goal)} 중
        </div>

        {/* 프로그레스 바 */}
        <div
          style={{
            height: 8,
            background: 'rgba(255,255,255,0.16)',
            borderRadius: 4,
            overflow: 'hidden',
            marginBottom: 12,
          }}
        >
          <div
            style={{
              height: '100%',
              width: Math.min(100, pct) + '%',
              background: pct > 100 ? '#FCA5A5' : '#86EFAC',
              borderRadius: 4,
            }}
          />
        </div>

        {/* 남은 예산 */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            alignItems: 'center',
            gap: 6,
            fontSize: 14,
            fontWeight: 600,
          }}
        >
          <span style={{ opacity: 0.6 }}>남은 예산</span>
          <span style={{ color: remaining >= 0 ? '#86EFAC' : '#FCA5A5' }}>
            {remaining >= 0 ? formatWonShort(remaining) : '-' + formatWonShort(Math.abs(remaining))}
          </span>
        </div>

        {incomeExceeded && (
          <div
            style={{
              marginTop: 10,
              padding: '8px 12px',
              background: 'rgba(252,165,165,0.18)',
              borderRadius: 8,
              fontSize: 12,
              fontWeight: 600,
              color: '#FCA5A5',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            ⚠️ 예산 합계가 실수익을 초과합니다
          </div>
        )}
      </div>
    </div>
  );
}

// Bottom sheet to edit a single category's monthly budget.
function CategoryBudgetSheet({
  cat,
  value,
  onClose,
  onSave,
}: {
  cat: { id: string; name: string; color: string };
  value: number;
  onClose: () => void;
  onSave: (v: number) => void;
}) {
  const [v, setV] = useState(value);
  const presets = [10, 20, 30, 50, 100];
  const adjust = (delta: number) => setV(Math.max(0, v + delta));

  const formatted = v.toLocaleString('ko-KR');
  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const digits = e.target.value.replace(/[^\d]/g, '');
    setV(Math.max(0, Math.floor(Number(digits) || 0)));
  };

  return (
    <BottomSheet
      open
      onClose={onClose}
      title={`${cat.name} 월 예산`}
      height="55%"
    >
      <div style={{ padding: '0 20px 24px' }}>
        <div
          style={{
            padding: '20px 0',
            textAlign: 'center',
            borderBottom: `1px solid ${T.divider}`,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'baseline',
              justifyContent: 'center',
              gap: 4,
              fontVariantNumeric: 'tabular-nums',
              maxWidth: '100%',
            }}
          >
            <span
              style={{
                fontSize: 20,
                fontWeight: 700,
                color: T.textSec,
                flexShrink: 0,
              }}
            >
              ₩
            </span>
            <input
              type="text"
              inputMode="numeric"
              value={formatted}
              onChange={onInputChange}
              style={{
                border: 0,
                background: 'transparent',
                textAlign: 'center',
                fontFamily: 'Pretendard, system-ui, sans-serif',
                fontSize: 30,
                fontWeight: 800,
                color: T.text,
                letterSpacing: '-0.02em',
                width: `${formatted.length}ch`,
                minWidth: 80,
                maxWidth: 240,
                outline: 'none',
                padding: 0,
              }}
            />
            <span
              style={{
                fontSize: 18,
                fontWeight: 700,
                color: T.textSec,
                flexShrink: 0,
              }}
            >
              원
            </span>
          </div>
          <div
            style={{
              marginTop: 6,
              fontSize: 13,
              color: T.textTer,
              fontWeight: 500,
            }}
          >
            {v >= 10000 ? Math.floor(v / 10000) + '만원' : v.toLocaleString() + '원'}{' '}
            / 월
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            gap: 8,
            padding: '20px 0 8px',
            justifyContent: 'space-between',
          }}
        >
          {[-50000, -10000, +10000, +50000].map((d) => (
            <button
              key={d}
              onClick={() => adjust(d)}
              style={{
                flex: 1,
                padding: '10px 0',
                border: 0,
                borderRadius: 10,
                background: T.bgMuted,
                color: T.text,
                fontFamily: 'Pretendard, system-ui, sans-serif',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {d > 0 ? '+' : '−'}
              {Math.abs(d) / 10000}만
            </button>
          ))}
        </div>

        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: T.textTer,
            margin: '20px 0 8px',
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
          }}
        >
          빠른 설정
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {presets.map((p) => (
            <button
              key={p}
              onClick={() => setV(p * 10000)}
              style={{
                border: 0,
                padding: '8px 14px',
                borderRadius: 999,
                background: v === p * 10000 ? cat.color + '18' : T.bgSoft,
                color: v === p * 10000 ? cat.color : T.text,
                fontFamily: 'Pretendard, system-ui, sans-serif',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {p}만원
            </button>
          ))}
        </div>

        <div style={{ marginTop: 24 }}>
          <PrimaryButton onClick={() => onSave(v)}>저장</PrimaryButton>
        </div>
      </div>
    </BottomSheet>
  );
}
