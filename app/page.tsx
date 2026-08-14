'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Screen,
  ScreenBody,
  T,
  MoneyText,
  ProgressBar,
  Badge,
  CatIcon,
  MonthPickerSheet,
  ExcludeCategoriesSheet,
} from '@/components/ui';
import { useExpensesByMonth, useMonthlySummary, useCategories } from '@/hooks/useSupabaseData';
import { getCurrentMonth, getExcludedCategories, saveExcludedCategories } from '@/lib/supabase-storage';
import { formatDateShort, getDaysRemaining } from '@/lib/utils';

const EMPTY_SET = new Set<string>();

// 원화 포맷 함수
function formatWon(amount: number): string {
  if (amount >= 10000) {
    return (amount / 10000).toFixed(0) + '만원';
  }
  return '₩' + Math.abs(Math.round(amount)).toLocaleString('ko-KR');
}

export default function HomePage() {
  const router = useRouter();
  const [monthOffset, setMonthOffset] = useState(0);
  const [monthSheetOpen, setMonthSheetOpen] = useState(false);
  // 내역 화면에서 설정한 "제외 카테고리"를 홈 요약에도 그대로 반영
  const [excludedCats, setExcludedCats] = useState<Set<string>>(new Set());
  const [excludeSheetOpen, setExcludeSheetOpen] = useState(false);
  // 꾹 누르고 있는 동안만 "모두 포함" 기준으로 미리보기 (떼면 원래 제외 설정으로 복귀)
  const [peekAll, setPeekAll] = useState(false);

  useEffect(() => {
    getExcludedCategories().then((ids) => setExcludedCats(new Set(ids)));
  }, []);

  const effectiveExcluded = peekAll ? EMPTY_SET : excludedCats;
  const todayMonth = getCurrentMonth();
  const currentMonth = (() => {
    const [y, m] = todayMonth.split('-').map(Number);
    const idx = y * 12 + (m - 1) + monthOffset;
    const yy = Math.floor(idx / 12);
    const mm = (idx % 12) + 1;
    return `${yy}-${String(mm).padStart(2, '0')}`;
  })();
  const isCurrentMonth = monthOffset === 0;
  const daysLeft = getDaysRemaining();

  const { expenses, loading: expensesLoading } = useExpensesByMonth(currentMonth);
  const { summary, loading: summaryLoading } = useMonthlySummary(currentMonth);
  const { categories } = useCategories();

  const loading = expensesLoading || summaryLoading;

  if (loading || !summary) {
    return (
      <Screen>
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <div style={{ textAlign: 'center' }}>
            <div
              style={{
                width: 40,
                height: 40,
                border: `3px solid ${T.divider}`,
                borderTopColor: T.accent,
                borderRadius: '50%',
                animation: 'spin 1s linear infinite',
                margin: '0 auto 16px',
              }}
            />
            <p style={{ color: T.textSec, fontSize: 15 }}>로딩 중...</p>
          </div>
          <style>{`
            @keyframes spin {
              to { transform: rotate(360deg); }
            }
          `}</style>
        </div>
      </Screen>
    );
  }

  // 제외 카테고리를 뺀 실제 표시용 합계 — 예산도 같이 빼야 사용률이 안 왜곡됨
  // '모두 포함' 꾹 누르는 동안은 effectiveExcluded가 빈 세트라 전체 기준으로 보임
  const includedBreakdown = Object.entries(summary.categoryBreakdown).filter(
    ([catId]) => !effectiveExcluded.has(catId)
  );
  const usedTotal = includedBreakdown.reduce((s, [, c]) => s + c.spent, 0);
  const budgetTotal = includedBreakdown.reduce((s, [, c]) => s + c.budget, 0);
  const remaining = budgetTotal - usedTotal;
  const pct = budgetTotal > 0 ? (usedTotal / budgetTotal) * 100 : 0;
  const over = remaining < 0;

  // 카테고리별 사용량 정렬 (예산 높은 순, 최대 8개)
  const categoryRows = categories
    .filter((c) => c.id !== 'other' && !effectiveExcluded.has(c.id))
    .map((cat) => {
      const catData = summary.categoryBreakdown[cat.id];
      const used = catData?.spent || 0;
      const cap = catData?.budget || 0;
      const p = cap > 0 ? (used / cap) * 100 : used > 0 ? 100 : 0;
      return { cat, used, cap, pct: p, over: used > cap };
    })
    .sort((a, b) => b.cap - a.cap)
    .slice(0, 8);

  // 카테고리 ID → 카테고리 객체 맵 (커스텀 카테고리 icon/color 조회용)
  const catLookup = new Map(categories.map((c) => [c.id, c]));

  // 최근 지출 4개 (제외 카테고리는 홈 요약과 일관되게 빼고 표시)
  const recentExpenses = expenses
    .filter((e) => !effectiveExcluded.has(e.category))
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 4);

  // 현재 년월 표시
  const [year, month] = currentMonth.split('-');
  const monthLabel = `${year}년 ${parseInt(month)}월`;

  return (
    <Screen>
      {/* 헤더 */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '60px 20px 8px',
          position: 'sticky',
          top: 0,
          background: T.bg,
          zIndex: 5,
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
            gap: 6,
          }}
        >
          <span
            style={{
              fontSize: 22,
              fontWeight: 700,
              letterSpacing: '-0.02em',
            }}
          >
            {monthLabel}
          </span>
          <svg width="18" height="18" viewBox="0 0 18 18">
            <path
              d="M5 7l4 4 4-4"
              stroke={T.textSec}
              strokeWidth="1.8"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <button
            onClick={() => router.push('/budget')}
            aria-label="예산 설정"
            style={{
              width: 40, height: 40, border: 0, background: 'transparent',
              borderRadius: 20, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
              <rect x="1" y="5" width="20" height="14" rx="2.5" stroke={T.text} strokeWidth="1.8" />
              <path d="M1 9h20" stroke={T.text} strokeWidth="1.8" strokeLinecap="round" />
              <circle cx="16" cy="14" r="1.5" fill={T.text} />
            </svg>
          </button>
          <button
            onClick={() => router.push('/mypage')}
            aria-label="프로필"
            style={{
              width: 40, height: 40, border: 0, background: 'transparent',
              borderRadius: 20, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
              <circle cx="11" cy="7.5" r="3.5" stroke={T.text} strokeWidth="1.8" />
              <path d="M3.5 18.5c0-3 3.4-5.5 7.5-5.5s7.5 2.5 7.5 5.5" stroke={T.text} strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </div>

      <ScreenBody>
        {/* 히어로 카드: 이번 달 요약 */}
        <div style={{ padding: '4px 20px 20px' }}>
          <div
            style={{
              background: T.bg,
              border: `1px solid ${T.divider}`,
              borderRadius: 20,
              padding: 24,
              boxShadow: '0 2px 8px rgba(10,13,20,0.04)',
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
              <span
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: T.textSec,
                  letterSpacing: '-0.01em',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                {isCurrentMonth ? '이번 달' : monthLabel} 사용 금액
                {excludedCats.size > 0 && (
                  <>
                    <button
                      onClick={() => setExcludeSheetOpen(true)}
                      style={{
                        fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 999,
                        background: T.bgMuted, color: T.textTer, cursor: 'pointer',
                        border: 0, fontFamily: 'Pretendard, system-ui, sans-serif',
                      }}
                    >
                      {excludedCats.size}개 제외 중
                    </button>
                    <button
                      onPointerDown={() => setPeekAll(true)}
                      onPointerUp={() => setPeekAll(false)}
                      onPointerLeave={() => setPeekAll(false)}
                      onPointerCancel={() => setPeekAll(false)}
                      style={{
                        fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 999,
                        background: peekAll ? T.accent : T.accentSoft, color: peekAll ? '#fff' : T.accent,
                        cursor: 'pointer', border: 0, fontFamily: 'Pretendard, system-ui, sans-serif',
                        touchAction: 'none', userSelect: 'none',
                      }}
                    >
                      모두 포함
                    </button>
                  </>
                )}
              </span>
              <button
                onClick={() => router.push('/add')}
                aria-label="지출 추가"
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  border: 0,
                  background: T.accentSoft,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <svg width="16" height="16" viewBox="0 0 16 16">
                  <path
                    d="M8 3v10M3 8h10"
                    stroke={T.accent}
                    strokeWidth="2.2"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            </div>

            {/* 큰 금액 */}
            <div style={{ marginBottom: 6 }}>
              <MoneyText value={usedTotal} size={34} weight={800} />
            </div>

            {/* 잔여/예산 라인 */}
            <div
              style={{
                display: 'flex',
                alignItems: 'baseline',
                gap: 6,
                marginBottom: 18,
                fontSize: 13,
                fontWeight: 500,
                letterSpacing: '-0.01em',
              }}
            >
              {over ? (
                <>
                  <span style={{ color: T.danger, fontWeight: 700 }}>
                    예산 {formatWon(-remaining)} 초과
                  </span>
                  <span style={{ color: T.textTer }}>
                    · 예산 {formatWon(budgetTotal)}
                  </span>
                </>
              ) : (
                <>
                  <span style={{ color: T.textSec }}>
                    잔여 금액{' '}
                    <span style={{ color: T.text, fontWeight: 700 }}>
                      {formatWon(remaining)}
                    </span>
                  </span>
                  <span style={{ color: T.textTer }}>
                    / 예산 {formatWon(budgetTotal)}
                  </span>
                </>
              )}
            </div>

            {/* 진행 바 */}
            <div style={{ marginBottom: 12 }}>
              <ProgressBar value={pct} height={10} />
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontSize: 13,
                fontWeight: 500,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ color: T.textSec }}>사용률</span>
                <span
                  style={{
                    color: over ? T.danger : T.text,
                    fontWeight: 700,
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {pct.toFixed(0)}%
                </span>
                {over && <Badge tone="danger">예산 초과</Badge>}
              </div>
              {isCurrentMonth && <div style={{ color: T.textTer }}>{daysLeft}일 남음</div>}
            </div>
          </div>
        </div>

        {/* 카테고리 분석 */}
        <div style={{ padding: '8px 20px 16px' }}>
          <div
            style={{
              background: T.bg,
              border: `1px solid ${T.divider}`,
              borderRadius: 16,
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '16px 16px 12px',
                borderBottom: `1px solid ${T.divider}`,
              }}
            >
              <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: '-0.02em' }}>
                {isCurrentMonth ? '이번 달' : monthLabel} 상세 내역
              </div>
              <button
                onClick={() => router.push('/expenses')}
                style={{
                  border: 0, background: 'transparent', cursor: 'pointer',
                  color: T.textTer, fontSize: 13, fontWeight: 500, padding: 0,
                }}
              >
                더보기 및 설정 →
              </button>
            </div>
            {categoryRows.map((r, i) => (
              <div
                key={r.cat.id}
                style={{ borderBottom: i < categoryRows.length - 1 ? `1px solid ${T.divider}` : 'none' }}
              >
                <CategoryRow
                  row={r}
                  onClick={() => router.push(`/expenses?category=${r.cat.id}`)}
                />
              </div>
            ))}
          </div>
        </div>

        {/* 최근 소비 내역 */}
        <div style={{ padding: '8px 20px 16px' }}>
          <div
            style={{
              background: T.bg,
              border: `1px solid ${T.divider}`,
              borderRadius: 16,
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '16px 16px 12px',
                borderBottom: `1px solid ${T.divider}`,
              }}
            >
              <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: '-0.02em' }}>
                최근 소비 내역
              </div>
              <button
                onClick={() => router.push('/expenses')}
                style={{
                  border: 0, background: 'transparent', cursor: 'pointer',
                  color: T.textTer, fontSize: 13, fontWeight: 500, padding: 0,
                }}
              >
                전체 보기 →
              </button>
            </div>
            {recentExpenses.length === 0 ? (
              <div
                style={{
                  padding: '40px 20px',
                  textAlign: 'center',
                  color: T.textTer,
                  fontSize: 14,
                }}
              >
                아직 지출 내역이 없어요
              </div>
            ) : (
              recentExpenses.map((e, i, arr) => (
                <div
                  key={e.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '14px 16px',
                    borderBottom:
                      i < arr.length - 1
                        ? `1px solid ${T.divider}`
                        : 'none',
                  }}
                >
                  <CatIcon catId={e.category} size={36} icon={catLookup.get(e.category)?.icon} color={catLookup.get(e.category)?.color} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 14,
                        fontWeight: 600,
                        color: T.text,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {e.merchant}
                    </div>
                    <div
                      style={{
                        fontSize: 12,
                        color: T.textTer,
                        marginTop: 2,
                      }}
                    >
                      {formatDateShort(e.date)}
                      {e.memo && ` · ${e.memo}`}
                    </div>
                  </div>
                  <div
                    style={{
                      fontSize: 15,
                      fontWeight: 700,
                      color: T.text,
                      fontVariantNumeric: 'tabular-nums',
                      letterSpacing: '-0.02em',
                    }}
                  >
                    −₩ {e.amount.toLocaleString('ko-KR')}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </ScreenBody>

      {monthSheetOpen && (
        <MonthPickerSheet
          current={currentMonth}
          onPick={(m) => {
            const [y, mo] = m.split('-').map(Number);
            const [ty, tm] = todayMonth.split('-').map(Number);
            const diff = y * 12 + (mo - 1) - (ty * 12 + (tm - 1));
            setMonthOffset(diff);
            setMonthSheetOpen(false);
          }}
          onClose={() => setMonthSheetOpen(false)}
        />
      )}

      {excludeSheetOpen && (
        <ExcludeCategoriesSheet
          categories={categories}
          excluded={excludedCats}
          onApply={(ids) => {
            setExcludedCats(new Set(ids));
            saveExcludedCategories(ids);
            setExcludeSheetOpen(false);
          }}
          onClose={() => setExcludeSheetOpen(false)}
        />
      )}
    </Screen>
  );
}

// 카테고리 행 컴포넌트
interface CategoryRowData {
  cat: {
    id: string;
    name: string;
    icon: string;
    color: string;
  };
  used: number;
  cap: number;
  pct: number;
  over: boolean;
}

function CategoryRow({
  row,
  onClick,
}: {
  row: CategoryRowData;
  onClick: () => void;
}) {
  const { cat, used, cap, pct, over } = row;

  return (
    <button
      onClick={onClick}
      style={{
        width: '100%',
        border: 0,
        background: 'transparent',
        padding: '14px 16px',
        cursor: 'pointer',
        textAlign: 'left',
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
        <CatIcon catId={cat.id} size={36} icon={cat.icon} color={cat.color} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'baseline',
              justifyContent: 'space-between',
              gap: 8,
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                minWidth: 0,
              }}
            >
              <span
                style={{
                  fontSize: 15,
                  fontWeight: 600,
                  letterSpacing: '-0.01em',
                }}
              >
                {cat.name}
              </span>
              {over && <Badge tone="danger">초과</Badge>}
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
              {formatWon(used)}
            </div>
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'baseline',
              justifyContent: 'space-between',
              marginTop: 2,
              fontSize: 12,
              color: T.textTer,
            }}
          >
            <span
              style={{
                color: over ? T.danger : T.textTer,
                fontWeight: over ? 600 : 500,
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {pct.toFixed(0)}%
            </span>
            <span style={{ fontVariantNumeric: 'tabular-nums' }}>
              예산 {cap >= 10000 ? (cap / 10000).toFixed(0) + '만원' : formatWon(cap)}
            </span>
          </div>
        </div>
      </div>
      <div style={{ paddingLeft: 48 }}>
        <ProgressBar
          value={pct}
          height={6}
          fillColor={T.accent}
          overColor={T.danger}
        />
      </div>
    </button>
  );
}
