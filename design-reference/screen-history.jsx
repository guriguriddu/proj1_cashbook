// screen-history.jsx — 월별 내역 화면
// Top: month total / category chips filter
// List: grouped by date, descending

function HistoryScreen({ navigate, expenses, budget, initialCat }) {
  const [filterCat, setFilterCat] = React.useState(initialCat || 'all');
  const [sort, setSort] = React.useState('date'); // 'date' | 'amount'
  // Selected month (YYYY-MM). Default to May 2026 — the demo "current" month.
  const [month, setMonth] = React.useState('2026-05');
  const [monthSheetOpen, setMonthSheetOpen] = React.useState(false);

  // Filter expenses to the selected month, then by category.
  const monthExpenses = expenses.filter(e => e.date.startsWith(month));
  const filtered = monthExpenses.filter(e => filterCat === 'all' || e.cat === filterCat);
  const total = filtered.reduce((a, e) => a + e.amount, 0);
  const count = filtered.length;

  // Pretty label like "2026년 5월" from a "YYYY-MM" string.
  const monthLabel = (m) => {
    const [y, mm] = m.split('-').map(Number);
    return `${y}년 ${mm}월`;
  };

  // group by date or sort by amount
  let grouped = [];
  if (sort === 'date') {
    const byDate = {};
    filtered.forEach(e => {
      if (!byDate[e.date]) byDate[e.date] = [];
      byDate[e.date].push(e);
    });
    grouped = Object.keys(byDate)
      .sort((a, b) => b.localeCompare(a))
      .map(date => ({ date, items: byDate[date].sort((a, b) => b.amount - a.amount) }));
  } else {
    grouped = [{ date: null, items: [...filtered].sort((a, b) => b.amount - a.amount) }];
  }

  // chip set: 전체 + categories present in the selected month
  const presentCats = new Set(monthExpenses.map(e => e.cat));
  const chips = [{ id: 'all', name: '전체', color: T.text }]
    .concat(window.CATEGORIES.filter(c => presentCats.has(c.id)));

  // category-specific summary
  const catData = filterCat !== 'all' ? window.CATEGORY_BY_ID[filterCat] : null;
  const catBudget = catData ? (budget[catData.id] || 0) : 0;
  const catPct = catBudget > 0 ? (total / catBudget) * 100 : 0;

  return (
    <Screen>
      <AppHeader title="내역" onBack={() => navigate('home')}
        rightSlot={
          <button onClick={() => setSort(sort === 'date' ? 'amount' : 'date')} style={{
            ...iconBtnStyle, width: 'auto', padding: '0 12px', height: 36,
            background: T.bgMuted, borderRadius: 18,
            fontSize: 12, fontWeight: 600, color: T.textSec,
            gap: 4, whiteSpace: 'nowrap', flexShrink: 0,
          }}>
            <svg width="12" height="12" viewBox="0 0 12 12"><path d="M3 4l3-3 3 3M3 8l3 3 3-3" stroke={T.textSec} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/></svg>
            {sort === 'date' ? '날짜순' : '금액순'}
          </button>
        }
      />

      {/* totals + month picker */}
      <div style={{
        padding: '8px 20px 12px',
        background: T.bg,
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: 6,
        }}>
          <button onClick={() => setMonthSheetOpen(true)} style={{
            border: 0, background: 'transparent', padding: 0, cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 4,
            fontSize: 14, fontWeight: 600, color: T.textSec, letterSpacing: '-0.01em',
          }}>
            {monthLabel(month)}
            <svg width="14" height="14" viewBox="0 0 14 14"><path d="M4 5l3 3 3-3" stroke={T.textSec} strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
          <div style={{ fontSize: 12, color: T.textTer, fontVariantNumeric: 'tabular-nums' }}>
            {count}건
          </div>
        </div>
        <MoneyText value={total} size={28} weight={800} />

        {catData && (
          <div style={{ marginTop: 14 }}>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              fontSize: 12, fontWeight: 500, color: T.textSec, marginBottom: 6,
            }}>
              <span><span style={{ color: catData.color, fontWeight: 700 }}>{catData.name}</span> 예산 사용률</span>
              <span style={{
                color: catPct > 100 ? T.danger : T.text, fontWeight: 700,
                fontVariantNumeric: 'tabular-nums',
              }}>
                {catPct.toFixed(0)}% / {catBudget.toLocaleString()}
              </span>
            </div>
            <ProgressBar value={catPct} height={6} fillColor={catData.color} />
          </div>
        )}
      </div>

      {/* chips */}
      <div style={{
        padding: '4px 16px 12px', display: 'flex', gap: 6,
        overflowX: 'auto', whiteSpace: 'nowrap',
        borderBottom: `1px solid ${T.divider}`,
      }}>
        {chips.map(c => (
          <button key={c.id} onClick={() => setFilterCat(c.id)} style={{
            border: 0, padding: '8px 14px', borderRadius: 999,
            background: filterCat === c.id ? T.text : T.bgMuted,
            color: filterCat === c.id ? '#fff' : T.textSec,
            fontFamily: 'Pretendard, system-ui, sans-serif',
            fontSize: 13, fontWeight: 600, letterSpacing: '-0.01em',
            cursor: 'pointer', flexShrink: 0,
            display: 'inline-flex', alignItems: 'center', gap: 5,
          }}>
            {c.id !== 'all' && (
              <span style={{
                width: 6, height: 6, borderRadius: 3, background: c.color,
                opacity: filterCat === c.id ? 0.9 : 0.7,
              }} />
            )}
            {c.name}
          </button>
        ))}
      </div>

      <ScreenBody>
        {grouped.map((g, gi) => (
          <div key={g.date || gi} style={{ marginTop: 4 }}>
            {/* Faint divider between day groups — sits inset by the same 20px
                gutter as the rows so it visually separates without cutting
                across the entire viewport. Skipped before the first group. */}
            {gi > 0 && g.date && (
              <div style={{
                height: 1, background: T.divider,
                margin: '6px 20px 0',
              }} />
            )}
            {g.date && (
              <div style={{
                padding: '14px 20px 6px',
                display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
              }}>
                <div style={{
                  fontSize: 12, fontWeight: 700, color: T.textTer,
                  letterSpacing: '-0.01em',
                }}>{window.formatDate(g.date)}</div>
                <div style={{
                  fontSize: 12, fontWeight: 600, color: T.textTer,
                  fontVariantNumeric: 'tabular-nums',
                }}>
                  {window.formatWon(g.items.reduce((a, e) => a + e.amount, 0))}
                </div>
              </div>
            )}
            <div>
              {g.items.map((e) => (
                <ExpenseRow key={e.id} e={e} />
              ))}
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div style={{
            padding: '64px 20px', textAlign: 'center',
            color: T.textTer, fontSize: 14, fontWeight: 500,
          }}>
            {monthLabel(month)}에는<br/>아직 거래가 없어요
          </div>
        )}
      </ScreenBody>

      {monthSheetOpen && (
        <MonthPickerSheet
          current={month}
          onPick={(m) => { setMonth(m); setMonthSheetOpen(false); }}
          onClose={() => setMonthSheetOpen(false)}
          expenses={expenses}
        />
      )}
    </Screen>
  );
}

