// screen-home.jsx — 홈 대시보드
// Top: month budget / used / remaining + add button
// Bottom: per-category usage list, sorted desc by amount

function HomeScreen({ navigate, expenses, budget, palette }) {
  const usedTotal = window.totalUsed(expenses);
  const budgetTotal = Object.entries(budget)
    .filter(([k]) => k !== 'finance')
    .reduce((a, [, v]) => a + v, 0);
  const remaining = budgetTotal - usedTotal;
  const pct = budgetTotal > 0 ? (usedTotal / budgetTotal) * 100 : 0;
  const over = remaining < 0;

  // per-category aggregation, sorted by used desc
  const usage = window.usageByCategory(expenses);
  const rows = window.CATEGORIES
    .filter(c => c.id !== 'finance')
    .map(c => {
      const used = usage[c.id] || 0;
      const cap = budget[c.id] || 0;
      const p = cap > 0 ? (used / cap) * 100 : 0;
      return { cat: c, used, cap, pct: p, over: used > cap };
    })
    .sort((a, b) => b.used - a.used);

  // today — for "days left" footer
  const now = new Date(2026, 4, 14); // May 14, 2026 (locked demo "today")
  const daysInMonth = 31;
  const daysLeft = daysInMonth - now.getDate();

  return (
    <Screen>
      {/* slim header: month label + bell
          paddingTop clears the iPhone status bar + Dynamic Island. */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '60px 20px 8px', position: 'sticky', top: 0, background: T.bg, zIndex: 5,
      }}>
        <button onClick={() => navigate('month-picker')} style={{
          border: 0, background: 'transparent', padding: 0, cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          <span style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em' }}>2026년 5월</span>
          <svg width="18" height="18" viewBox="0 0 18 18"><path d="M5 7l4 4 4-4" stroke={T.textSec} strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </button>
        <div style={{ display: 'flex', gap: 4 }}>
          <button aria-label="알림" style={iconBtn}>
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
              <path d="M11 3a5 5 0 00-5 5v3l-1.5 2.5h13L16 11V8a5 5 0 00-5-5zM9 17a2 2 0 004 0" stroke={T.text} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>
      </div>

      <ScreenBody>
        {/* ── Hero card: this month summary ───────────────────────
            Combines used / budget / remaining into one block; the secondary
            stat tiles and pace nudge were removed to keep the focus tight. */}
        <div style={{ padding: '4px 20px 20px' }}>
          <div style={{
            background: T.bg, border: `1px solid ${T.divider}`,
            borderRadius: 20, padding: 24,
            boxShadow: '0 2px 8px rgba(10,13,20,0.04)',
          }}>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              marginBottom: 12,
            }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: T.textSec, letterSpacing: '-0.01em' }}>
                이번 달 사용 금액
              </span>
              <button onClick={() => navigate('add')} aria-label="지출 추가" style={{
                width: 36, height: 36, borderRadius: 18,
                border: 0, background: T.accentSoft, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <svg width="16" height="16" viewBox="0 0 16 16">
                  <path d="M8 3v10M3 8h10" stroke={T.accent} strokeWidth="2.2" strokeLinecap="round"/>
                </svg>
              </button>
            </div>

            {/* big number */}
            <div style={{ marginBottom: 6 }}>
              <MoneyText value={usedTotal} size={34} weight={800} />
            </div>

            {/* remaining-budget line — woven in directly below the spending number */}
            <div style={{
              display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 18,
              fontSize: 13, fontWeight: 500, letterSpacing: '-0.01em',
            }}>
              {over ? (
                <>
                  <span style={{ color: T.danger, fontWeight: 700 }}>
                    예산 {window.formatWon(-remaining)} 초과
                  </span>
                  <span style={{ color: T.textTer }}>
                    · 예산 {window.formatWon(budgetTotal)}
                  </span>
                </>
              ) : (
                <>
                  <span style={{ color: T.textSec }}>
                    잔여 금액 <span style={{ color: T.text, fontWeight: 700 }}>{window.formatWon(remaining)}</span>
                  </span>
                  <span style={{ color: T.textTer }}>
                    / 예산 {window.formatWon(budgetTotal)}
                  </span>
                </>
              )}
            </div>

            {/* big progress bar */}
            <div style={{ marginBottom: 12 }}>
              <ProgressBar value={pct} height={10} />
            </div>

            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              fontSize: 13, fontWeight: 500,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ color: T.textSec }}>사용률</span>
                <span style={{
                  color: over ? T.danger : T.text,
                  fontWeight: 700, fontVariantNumeric: 'tabular-nums',
                }}>{pct.toFixed(0)}%</span>
                {over && <Badge tone="danger">예산 초과</Badge>}
              </div>
              <div style={{ color: T.textTer }}>
                {daysLeft}일 남음
              </div>
            </div>
          </div>
        </div>

        {/* ── Category breakdown ───────────────────────────────── */}
        <div style={{ padding: '8px 20px 16px' }}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            marginBottom: 12,
          }}>
            <div style={{ fontSize: 17, fontWeight: 700, letterSpacing: '-0.02em' }}>
              카테고리
            </div>
            <button onClick={() => navigate('budget')} style={{
              border: 0, background: 'transparent', cursor: 'pointer',
              color: T.textTer, fontSize: 13, fontWeight: 500, padding: 0,
            }}>예산 설정 →</button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {rows.map(r => (
              <CategoryRow key={r.cat.id} row={r} palette={palette}
                           onClick={() => navigate('history', { cat: r.cat.id })} />
            ))}
          </div>
        </div>

        {/* recent activity sliver — bottom */}
        <div style={{ padding: '8px 20px 16px' }}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            marginBottom: 12,
          }}>
            <div style={{ fontSize: 17, fontWeight: 700, letterSpacing: '-0.02em' }}>
              최근 소비 내역
            </div>
            <button onClick={() => navigate('history')} style={{
              border: 0, background: 'transparent', cursor: 'pointer',
              color: T.textTer, fontSize: 13, fontWeight: 500, padding: 0,
            }}>전체 보기 →</button>
          </div>
          <div style={{
            background: T.bg, border: `1px solid ${T.divider}`, borderRadius: 16,
            overflow: 'hidden',
          }}>
            {[...expenses].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 4).map((e, i, arr) => (
              <div key={e.id} style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px',
                borderBottom: i < arr.length - 1 ? `1px solid ${T.divider}` : 'none',
              }}>
                <CatIcon cat={e.cat} size={36} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: 14, fontWeight: 600, color: T.text,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>{e.merchant}</div>
                  <div style={{ fontSize: 12, color: T.textTer, marginTop: 2 }}>
                    {window.formatDateShort(e.date)} · {e.sub}
                  </div>
                </div>
                <div style={{
                  fontSize: 15, fontWeight: 700, color: T.text,
                  fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em',
                }}>−{window.formatWon(e.amount).replace('₩','₩ ')}</div>
              </div>
            ))}
          </div>
        </div>
      </ScreenBody>
    </Screen>
  );
}

