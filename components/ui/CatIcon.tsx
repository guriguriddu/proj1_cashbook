'use client';

import { CSSProperties } from 'react';
import { DEFAULT_CATEGORIES } from '@/constants/categories';

interface CatIconProps {
  catId: string;
  size?: number;
  style?: CSSProperties;
}

// Hex color to category mapping
const CATEGORY_COLORS: Record<string, string> = {
  food: '#FF6B6B',
  cafe: '#8B5CF6',
  transport: '#3B82F6',
  shopping: '#F59E0B',
  fixed: '#6B7280',
  entertainment: '#EC4899',
  health: '#10B981',
  other: '#6B7280',
};

export function CatIcon({ catId, size = 40, style }: CatIconProps) {
  const category = DEFAULT_CATEGORIES.find((c) => c.id === catId);
  if (!category) return null;

  const color = CATEGORY_COLORS[catId] || '#6B7280';

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.3,
        background: `${color}18`,
        color: color,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: size * 0.5,
        flexShrink: 0,
        ...style,
      }}
    >
      <span style={{ filter: 'grayscale(0)' }}>{category.icon}</span>
    </div>
  );
}