function ExpenseRow({ e }) {
  const cat = window.CATEGORY_BY_ID[e.cat];
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '12px 20px', cursor: 'pointer',
    }}>
      <CatIcon cat={cat} size={36} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 15, fontWeight: 600, color: T.text,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          letterSpacing: '-0.01em',
        }}>{e.merchant}</div>
        <div style={{
          fontSize: 12, color: T.textTer, marginTop: 2,
          display: 'flex', alignItems: 'center', gap: 4,
        }}>
          <span style={{ color: cat.color, fontWeight: 500 }}>{cat.name}</span>
          <span>·</span>
          <span>{e.sub}</span>
          <span>·</span>
          <span>{e.src}</span>
        </div>
      </div>
      <div style={{
        fontSize: 15, fontWeight: 700, color: T.text,
        fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em',
        flexShrink: 0,
      }}>−{window.formatWon(e.amount).replace('₩','₩ ')}</div>
    </div>
  );
}

const iconBtnStyle = {
  width: 40, height: 40, border: 0, background: 'transparent',
  borderRadius: 20, cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
};

// ── MonthPickerSheet ────────────────────────────────────────────────────────
// Bottom sheet listing the last 12 months. Each row shows the month label and
// a small total/count badge sourced from `expenses` so the user can see at a
// glance which months actually have data. Tapping a row selects that month
// and closes the sheet.
function MonthPickerSheet({ current, onPick, onClose, expenses }) {
  // "Today" for the demo is May 2026 — we always seed the list from there so
  // the user sees a stable 12-month window in screenshots / handoffs.
  const baseY = 2026, baseM = 5;
  const months = [];
  for (let i = 0; i < 12; i++) {
    const idx = baseY * 12 + (baseM - 1) - i;
    const y = Math.floor(idx / 12);
    const m = (idx % 12) + 1;
    const id = `${y}-${String(m).padStart(2, '0')}`;
    const monthExp = expenses.filter(e => e.date.startsWith(id));
    months.push({
      id, y, m,
      total: monthExp.reduce((a, e) => a + e.amount, 0),
      count: monthExp.length,
    });
  }
  return (
    <BottomSheet open onClose={onClose} title="월 선택" height="70%">
      <div style={{ padding: '0 8px 16px' }}>
        {months.map((mo) => {
          const isCurrent = mo.id === current;
          const isToday = mo.id === '2026-05';
          return (
            <button key={mo.id} onClick={() => onPick(mo.id)} style={{
              width: '100%', border: 0, background: isCurrent ? T.accentSoft : 'transparent',
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '14px 16px', margin: '2px 0', borderRadius: 12,
              cursor: 'pointer', textAlign: 'left',
            }}>
              <div style={{
                width: 40, height: 40, borderRadius: 10,
                background: isCurrent ? T.accent : T.bgMuted,
                color: isCurrent ? '#fff' : T.textSec,
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                justifyContent: 'center', flexShrink: 0,
                fontFamily: 'Pretendard, system-ui, sans-serif',
              }}>
                <span style={{ fontSize: 10, fontWeight: 600, opacity: 0.85, lineHeight: 1 }}>
                  {mo.y}
                </span>
                <span style={{ fontSize: 15, fontWeight: 800, lineHeight: 1.2 }}>
                  {mo.m}월
                </span>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: 15, fontWeight: 700, letterSpacing: '-0.01em',
                  color: isCurrent ? T.accent : T.text,
                  display: 'flex', alignItems: 'center', gap: 6,
                }}>
                  {mo.y}년 {mo.m}월
                  {isToday && (
                    <span style={{
                      fontSize: 10, fontWeight: 700, padding: '2px 6px',
                      borderRadius: 999, background: T.bgMuted, color: T.textSec,
                    }}>이번 달</span>
                  )}
                </div>
                <div style={{
                  fontSize: 12, color: T.textTer, marginTop: 2,
                  fontVariantNumeric: 'tabular-nums',
                }}>
                  {mo.count > 0
                    ? `${mo.count}건 · ${window.formatWon(mo.total)}`
                    : '거래 없음'}
                </div>
              </div>
              {isCurrent && (
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none" style={{ flexShrink: 0 }}>
                  <path d="M4 9l3 3 7-7" stroke={T.accent} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              )}
            </button>
          );
        })}
      </div>
    </BottomSheet>
  );
}

Object.assign(window, { HistoryScreen });
