'use client';

import { T } from './theme';
import { ReactNode, CSSProperties } from 'react';

interface CardProps {
  children: ReactNode;
  padding?: number;
  style?: CSSProperties;
  onClick?: () => void;
}

export function Card({ children, padding = 20, style, onClick }: CardProps) {
  return (
    <div
      onClick={onClick}
      style={{
        background: T.bg,
        border: `1px solid ${T.divider}`,
        borderRadius: 16,
        padding,
        cursor: onClick ? 'pointer' : 'default',
        ...style,
      }}
    >
      {children}
    </div>
  );
}
