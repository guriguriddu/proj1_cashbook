'use client';

import { T } from './theme';
import { ReactNode, CSSProperties } from 'react';

interface AppHeaderProps {
  title: string;
  onBack?: () => void;
  rightSlot?: ReactNode;
  sticky?: boolean;
  transparent?: boolean;
}

export function AppHeader({
  title,
  onBack,
  rightSlot,
  sticky = true,
  transparent = false,
}: AppHeaderProps) {
  return (
    <div
      style={{
        position: sticky ? 'sticky' : 'relative',
        top: 0,
        zIndex: 10,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        height: 52,
        padding: '50px 8px 0',
        background: transparent ? 'transparent' : T.bg,
        borderBottom: transparent ? '0' : `1px solid ${T.divider}`,
        boxSizing: 'content-box',
      }}
    >
      <div
        style={{
          width: 44,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-start',
        }}
      >
        {onBack && (
          <button
            onClick={onBack}
            aria-label="뒤로가기"
            style={{
              width: 44,
              height: 44,
              border: 0,
              background: 'transparent',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              padding: 0,
            }}
          >
            <svg width="11" height="20" viewBox="0 0 11 20" fill="none">
              <path
                d="M9.5 1.5L1.5 10l8 8.5"
                stroke={T.text}
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        )}
      </div>
      <div
        style={{
          flex: 1,
          textAlign: 'center',
          fontSize: 17,
          fontWeight: 600,
          color: T.text,
          letterSpacing: '-0.01em',
        }}
      >
        {title}
      </div>
      <div
        style={{
          minWidth: 44,
          width: 'auto',
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          paddingRight: 8,
        }}
      >
        {rightSlot}
      </div>
    </div>
  );
}
