'use client';

import { T } from './theme';
import { CSSProperties, ReactNode } from 'react';

interface ScreenProps {
  children: ReactNode;
  style?: CSSProperties;
}

export function Screen({ children, style }: ScreenProps) {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        background: T.bg,
        color: T.text,
        position: 'relative',
        fontFamily: 'Pretendard, system-ui, sans-serif',
        ...style,
      }}
    >
      {children}
    </div>
  );
}
