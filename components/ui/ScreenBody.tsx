'use client';

import { ReactNode, CSSProperties } from 'react';

interface ScreenBodyProps {
  children: ReactNode;
  padBottom?: number;
  style?: CSSProperties;
}

export function ScreenBody({ children, padBottom = 96, style }: ScreenBodyProps) {
  return (
    <div
      style={{
        flex: 1,
        overflowY: 'auto',
        overflowX: 'hidden',
        WebkitOverflowScrolling: 'touch',
        paddingBottom: padBottom,
        ...style,
      }}
    >
      {children}
    </div>
  );
}
