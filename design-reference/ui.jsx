// ui.jsx — shared UI primitives for the budget app
// Pretendard-based, Toss-style flat finance UI.

const T = {
  bg:        '#FFFFFF',
  bgSoft:    '#F7F8FA',
  bgMuted:   '#F2F4F6',
  divider:   '#EEF0F3',
  text:      '#0A0D14',
  textSec:   '#4E5968',
  textTer:   '#8B95A1',
  textMuted: '#B0B8C1',
  accent:    '#1F8A5B',
  accentSoft:'#E6F4ED',
  warn:      '#F59E0B',
  warnSoft:  '#FEF3C7',
  danger:    '#EF4444',
  dangerSoft:'#FEE2E2',
  blue:      '#3B82F6',
};
window.T = T;

// ── App-level chrome ────────────────────────────────────────────────────────

// Screen wraps a full mobile-app screen: header + scrollable body.
// White background, fills the device frame.
function Screen({ children, style }) {
  return (
    <div style={{
      width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
      background: T.bg, color: T.text, position: 'relative',
      ...style,
    }}>
      {children}
    </div>
  );
}

// AppHeader — slim header bar with optional back button and title.
// onBack: callback (shows chevron). rightSlot: optional ReactNode.
function AppHeader({ title, onBack, rightSlot, sticky = true, transparent = false }) {
  // 50px top inset clears the iPhone status bar + Dynamic Island that
  // IOSDevice overlays at the very top of the frame.
  return (
    <div style={{
      position: sticky ? 'sticky' : 'relative', top: 0, zIndex: 10,
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      height: 52, padding: '50px 8px 0',
      background: transparent ? 'transparent' : T.bg,
      borderBottom: transparent ? '0' : `1px solid ${T.divider}`,
      boxSizing: 'content-box',
    }}>
      <div style={{ width: 44, display: 'flex', alignItems: 'center', justifyContent: 'flex-start' }}>
        {onBack && (
          <button onClick={onBack} aria-label="뒤로가기" style={{
            width: 44, height: 44, border: 0, background: 'transparent',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', padding: 0,
          }}>
            <svg width="11" height="20" viewBox="0 0 11 20" fill="none">
              <path d="M9.5 1.5L1.5 10l8 8.5" stroke={T.text} strokeWidth="1.8"
                    strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        )}
      </div>
      <div style={{
        flex: 1, textAlign: 'center', fontSize: 17, fontWeight: 600,
        color: T.text, letterSpacing: '-0.01em',
      }}>{title}</div>
      <div style={{ minWidth: 44, width: 'auto', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingRight: 8 }}>
        {rightSlot}
      </div>
    </div>
  );
}

// ScreenBody — scrollable area below header, above bottom tab bar.
// Adds bottom padding so content doesn't hide under the tab bar.
function ScreenBody({ children, padBottom = 96, style }) {
  return (
    <div style={{
      flex: 1, overflowY: 'auto', overflowX: 'hidden',
      WebkitOverflowScrolling: 'touch',
      paddingBottom: padBottom,
      ...style,
    }}>
      {children}
    </div>
  );
}

// ── Buttons ─────────────────────────────────────────────────────────────────

function PrimaryButton({ children, onClick, disabled, full = true, style }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      width: full ? '100%' : 'auto',
      height: 56, padding: '0 24px',
      border: 0, borderRadius: 14,
      background: disabled ? T.bgMuted : T.accent,
      color: disabled ? T.textTer : '#fff',
      fontFamily: 'Pretendard, system-ui, sans-serif',
      fontSize: 17, fontWeight: 600, letterSpacing: '-0.01em',
      cursor: disabled ? 'default' : 'pointer',
      transition: 'background .15s',
      ...style,
    }}>{children}</button>
  );
}

function SecondaryButton({ children, onClick, full = true, style }) {
  return (
    <button onClick={onClick} style={{
      width: full ? '100%' : 'auto',
      height: 56, padding: '0 24px',
      border: 0, borderRadius: 14,
      background: T.bgMuted, color: T.text,
      fontFamily: 'Pretendard, system-ui, sans-serif',
      fontSize: 17, fontWeight: 600, letterSpacing: '-0.01em',
      cursor: 'pointer',
      ...style,
    }}>{children}</button>
  );
}

function TextButton({ children, onClick, color = T.accent, style }) {
  return (
    <button onClick={onClick} style={{
      border: 0, background: 'transparent', color, padding: '8px 12px',
      fontFamily: 'Pretendard, system-ui, sans-serif',
      fontSize: 15, fontWeight: 600, letterSpacing: '-0.01em',
      cursor: 'pointer',
      ...style,
    }}>{children}</button>
  );
}

