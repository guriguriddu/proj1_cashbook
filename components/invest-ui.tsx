'use client';

import { useState } from 'react';
import { T, BottomSheet, PrimaryButton } from '@/components/ui';

// 투자/세금/시뮬 화면 공용 프리젠테이션 컴포넌트

export function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 13, fontWeight: 700, color: T.textTer, padding: '0 4px 8px', letterSpacing: '-0.01em' }}>{title}</div>
      <div style={{ background: T.bg, border: `1px solid ${T.divider}`, borderRadius: 16, overflow: 'hidden' }}>
        {children}
      </div>
    </div>
  );
}

export function InputRow({ label, value, onTap, noBorder }: { label: string; value: string; onTap: () => void; noBorder?: boolean }) {
  return (
    <button
      onClick={onTap}
      style={{
        width: '100%', border: 0, background: 'transparent',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 16px', cursor: 'pointer', textAlign: 'left',
        borderBottom: noBorder ? 'none' : `1px solid ${T.divider}`,
      }}
    >
      <span style={{ fontSize: 14, fontWeight: 600, color: T.text, letterSpacing: '-0.01em' }}>{label}</span>
      <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: T.text, fontVariantNumeric: 'tabular-nums' }}>{value}</span>
        <svg width="6" height="10" viewBox="0 0 6 10" fill="none">
          <path d="M1 1l4 4-4 4" stroke={T.textTer} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    </button>
  );
}

export function ToggleRow({ label, value, onChange, noBorder }: { label: string; value: boolean; onChange: (v: boolean) => void; noBorder?: boolean }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '14px 16px',
      borderBottom: noBorder ? 'none' : `1px solid ${T.divider}`,
    }}>
      <span style={{ fontSize: 14, fontWeight: 600, color: T.text, letterSpacing: '-0.01em' }}>{label}</span>
      <button
        onClick={() => onChange(!value)}
        style={{
          width: 44, height: 26, borderRadius: 13, border: 0, cursor: 'pointer',
          background: value ? T.accent : T.bgMuted,
          position: 'relative', transition: 'background .2s', flexShrink: 0,
        }}
      >
        <div style={{
          position: 'absolute', top: 3, left: value ? 21 : 3,
          width: 20, height: 20, borderRadius: 10, background: '#fff',
          transition: 'left .2s', boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
        }} />
      </button>
    </div>
  );
}

export function ResultRow({ label, value, color, big }: { label: string; value: string; color?: string; big?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: big ? '14px 16px' : '10px 16px' }}>
      <span style={{ fontSize: big ? 14 : 13, fontWeight: big ? 700 : 600, color: T.textSec, letterSpacing: '-0.01em' }}>{label}</span>
      <span style={{ fontSize: big ? 17 : 14, fontWeight: 700, color: color || T.text, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em' }}>{value}</span>
    </div>
  );
}

export function InfoBanner({ children, tone }: { children: React.ReactNode; tone: 'warn' | 'danger' | 'neutral' }) {
  const colors = {
    warn: { bg: T.warnSoft, fg: '#92400E' },
    danger: { bg: T.dangerSoft, fg: '#991B1B' },
    neutral: { bg: T.bgMuted, fg: T.textSec },
  }[tone];
  return (
    <div style={{ background: colors.bg, borderRadius: 12, padding: '12px 14px', fontSize: 12, color: colors.fg, lineHeight: 1.6, fontWeight: 500 }}>
      {children}
    </div>
  );
}

export function NumberEditSheet({ title, value, onClose, onSave, unit = '원', min = 0, max, presets, step = 10000 }: {
  title: string; value: number; onClose: () => void; onSave: (v: number) => void;
  unit?: string; min?: number; max?: number; presets?: { value: number; label: string }[]; step?: number;
}) {
  const [v, setV] = useState(value);
  const isMoney = unit === '원';
  const displayed = isMoney ? Number(v || 0).toLocaleString('ko-KR') : String(v);

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/[^\d.]/g, '');
    const n = Math.max(min ?? 0, Number(raw) || 0);
    setV(max != null ? Math.min(max, n) : n);
  };

  const bump = (d: number) => {
    const next = Math.max(min ?? 0, v + d);
    setV(max != null ? Math.min(max, next) : next);
  };

  return (
    <BottomSheet open onClose={onClose} title={title} height="55%">
      <div style={{ padding: '0 20px 24px' }}>
        <div style={{ padding: '20px 0', textAlign: 'center', borderBottom: `1px solid ${T.divider}` }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: 4, fontVariantNumeric: 'tabular-nums' }}>
            {isMoney && <span style={{ fontSize: 20, fontWeight: 700, color: T.textSec }}>₩</span>}
            <input
              type="text" inputMode="numeric" value={displayed} onChange={onInputChange}
              style={{
                border: 0, background: 'transparent', textAlign: 'center',
                fontFamily: 'Pretendard, system-ui, sans-serif',
                fontSize: 30, fontWeight: 800, color: T.text,
                width: `${Math.max(3, displayed.length)}ch`, minWidth: 80, maxWidth: 240, outline: 'none', padding: 0,
              }}
            />
            <span style={{ fontSize: 18, fontWeight: 700, color: T.textSec }}>{unit}</span>
          </div>
          {isMoney && v >= 10_000 && (
            <div style={{ marginTop: 6, fontSize: 13, color: T.textTer }}>
              {v >= 100_000_000 ? Math.floor(v / 100_000_000) + '억 ' + Math.floor((v % 100_000_000) / 10_000) + '만원' : Math.floor(v / 10_000) + '만원'}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8, padding: '20px 0 8px' }}>
          {[-step * 10, -step, +step, +step * 10].map((d) => (
            <button key={d} onClick={() => bump(d)} style={{
              flex: 1, padding: '10px 0', border: 0, borderRadius: 10,
              background: T.bgMuted, color: T.text, fontFamily: 'Pretendard, system-ui, sans-serif',
              fontSize: 13, fontWeight: 600, cursor: 'pointer', fontVariantNumeric: 'tabular-nums',
            }}>
              {d > 0 ? '+' : '−'}{isMoney ? (Math.abs(d) >= 10000 ? `${Math.abs(d) / 10000}만` : Math.abs(d).toLocaleString()) : Math.abs(d)}
            </button>
          ))}
        </div>
        {presets && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 12 }}>
            {presets.map((p) => (
              <button key={p.value} onClick={() => setV(p.value)} style={{
                border: 0, padding: '8px 14px', borderRadius: 999,
                background: v === p.value ? T.accentSoft : T.bgSoft,
                color: v === p.value ? T.accent : T.text,
                fontFamily: 'Pretendard, system-ui, sans-serif', fontSize: 13, fontWeight: 600, cursor: 'pointer',
              }}>
                {p.label}
              </button>
            ))}
          </div>
        )}
        <div style={{ marginTop: 24 }}>
          <PrimaryButton onClick={() => onSave(v)}>적용</PrimaryButton>
        </div>
      </div>
    </BottomSheet>
  );
}
