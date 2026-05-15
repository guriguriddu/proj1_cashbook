'use client';

import { T } from './theme';
import { ReactNode, CSSProperties } from 'react';

interface FieldRowProps {
  label: string;
  children: ReactNode;
  style?: CSSProperties;
}

export function FieldRow({ label, children, style }: FieldRowProps) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '14px 20px',
        borderBottom: `1px solid ${T.divider}`,
        gap: 16,
        ...style,
      }}
    >
      <div
        style={{
          fontSize: 14,
          color: T.textSec,
          fontWeight: 500,
          flexShrink: 0,
        }}
      >
        {label}
      </div>
      <div
        style={{
          flex: 1,
          display: 'flex',
          justifyContent: 'flex-end',
        }}
      >
        {children}
      </div>
    </div>
  );
}
