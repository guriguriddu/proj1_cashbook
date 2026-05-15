// screen-budget.jsx — 예산 설정 화면
// Period tabs (연/반기/분기/월) + stepper to walk through specific periods
// (e.g. previous/next month) + category-level monthly budgets.

// Resolve a period (type + offset from "current") to a display label.
// "current" is locked to May 2026 for the demo. Offsets navigate by the period's
// own unit — months for 'month', quarters for 'quarter', halves for 'half',
// years for 'year' — so a single ◀/▶ stepper works for all four.
function periodInfo(type, offset) {
  const baseY = 2026, baseM = 5; // May 2026
  if (type === 'year') {
    const y = baseY + offset;
    return { title: `${y}년 예산`, sub: '연간 목표 지출', short: `${y}년` };
  }
  if (type === 'half') {
    const idx = baseY * 2 + 0 + offset; // base = 2026 H1
    const y = Math.floor(idx / 2);
    const h = ((idx % 2) + 2) % 2; // 0=상, 1=하
    return { title: `${y} ${h === 0 ? '상' : '하'}반기 예산`, sub: '6개월 목표 지출', short: `${y} ${h === 0 ? '상' : '하'}반기` };
  }
  if (type === 'quarter') {
    const idx = baseY * 4 + 1 + offset; // base = 2026 Q2
    const y = Math.floor(idx / 4);
    const q = (((idx % 4) + 4) % 4) + 1;
    return { title: `${y} ${q}분기 예산`, sub: '3개월 목표 지출', short: `${y} ${q}분기` };
  }
  // month
  const idx = baseY * 12 + (baseM - 1) + offset;
  const y = Math.floor(idx / 12);
  const m = (((idx % 12) + 12) % 12) + 1;
  return { title: `${y}년 ${m}월 예산`, sub: '월별 목표 지출', short: `${y}년 ${m}월` };
}

