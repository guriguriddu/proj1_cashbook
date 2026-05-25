'use client';

import { useState, useEffect, Suspense } from 'react';
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
import {
  getCurrentMonth,
  getReceiptImageUrl,
} from '@/lib/supabase-storage';
import { useExpensesByMonth, useBudget } from '@/hooks/useSupabaseData';
import * as storage from '@/lib/supabase-storage';
import { formatDateShort } from '@/lib/utils';
import { DEFAULT_CATEGORIES, getCategoryById } from '@/constants/categories';
import type { Expense } from '@/types';

function formatWon(amount: number): string {
  return '₩' + Math.abs(Math.round(amount)).toLocaleString('ko-KR');
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
  const dayName = dayNames[date.getDay()];
  return `${month}월 ${day}일 (${dayName})`;
}

type StatsPeriodType = 'quarter' | 'half' | 'year';

function statsInfo(type: StatsPeriodType, offset: number) {
  const now = new Date();
  const baseY = now.getFullYear();
  const baseM = now.getMonth() + 1;

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

  const [viewMode, setViewMode] = useState<'list' | 'stats'>('list');
  const [filterCat, setFilterCat] = useState(initialCat);
  const [sort, setSort] = useState<'date' | 'amount'>('date');
  const [month, setMonth] = useState(getCurrentMonth());
  const [monthSheetOpen, setMonthSheetOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);

  // Stats mode state
  const [statsPeriod, setStatsPeriod] = useState<StatsPeriodType>('quarter');
  const [statsOffset, setStatsOffset] = useState(0);
  const [statsExpenses, setStatsExpenses] = useState<Expense[]>([]);
  const [statsLoading, setStatsLoading] = useState(false);

  const { expenses, loading: expensesLoading, refresh: refreshExpenses } = useExpensesByMonth(month);
  const { budget, loading: budgetLoading } = useBudget();

  const loading = expensesLoading || budgetLoading;

  // Fetch stats data when in stats mode
  useEffect(() => {
    if (viewMode !== 'stats') return;
    const info = statsInfo(statsPeriod, statsOffset);
    setStatsLoading(true);
    storage
      .getExpensesByDateRange(info.startDate, info.endDate)
      .then(setStatsExpenses)
      .finally(() => setStatsLoading(false));
  }, [viewMode, statsPeriod, statsOffset]);

  if (loading || !budget) {
    return (
      <Screen>
        <div style={{ padding: 20, color: T.textSec }}>로딩 중...</div>
      </Screen>
    );
  }

  const monthExpenses = expenses;
  const filtered = monthExpenses.filter(
    (e) => filterCat === 'all' || e.category === filterCat
  );
  const total = filtered.reduce((a, e) => a + e.amount, 0);
  const count = filtered.length;

  const monthLabel = (m: string) => {
    const [y, mm] = m.split('-').map(Number);
    return `${y}년 ${mm}월`;
  };

  type GroupedExpense = { date: string | null; items: Expense[] };
  let grouped: GroupedExpense[] = [];
  if (sort === 'date') {
    const byDate: Record<string, Expense[]> = {};
    filtered.forEach((e) => {
      if (!byDate[e.date]) byDate[e.date] = [];
      byDate[e.date].push(e);
    });
    grouped = Object.keys(byDate)
      .sort((a, b) => b.localeCompare(a))
      .map((date) => ({
        date,
        items: byDate[date].sort((a, b) => b.amount - a.amount),
      }));
  } else {
    grouped = [{ date: null, items: [...filtered].sort((a, b) => b.amount - a.amount) }];
  }

  const presentCats = new Set(monthExpenses.map((e) => e.category));
  const chips: Array<{ id: string; name: string; color: string }> = [
    { id: 'all', name: '전체', color: T.text },
    ...DEFAULT_CATEGORIES.filter((c) => presentCats.has(c.id)).map((c) => ({
      id: c.id,
      name: c.name,
      color: c.color,
    })),
  ];

  const catData = filterCat !== 'all' ? DEFAULT_CATEGORIES.find((c) => c.id === filterCat) : null;
  const catBudget = catData ? budget.categoryBudgets[catData.id] || 0 : 0;
  const catPct = catBudget > 0 ? (total / catBudget) * 100 : 0;

  const handleDelete = async (id: string) => {
    if (confirm('이 지출 내역을 삭제하시겠습니까?')) {
      await storage.deleteExpense(id);
      refreshExpenses();
    }
  };

  const handleSaveEdit = async (updated: Expense) => {
    await storage.updateExpense(updated.id, updated);
    setEditingExpense(null);
    refreshExpenses();
  };

  // Stats aggregation
  const statsInfo_ = statsInfo(statsPeriod, statsOffset);
  const statsCatTotals: Record<string, number> = {};
  statsExpenses.forEach((e) => {
    statsCatTotals[e.category] = (statsCatTotals[e.category] || 0) + e.amount;
  });
  const statsTotalSpent = Object.values(statsCatTotals).reduce((a, v) => a + v, 0);
  const statsCatList = DEFAULT_CATEGORIES.filter((c) => statsCatTotals[c.id] > 0).sort(
    (a, b) => (statsCatTotals[b.id] || 0) - (statsCatTotals[a.id] || 0)
  );

  return (
    <Screen>
      <AppHeader
        title="내역"
        onBack={() => router.push('/')}
        rightSlot={
          viewMode === 'list' ? (
            <button
              onClick={() => setSort(sort === 'date' ? 'amount' : 'date')}
              style={{
                width: 'auto',
                padding: '0 12px',
                height: 36,
                background: T.bgMuted,
                borderRadius: 18,
                fontSize: 12,
                fontWeight: 600,
                color: T.textSec,
                gap: 4,
                whiteSpace: 'nowrap',
                flexShrink: 0,
                border: 0,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <svg width="12" height="12" viewBox="0 0 12 12">
                <path
                  d="M3 4l3-3 3 3M3 8l3 3 3-3"
                  stroke={T.textSec}
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
                />
              </svg>
              {sort === 'date' ? '날짜순' : '금액순'}
            </button>
          ) : null
        }
      />

      {/* View mode toggle */}
      <div style={{ padding: '6px 20px 4px', display: 'flex', gap: 4 }}>
        {(['list', 'stats'] as const).map((mode) => (
          <button
            key={mode}
            onClick={() => setViewMode(mode)}
            style={{
              border: 0,
              padding: '8px 18px',
              borderRadius: 999,
              background: viewMode === mode ? T.text : T.bgMuted,
              color: viewMode === mode ? '#fff' : T.textSec,
              fontFamily: 'Pretendard, system-ui, sans-serif',
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer',
              letterSpacing: '-0.01em',
              transition: 'all .15s',
            }}
          >
            {mode === 'list' ? '내역' : '통계'}
          </button>
        ))}
      </div>

      {viewMode === 'list' ? (
        <>
          {/* totals + month picker */}
          <div style={{ padding: '8px 20px 12px', background: T.bg }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 6,
              }}
            >
              <button
                onClick={() => setMonthSheetOpen(true)}
                style={{
                  border: 0,
                  background: 'transparent',
                  padding: 0,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  fontSize: 14,
                  fontWeight: 600,
                  color: T.textSec,
                  letterSpacing: '-0.01em',
                }}
              >
                {monthLabel(month)}
                <svg width="14" height="14" viewBox="0 0 14 14">
                  <path
                    d="M4 5l3 3 3-3"
                    stroke={T.textSec}
                    strokeWidth="1.5"
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
              <div style={{ fontSize: 12, color: T.textTer, fontVariantNumeric: 'tabular-nums' }}>
                {count}건
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <MoneyText value={total} size={28} weight={800} />
            </div>

            {filterCat === 'all' &&
              (() => {
                const totalBudget = Object.values(budget.categoryBudgets).reduce(
                  (a, v) => a + v,
                  0
                );
                const totalPct = totalBudget > 0 ? (total / totalBudget) * 100 : 0;
                return (
                  <div style={{ marginTop: 14 }}>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        fontSize: 12,
                        fontWeight: 500,
                        color: T.textSec,
                        marginBottom: 6,
                      }}
                    >
                      <span style={{ fontWeight: 600 }}>월 예산 사용률</span>
                      <span
                        style={{
                          color: totalPct > 100 ? T.danger : T.text,
                          fontWeight: 700,
                          fontVariantNumeric: 'tabular-nums',
                        }}
                      >
                        {totalPct.toFixed(0)}% / {totalBudget.toLocaleString()}원
                      </span>
                    </div>
                    <ProgressBar
                      value={totalPct}
                      height={6}
                      fillColor={totalPct > 100 ? T.danger : T.accent}
                    />
                  </div>
                );
              })()}

            {catData && (
              <div style={{ marginTop: 14 }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    fontSize: 12,
                    fontWeight: 500,
                    color: T.textSec,
                    marginBottom: 6,
                  }}
                >
                  <span>
                    <span style={{ color: catData.color, fontWeight: 700 }}>{catData.name}</span>{' '}
                    예산 사용률
                  </span>
                  <span
                    style={{
                      color: catPct > 100 ? T.danger : T.text,
                      fontWeight: 700,
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {catBudget > 0
                      ? `${catPct.toFixed(0)}% / ${catBudget.toLocaleString()}원`
                      : '예산 미설정'}
                  </span>
                </div>
                <ProgressBar
                  value={catBudget > 0 ? catPct : total > 0 ? 100 : 0}
                  height={6}
                  fillColor={catData.color}
                />
              </div>
            )}
          </div>

          {/* chips */}
          <div
            style={{
              padding: '4px 16px 12px',
              display: 'flex',
              gap: 6,
              overflowX: 'auto',
              whiteSpace: 'nowrap',
              borderBottom: `1px solid ${T.divider}`,
            }}
          >
            {chips.map((c) => (
              <button
                key={c.id}
                onClick={() => setFilterCat(c.id)}
                style={{
                  border: 0,
                  padding: '8px 14px',
                  borderRadius: 999,
                  background: filterCat === c.id ? T.text : T.bgMuted,
                  color: filterCat === c.id ? '#fff' : T.textSec,
                  fontFamily: 'Pretendard, system-ui, sans-serif',
                  fontSize: 13,
                  fontWeight: 600,
                  letterSpacing: '-0.01em',
                  cursor: 'pointer',
                  flexShrink: 0,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                }}
              >
                {c.id !== 'all' && (
                  <span
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: 3,
                      background: c.color,
                      opacity: filterCat === c.id ? 0.9 : 0.7,
                    }}
                  />
                )}
                {c.name}
              </button>
            ))}
          </div>

          <ScreenBody>
            {grouped.map((g, gi) => (
              <div key={g.date || gi} style={{ marginTop: 4 }}>
                {gi > 0 && g.date && (
                  <div style={{ height: 1, background: T.divider, margin: '6px 20px 0' }} />
                )}
                {g.date && (
                  <div
                    style={{
                      padding: '14px 20px 6px',
                      display: 'flex',
                      alignItems: 'baseline',
                      justifyContent: 'space-between',
                    }}
                  >
                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: 700,
                        color: T.textTer,
                        letterSpacing: '-0.01em',
                      }}
                    >
                      {formatDate(g.date)}
                    </div>
                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: 600,
                        color: T.textTer,
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
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
            ))}
            {filtered.length === 0 && (
              <div
                style={{
                  padding: '64px 20px',
                  textAlign: 'center',
                  color: T.textTer,
                  fontSize: 14,
                  fontWeight: 500,
                }}
              >
                {monthLabel(month)}에는
                <br />
                아직 거래가 없어요
              </div>
            )}
          </ScreenBody>
        </>
      ) : (
        /* Stats mode */
        <>
          {/* Period type selector */}
          <div style={{ padding: '8px 20px 0' }}>
            <div
              style={{
                display: 'flex',
                gap: 6,
                padding: 4,
                background: T.bgMuted,
                borderRadius: 12,
              }}
            >
              {(
                [
                  { id: 'quarter' as const, label: '분기' },
                  { id: 'half' as const, label: '반기' },
                  { id: 'year' as const, label: '연간' },
                ] as { id: StatsPeriodType; label: string }[]
              ).map((p) => (
                <button
                  key={p.id}
                  onClick={() => {
                    setStatsPeriod(p.id);
                    setStatsOffset(0);
                  }}
                  style={{
                    flex: 1,
                    border:
                      statsPeriod === p.id
                        ? `2px solid ${T.accent}`
                        : '2px solid transparent',
                    padding: '8px 0',
                    borderRadius: 8,
                    background: statsPeriod === p.id ? T.bg : 'transparent',
                    fontFamily: 'Pretendard, system-ui, sans-serif',
                    fontSize: 13,
                    fontWeight: statsPeriod === p.id ? 700 : 600,
                    color: statsPeriod === p.id ? T.accent : T.textTer,
                    cursor: 'pointer',
                    letterSpacing: '-0.01em',
                    boxShadow:
                      statsPeriod === p.id ? '0 2px 6px rgba(0,0,0,0.1)' : 'none',
                    transition: 'all .15s',
                  }}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Period stepper */}
          <div
            style={{
              padding: '10px 20px 12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <StatStepBtn onClick={() => setStatsOffset(statsOffset - 1)} dir="prev" />
            <div style={{ textAlign: 'center', flex: 1 }}>
              <div
                style={{
                  fontSize: 15,
                  fontWeight: 700,
                  color: T.text,
                  letterSpacing: '-0.02em',
                }}
              >
                {statsInfo_.label}
              </div>
              {statsOffset !== 0 && (
                <button
                  onClick={() => setStatsOffset(0)}
                  style={{
                    border: 0,
                    background: 'transparent',
                    cursor: 'pointer',
                    color: T.accent,
                    fontSize: 11,
                    fontWeight: 600,
                    padding: '2px 0',
                  }}
                >
                  현재로 돌아가기
                </button>
              )}
            </div>
            <StatStepBtn onClick={() => setStatsOffset(statsOffset + 1)} dir="next" />
          </div>

          <ScreenBody>
            {statsLoading ? (
              <div style={{ padding: '40px 20px', textAlign: 'center', color: T.textSec, fontSize: 14 }}>
                로딩 중...
              </div>
            ) : statsExpenses.length === 0 ? (
              <div
                style={{
                  padding: '64px 20px',
                  textAlign: 'center',
                  color: T.textTer,
                  fontSize: 14,
                  fontWeight: 500,
                }}
              >
                {statsInfo_.label}에는
                <br />
                거래 내역이 없어요
              </div>
            ) : (
              <div style={{ padding: '0 20px 16px' }}>
                {/* Total for period */}
                <div
                  style={{
                    background: T.text,
                    color: '#fff',
                    borderRadius: 20,
                    padding: '20px 22px',
                    marginBottom: 16,
                  }}
                >
                  <div style={{ fontSize: 14, fontWeight: 600, opacity: 0.7, marginBottom: 6 }}>
                    {statsInfo_.label} 총 지출
                  </div>
                  <MoneyText value={statsTotalSpent} size={32} weight={800} color="#fff" />
                  <div
                    style={{
                      marginTop: 8,
                      fontSize: 13,
                      opacity: 0.6,
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {statsExpenses.length}건
                  </div>
                </div>

                {/* Category breakdown */}
                <div style={{ fontSize: 13, fontWeight: 700, color: T.textTer, marginBottom: 10 }}>
                  카테고리별 지출
                </div>
                <div
                  style={{
                    background: T.bg,
                    border: `1px solid ${T.divider}`,
                    borderRadius: 14,
                    overflow: 'hidden',
                  }}
                >
                  {statsCatList.map((cat, i) => {
                    const amt = statsCatTotals[cat.id] || 0;
                    const pct = statsTotalSpent > 0 ? (amt / statsTotalSpent) * 100 : 0;
                    return (
                      <div
                        key={cat.id}
                        style={{
                          padding: '14px 16px',
                          borderBottom:
                            i < statsCatList.length - 1
                              ? `1px solid ${T.divider}`
                              : 'none',
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 12,
                            marginBottom: 8,
                          }}
                        >
                          <CatIcon catId={cat.id} size={32} icon={cat.icon} color={cat.color} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div
                              style={{
                                fontSize: 14,
                                fontWeight: 600,
                                letterSpacing: '-0.01em',
                              }}
                            >
                              {cat.name}
                            </div>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <div
                              style={{
                                fontSize: 15,
                                fontWeight: 700,
                                fontVariantNumeric: 'tabular-nums',
                                letterSpacing: '-0.02em',
                              }}
                            >
                              {formatWon(amt)}
                            </div>
                            <div
                              style={{
                                fontSize: 11,
                                color: T.textTer,
                                fontWeight: 600,
                                marginTop: 2,
                                fontVariantNumeric: 'tabular-nums',
                              }}
                            >
                              {pct.toFixed(1)}%
                            </div>
                          </div>
                        </div>
                        {/* bar */}
                        <div
                          style={{
                            height: 5,
                            background: T.bgMuted,
                            borderRadius: 3,
                            overflow: 'hidden',
                          }}
                        >
                          <div
                            style={{
                              height: '100%',
                              width: pct + '%',
                              background: cat.color,
                              borderRadius: 3,
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </ScreenBody>
        </>
      )}

      {monthSheetOpen && (
        <MonthPickerSheet
          current={month}
          onPick={(m) => {
            setMonth(m);
            setMonthSheetOpen(false);
          }}
          onClose={() => setMonthSheetOpen(false)}
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
    </Screen>
  );
}

function StatStepBtn({ onClick, dir }: { onClick: () => void; dir: 'prev' | 'next' }) {
  return (
    <button
      onClick={onClick}
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

function ExpenseRow({ e, onClick }: { e: Expense; onClick: () => void }) {
  const cat = getCategoryById(e.category);
  return (
    <button
      onClick={onClick}
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '14px 20px',
        cursor: 'pointer',
        border: 0,
        background: 'transparent',
        textAlign: 'left',
      }}
    >
      <CatIcon catId={e.category} size={36} />
      <div style={{ flex: 1, minWidth: 0 }}>
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
          {e.merchant}
        </div>
        <div
          style={{
            fontSize: 12,
            color: T.textTer,
            marginTop: 2,
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          <span style={{ color: cat?.color, fontWeight: 500 }}>{cat?.name}</span>
          {e.memo && (
            <>
              <span>·</span>
              <span>{e.memo}</span>
            </>
          )}
          <span>·</span>
          <span>{e.source === 'ocr' ? 'OCR' : '직접입력'}</span>
          {e.imageUrl && (
            <>
              <span>·</span>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <rect x="1" y="2" width="10" height="8" rx="1.5" stroke={T.textTer} strokeWidth="1.2" />
                <circle cx="4" cy="5.5" r="1" fill={T.textTer} />
                <path
                  d="M1.5 9l2.5-2.5 1.5 1 3-2.5 2 2"
                  stroke={T.textTer}
                  strokeWidth="1"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
                />
              </svg>
            </>
          )}
        </div>
      </div>
      <div
        style={{
          fontSize: 15,
          fontWeight: 700,
          color: T.text,
          fontVariantNumeric: 'tabular-nums',
          letterSpacing: '-0.02em',
          flexShrink: 0,
        }}
      >
        −{formatWon(e.amount).replace('₩', '₩ ')}
      </div>
    </button>
  );
}

function MonthPickerSheet({
  current,
  onPick,
  onClose,
}: {
  current: string;
  onPick: (m: string) => void;
  onClose: () => void;
}) {
  const now = new Date();
  const baseY = now.getFullYear();
  const baseM = now.getMonth() + 1;
  const todayMonth = `${baseY}-${String(baseM).padStart(2, '0')}`;

  const months: { id: string; y: number; m: number }[] = [];
  for (let i = 0; i < 12; i++) {
    const idx = baseY * 12 + (baseM - 1) - i;
    const y = Math.floor(idx / 12);
    const m = (idx % 12) + 1;
    const id = `${y}-${String(m).padStart(2, '0')}`;
    months.push({ id, y, m });
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
                width: '100%',
                border: 0,
                background: isCurrent ? T.accentSoft : 'transparent',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '14px 16px',
                margin: '2px 0',
                borderRadius: 12,
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 10,
                  background: isCurrent ? T.accent : T.bgMuted,
                  color: isCurrent ? '#fff' : T.textSec,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  fontFamily: 'Pretendard, system-ui, sans-serif',
                }}
              >
                <span style={{ fontSize: 10, fontWeight: 600, opacity: 0.85, lineHeight: 1 }}>
                  {mo.y}
                </span>
                <span style={{ fontSize: 15, fontWeight: 800, lineHeight: 1.2 }}>{mo.m}월</span>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 15,
                    fontWeight: 700,
                    letterSpacing: '-0.01em',
                    color: isCurrent ? T.accent : T.text,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  {mo.y}년 {mo.m}월
                  {isToday && (
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        padding: '2px 6px',
                        borderRadius: 999,
                        background: T.bgMuted,
                        color: T.textSec,
                      }}
                    >
                      이번 달
                    </span>
                  )}
                </div>
              </div>
              {isCurrent && (
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none" style={{ flexShrink: 0 }}>
                  <path
                    d="M4 9l3 3 7-7"
                    stroke={T.accent}
                    strokeWidth="2.4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              )}
            </button>
          );
        })}
      </div>
    </BottomSheet>
  );
}

function EditExpenseSheet({
  expense,
  onSave,
  onDelete,
  onClose,
}: {
  expense: Expense;
  onSave: (expense: Expense) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}) {
  const [date, setDate] = useState(expense.date);
  const [amount, setAmount] = useState(String(expense.amount));
  const [merchant, setMerchant] = useState(expense.merchant);
  const [category, setCategory] = useState(expense.category);
  const [memo, setMemo] = useState(expense.memo);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [showImageModal, setShowImageModal] = useState(false);

  useEffect(() => {
    if (expense.imageUrl) {
      getReceiptImageUrl(expense.imageUrl).then(setImageUrl);
    }
  }, [expense.imageUrl]);

  const handleSubmit = () => {
    onSave({ ...expense, date, amount: parseInt(amount) || 0, merchant, category, memo });
  };

  const handleDelete = () => {
    onDelete(expense.id);
    onClose();
  };

  const categories = DEFAULT_CATEGORIES.filter((c) => c.id !== 'other');

  return (
    <BottomSheet open onClose={onClose} title="지출 수정" height="85%">
      <div style={{ padding: '0 20px 24px' }}>
        {imageUrl && (
          <div style={{ marginBottom: 16 }}>
            <label
              style={{
                display: 'block',
                fontSize: 13,
                fontWeight: 600,
                color: T.textSec,
                marginBottom: 8,
              }}
            >
              영수증 / 캡쳐
            </label>
            <button
              onClick={() => setShowImageModal(true)}
              style={{
                width: '100%',
                height: 120,
                border: `1px solid ${T.divider}`,
                borderRadius: 12,
                overflow: 'hidden',
                cursor: 'pointer',
                background: T.bgSoft,
                padding: 0,
                position: 'relative',
              }}
            >
              <img
                src={imageUrl}
                alt="영수증"
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
              <div
                style={{
                  position: 'absolute',
                  bottom: 8,
                  right: 8,
                  padding: '4px 8px',
                  borderRadius: 6,
                  background: 'rgba(0,0,0,0.6)',
                  color: '#fff',
                  fontSize: 11,
                  fontWeight: 600,
                }}
              >
                탭하여 확대
              </div>
            </button>
          </div>
        )}

        <div style={{ marginBottom: 16 }}>
          <label
            style={{ display: 'block', fontSize: 13, fontWeight: 600, color: T.textSec, marginBottom: 8 }}
          >
            금액
          </label>
          <input
            type="text"
            inputMode="numeric"
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^0-9]/g, ''))}
            style={{
              width: '100%',
              padding: '12px 16px',
              border: `1px solid ${T.divider}`,
              borderRadius: 12,
              fontSize: 16,
              fontWeight: 600,
              outline: 'none',
              fontFamily: 'Pretendard, system-ui, sans-serif',
            }}
          />
        </div>

        <div style={{ marginBottom: 16 }}>
          <label
            style={{ display: 'block', fontSize: 13, fontWeight: 600, color: T.textSec, marginBottom: 8 }}
          >
            사용처
          </label>
          <input
            type="text"
            value={merchant}
            onChange={(e) => setMerchant(e.target.value)}
            style={{
              width: '100%',
              padding: '12px 16px',
              border: `1px solid ${T.divider}`,
              borderRadius: 12,
              fontSize: 16,
              fontWeight: 600,
              outline: 'none',
              fontFamily: 'Pretendard, system-ui, sans-serif',
            }}
          />
        </div>

        <div style={{ marginBottom: 16 }}>
          <label
            style={{ display: 'block', fontSize: 13, fontWeight: 600, color: T.textSec, marginBottom: 8 }}
          >
            날짜
          </label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            style={{
              width: '100%',
              padding: '12px 16px',
              border: `1px solid ${T.divider}`,
              borderRadius: 12,
              fontSize: 16,
              fontWeight: 600,
              outline: 'none',
              fontFamily: 'Pretendard, system-ui, sans-serif',
            }}
          />
        </div>

        <div style={{ marginBottom: 16 }}>
          <label
            style={{ display: 'block', fontSize: 13, fontWeight: 600, color: T.textSec, marginBottom: 8 }}
          >
            카테고리
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
            {categories.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setCategory(cat.id)}
                style={{
                  border:
                    category === cat.id
                      ? `2px solid ${cat.color}`
                      : `1px solid ${T.divider}`,
                  padding: '10px 4px',
                  borderRadius: 12,
                  cursor: 'pointer',
                  background: category === cat.id ? cat.color + '12' : 'transparent',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                <CatIcon catId={cat.id} size={28} />
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: category === cat.id ? cat.color : T.textSec,
                  }}
                >
                  {cat.name}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div style={{ marginBottom: 24 }}>
          <label
            style={{ display: 'block', fontSize: 13, fontWeight: 600, color: T.textSec, marginBottom: 8 }}
          >
            메모
          </label>
          <input
            type="text"
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            placeholder="선택사항"
            style={{
              width: '100%',
              padding: '12px 16px',
              border: `1px solid ${T.divider}`,
              borderRadius: 12,
              fontSize: 16,
              fontWeight: 600,
              outline: 'none',
              fontFamily: 'Pretendard, system-ui, sans-serif',
            }}
          />
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button
            type="button"
            onClick={handleDelete}
            style={{
              padding: '14px 20px',
              border: `1px solid ${T.danger}`,
              borderRadius: 12,
              color: T.danger,
              background: 'transparent',
              fontSize: 15,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            삭제
          </button>
          <div style={{ flex: 1 }}>
            <PrimaryButton onClick={handleSubmit}>저장</PrimaryButton>
          </div>
        </div>
      </div>

      {showImageModal && imageUrl && (
        <div
          onClick={() => setShowImageModal(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.9)',
            zIndex: 2000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
          }}
        >
          <button
            onClick={() => setShowImageModal(false)}
            style={{
              position: 'absolute',
              top: 16,
              right: 16,
              width: 40,
              height: 40,
              borderRadius: 20,
              border: 0,
              background: 'rgba(255,255,255,0.2)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <svg width="18" height="18" viewBox="0 0 18 18">
              <path d="M4 4l10 10M14 4l-10 10" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
          <img
            src={imageUrl}
            alt="영수증"
            style={{
              maxWidth: '100%',
              maxHeight: '90vh',
              objectFit: 'contain',
              borderRadius: 8,
            }}
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </BottomSheet>
  );
}
