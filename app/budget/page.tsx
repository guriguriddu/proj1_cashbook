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
import * as storage from '@/lib/supabase-storage';
import { useBudget, useGoalSettings } from '@/hooks/useSupabaseData';
import { DEFAULT_CATEGORIES } from '@/constants/categories';
import type { Budget, BudgetScope } from '@/types';

function formatWonShort(amount: number): string {
  if (amount >= 10000) return (amount / 10000).toFixed(0) + '만원';
  return '₩' + Math.abs(Math.round(amount)).toLocaleString('ko-KR');
}

export default function BudgetPage() {
  const router = useRouter();
  const { budget, loading: budgetLoading, refresh: refreshBudget } = useBudget();
  const { settings } = useGoalSettings();
  const [allCategories, setAllCategories] = useState<import('@/types').Category[]>([]);

  useEffect(() => {
    storage.getCategories().then(setAllCategories).catch(() => {});
  }, []);

  const monthlyIncome = settings.monthlyIncome;
  const [offset, setOffset] = useState(0);
  const [editing, setEditing] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [used, setUsed] = useState(0);
  const [incomeExceeded, setIncomeExceeded] = useState(false);
  const [pendingBudget, setPendingBudget] = useState<Budget | null>(null);

  // Compute current month from offset
  const now = new Date();
  const baseY = now.getFullYear();
  const baseM = now.getMonth() + 1;
  const idx = baseY * 12 + (baseM - 1) + offset;
  const y = Math.floor(idx / 12);
  const m = (((idx % 12) + 12) % 12) + 1;
  const monthKey = `${y}-${String(m).padStart(2, '0')}`;
  const monthLabel = `${y}년 ${m}월`;

  useEffect(() => {
    storage.getMonthlyTotal(monthKey).then(setUsed);
  }, [monthKey]);

  if (budgetLoading || !budget) {
    return (
      <Screen>
        <div style={{ padding: 20, color: T.textSec }}>로딩 중...</div>
      </Screen>
    );
  }

  const categories = (allCategories.length > 0 ? allCategories : DEFAULT_CATEGORIES).filter(
    (c) => c.id !== 'other'
  );
  const allCats = allCategories.length > 0 ? allCategories : DEFAULT_CATEGORIES;
  const goal = allCats.reduce(
    (sum, c) => sum + storage.getCategoryBudgetForMonth(budget, monthKey, c.id),
    0
  );

  return (
    <Screen>
      <AppHeader title="목표 · 예산" onBack={() => router.push('/')} />

      {/* Month navigator */}
      <div
        style={{
          padding: '8px 20px 12px',
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
            {monthLabel}
          </div>
          {offset !== 0 ? (
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
              이번 달로 돌아가기
            </button>
          ) : (
            <div style={{ fontSize: 11, color: T.textTer, fontWeight: 500, marginTop: 2 }}>
              이번 달
            </div>
          )}
        </div>
        <StepBtn onClick={() => setOffset(offset + 1)} dir="next" />
      </div>

      <ScreenBody padBottom={100}>
        {/* Monthly hero card */}
        <MonthlyGoalCard
          monthLabel={monthLabel}
          goal={goal}
          used={used}
          incomeExceeded={incomeExceeded}
        />

        {/* 수익 미설정 안내 */}
        {monthlyIncome === 0 && (
          <div style={{ padding: '0 20px 8px' }}>
            <button
              onClick={() => router.push('/mypage')}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '12px 16px',
                background: T.warnSoft,
                border: `1px solid #F59E0B44`,
                borderRadius: 14,
                cursor: 'pointer',
                textAlign: 'left',
                fontFamily: 'Pretendard, system-ui, sans-serif',
              }}
            >
              <span style={{ fontSize: 18 }}>💡</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#92400E' }}>
                  월 수익을 설정하면 예산 초과 여부를 알려드려요
                </div>
                <div style={{ fontSize: 11, color: '#B45309', marginTop: 2 }}>
                  마이페이지에서 설정 →
                </div>
              </div>
            </button>
          </div>
        )}

        {/* Category-level budgets */}
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
              {monthLabel} 카테고리 예산
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
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
                  fontFamily: 'Pretendard, system-ui, sans-serif',
                }}
              >
                {editMode ? '완료' : '수정'}
              </button>
            </div>
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
            {categories.map((c, i) => {
              const effectiveAmt = storage.getCategoryBudgetForMonth(budget, monthKey, c.id);
              const hasOverride = !!budget.monthlyCategoryBudgets?.[monthKey]?.[c.id];
              return (
                <button
                  key={c.id}
                  onClick={() => { if (editMode) setEditing(c.id); }}
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
                  <CatIcon catId={c.id} size={36} icon={c.icon} color={c.color} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 15, fontWeight: 600, letterSpacing: '-0.01em' }}>
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
                      {(effectiveAmt / 10000).toFixed(0)}만원
                    </div>
                    {hasOverride && (
                      <div style={{ fontSize: 10, color: T.accent, fontWeight: 600, marginTop: 1 }}>
                        이번 달만
                      </div>
                    )}
                  </div>
                  {editMode && (
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0 }}>
                      <path
                        d="M9.5 1.5l3 3-8 8H1.5v-3l8-8z"
                        stroke={T.accent}
                        strokeWidth="1.6"
                        strokeLinejoin="round"
                      />
                    </svg>
                  )}
                </button>
              );
            })}
          </div>

          {editMode && (
            <div style={{ marginTop: 8, padding: '0 4px' }}>
              <div style={{ fontSize: 12, color: T.textTer, lineHeight: 1.5 }}>
                수정할 카테고리를 탭하세요.
              </div>
            </div>
          )}
        </div>

        <div style={{ height: 8 }} />
      </ScreenBody>

      {/* Bottom 완료 button */}
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
          zIndex: 10,
        }}
      >
        <SecondaryButton onClick={() => router.push('/')}>완료</SecondaryButton>
      </div>

      {/* Income exceeded confirm */}
      {pendingBudget && (
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
          onClick={() => setPendingBudget(null)}
        >
          <div
            style={{
              background: T.bg,
              borderRadius: 20,
              padding: '24px 20px 20px',
              width: '100%',
              maxWidth: 320,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 8 }}>예산 확인</div>
            <div style={{ fontSize: 14, color: T.textSec, lineHeight: 1.6, marginBottom: 20 }}>
              월 예산 합계가 실수익(₩{monthlyIncome.toLocaleString('ko-KR')})보다 높습니다.
              <br />
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

      {editing &&
        (() => {
          const cat = (
            categories.find((c) => c.id === editing) ||
            DEFAULT_CATEGORIES.find((c) => c.id === editing)
          )!;
          const effectiveValue = storage.getCategoryBudgetForMonth(budget, monthKey, editing);
          const hasExistingOverride = !!budget.monthlyCategoryBudgets?.[monthKey]?.[editing];
          return (
            <CategoryBudgetSheet
              cat={cat}
              value={effectiveValue}
              month={monthKey}
              hasMonthOverride={hasExistingOverride}
              onClose={() => setEditing(null)}
              onSave={async (v, scope) => {
                await storage.saveCategoryBudgetScope(editing, v, monthKey, scope);
                await refreshBudget();
                const newTotal = allCats.reduce((sum, c) => {
                  const amt =
                    c.id === editing ? v : storage.getCategoryBudgetForMonth(budget, monthKey, c.id);
                  return sum + amt;
                }, 0);
                setIncomeExceeded(monthlyIncome > 0 && newTotal > monthlyIncome);
                setEditing(null);
              }}
            />
          );
        })()}
    </Screen>
  );
}