function BudgetScreen({ navigate, budget, setBudget }) {
  // top: period segmented control + which instance (offset from current)
  const [period, setPeriod] = React.useState('month');
  const [offset, setOffset] = React.useState(0);
  const [editing, setEditing] = React.useState(null); // category id currently in the edit sheet
  // editMode: the whole category list flips into "editable" appearance when on.
  // While off, rows are static — tapping one is a no-op. The "수정" header
  // button toggles this so the user opts in before the list becomes interactive.
  const [editMode, setEditMode] = React.useState(false);

  // Switching period type resets the stepper — otherwise "+2 months" turns
  // into "+2 years" silently when you tap 연간.
  const changePeriod = (next) => { setPeriod(next); setOffset(0); };

  // Goals keyed by `${type}:${offset}` so each specific period (e.g. 2026-04,
  // 2026-05, 2026-06) holds its own budget. Falls back to a sensible default
  // derived from the current monthly category budget.
  const monthlyTotal = Object.values(budget).reduce((a, v) => a + v, 0);
  const defaultGoal = (type) =>
    type === 'year' ? monthlyTotal * 12
    : type === 'half' ? monthlyTotal * 6
    : type === 'quarter' ? monthlyTotal * 3
    : monthlyTotal;
  const [goals, setGoals] = React.useState({});
  const goalKey = `${period}:${offset}`;
  const goal = goals[goalKey] ?? defaultGoal(period);
  const setGoal = (v) => setGoals({ ...goals, [goalKey]: v });

  // Mock usage rate by period type (demo only). Slight variation per offset so
  // stepping back/forward feels alive.
  const usedShares = { year: 0.18, half: 0.32, quarter: 0.55, month: 0.66 };
  const shareJitter = (offset * 0.07);
  const used = Math.max(0, Math.round(goal * Math.min(1.2, Math.max(0, usedShares[period] - shareJitter))));

  const periods = [
    { id: 'year',    label: '연간'   },
    { id: 'half',    label: '반기'   },
    { id: 'quarter', label: '분기'   },
    { id: 'month',   label: '월별'   },
  ];

  const info = periodInfo(period, offset);

  return (
    <Screen>
      <AppHeader title="목표 · 예산" onBack={() => navigate('home')} />

      {/* period selector */}
      <div style={{ padding: '8px 20px 12px' }}>
        <div style={{
          display: 'flex', gap: 6, padding: 4, background: T.bgMuted, borderRadius: 12,
        }}>
          {periods.map(p => (
            <button key={p.id} onClick={() => changePeriod(p.id)} style={{
              flex: 1, border: 0, padding: '8px 0', borderRadius: 8,
              background: period === p.id ? T.bg : 'transparent',
              fontFamily: 'Pretendard, system-ui, sans-serif',
              fontSize: 13, fontWeight: 600,
              color: period === p.id ? T.text : T.textTer,
              cursor: 'pointer', letterSpacing: '-0.01em',
              boxShadow: period === p.id ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
              transition: 'all .15s',
            }}>{p.label}</button>
          ))}
        </div>
      </div>

      {/* period stepper: ◀ [label · 오늘] ▶ */}
      <div style={{
        padding: '0 20px 12px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <StepBtn onClick={() => setOffset(offset - 1)} dir="prev" />
        <div style={{ textAlign: 'center', flex: 1 }}>
          <div style={{
            fontSize: 15, fontWeight: 700, color: T.text, letterSpacing: '-0.02em',
          }}>{info.short}</div>
          {offset !== 0 && (
            <button onClick={() => setOffset(0)} style={{
              border: 0, background: 'transparent', cursor: 'pointer',
              color: T.accent, fontSize: 11, fontWeight: 600, padding: '2px 0',
              letterSpacing: '-0.01em',
            }}>현재로 돌아가기</button>
          )}
          {offset === 0 && (
            <div style={{ fontSize: 11, color: T.textTer, fontWeight: 500, marginTop: 2 }}>
              현재
            </div>
          )}
        </div>
        <StepBtn onClick={() => setOffset(offset + 1)} dir="next" />
      </div>

      <ScreenBody>
        {/* Big goal card for selected period */}
        <PeriodGoalCard
          info={info}
          goal={goal}
          used={used}
          setGoal={setGoal}
        />

        {/* Category-level monthly budgets — only meaningful when looking at a
            specific month. Other periods just show the headline goal card. */}
        {period === 'month' && (
          <div style={{ padding: '8px 20px 16px' }}>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              marginBottom: 8,
            }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: T.textTer }}>
                {info.short.split(' ').slice(-1)[0]} 카테고리 예산
              </div>
              {/* Toggles edit mode for the entire category section. Reads
                  "수정" when off, "완료" when on. Active state uses the accent
                  pill so it's obvious the list below is now interactive. */}
              <button onClick={() => setEditMode(!editMode)} style={{
                border: 0, cursor: 'pointer',
                background: editMode ? T.accent : 'transparent',
                color: editMode ? '#fff' : T.accent,
                fontSize: 13, fontWeight: 700, letterSpacing: '-0.01em',
                padding: editMode ? '6px 12px' : '6px 0',
                borderRadius: 999,
                transition: 'all .15s',
              }}>{editMode ? '완료' : '수정'}</button>
            </div>
            <div style={{
              background: T.bg,
              border: `1px solid ${editMode ? T.accent + '55' : T.divider}`,
              borderRadius: 14, overflow: 'hidden',
              transition: 'border-color .15s',
            }}>
              {window.CATEGORIES.map((c, i) => (
                <button
                  key={c.id}
                  onClick={() => { if (editMode) setEditing(c.id); }}
                  disabled={!editMode}
                  style={{
                    width: '100%', border: 0,
                    background: editMode ? T.accentSoft + '40' : 'transparent',
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '12px 14px',
                    cursor: editMode ? 'pointer' : 'default',
                    textAlign: 'left',
                    borderBottom: i < window.CATEGORIES.length - 1
                      ? `1px solid ${editMode ? T.accent + '22' : T.divider}` : 'none',
                    transition: 'background .15s, border-color .15s',
                  }}
                >
                  <CatIcon cat={c} size={36} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 15, fontWeight: 600, letterSpacing: '-0.01em' }}>
                      {c.name}
                    </div>
                    <div style={{ fontSize: 11, color: T.textTer, marginTop: 1 }}>
                      {c.sub.slice(0, 3).join(' · ')}{c.sub.length > 3 ? ` 외 ${c.sub.length - 3}` : ''}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', marginRight: editMode ? 4 : 0 }}>
                    <div style={{
                      fontSize: 15, fontWeight: 700,
                      color: T.textSec,
                      fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em',
                    }}>{(budget[c.id]/10000).toFixed(0)}만원</div>
                  </div>
                  {/* In edit mode, hint with a small pencil icon (replaces the
                      old "수정" pill that was always on). When not editing the
                      row is purely informational. */}
                  {editMode && (
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0 }}>
                      <path d="M9.5 1.5l3 3-8 8H1.5v-3l8-8z" stroke={T.accent} strokeWidth="1.6" strokeLinejoin="round"/>
                    </svg>
                  )}
                </button>
              ))}
            </div>

            {/* Helper text — only shows in edit mode so users see why the list
                lit up. */}
            {editMode && (
              <div style={{
                marginTop: 10, fontSize: 12, color: T.textTer,
                lineHeight: 1.5, padding: '0 4px',
              }}>
                수정할 카테고리를 탭하세요.
              </div>
            )}
          </div>
        )}

        <div style={{ padding: '0 20px 8px' }}>
          <SecondaryButton onClick={() => navigate('home')}>저장</SecondaryButton>
        </div>
      </ScreenBody>

      {editing && (
        <CategoryBudgetSheet
          cat={window.CATEGORY_BY_ID[editing]}
          value={budget[editing]}
          onClose={() => setEditing(null)}
          onSave={(v) => { setBudget({ ...budget, [editing]: v }); setEditing(null); }}
        />
      )}
    </Screen>
  );
}

