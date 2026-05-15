// theme.ts — Toss-style design tokens
// Based on design-reference/ui.jsx

export const T = {
  // Backgrounds
  bg: '#FFFFFF',
  bgSoft: '#F7F8FA',
  bgMuted: '#F2F4F6',

  // Borders & Dividers
  divider: '#EEF0F3',

  // Text Colors
  text: '#0A0D14',
  textSec: '#4E5968',
  textTer: '#8B95A1',
  textMuted: '#B0B8C1',

  // Accent (Green)
  accent: '#1F8A5B',
  accentSoft: '#E6F4ED',

  // Warning (Yellow/Orange)
  warn: '#F59E0B',
  warnSoft: '#FEF3C7',

  // Danger (Red)
  danger: '#EF4444',
  dangerSoft: '#FEE2E2',

  // Blue
  blue: '#3B82F6',
  blueSoft: '#E0EDFF',
} as const;

export type ThemeColor = keyof typeof T;
