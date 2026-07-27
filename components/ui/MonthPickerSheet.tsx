'use client';

import { T } from './theme';
import { BottomSheet } from './BottomSheet';

export function MonthPickerSheet({
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
