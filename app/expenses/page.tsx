'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Screen,
  ScreenBody,
  AppHeader,
  T,
  MoneyText,
  ProgressBar,
  CatIcon,
  BottomSheet,
  PrimaryButton,
} from '@/components/ui';
import { getCurrentMonth, getReceiptImageUrl } from '@/lib/supabase-storage';
import { useExpensesByMonth, useBudget } from '@/hooks/useSupabaseData';
import * as storage from '@/lib/supabase-storage';
import { DEFAULT_CATEGORIES, getCategoryById } from '@/constants/categories';
import type { Expense, BudgetScope } from '@/types';

function formatWon(amount: number): string {
  return '₩' + Math.abs(Math.round(amount)).toLocaleString('ko-KR');
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const dayName = ['일', '월', '화', '수', '목', '금', '토'][date.getDay()];
  return `${month}월 ${day}일 (${dayName})`;
}

type PeriodType = 'month' | 'quarter' | 'half' | 'year';

function periodInfo(type: PeriodType, offset: number) {
  const now = new Date();
  const baseY = now.getFullYear();
  const baseM = now.getMonth() + 1;

  if (type === 'month') {
    const idx = baseY * 12 + (baseM - 1) + offset;
    const y = Math.floor(idx / 12);
    const m = (((idx % 12) + 12) % 12) + 1;
    const monthKey = `${y}-${String(m).padStart(2, '0')}`;
    return { label: `${y}년 ${m}월`, monthKey };
  }
  if (type === 'quarter') {
    const currentQ = Math.ceil(baseM / 3);
    const idx = baseY * 4 + (currentQ - 1) + offset;
    const y = Math.floor(idx / 4);
    const q = (((idx % 4) + 4) % 4) + 1;
    const startM = (q - 1) * 3 + 1;
    const endM = q * 3;
    const endDay = new Date(y, endM, 0).getDate();
    return {
      label: `${y}년 ${q}분기`,
      startDate: `${y}-${String(startM).padStart(2, '0')}-01`,
      endDate: `${y}-${String(endM).padStart(2, '0')}-${endDay}`,
    };
  }
  if (type === 'half') {
    const currentH = baseM <= 6 ? 0 : 1;
    const idx = baseY * 2 + currentH + offset;
    const y = Math.floor(idx / 2);
    const h = ((idx % 2) + 2) % 2;
    const startM = h === 0 ? 1 : 7;
    const endM = h === 0 ? 6 : 12;
    const endDay = new Date(y, endM, 0).getDate();
    return {
      label: `${y}년 ${h === 0 ? '상' : '하'}반기`,
      startDate: `${y}-${String(startM).padStart(2, '0')}-01`,
      endDate: `${y}-${String(endM).padStart(2, '0')}-${endDay}`,
    };
  }
  // year
  const y = baseY + offset;
  return {
    label: `${y}년`,
    startDate: `${y}-01-01`,
    endDate: `${y}-12-31`,
  };
}

export default function ExpensesPage() {
  return (
    <Suspense
      fallback={
        <Screen>
          <div style={{ padding: 20, color: T.textSec }}>로딩 중...</div>
        </Screen>
      }
    >
      <ExpensesContent />
    </Suspense>
  );
}

function ExpensesContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialCat = searchParams.get('category') || 'all';

  const [period, setPeriod] = useState<PeriodType>('month');
  const [offset, setOffset] = useState(0);
  const [filterCat, setFilterCat] = useState(initialCat);
  const [sort, setSort] = useState<'date' | 'amount'>('date');
  const [monthSheetOpen, setMonthSheetOpen] = useState(false);
  const [periodSheetOpen, setPeriodSheetOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [budgetEditCat, setBudgetEditCat] = useState<string | null>(null);

  // For non-monthly periods: fetch by date range
  const [rangeExpenses, setRangeExpenses] = useState<Expense[]>([]);
  const [rangeLoading, setRangeLoading] = useState(false);

  const info = periodInfo(period, offset);
  const monthKey = ('monthKey' in info ? info.monthKey : null) ?? getCurrentMonth();

  const { expenses: monthExpenses, loading: monthLoading, refresh: refreshExpenses } =
    useExpensesByMonth(monthKey);
  const { budget, loading: budgetLoading, refresh: refreshBudget } = useBudget();

  // Fetch range when period is not month
  useEffect(() => {
    if (period === 'month') return;
    const i = periodInfo(period, offset);
    if (!('startDate' in i) || !i.startDate || !i.endDate) return;
    setRangeLoading(true);
    storage
      .getExpensesByDateRange(i.startDate, i.endDate)
      .then(setRangeExpenses)
      .finally(() => setRangeLoading(false));
  }, [period, offset]);

  const changePeriod = (p: PeriodType) => {
    setPeriod(p);
    setOffset(0);
    setFilterCat('all');
  };

  if ((period === 'month' && (monthLoading || budgetLoading)) || !budget) {
    return (
      <Screen>
        <div style={{ padding: 20, color: T.textSec }}>로딩 중...</div>
      </Screen>
    );
  }

  // Non-month range data
  const rangeFiltered = rangeExpenses.filter(
    (e) => filterCat === 'all' || e.category === filterCat
  );
  const rangeTotal = rangeFiltered.reduce((a, e) => a + e.amount, 0);
  const rangePresentCats = new Set(rangeExpenses.map((e) => e.category));
  const rangeChips = [
    { id: 'all', name: '전체', color: T.text },
    ...DEFAULT_CATEGORIES.filter((c) => rangePresentCats.has(c.id)).map((c) => ({
      id: c.id, name: c.name, color: c.color,
    })),
  ];

  type GroupedExpense = { date: string | null; items: Expense[] };
  function buildGrouped(expenses: Expense[]): GroupedExpense[] {
    if (sort === 'date') {
      const byDate: Record<string, Expense[]> = {};
      expenses.forEach((e) => {
        if (!byDate[e.date]) byDate[e.date] = [];
        byDate[e.date].push(e);
      });
      return Object.keys(byDate)
        .sort((a, b) => b.localeCompare(a))
        .map((date) => ({ date, items: byDate[date].sort((a, b) => b.amount - a.amount) }));
    }
    return [{ date: null, items: [...expenses].sort((a, b) => b.amount - a.amount) }];
  }
  const rangeGrouped = buildGrouped(rangeFiltered);

  // Monthly list data
  const filtered = monthExpenses.filter(
    (e) => filterCat === 'all' || e.category === filterCat
  );
  const filteredTotal = filtered.reduce((a, e) => a + e.amount, 0);
  const count = filtered.length;
  const grouped = buildGrouped(filtered);

  const presentCats = new Set(monthExpenses.map((e) => e.category));
  const chips = [
    { id: 'all', name: '전체', color: T.text },
    ...DEFAULT_CATEGORIES.filter((c) => presentCats.has(c.id)).map((c) => ({
      id: c.id, name: c.name, color: c.color,
    })),
  ];

  const catData = filterCat !== 'all' ? DEFAULT_CATEGORIES.find((c) => c.id === filterCat) : null;
  const catBudget = catData ? budget.categoryBudgets[catData.id] || 0 : 0;
  const catPct = catBudget > 0 ? (filteredTotal / catBudget) * 100 : 0;

  const handleDelete = async (id: string, skipConfirm = false) => {
    if (!skipConfirm && !confirm('이 지출 내역을 삭제하시겠습니까?')) return;
    await storage.deleteExpense(id);
    refreshExpenses();
    if (period !== 'month') {
      const i = periodInfo(period, offset);
      if ('startDate' in i && i.startDate && i.endDate) {
        setRangeLoading(true);
        storage.getExpensesByDateRange(i.startDate, i.endDate).then(setRangeExpenses).finally(() => setRangeLoading(false));
      }
    }
  };

  const handleSaveEdit = async (updated: Expense) => {
    await storage.updateExpense(updated.id, updated);
    setEditingExpense(null);
    refreshExpenses();
  };

  const periods = [
    { id: 'month' as const, label: '월간' },
    { id: 'quarter' as const, label: '분기' },
    { id: 'half' as const, label: '반기' },
    { id: 'year' as const, label: '연간' },
  ];

  return (
    <Screen>
      <AppHeader title="내역" onBack={() => router.push('/')} />

      {/* Period tabs */}
      <div style={{ padding: '8px 20px 0' }}>
        <div style={{ display: 'flex', gap: 6, padding: 4, background: T.bgMuted, borderRadius: 12 }}>
          {periods.map((p) => (
            <button
              key={p.id}
              onClick={() => changePeriod(p.id)}
              style={{
                flex: 1, border: period === p.id ? `2px solid ${T.accent}` : '2px solid transparent',
                padding: '8px 0', borderRadius: 8,
                background: period === p.id ? T.bg : 'transparent',
                fontFamily: 'Pretendard, system-ui, sans-serif',
                fontSize: 13, fontWeight: period === p.id ? 700 : 600,
                color: period === p.id ? T.accent : T.textTer,
                cursor: 'pointer', letterSpacing: '-0.01em',
                boxShadow: period === p.id ? '0 2px 6px rgba(0,0,0,0.1)' : 'none',
                transition: 'all .15s',
              }}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {period === 'month' ? (
        /* ── 월간 리스트 뷰 ── */
        <>
          <div style={{ padding: '8px 20px 12px', background: T.bg }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <button
                onClick={() => setMonthSheetOpen(true)}
                style={{
                  border: 0, background: 'transparent', padding: 0, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 4,
                  fontSize: 14, fontWeight: 600, color: T.textSec, letterSpacing: '-0.01em',
                }}
              >
                {info.label}
                <svg width="14" height="14" viewBox="0 0 14 14">
                  <path d="M4 5l3 3 3-3" stroke={T.textSec} strokeWidth="1.5" fill="none"
                    strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              <div style={{ fontSize: 12, color: T.textTer, fontVariantNumeric: 'tabular-nums' }}>
                {count}건
              </div>
            </div>
            <MoneyText value={filteredTotal} size={28} weight={800} />

            {filterCat === 'all' && (() => {
              const totalBudget = DEFAULT_CATEGORIES.reduce((a, c) => a + storage.getCategoryBudgetForMonth(budget, monthKey, c.id), 0);
              const totalPct = totalBudget > 0 ? (filteredTotal / totalBudget) * 100 : 0;
              return (
                <div style={{ marginTop: 14 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12, fontWeight: 500, color: T.textSec, marginBottom: 6 }}>
                    <span style={{ fontWeight: 600 }}>월 예산 사용률</span>
                    <span style={{ color: totalPct > 100 ? T.danger : T.text, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                      {totalPct.toFixed(0)}% / {totalBudget.toLocaleString()}원
                    </span>
                  </div>
                  <ProgressBar value={totalPct} height={6} fillColor={totalPct > 100 ? T.danger : T.accent} />
                </div>
              );
            })()}

            {catData && (
              <div style={{ marginTop: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12, fontWeight: 500, color: T.textSec, marginBottom: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span>
                      <span style={{ color: catData.color, fontWeight: 700 }}>{catData.name}</span> 예산 사용률
                    </span>
                    <button
                      onClick={() => setBudgetEditCat(catData.id)}
                      style={{ border: 0, background: 'transparent', padding: '2px 6px', borderRadius: 6, cursor: 'pointer', fontSize: 11, fontWeight: 700, color: T.accent, letterSpacing: '-0.01em' }}
                    >
                      수정
                    </button>
                  </div>
                  <span style={{ color: catPct > 100 ? T.danger : T.text, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                    {catBudget > 0 ? `${catPct.toFixed(0)}% / ${catBudget.toLocaleString()}원` : '예산 미설정'}
                  </span>
                </div>
                <ProgressBar value={catBudget > 0 ? catPct : filteredTotal > 0 ? 100 : 0} height={6} fillColor={catData.color} />
              </div>
            )}
          </div>

          {/* Category chips + sort */}
          <div style={{ display: 'flex', alignItems: 'center', borderBottom: `1px solid ${T.divider}` }}>
            <div style={{ flex: 1, padding: '4px 0 12px 16px', display: 'flex', gap: 6, overflowX: 'auto', whiteSpace: 'nowrap' }}>
              {chips.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setFilterCat(c.id)}
                  style={{
                    border: 0, padding: '8px 14px', borderRadius: 999,
                    background: filterCat === c.id ? T.text : T.bgMuted,
                    color: filterCat === c.id ? '#fff' : T.textSec,
                    fontFamily: 'Pretendard, system-ui, sans-serif',
                    fontSize: 13, fontWeight: 600, letterSpacing: '-0.01em',
                    cursor: 'pointer', flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 5,
                  }}
                >
                  {c.id !== 'all' && (
                    <span style={{ width: 6, height: 6, borderRadius: 3, background: c.color, opacity: filterCat === c.id ? 0.9 : 0.7 }} />
                  )}
                  {c.name}
                </button>
              ))}
            </div>
            <button
              onClick={() => setSort(sort === 'date' ? 'amount' : 'date')}
              style={{
                flexShrink: 0, margin: '0 16px 12px 8px', padding: '6px 10px', height: 32,
                background: T.bgMuted, borderRadius: 999, fontSize: 11, fontWeight: 600,
                color: T.textSec, border: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3,
                whiteSpace: 'nowrap',
              }}
            >
              <svg width="10" height="10" viewBox="0 0 12 12">
                <path d="M3 4l3-3 3 3M3 8l3 3 3-3" stroke={T.textSec} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
              </svg>
              {sort === 'date' ? '날짜순' : '금액순'}
            </button>
          </div>

          <ScreenBody>
            {grouped.map((g, gi) => (
              <div key={g.date || gi} style={{ marginTop: 4 }}>
                {gi > 0 && g.date && <div style={{ height: 1, background: T.divider, margin: '6px 20px 0' }} />}
                {g.date && (
                  <div style={{ padding: '14px 20px 6px', display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: T.textTer, letterSpacing: '-0.01em' }}>
                      {formatDate(g.date)}
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: T.textTer, fontVariantNumeric: 'tabular-nums' }}>
                      {formatWon(g.items.reduce((a, e) => a + e.amount, 0))}
                    </div>
                  </div>
                )}
                <div>
                  {g.items.map((e) => (
                    <ExpenseRow key={e.id} e={e} onClick={() => setEditingExpense(e)} onDelete={() => handleDelete(e.id, true)} />
                  ))}
                </div>
              </div>
            ))}
            {filtered.length === 0 && (
              <div style={{ padding: '64px 20px', textAlign: 'center', color: T.textTer, fontSize: 14, fontWeight: 500 }}>
                {info.label}에는<br />아직 거래가 없어요
              </div>
            )}
          </ScreenBody>
        </>
      ) : (
        /* ── 분기/반기/연간 리스트 뷰 ── */
        <>
          <div style={{ padding: '8px 20px 12px', background: T.bg }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <button
                onClick={() => setPeriodSheetOpen(true)}
                style={{
                  border: 0, background: 'transparent', padding: 0, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 4,
                  fontSize: 14, fontWeight: 600, color: T.textSec, letterSpacing: '-0.01em',
                }}
              >
                {info.label}
                <svg width="14" height="14" viewBox="0 0 14 14">
                  <path d="M4 5l3 3 3-3" stroke={T.textSec} strokeWidth="1.5" fill="none"
                    strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              <div style={{ fontSize: 12, color: T.textTer, fontVariantNumeric: 'tabular-nums' }}>
                {rangeFiltered.length}건
              </div>
            </div>
            <MoneyText value={rangeTotal} size={28} weight={800} />
            {filterCat === 'all' && (() => {
              const monthCount = period === 'quarter' ? 3 : period === 'half' ? 6 : 12;
              const monthlyBudget = Object.values(budget.categoryBudgets).reduce((a, v) => a + v, 0);
              const totalBudget = monthlyBudget * monthCount;
              const totalPct = totalBudget > 0 ? (rangeTotal / totalBudget) * 100 : 0;
              const periodLabel = period === 'quarter' ? '분기' : period === 'half' ? '반기' : '연간';
              return (
                <div style={{ marginTop: 14 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12, fontWeight: 500, color: T.textSec, marginBottom: 6 }}>
                    <span style={{ fontWeight: 600 }}>{periodLabel} 예산 사용률</span>
                    <span style={{ color: totalPct > 100 ? T.danger : T.text, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                      {totalPct.toFixed(0)}% / {totalBudget.toLocaleString()}원
                    </span>
                  </div>
                  <ProgressBar value={totalPct} height={6} fillColor={totalPct > 100 ? T.danger : T.accent} />
                </div>
              );
            })()}
          </div>

          {/* Category chips + sort */}
          <div style={{ display: 'flex', alignItems: 'center', borderBottom: `1px solid ${T.divider}` }}>
            <div style={{ flex: 1, padding: '4px 0 12px 16px', display: 'flex', gap: 6, overflowX: 'auto', whiteSpace: 'nowrap' }}>
              {rangeChips.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setFilterCat(c.id)}
                  style={{
                    border: 0, padding: '8px 14px', borderRadius: 999,
                    background: filterCat === c.id ? T.text : T.bgMuted,
                    color: filterCat === c.id ? '#fff' : T.textSec,
                    fontFamily: 'Pretendard, system-ui, sans-serif',
                    fontSize: 13, fontWeight: 600, letterSpacing: '-0.01em',
                    cursor: 'pointer', flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 5,
                  }}
                >
                  {c.id !== 'all' && (
                    <span style={{ width: 6, height: 6, borderRadius: 3, background: c.color, opacity: filterCat === c.id ? 0.9 : 0.7 }} />
                  )}
                  {c.name}
                </button>
              ))}
            </div>
            <button
              onClick={() => setSort(sort === 'date' ? 'amount' : 'date')}
              style={{
                flexShrink: 0, margin: '0 16px 12px 8px', padding: '6px 10px', height: 32,
                background: T.bgMuted, borderRadius: 999, fontSize: 11, fontWeight: 600,
                color: T.textSec, border: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3,
                whiteSpace: 'nowrap',
              }}
            >
              <svg width="10" height="10" viewBox="0 0 12 12">
                <path d="M3 4l3-3 3 3M3 8l3 3 3-3" stroke={T.textSec} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
              </svg>
              {sort === 'date' ? '날짜순' : '금액순'}
            </button>
          </div>

          <ScreenBody>
            {rangeLoading ? (
              <div style={{ padding: '40px 20px', textAlign: 'center', color: T.textSec, fontSize: 14 }}>
                로딩 중...
              </div>
            ) : rangeGrouped.length === 0 ? (
              <div style={{ padding: '64px 20px', textAlign: 'center', color: T.textTer, fontSize: 14, fontWeight: 500 }}>
                {info.label}에는<br />거래 내역이 없어요
              </div>
            ) : (
              rangeGrouped.map((g, gi) => (
                <div key={g.date || gi} style={{ marginTop: 4 }}>
                  {gi > 0 && g.date && <div style={{ height: 1, background: T.divider, margin: '6px 20px 0' }} />}
                  {g.date && (
                    <div style={{ padding: '14px 20px 6px', display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: T.textTer, letterSpacing: '-0.01em' }}>
                        {formatDate(g.date)}
                      </div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: T.textTer, fontVariantNumeric: 'tabular-nums' }}>
                        {formatWon(g.items.reduce((a, e) => a + e.amount, 0))}
                      </div>
                    </div>
                  )}
                  <div>
                    {g.items.map((e) => (
                      <ExpenseRow key={e.id} e={e} onClick={() => setEditingExpense(e)} />
                    ))}
                  </div>
                </div>
              ))
            )}
          </ScreenBody>
        </>
      )}

      {monthSheetOpen && (
        <MonthPickerSheet
          current={monthKey}
          onPick={(m) => {
            const now = new Date();
            const [y, mo] = m.split('-').map(Number);
            const diff = y * 12 + (mo - 1) - (now.getFullYear() * 12 + now.getMonth());
            setOffset(diff);
            setMonthSheetOpen(false);
          }}
          onClose={() => setMonthSheetOpen(false)}
        />
      )}

      {periodSheetOpen && period !== 'month' && (
        <PeriodPickerSheet
          period={period}
          currentOffset={offset}
          onPick={(off) => { setOffset(off); setPeriodSheetOpen(false); }}
          onClose={() => setPeriodSheetOpen(false)}
        />
      )}

      {editingExpense && (
        <EditExpenseSheet
          expense={editingExpense}
          onSave={handleSaveEdit}
          onDelete={handleDelete}
          onClose={() => setEditingExpense(null)}
        />
      )}

      {budgetEditCat && (() => {
        const cat = DEFAULT_CATEGORIES.find((c) => c.id === budgetEditCat)!;
        const currentAmt = storage.getCategoryBudgetForMonth(budget, monthKey, budgetEditCat);
        return (
          <QuickBudgetSheet
            cat={cat}
            value={currentAmt}
            month={monthKey}
            onClose={() => setBudgetEditCat(null)}
            onSave={async (v, scope) => {
              await storage.saveCategoryBudgetScope(budgetEditCat, v, monthKey, scope);
              await refreshBudget();
              setBudgetEditCat(null);
            }}
          />
        );
      })()}
    </Screen>
  );
}

function PeriodPickerSheet({
  period, currentOffset, onPick, onClose,
}: {
  period: 'quarter' | 'half' | 'year';
  currentOffset: number;
  onPick: (offset: number) => void;
  onClose: () => void;
}) {
  const count = period === 'quarter' ? 8 : period === 'half' ? 4 : 3;
  const options = Array.from({ length: count }, (_, i) => -i); // [0, -1, -2, ...]

  return (
    <BottomSheet open onClose={onClose} title="기간 선택" height="70%">
      <div style={{ padding: '0 8px 16px' }}>
        {options.map((off) => {
          const pInfo = periodInfo(period, off);
          const isCurrent = off === currentOffset;
          return (
            <button
              key={off}
              onClick={() => onPick(off)}
              style={{
                width: '100%', border: 0, background: isCurrent ? T.accentSoft : 'transparent',
                display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px',
                margin: '2px 0', borderRadius: 12, cursor: 'pointer', textAlign: 'left',
                fontFamily: 'Pretendard, system-ui, sans-serif',
              }}
            >
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: '-0.01em', color: isCurrent ? T.accent : T.text, display: 'flex', alignItems: 'center', gap: 6 }}>
                  {pInfo.label}
                  {off === 0 && (
                    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 999, background: T.bgMuted, color: T.textSec }}>
                      현재
                    </span>
                  )}
                </div>
              </div>
              {isCurrent && (
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none" style={{ flexShrink: 0 }}>
                  <path d="M4 9l3 3 7-7" stroke={T.accent} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </button>
          );
        })}
      </div>
    </BottomSheet>
  );
}

const DELETE_BTN_WIDTH = 76;

function ExpenseRow({ e, onClick, onDelete }: { e: Expense; onClick: () => void; onDelete?: () => void }) {
  const cat = getCategoryById(e.category);
  const [swipeX, setSwipeX] = useState(0);
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const didSwipe = useRef(false);
  const isOpen = swipeX >= DELETE_BTN_WIDTH;

  const handleTouchStart = (ev: React.TouchEvent) => {
    touchStartX.current = ev.touches[0].clientX;
    touchStartY.current = ev.touches[0].clientY;
    didSwipe.current = false;
  };

  const handleTouchMove = (ev: React.TouchEvent) => {
    const dx = touchStartX.current - ev.touches[0].clientX;
    const dy = Math.abs(touchStartY.current - ev.touches[0].clientY);
    if (!didSwipe.current && Math.abs(dx) > 8 && Math.abs(dx) > dy) {
      didSwipe.current = true;
    }
    if (didSwipe.current) {
      setSwipeX(Math.max(0, Math.min(DELETE_BTN_WIDTH, dx)));
    }
  };

  const handleTouchEnd = () => {
    if (swipeX > DELETE_BTN_WIDTH * 0.5) {
      setSwipeX(DELETE_BTN_WIDTH);
    } else {
      setSwipeX(0);
    }
  };

  const handleClick = () => {
    if (didSwipe.current) { didSwipe.current = false; return; }
    if (isOpen) { setSwipeX(0); return; }
    onClick();
  };

  return (
    <div style={{ position: 'relative', overflow: 'hidden' }}>
      {onDelete && (
        <button
          onClick={(ev) => { ev.stopPropagation(); setSwipeX(0); onDelete(); }}
          style={{
            position: 'absolute', right: 0, top: 0, bottom: 0, width: DELETE_BTN_WIDTH,
            background: T.danger, border: 0, cursor: 'pointer',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4,
          }}
        >
          <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
            <path d="M6 5V4a1 1 0 011-1h6a1 1 0 011 1v1M3 5h14M8 9v6M12 9v6M4 5l1 12h10l1-12" stroke="white" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span style={{ color: 'white', fontSize: 11, fontWeight: 700, letterSpacing: '-0.01em' }}>삭제</span>
        </button>
      )}
      <button
        onClick={handleClick}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 12,
          padding: '14px 20px', cursor: 'pointer', border: 0,
          background: isOpen ? T.bgSoft : T.bg,
          textAlign: 'left', position: 'relative', zIndex: 1,
          transform: `translateX(-${swipeX}px)`,
          transition: (swipeX === 0 || swipeX === DELETE_BTN_WIDTH) ? 'transform 0.2s ease, background 0.2s' : 'none',
        }}
      >
        <CatIcon catId={e.category} size={36} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: T.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', letterSpacing: '-0.01em' }}>
            {e.merchant}
          </div>
          <div style={{ fontSize: 12, color: T.textTer, marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ color: cat?.color, fontWeight: 500 }}>{cat?.name}</span>
            {e.memo && <><span>·</span><span>{e.memo}</span></>}
            <span>·</span>
            <span>{e.source === 'ocr' ? 'OCR' : '직접입력'}</span>
            {e.imageUrl && (
              <><span>·</span>
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <rect x="1" y="2" width="10" height="8" rx="1.5" stroke={T.textTer} strokeWidth="1.2" />
                  <circle cx="4" cy="5.5" r="1" fill={T.textTer} />
                  <path d="M1.5 9l2.5-2.5 1.5 1 3-2.5 2 2" stroke={T.textTer} strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                </svg>
              </>
            )}
          </div>
        </div>
        <div style={{ fontSize: 15, fontWeight: 700, color: T.text, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em', flexShrink: 0 }}>
          −{formatWon(e.amount).replace('₩', '₩ ')}
        </div>
      </button>
    </div>
  );
}

function MonthPickerSheet({ current, onPick, onClose }: { current: string; onPick: (m: string) => void; onClose: () => void }) {
  const now = new Date();
  const baseY = now.getFullYear();
  const baseM = now.getMonth() + 1;
  const todayMonth = `${baseY}-${String(baseM).padStart(2, '0')}`;

  const months: { id: string; y: number; m: number }[] = [];
  for (let i = 0; i < 12; i++) {
    const idx = baseY * 12 + (baseM - 1) - i;
    const y = Math.floor(idx / 12);
    const m = (idx % 12) + 1;
    months.push({ id: `${y}-${String(m).padStart(2, '0')}`, y, m });
  }

  return (
    <BottomSheet open onClose={onClose} title="월 선택" height="70%">
      <div style={{ padding: '0 8px 16px' }}>
        {months.map((mo) => {
          const isCurrent = mo.id === current;
          const isToday = mo.id === todayMonth;
          return (
            <button
              key={mo.id}
              onClick={() => onPick(mo.id)}
              style={{
                width: '100%', border: 0, background: isCurrent ? T.accentSoft : 'transparent',
                display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px',
                margin: '2px 0', borderRadius: 12, cursor: 'pointer', textAlign: 'left',
              }}
            >
              <div style={{
                width: 40, height: 40, borderRadius: 10,
                background: isCurrent ? T.accent : T.bgMuted,
                color: isCurrent ? '#fff' : T.textSec,
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0, fontFamily: 'Pretendard, system-ui, sans-serif',
              }}>
                <span style={{ fontSize: 10, fontWeight: 600, opacity: 0.85, lineHeight: 1 }}>{mo.y}</span>
                <span style={{ fontSize: 15, fontWeight: 800, lineHeight: 1.2 }}>{mo.m}월</span>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: '-0.01em', color: isCurrent ? T.accent : T.text, display: 'flex', alignItems: 'center', gap: 6 }}>
                  {mo.y}년 {mo.m}월
                  {isToday && (
                    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 999, background: T.bgMuted, color: T.textSec }}>
                      이번 달
                    </span>
                  )}
                </div>
              </div>
              {isCurrent && (
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none" style={{ flexShrink: 0 }}>
                  <path d="M4 9l3 3 7-7" stroke={T.accent} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </button>
          );
        })}
      </div>
    </BottomSheet>
  );
}