// ◀ / ▶ stepper buttons
function StepBtn({ onClick, dir }) {
  return (
    <button onClick={onClick} aria-label={dir === 'prev' ? '이전' : '다음'} style={{
      width: 36, height: 36, borderRadius: 18, border: 0, cursor: 'pointer',
      background: T.bgSoft,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <svg width="10" height="14" viewBox="0 0 10 14" fill="none"
           style={dir === 'next' ? null : { transform: 'rotate(180deg)' }}>
        <path d="M2 1l6 6-6 6" stroke={T.text} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    </button>
  );
}

// Hero card for the active period
function PeriodGoalCard({ info, goal, used, setGoal }) {
  const pct = (used / goal) * 100;
  const remaining = goal - used;

  return (
    <div style={{ padding: '0 20px 16px' }}>
      <div style={{
        background: T.text, color: '#fff', borderRadius: 20, padding: 22,
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: 10,
        }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, opacity: 0.7, marginBottom: 2 }}>
              {info.sub}
            </div>
            <div style={{ fontSize: 17, fontWeight: 700, letterSpacing: '-0.02em' }}>
              {info.title}
            </div>
          </div>
          <div style={{
            padding: '6px 10px', borderRadius: 999,
            background: 'rgba(255,255,255,0.12)',
            fontSize: 11, fontWeight: 600,
          }}>편집</div>
        </div>
        <div style={{
          display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 18,
        }}>
          <MoneyText value={goal} size={32} weight={800} color="#fff" />
        </div>
        <div style={{
          height: 8, background: 'rgba(255,255,255,0.16)', borderRadius: 4,
          overflow: 'hidden', marginBottom: 10,
        }}>
          <div style={{
            height: '100%', width: Math.min(100, pct) + '%',
            background: pct > 100 ? '#FCA5A5' : '#86EFAC',
            borderRadius: 4,
          }} />
        </div>
        <div style={{
          display: 'flex', justifyContent: 'space-between',
          fontSize: 13, fontWeight: 700, fontVariantNumeric: 'tabular-nums',
          letterSpacing: '-0.01em',
        }}>
          <div>
            {window.formatWonShort(used)} · {pct.toFixed(0)}%
          </div>
          <div>
            {window.formatWonShort(remaining)}
          </div>
        </div>
      </div>
    </div>
  );
}

// Bottom sheet to edit a single category's monthly budget.
function CategoryBudgetSheet({ cat, value, onClose, onSave }) {
  const [v, setV] = React.useState(value);
  const presets = [10, 20, 30, 50, 100];
  const adjust = (delta) => setV(Math.max(0, v + delta));

  // Comma-formatted display for the editable input. We swap the native
  // <input type="number"> (which never shows thousand separators) for a
  // text input that mirrors the formatted string and strips non-digits on
  // input. Font size dropped from 38 → 30 so large values like 1,234,567
  // don't get clipped inside the bottom sheet's content padding.
  const formatted = v.toLocaleString('ko-KR');
  const onInputChange = (e) => {
    const digits = e.target.value.replace(/[^\d]/g, '');
    setV(Math.max(0, Math.floor(Number(digits) || 0)));
  };

  return (
    <BottomSheet open onClose={onClose} title={`${cat.name} 월 예산`} height="55%">
      <div style={{ padding: '0 20px 24px' }}>
        <div style={{
          padding: '20px 0', textAlign: 'center',
          borderBottom: `1px solid ${T.divider}`,
        }}>
          <div style={{
            display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: 4,
            fontVariantNumeric: 'tabular-nums',
            maxWidth: '100%',
          }}>
            <span style={{ fontSize: 20, fontWeight: 700, color: T.textSec, flexShrink: 0 }}>₩</span>
            <input
              type="text" inputMode="numeric" value={formatted}
              onChange={onInputChange}
              style={{
                border: 0, background: 'transparent', textAlign: 'center',
                fontFamily: 'Pretendard, system-ui, sans-serif',
                fontSize: 30, fontWeight: 800, color: T.text,
                letterSpacing: '-0.02em',
                // formatted string is 1-13 chars max ("₩1,234,567,890"); each
                // glyph at 30px tabular-nums is ~18px so a 13-char number fits
                // in ~234px — still leaves margin inside the 360-ish sheet.
                width: `${formatted.length}ch`,
                minWidth: 80, maxWidth: 240,
                outline: 'none', padding: 0,
              }}
            />
            <span style={{ fontSize: 18, fontWeight: 700, color: T.textSec, flexShrink: 0 }}>원</span>
          </div>
          <div style={{
            marginTop: 6, fontSize: 13, color: T.textTer, fontWeight: 500,
          }}>
            {v >= 10000 ? Math.floor(v / 10000) + '만원' : v.toLocaleString() + '원'} / 월
          </div>
        </div>

        <div style={{
          display: 'flex', gap: 8, padding: '20px 0 8px',
          justifyContent: 'space-between',
        }}>
          {[-50000, -10000, +10000, +50000].map(d => (
            <button key={d} onClick={() => adjust(d)} style={{
              flex: 1, padding: '10px 0', border: 0, borderRadius: 10,
              background: T.bgMuted, color: T.text,
              fontFamily: 'Pretendard, system-ui, sans-serif',
              fontSize: 13, fontWeight: 600, cursor: 'pointer',
              fontVariantNumeric: 'tabular-nums',
            }}>{d > 0 ? '+' : '−'}{(Math.abs(d) / 10000)}만</button>
          ))}
        </div>

        <div style={{
          fontSize: 11, fontWeight: 700, color: T.textTer,
          margin: '20px 0 8px', textTransform: 'uppercase', letterSpacing: '0.06em',
        }}>빠른 설정</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {presets.map(p => (
            <button key={p} onClick={() => setV(p * 10000)} style={{
              border: 0, padding: '8px 14px', borderRadius: 999,
              background: v === p * 10000 ? cat.color + '18' : T.bgSoft,
              color: v === p * 10000 ? cat.color : T.text,
              fontFamily: 'Pretendard, system-ui, sans-serif',
              fontSize: 13, fontWeight: 600, cursor: 'pointer',
            }}>{p}만원</button>
          ))}
        </div>

        <div style={{ marginTop: 24 }}>
          <PrimaryButton onClick={() => onSave(v)}>저장</PrimaryButton>
        </div>
      </div>
    </BottomSheet>
  );
}

Object.assign(window, { BudgetScreen });
