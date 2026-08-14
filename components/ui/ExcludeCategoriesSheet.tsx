'use client';

import { useState } from 'react';
import { T } from './theme';
import { BottomSheet } from './BottomSheet';
import { PrimaryButton } from './Buttons';
import { CatIcon } from './CatIcon';
import type { Category } from '@/types';

export function ExcludeCategoriesSheet({
  categories, excluded, onApply, onClose,
}: {
  categories: Category[];
  excluded: Set<string>;
  onApply: (ids: string[]) => void;
  onClose: () => void;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set(excluded));

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <BottomSheet open onClose={onClose} title="카테고리 제외" height="75%">
      <div style={{ padding: '0 20px 8px', fontSize: 13, color: T.textSec, lineHeight: 1.5 }}>
        &lsquo;전체&rsquo;로 볼 때 목록에서 뺄 카테고리를 골라주세요.
      </div>
      <div style={{ padding: '8px 8px 16px' }}>
        {categories.map((cat) => {
          const on = selected.has(cat.id);
          return (
            <button
              key={cat.id}
              onClick={() => toggle(cat.id)}
              style={{
                width: '100%', border: 0, background: 'transparent',
                display: 'flex', alignItems: 'center', gap: 12, padding: '12px 12px',
                borderRadius: 12, cursor: 'pointer', textAlign: 'left',
                fontFamily: 'Pretendard, system-ui, sans-serif',
              }}
            >
              <CatIcon catId={cat.id} size={32} icon={cat.icon} color={cat.color} />
              <span style={{ flex: 1, fontSize: 14, fontWeight: 600, color: on ? T.textTer : T.text, textDecoration: on ? 'line-through' : 'none' }}>
                {cat.name}
              </span>
              <div style={{
                width: 20, height: 20, borderRadius: 6, flexShrink: 0,
                border: `1.5px solid ${on ? T.danger : T.divider}`,
                background: on ? T.danger : 'transparent',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {on && (
                  <svg width="11" height="9" viewBox="0 0 13 10" fill="none">
                    <path d="M1.5 5l3.5 3.5 7-7" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </div>
            </button>
          );
        })}
      </div>
      <div style={{
        position: 'sticky', bottom: 0, background: T.bg,
        padding: '12px 20px 24px', borderTop: `1px solid ${T.divider}`,
      }}>
        <PrimaryButton onClick={() => onApply([...selected])}>적용</PrimaryButton>
      </div>
    </BottomSheet>
  );
}
