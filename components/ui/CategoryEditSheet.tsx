'use client';

import { useState } from 'react';
import { T } from './theme';
import { BottomSheet } from './BottomSheet';
import { PrimaryButton } from './Buttons';
import { CatIcon } from './CatIcon';
import type { Category } from '@/types';

const COLOR_PRESETS = [
  '#F97316', '#D97706', '#EC4899', '#8B5CF6', '#6366F1',
  '#3B82F6', '#0EA5E9', '#10B981', '#22C55E', '#EF4444',
  '#F43F5E', '#6B7280',
];

export function CategoryEditSheet({
  category, onSave, onClose,
}: {
  category: Category;
  onSave: (updates: { name: string; icon: string; color: string }) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(category.name);
  const [icon, setIcon] = useState(category.icon);
  const [color, setColor] = useState(category.color);

  const canSave = name.trim().length > 0;

  return (
    <BottomSheet open onClose={onClose} title="카테고리 수정" height="70%">
      <div style={{ padding: '0 20px 8px', display: 'flex', justifyContent: 'center' }}>
        <CatIcon catId={category.id} size={56} icon={icon} color={color} />
      </div>

      <div style={{ padding: '16px 20px 0', display: 'flex', gap: 8, alignItems: 'center' }}>
        <input
          type="text"
          value={icon}
          onChange={(e) => setIcon(e.target.value.slice(0, 2))}
          placeholder="🏷️"
          style={{
            width: 52, textAlign: 'center', border: `1px solid ${T.divider}`, borderRadius: 10,
            padding: '12px 0', fontSize: 18, fontFamily: 'Pretendard, system-ui, sans-serif',
          }}
        />
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="카테고리 이름"
          style={{
            flex: 1, border: `1px solid ${T.divider}`, borderRadius: 10,
            padding: '12px 14px', fontSize: 14, fontFamily: 'Pretendard, system-ui, sans-serif',
          }}
        />
      </div>

      <div style={{ padding: '20px 20px 0' }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: T.textTer, marginBottom: 10 }}>
          색상
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          {COLOR_PRESETS.map((c) => (
            <button
              key={c}
              onClick={() => setColor(c)}
              aria-label={c}
              style={{
                width: 32, height: 32, borderRadius: 16, cursor: 'pointer',
                background: c,
                border: color === c ? `2.5px solid ${T.text}` : '2.5px solid transparent',
                boxShadow: color === c ? `0 0 0 2px ${T.bg}` : 'none',
                padding: 0,
              }}
            />
          ))}
        </div>
      </div>

      <div style={{ padding: '24px 20px 8px' }}>
        <PrimaryButton
          disabled={!canSave}
          onClick={() => onSave({ name: name.trim(), icon: icon.trim() || '🏷️', color })}
        >
          저장
        </PrimaryButton>
      </div>
    </BottomSheet>
  );
}