function StepBtn({ onClick, dir }: { onClick: () => void; dir: 'prev' | 'next' }) {
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

function MonthlyGoalCard({
  monthLabel,
  goal,
  used,
  incomeExceeded,
}: {
  monthLabel: string;
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
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 12,
          }}
        >
          <div style={{ fontSize: 14, fontWeight: 600, opacity: 0.8 }}>{monthLabel}</div>
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

        <div style={{ marginBottom: 6 }}>
          <MoneyText value={used} size={36} weight={800} color="#fff" />
        </div>

        <div style={{ fontSize: 14, fontWeight: 500, opacity: 0.7, marginBottom: 16 }}>
          예산 {formatWonShort(goal)} 중
        </div>

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
            {remaining >= 0
              ? formatWonShort(remaining)
              : '-' + formatWonShort(Math.abs(remaining))}
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

function CategoryBudgetSheet({
  cat,
  value,
  month,
  hasMonthOverride,
  onClose,
  onSave,
}: {
  cat: { id: string; name: string; color: string };
  value: number;
  month: string;
  hasMonthOverride: boolean;
  onClose: () => void;
  onSave: (v: number, scope: BudgetScope) => void;
}) {
  const [v, setV] = useState(value);
  const [scope, setScope] = useState<BudgetScope>(
    hasMonthOverride ? 'this_month' : 'this_and_forward'
  );
  const presets = [10, 20, 30, 50, 100];
  const adjust = (delta: number) => setV(Math.max(0, v + delta));

  const formatted = v.toLocaleString('ko-KR');
  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const digits = e.target.value.replace(/[^\d]/g, '');
    setV(Math.max(0, Math.floor(Number(digits) || 0)));
  };

  const [y, mo] = month.split('-');
  const monthLabel = `${y}년 ${parseInt(mo)}월`;

  return (
    <BottomSheet open onClose={onClose} title={`${cat.name} 예산`} height="70%">
      <div style={{ padding: '0 20px 24px' }}>
        {/* 금액 입력 */}
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
            }}
          >
            <span style={{ fontSize: 20, fontWeight: 700, color: T.textSec, flexShrink: 0 }}>
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
            <span style={{ fontSize: 18, fontWeight: 700, color: T.textSec, flexShrink: 0 }}>
              원
            </span>
          </div>
          <div style={{ marginTop: 6, fontSize: 13, color: T.textTer, fontWeight: 500 }}>
            {v >= 10000 ? Math.floor(v / 10000) + '만원' : v.toLocaleString() + '원'} / 월
          </div>
        </div>

        {/* 조절 버튼 */}
        <div
          style={{
            display: 'flex',
            gap: 8,
            padding: '16px 0 8px',
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
              {d > 0 ? '+' : '−'}{Math.abs(d) / 10000}만
            </button>
          ))}
        </div>

        {/* 빠른 설정 */}
        <div
          style={{
            display: 'flex',
            gap: 6,
            flexWrap: 'wrap',
            paddingBottom: 16,
            borderBottom: `1px solid ${T.divider}`,
          }}
        >
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

        {/* 적용 범위 */}
        <div style={{ paddingTop: 16 }}>
          <div
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: T.textTer,
              marginBottom: 10,
              letterSpacing: '-0.01em',
            }}
          >
            적용 범위
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {(
              [
                { value: 'this_month', label: '이번 달만', sub: monthLabel },
                {
                  value: 'this_and_forward',
                  label: '이번 달부터 모두',
                  sub: `${monthLabel} 이후 기본 예산으로 적용`,
                },
              ] as { value: BudgetScope; label: string; sub: string }[]
            ).map((opt) => (
              <button
                key={opt.value}
                onClick={() => setScope(opt.value)}
                style={{
                  width: '100%',
                  border: `2px solid ${scope === opt.value ? T.accent : T.divider}`,
                  borderRadius: 12,
                  padding: '12px 14px',
                  background: scope === opt.value ? T.accentSoft : T.bg,
                  cursor: 'pointer',
                  textAlign: 'left',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  fontFamily: 'Pretendard, system-ui, sans-serif',
                }}
              >
                <div
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: 9,
                    flexShrink: 0,
                    border: `2px solid ${scope === opt.value ? T.accent : T.divider}`,
                    background: scope === opt.value ? T.accent : 'transparent',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {scope === opt.value && (
                    <div
                      style={{ width: 6, height: 6, borderRadius: 3, background: '#fff' }}
                    />
                  )}
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: T.text }}>{opt.label}</div>
                  <div style={{ fontSize: 11, color: T.textSec, marginTop: 2 }}>{opt.sub}</div>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div style={{ marginTop: 20 }}>
          <PrimaryButton onClick={() => onSave(v, scope)}>적용</PrimaryButton>
        </div>
      </div>
    </BottomSheet>
  );
}
