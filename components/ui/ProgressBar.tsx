'use client';

import { T } from './theme';

interface ProgressBarProps {
  value: number;
  height?: number;
  trackColor?: string;
  fillColor?: string;
  overColor?: string;
  borderRadius?: number;
}

export function ProgressBar({
  value,
  height = 8,
  trackColor,
  fillColor,
  overColor = T.danger,
  borderRadius,
}: ProgressBarProps) {
  const pct = Math.max(0, value);
  const over = pct > 100;
  const fill = over ? overColor : (fillColor || T.accent);
  const track = trackColor || T.bgMuted;
  const r = borderRadius ?? height / 2;

  return (
    <div
      style={{
        width: '100%',
        height,
        background: track,
        borderRadius: r,
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      <div
        style={{
          height: '100%',
          width: `${Math.min(100, pct)}%`,
          background: fill,
          borderRadius: r,
          transition: 'width .35s cubic-bezier(.2,.7,.3,1), background .2s',
        }}
      />
    </div>
  );
}
