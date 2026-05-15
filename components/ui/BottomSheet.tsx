'use client';

import { T } from './theme';
import { ReactNode, CSSProperties } from 'react';

interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  title?: string;
  height?: string | number;
}

export function BottomSheet({
  open,
  onClose,
  children,
  title,
  height,
}: BottomSheetProps) {
  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(10,13,20,0.45)',
          zIndex: 100,
          animation: 'fadeIn .2s ease',
        }}
      />
      {/* Sheet */}
      <div
        style={{
          position: 'fixed',
          left: '50%',
          transform: 'translateX(-50%)',
          bottom: 0,
          width: '100%',
          maxWidth: 512,
          zIndex: 101,
          background: T.bg,
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
          maxHeight: height || '85%',
          display: 'flex',
          flexDirection: 'column',
          animation: 'sheetUp .25s cubic-bezier(.2,.8,.2,1)',
          boxShadow: '0 -8px 32px rgba(0,0,0,0.12)',
        }}
      >
        {/* Handle */}
        <div
          style={{
            padding: '12px 0 8px',
            display: 'flex',
            justifyContent: 'center',
          }}
        >
          <div
            style={{
              width: 36,
              height: 4,
              borderRadius: 2,
              background: T.bgMuted,
            }}
          />
        </div>

        {/* Header */}
        {title && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '8px 20px 16px',
            }}
          >
            <div
              style={{
                fontSize: 18,
                fontWeight: 700,
                letterSpacing: '-0.02em',
              }}
            >
              {title}
            </div>
            <button
              onClick={onClose}
              aria-label="닫기"
              style={{
                width: 32,
                height: 32,
                border: 0,
                background: T.bgMuted,
                borderRadius: 16,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <svg width="14" height="14" viewBox="0 0 14 14">
                <path
                  d="M3 3l8 8M11 3l-8 8"
                  stroke={T.textSec}
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </div>
        )}

        {/* Content */}
        <div style={{ overflow: 'auto', paddingBottom: 24 }}>{children}</div>
      </div>

      {/* CSS Animations */}
      <style jsx global>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
        @keyframes sheetUp {
          from {
            transform: translateY(100%);
          }
          to {
            transform: translateY(0);
          }
        }
      `}</style>
    </>
  );
}