function QuickBudgetSheet({ cat, value, month, onClose, onSave }: {
  cat: { id: string; name: string; color: string };
  value: number;
  month: string;
  onClose: () => void;
  onSave: (v: number, scope: BudgetScope) => void;
}) {
  const [v, setV] = useState(value);
  const [scope, setScope] = useState<BudgetScope>('this_month');
  const presets = [10, 20, 30, 50, 100];
  const adjust = (delta: number) => setV(Math.max(0, v + delta));
  const formatted = v.toLocaleString('ko-KR');
  const [y, mo] = month.split('-');
  const monthLabel = `${y}년 ${parseInt(mo)}월`;

  return (
    <BottomSheet open onClose={onClose} title={`${cat.name} 예산 수정`} height="70%">
      <div style={{ padding: '0 20px 24px' }}>
        <div style={{ padding: '20px 0', textAlign: 'center', borderBottom: `1px solid ${T.divider}` }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: 4 }}>
            <span style={{ fontSize: 20, fontWeight: 700, color: T.textSec }}>₩</span>
            <input
              type="text" inputMode="numeric" value={formatted}
              onChange={(e) => {
                const digits = e.target.value.replace(/[^\d]/g, '');
                setV(Math.max(0, Math.floor(Number(digits) || 0)));
              }}
              style={{
                border: 0, background: 'transparent', textAlign: 'center',
                fontFamily: 'Pretendard, system-ui, sans-serif', fontSize: 30, fontWeight: 800,
                color: T.text, letterSpacing: '-0.02em', width: `${formatted.length}ch`,
                minWidth: 80, maxWidth: 240, outline: 'none', padding: 0,
              }}
            />
            <span style={{ fontSize: 18, fontWeight: 700, color: T.textSec }}>원</span>
          </div>
          <div style={{ marginTop: 6, fontSize: 13, color: T.textTer, fontWeight: 500 }}>
            {v >= 10000 ? Math.floor(v / 10000) + '만원' : v.toLocaleString() + '원'} / 월
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, padding: '16px 0 8px', justifyContent: 'space-between' }}>
          {[-50000, -10000, +10000, +50000].map((d) => (
            <button key={d} onClick={() => adjust(d)}
              style={{ flex: 1, padding: '10px 0', border: 0, borderRadius: 10, background: T.bgMuted, color: T.text, fontFamily: 'Pretendard, system-ui, sans-serif', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              {d > 0 ? '+' : '−'}{Math.abs(d) / 10000}만
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', paddingBottom: 16, borderBottom: `1px solid ${T.divider}` }}>
          {presets.map((p) => (
            <button key={p} onClick={() => setV(p * 10000)}
              style={{ border: 0, padding: '8px 14px', borderRadius: 999, background: v === p * 10000 ? cat.color + '18' : T.bgSoft, color: v === p * 10000 ? cat.color : T.text, fontFamily: 'Pretendard, system-ui, sans-serif', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              {p}만원
            </button>
          ))}
        </div>

        <div style={{ paddingTop: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: T.textTer, marginBottom: 10 }}>적용 범위</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {([
              { value: 'this_month' as BudgetScope, label: '이번 달만', sub: monthLabel },
              { value: 'this_and_forward' as BudgetScope, label: '이번 달부터 모두', sub: `${monthLabel} 이후 기본 예산으로 적용` },
            ]).map((opt) => (
              <button key={opt.value} onClick={() => setScope(opt.value)}
                style={{ width: '100%', border: `2px solid ${scope === opt.value ? T.accent : T.divider}`, borderRadius: 12, padding: '12px 14px', background: scope === opt.value ? T.accentSoft : T.bg, cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 12, fontFamily: 'Pretendard, system-ui, sans-serif' }}>
                <div style={{ width: 18, height: 18, borderRadius: 9, flexShrink: 0, border: `2px solid ${scope === opt.value ? T.accent : T.divider}`, background: scope === opt.value ? T.accent : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {scope === opt.value && <div style={{ width: 6, height: 6, borderRadius: 3, background: '#fff' }} />}
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

function EditExpenseSheet({ expense, onSave, onDelete, onClose }: {
  expense: Expense; onSave: (e: Expense) => void; onDelete: (id: string) => void; onClose: () => void;
}) {
  const [date, setDate] = useState(expense.date);
  const [amount, setAmount] = useState(String(expense.amount));
  const [merchant, setMerchant] = useState(expense.merchant);
  const [category, setCategory] = useState(expense.category);
  const [memo, setMemo] = useState(expense.memo);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [showImageModal, setShowImageModal] = useState(false);

  useEffect(() => {
    if (expense.imageUrl) getReceiptImageUrl(expense.imageUrl).then(setImageUrl);
  }, [expense.imageUrl]);

  const categories = DEFAULT_CATEGORIES.filter((c) => c.id !== 'other');

  return (
    <BottomSheet open onClose={onClose} title="지출 수정" height="85%">
      <div style={{ padding: '0 20px 24px' }}>
        {imageUrl && (
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: T.textSec, marginBottom: 8 }}>영수증 / 캡쳐</label>
            <button onClick={() => setShowImageModal(true)}
              style={{ width: '100%', height: 120, border: `1px solid ${T.divider}`, borderRadius: 12, overflow: 'hidden', cursor: 'pointer', background: T.bgSoft, padding: 0, position: 'relative' }}>
              <img src={imageUrl} alt="영수증" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              <div style={{ position: 'absolute', bottom: 8, right: 8, padding: '4px 8px', borderRadius: 6, background: 'rgba(0,0,0,0.6)', color: '#fff', fontSize: 11, fontWeight: 600 }}>탭하여 확대</div>
            </button>
          </div>
        )}

        {[
          { label: '금액', content: <input type="text" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9]/g, ''))} style={{ width: '100%', padding: '12px 16px', border: `1px solid ${T.divider}`, borderRadius: 12, fontSize: 16, fontWeight: 600, outline: 'none', fontFamily: 'Pretendard, system-ui, sans-serif' }} /> },
          { label: '사용처', content: <input type="text" value={merchant} onChange={(e) => setMerchant(e.target.value)} style={{ width: '100%', padding: '12px 16px', border: `1px solid ${T.divider}`, borderRadius: 12, fontSize: 16, fontWeight: 600, outline: 'none', fontFamily: 'Pretendard, system-ui, sans-serif' }} /> },
          { label: '날짜', content: <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ width: '100%', padding: '12px 16px', border: `1px solid ${T.divider}`, borderRadius: 12, fontSize: 16, fontWeight: 600, outline: 'none', fontFamily: 'Pretendard, system-ui, sans-serif' }} /> },
        ].map(({ label, content }) => (
          <div key={label} style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: T.textSec, marginBottom: 8 }}>{label}</label>
            {content}
          </div>
        ))}

        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: T.textSec, marginBottom: 8 }}>카테고리</label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
            {categories.map((cat) => (
              <button key={cat.id} type="button" onClick={() => setCategory(cat.id)}
                style={{ border: category === cat.id ? `2px solid ${cat.color}` : `1px solid ${T.divider}`, padding: '10px 4px', borderRadius: 12, cursor: 'pointer', background: category === cat.id ? cat.color + '12' : 'transparent', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                <CatIcon catId={cat.id} size={28} />
                <span style={{ fontSize: 11, fontWeight: 600, color: category === cat.id ? cat.color : T.textSec }}>{cat.name}</span>
              </button>
            ))}
          </div>
        </div>

        <div style={{ marginBottom: 24 }}>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: T.textSec, marginBottom: 8 }}>메모</label>
          <input type="text" value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="선택사항"
            style={{ width: '100%', padding: '12px 16px', border: `1px solid ${T.divider}`, borderRadius: 12, fontSize: 16, fontWeight: 600, outline: 'none', fontFamily: 'Pretendard, system-ui, sans-serif' }} />
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" onClick={() => { onDelete(expense.id); onClose(); }}
            style={{ padding: '14px 20px', border: `1px solid ${T.danger}`, borderRadius: 12, color: T.danger, background: 'transparent', fontSize: 15, fontWeight: 600, cursor: 'pointer' }}>
            삭제
          </button>
          <div style={{ flex: 1 }}>
            <PrimaryButton onClick={() => onSave({ ...expense, date, amount: parseInt(amount) || 0, merchant, category, memo })}>저장</PrimaryButton>
          </div>
        </div>
      </div>

      {showImageModal && imageUrl && (
        <div onClick={() => setShowImageModal(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <button onClick={() => setShowImageModal(false)}
            style={{ position: 'absolute', top: 16, right: 16, width: 40, height: 40, borderRadius: 20, border: 0, background: 'rgba(255,255,255,0.2)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="18" height="18" viewBox="0 0 18 18"><path d="M4 4l10 10M14 4l-10 10" stroke="#fff" strokeWidth="2" strokeLinecap="round" /></svg>
          </button>
          <img src={imageUrl} alt="영수증" style={{ maxWidth: '100%', maxHeight: '90vh', objectFit: 'contain', borderRadius: 8 }} onClick={(e) => e.stopPropagation()} />
        </div>
      )}
    </BottomSheet>
  );
}
