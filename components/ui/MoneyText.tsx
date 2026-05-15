'use client';

import { T } from './theme';
import { CSSProperties } from 'react';

interface MoneyTextProps {
  value: number;
  size?: number;
  weight?: number;
  color?: string;
  prefix?: string;
  style?: CSSProperties;
}

export function MoneyText({
  value,
  size = 32,
  weight = 700,
  color = T.text,
  prefix = '₩',
  style,
}: MoneyTextProps) {
  const formatted = Math.abs(Math.round(value)).toLocaleString('ko-KR');

  return (
    <span
      style={{
        fontFamily: 'Pretendard, system-ui, sans-serif',
        fontSize: size,
        fontWeight: weight,
        color,
        letterSpacing: '-0.025em',
        fontVariantNumeric: 'tabular-nums',
        ...style,
      }}
    >
      <span
        style={{
          fontSize: size * 0.72,
          marginRight: 2,
          fontWeight: weight - 100,
        }}
      >
        {prefix}
      </span>
      {(value < 0 ? '-' : '') + formatted}
    </span>
  );
}