// ── Progress + badges ───────────────────────────────────────────────────────

// ProgressBar — horizontal bar. When value > 100, switches to overColor
// (red by default) even if a custom fillColor is provided — so category bars
// flip red on overspend regardless of palette.
function ProgressBar({ value, height = 8, trackColor, fillColor, overColor = T.danger, borderRadius }) {
  const pct = Math.max(0, value);
  const over = pct > 100;
  const fill = over ? overColor : (fillColor || T.accent);
  const track = trackColor || T.bgMuted;
  const r = borderRadius ?? height / 2;
  return (
    <div style={{
      width: '100%', height, background: track, borderRadius: r,
      overflow: 'hidden', position: 'relative',
    }}>
      <div style={{
        height: '100%', width: Math.min(100, pct) + '%',
        background: fill, borderRadius: r,
        transition: 'width .35s cubic-bezier(.2,.7,.3,1), background .2s',
      }} />
    </div>
  );
}

// Pill / badge
function Badge({ children, tone = 'neutral', size = 'sm', style }) {
  const tones = {
    neutral: { bg: T.bgMuted, fg: T.textSec },
    accent:  { bg: T.accentSoft, fg: T.accent },
    warn:    { bg: T.warnSoft, fg: '#B45309' },
    danger:  { bg: T.dangerSoft, fg: T.danger },
    blue:    { bg: '#E0EDFF', fg: T.blue },
  };
  const t = tones[tone] || tones.neutral;
  const sizes = {
    sm: { fontSize: 11, padding: '3px 8px', radius: 6 },
    md: { fontSize: 12, padding: '4px 10px', radius: 7 },
    lg: { fontSize: 13, padding: '6px 12px', radius: 8 },
  };
  const s = sizes[size] || sizes.sm;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      background: t.bg, color: t.fg,
      fontSize: s.fontSize, fontWeight: 600,
      padding: s.padding, borderRadius: s.radius, letterSpacing: '-0.01em',
      whiteSpace: 'nowrap',
      ...style,
    }}>{children}</span>
  );
}

// ── Category icon — colored rounded square with emoji/glyph ────────────────

function CatIcon({ cat, size = 40, style }) {
  // accept either a category id or the category object
  const c = typeof cat === 'string' ? window.CATEGORY_BY_ID[cat] : cat;
  if (!c) return null;
  return (
    <div style={{
      width: size, height: size, borderRadius: size * 0.3,
      background: c.color + '18', color: c.color,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.5, flexShrink: 0,
      ...style,
    }}>
      <span style={{ filter: 'grayscale(0)' }}>{c.emoji}</span>
    </div>
  );
}

// ── Card ────────────────────────────────────────────────────────────────────

function Card({ children, padding = 20, style, onClick }) {
  return (
    <div onClick={onClick} style={{
      background: T.bg, border: `1px solid ${T.divider}`, borderRadius: 16,
      padding, cursor: onClick ? 'pointer' : 'default',
      ...style,
    }}>{children}</div>
  );
}

// ── Number display — large, tabular ─────────────────────────────────────────
function MoneyText({ value, size = 32, weight = 700, color = T.text, prefix = '₩', style }) {
  const s = Math.abs(Math.round(value)).toLocaleString('ko-KR');
  return (
    <span style={{
      fontFamily: 'Pretendard, system-ui, sans-serif',
      fontSize: size, fontWeight: weight, color,
      letterSpacing: '-0.025em',
      fontVariantNumeric: 'tabular-nums',
      ...style,
    }}>
      <span style={{ fontSize: size * 0.72, marginRight: 2, fontWeight: weight - 100 }}>{prefix}</span>
      {(value < 0 ? '-' : '') + s}
    </span>
  );
}

