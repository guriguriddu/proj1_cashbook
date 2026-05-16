'use client';

import { T } from './theme';
import { ReactNode, CSSProperties } from 'react';

interface ButtonProps {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  full?: boolean;
  style?: CSSProperties;
  type?: 'button' | 'submit' | 'reset';
}

export function PrimaryButton({
  children,
  onClick,
  disabled,
  full = true,
  style,
  type = 'button',
}: ButtonProps) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      style={{
        width: full ? '100%' : 'auto',
        height: 56,
        padding: '0 24px',
        border: 0,
        borderRadius: 14,
        background: disabled ? T.bgMuted : T.accent,
        color: disabled ? T.textTer : '#fff',
        fontFamily: 'Pretendard, system-ui, sans-serif',
        fontSize: 17,
        fontWeight: 600,
        letterSpacing: '-0.01em',
        cursor: disabled ? 'default' : 'pointer',
        transition: 'background .15s',
        ...style,
      }}
    >
      {children}
    </button>
  );
}

export function SecondaryButton({
  children,
  onClick,
  full = true,
  style,
}: Omit<ButtonProps, 'disabled'>) {
  return (
    <button
      onClick={onClick}
      style={{
        width: full ? '100%' : 'auto',
        height: 56,
        padding: '0 24px',
        border: 0,
        borderRadius: 14,
        background: T.bgMuted,
        color: T.text,
        fontFamily: 'Pretendard, system-ui, sans-serif',
        fontSize: 17,
        fontWeight: 600,
        letterSpacing: '-0.01em',
        cursor: 'pointer',
        ...style,
      }}
    >
      {children}
    </button>
  );
}

interface TextButtonProps {
  children: ReactNode;
  onClick?: () => void;
  color?: string;
  style?: CSSProperties;
}

export function TextButton({
  children,
  onClick,
  color = T.accent,
  style,
}: TextButtonProps) {
  return (
    <button
      onClick={onClick}
      style={{
        border: 0,
        background: 'transparent',
        color,
        padding: '8px 12px',
        fontFamily: 'Pretendard, system-ui, sans-serif',
        fontSize: 15,
        fontWeight: 600,
        letterSpacing: '-0.01em',
        cursor: 'pointer',
        ...style,
      }}
    >
      {children}
    </button>
  );
}