// One category row — colored bar + numbers
function CategoryRow({ row, palette, onClick }) {
  const { cat, used, cap, pct, over } = row;
  // Use the category's own color when palette === 'category';
  // otherwise everyone shares the accent (cleaner, more Toss-like)
  const useCatColor = palette === 'category';
  const fill = useCatColor ? cat.color : T.accent;
  const overFill = T.danger;
  return (
    <button onClick={onClick} style={{
      width: '100%', border: 0, background: 'transparent', padding: '10px 4px',
      cursor: 'pointer', textAlign: 'left',
      borderRadius: 12,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
        <CatIcon cat={cat} size={36} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
            gap: 8,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
              <span style={{ fontSize: 15, fontWeight: 600, letterSpacing: '-0.01em' }}>{cat.name}</span>
              {over && <Badge tone="danger">초과</Badge>}
            </div>
            <div style={{
              fontSize: 15, fontWeight: 700, color: T.text,
              fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em',
              flexShrink: 0,
            }}>
              {window.formatWon(used)}
            </div>
          </div>
          <div style={{
            display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
            marginTop: 2, fontSize: 12, color: T.textTer,
          }}>
            <span style={{
              color: over ? T.danger : T.textTer, fontWeight: over ? 600 : 500,
              fontVariantNumeric: 'tabular-nums',
            }}>{pct.toFixed(0)}%</span>
            <span style={{ fontVariantNumeric: 'tabular-nums' }}>
              예산 {cap >= 10000 ? (cap/10000).toFixed(0) + '만원' : window.formatWon(cap)}
            </span>
          </div>
        </div>
      </div>
      <div style={{ paddingLeft: 48 }}>
        <ProgressBar value={pct} height={6} fillColor={fill} overColor={overFill} />
      </div>
    </button>
  );
}

const iconBtn = {
  width: 40, height: 40, border: 0, background: 'transparent',
  borderRadius: 20, cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
};

Object.assign(window, { HomeScreen });