// ── BottomTabBar ────────────────────────────────────────────────────────────
// Uniform 4-tab layout — every tab has the same icon size + label style and
// only the active tab is highlighted. Earlier revision floated the center
// "입력" tab as an accent FAB; that emphasis was removed per user feedback so
// the bar reads as a flat row.
function BottomTabBar({ active, onNavigate }) {
  const tabs = [
    { id: 'home',    label: '홈',    icon: 'home' },
    { id: 'history', label: '내역',  icon: 'list' },
    { id: 'add',     label: '입력',  icon: 'plus' },
    { id: 'budget',  label: '예산',  icon: 'target' },
  ];
  return (
    <div style={{
      position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 30,
      height: 84,
      background: 'rgba(255,255,255,0.96)',
      backdropFilter: 'blur(20px) saturate(180%)',
      WebkitBackdropFilter: 'blur(20px) saturate(180%)',
      borderTop: `1px solid ${T.divider}`,
      display: 'flex', alignItems: 'flex-start',
      paddingTop: 10, paddingBottom: 24,
    }}>
      {tabs.map(t => {
        const isActive = active === t.id;
        return (
          <button key={t.id} onClick={() => onNavigate(t.id)} style={{
            flex: 1, height: 50, border: 0, background: 'transparent',
            padding: 0, cursor: 'pointer',
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'flex-start', gap: 4,
          }}>
            <TabIcon icon={t.icon} active={isActive} />
            <div style={{
              fontSize: 11, fontWeight: isActive ? 700 : 500,
              color: isActive ? T.text : T.textTer,
              letterSpacing: '-0.01em',
            }}>{t.label}</div>
          </button>
        );
      })}
    </div>
  );
}

function TabIcon({ icon, active }) {
  const c = active ? T.text : T.textTer;
  const w = active ? 2.2 : 1.8;
  if (icon === 'home') return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <path d="M3.5 10.5L12 4l8.5 6.5V20a1 1 0 01-1 1h-4v-6h-7v6h-4a1 1 0 01-1-1v-9.5z"
            stroke={c} strokeWidth={w} strokeLinejoin="round"/>
    </svg>
  );
  if (icon === 'list') return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <path d="M4 7h16M4 12h16M4 17h10" stroke={c} strokeWidth={w} strokeLinecap="round"/>
    </svg>
  );
  if (icon === 'plus') return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="9" stroke={c} strokeWidth={w}/>
      <path d="M12 8v8M8 12h8" stroke={c} strokeWidth={w} strokeLinecap="round"/>
    </svg>
  );
  if (icon === 'target') return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="8.5" stroke={c} strokeWidth={w}/>
      <circle cx="12" cy="12" r="4" stroke={c} strokeWidth={w}/>
      <circle cx="12" cy="12" r="1.2" fill={c}/>
    </svg>
  );
  return null;
}

// ── Bottom sheet ────────────────────────────────────────────────────────────
function BottomSheet({ open, onClose, children, title, height }) {
  if (!open) return null;
  return (
    <>
      <div onClick={onClose} style={{
        position: 'absolute', inset: 0, background: 'rgba(10,13,20,0.45)',
        zIndex: 100, animation: 'fadeIn .2s ease',
      }} />
      <div style={{
        position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 101,
        background: T.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24,
        maxHeight: height || '85%', display: 'flex', flexDirection: 'column',
        animation: 'sheetUp .25s cubic-bezier(.2,.8,.2,1)',
        boxShadow: '0 -8px 32px rgba(0,0,0,0.12)',
      }}>
        <div style={{ padding: '12px 0 8px', display: 'flex', justifyContent: 'center' }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: T.bgMuted }} />
        </div>
        {title && (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '8px 20px 16px',
          }}>
            <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.02em' }}>{title}</div>
            <button onClick={onClose} aria-label="닫기" style={{
              width: 32, height: 32, border: 0, background: T.bgMuted,
              borderRadius: 16, cursor: 'pointer', display: 'flex',
              alignItems: 'center', justifyContent: 'center',
            }}>
              <svg width="14" height="14" viewBox="0 0 14 14"><path d="M3 3l8 8M11 3l-8 8" stroke={T.textSec} strokeWidth="1.8" strokeLinecap="round"/></svg>
            </button>
          </div>
        )}
        <div style={{ overflow: 'auto', paddingBottom: 24 }}>{children}</div>
      </div>
    </>
  );
}

// ── small list field rows used in forms / sheets ────────────────────────────
function FieldRow({ label, children, style }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '14px 20px', borderBottom: `1px solid ${T.divider}`,
      gap: 16, ...style,
    }}>
      <div style={{ fontSize: 14, color: T.textSec, fontWeight: 500, flexShrink: 0 }}>{label}</div>
      <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-end' }}>{children}</div>
    </div>
  );
}

Object.assign(window, {
  T, Screen, AppHeader, ScreenBody,
  PrimaryButton, SecondaryButton, TextButton,
  ProgressBar, Badge, CatIcon, Card, MoneyText,
  BottomTabBar, BottomSheet, FieldRow,
});
