'use client';

import { CSSProperties } from 'react';
import { DEFAULT_CATEGORIES } from '@/constants/categories';

interface CatIconProps {
  catId: string;
  size?: number;
  style?: CSSProperties;
  // 커스텀 카테고리용 직접 전달
  icon?: string;
  color?: string;
}

export function CatIcon({ catId, size = 40, style, icon: iconProp, color: colorProp }: CatIconProps) {
  const category = DEFAULT_CATEGORIES.find((c) => c.id === catId);

  const icon = iconProp || category?.icon || '📦';
  const color = colorProp || category?.color || '#6B7280';

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.3,
        background: `${color}22`,
        color: color,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: size * 0.5,
        flexShrink: 0,
        ...style,
      }}
    >
      <span>{icon}</span>
    </div>
  );
}
