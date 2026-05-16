'use client';

import { T } from './theme';
import { ReactNode, CSSProperties } from 'react';

export type BadgeTone = 'neutral' | 'accent' | 'warn' | 'danger' | 'blue' | 'purple';
export type BadgeSize = 'sm' | 'md' | 'lg';

interface BadgeProps {
  children: ReactNode;
  tone?: BadgeTone;
  size?: BadgeSize;
  style?: CSSProperties;
}

const tones: Record<BadgeTone, { bg: string; fg: string }> = {
  neutral: { bg: T.bgMuted, fg: T.textSec },
  accent: { bg: T.accentSoft, fg: T.accent },
  warn: { bg: T.warnSoft, fg: '#B45309' },
  danger: { bg: T.dangerSoft, fg: T.danger },
  blue: { bg: T.blueSoft, fg: T.blue },
  purple: { bg: 'rgba(168,85,247,0.12)', fg: '#7C3AED' },
};

const sizes: Record<BadgeSize, { fontSize: number; padding: string; radius: number }> = {
  sm: { fontSize: 11, padding: '3px 8px', radius: 6 },
  md: { fontSize: 12, padding: '4px 10px', radius: 7 },
  lg: { fontSize: 13, padding: '6px 12px', radius: 8 },
};

export function Badge({ children, tone = 'neutral', size = 'sm', style }: BadgeProps) {
  const t = tones[tone];
  const s = sizes[size];

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        background: t.bg,
        color: t.fg,
        fontSize: s.fontSize,
        fontWeight: 600,
        padding: s.padding,
        borderRadius: s.radius,
        letterSpacing: '-0.01em',
        whiteSpace: 'nowrap',
        ...style,
      }}
    >
      {children}
    </span>
  );
}
