'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Screen,
  AppHeader,
  ScreenBody,
  T,
  PrimaryButton,
  SecondaryButton,
  Badge,
  BottomSheet,
} from '@/components/ui';
import { CatIcon } from '@/components/ui/CatIcon';
import { DEFAULT_CATEGORIES } from '@/constants/categories';
import { getCategories, addCustomCategory, deleteCustomCategory } from '@/lib/supabase-storage';
import type { Category } from '@/types';

const PRESET_COLORS = [
  '#F97316', '#EF4444', '#8B5CF6', '#3B82F6', '#10B981',
  '#F59E0B', '#EC4899', '#06B6D4', '#6366F1', '#0EA5E9',
  '#84CC16', '#6B7280',
];

const PRESET_EMOJIS = [
  '💰', '🏦', '💳', '🛒', '🎮', '🎵', '📚', '🏋️', '🐾', '🌿',
  '🎁', '🔧', '🏠', '✈️', '🍺', '💊', '🎨', '📱', '🚀', '⭐',
];

export default function CategoriesPage() {
  const router = useRouter();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddSheet, setShowAddSheet] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null);

  // 추가 폼 상태
  const [newName, setNewName] = useState('');
  const [newIcon, setNewIcon] = useState('💰');
  const [newColor, setNewColor] = useState('#F97316');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    const cats = await getCategories();
    setCategories(cats);
    setLoading(false);
  }

  async function handleAdd() {
    if (!newName.trim()) {
      setError('카테고리 이름을 입력해주세요');
      return;
    }
    const id = 'custom_' + Date.now();
    setSaving(true);
    try {
      await addCustomCategory({ id, name: newName.trim(), icon: newIcon, color: newColor, keywords: [] });
      setShowAddSheet(false);
      setNewName('');
      setNewIcon('💰');
      setNewColor('#F97316');
      setError('');
      await load();
    } catch {
      setError('저장에 실패했습니다');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(cat: Category) {
    try {
      await deleteCustomCategory(cat.id);
      setDeleteTarget(null);
      await load();
    } catch {
      alert('삭제에 실패했습니다');
    }
  }

  const defaultCats = categories.filter((c) => !c.isCustom);
  const customCats = categories.filter((c) => c.isCustom);

  return (
    <Screen>
      <AppHeader title="카테고리 관리" onBack={() => router.back()} />
      <ScreenBody padBottom={100}>

        {/* 기본 카테고리 */}
        <div style={{ padding: '16px 20px 8px' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: T.textTer, marginBottom: 10 }}>
            기본 카테고리
          </div>
          <div style={{ background: T.bg, borderRadius: 16, overflow: 'hidden', border: `1px solid ${T.divider}` }}>
            {defaultCats.map((cat, i) => (
              <div
                key={cat.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '13px 16px',
                  borderBottom: i < defaultCats.length - 1 ? `1px solid ${T.divider}` : 'none',
                }}
              >
                <CatIcon catId={cat.id} size={36} icon={cat.icon} color={cat.color} />
                <span style={{ fontSize: 15, fontWeight: 600, flex: 1 }}>{cat.name}</span>
              </div>
            ))}
          </div>
        </div>

        {/* 직접 추가한 카테고리 */}
        <div style={{ padding: '16px 20px 8px' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: T.textTer, marginBottom: 10 }}>
            직접 추가한 카테고리
          </div>
          {loading ? (
            <div style={{ color: T.textSec, fontSize: 14, padding: '12px 0' }}>불러오는 중...</div>
          ) : customCats.length === 0 ? (
            <div
              style={{
                background: T.bgSoft,
                borderRadius: 16,
                padding: '24px',
                textAlign: 'center',
                color: T.textTer,
                fontSize: 14,
              }}
            >
              아직 추가한 카테고리가 없어요
            </div>
          ) : (
            <div style={{ background: T.bg, borderRadius: 16, overflow: 'hidden', border: `1px solid ${T.divider}` }}>
              {customCats.map((cat, i) => (
                <div
                  key={cat.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '13px 16px',
                    borderBottom: i < customCats.length - 1 ? `1px solid ${T.divider}` : 'none',
                  }}
                >
                  <CatIcon catId={cat.id} size={36} icon={cat.icon} color={cat.color} />
                  <span style={{ fontSize: 15, fontWeight: 600, flex: 1 }}>{cat.name}</span>
                  <Badge tone="blue" size="sm">직접 추가</Badge>
                  <button
                    onClick={() => setDeleteTarget(cat)}
                    style={{
                      border: 0, background: 'transparent',
                      color: T.textTer, cursor: 'pointer',
                      fontSize: 18, padding: '4px 6px',
                    }}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </ScreenBody>

      {/* 하단 추가 버튼 */}
      <div
        style={{
          position: 'fixed', left: 0, right: 0, bottom: 0,
          padding: '12px 20px 28px',
          background: 'linear-gradient(to top, rgba(255,255,255,1) 60%, rgba(255,255,255,0))',
          maxWidth: 512, margin: '0 auto', zIndex: 100,
        }}
      >
        <PrimaryButton onClick={() => setShowAddSheet(true)}>
          + 카테고리 추가
        </PrimaryButton>
      </div>

      {/* 추가 시트 */}
      {showAddSheet && (
        <BottomSheet open onClose={() => { setShowAddSheet(false); setError(''); }} title="카테고리 추가" height="85%">
          <div style={{ padding: '0 20px 32px', display: 'flex', flexDirection: 'column', gap: 20 }}>

            {/* 미리보기 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '16px', background: T.bgSoft, borderRadius: 14 }}>
              <div
                style={{
                  width: 48, height: 48, borderRadius: 14,
                  background: newColor + '22', display: 'flex',
                  alignItems: 'center', justifyContent: 'center', fontSize: 24,
                }}
              >
                {newIcon}
              </div>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700 }}>{newName || '카테고리 이름'}</div>
                <Badge tone="blue" size="sm">직접 추가</Badge>
              </div>
            </div>

            {/* 이름 */}
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: T.textSec, marginBottom: 8 }}>카테고리 이름</div>
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="예: 의료비, 반려동물..."
                maxLength={10}
                style={{
                  width: '100%', padding: '14px 16px',
                  fontSize: 16, border: `1px solid ${T.divider}`,
                  borderRadius: 12, outline: 'none',
                  background: T.bgMuted, boxSizing: 'border-box',
                  fontFamily: 'inherit',
                }}
              />
            </div>

            {/* 아이콘 */}
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: T.textSec, marginBottom: 8 }}>아이콘</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {PRESET_EMOJIS.map((emoji) => (
                  <button
                    key={emoji}
                    onClick={() => setNewIcon(emoji)}
                    style={{
                      width: 44, height: 44, borderRadius: 10, fontSize: 22,
                      border: newIcon === emoji ? `2px solid ${T.accent}` : `1px solid ${T.divider}`,
                      background: newIcon === emoji ? T.accentSoft : T.bgSoft,
                      cursor: 'pointer',
                    }}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>

            {/* 색상 */}
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: T.textSec, marginBottom: 8 }}>색상</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {PRESET_COLORS.map((color) => (
                  <button
                    key={color}
                    onClick={() => setNewColor(color)}
                    style={{
                      width: 36, height: 36, borderRadius: '50%',
                      background: color, border: 'none', cursor: 'pointer',
                      outline: newColor === color ? `3px solid ${color}` : 'none',
                      outlineOffset: 2,
                    }}
                  />
                ))}
              </div>
            </div>

            {error && (
              <div style={{ fontSize: 13, color: T.danger, fontWeight: 500 }}>{error}</div>
            )}

            <div style={{ display: 'flex', gap: 8 }}>
              <SecondaryButton onClick={() => { setShowAddSheet(false); setError(''); }} style={{ flex: 1 }}>
                취소
              </SecondaryButton>
              <PrimaryButton onClick={handleAdd} disabled={saving} style={{ flex: 1.5 }}>
                {saving ? '저장 중...' : '추가하기'}
              </PrimaryButton>
            </div>
          </div>
        </BottomSheet>
      )}

      {/* 삭제 확인 모달 */}
      {deleteTarget && (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
            zIndex: 1000, display: 'flex', alignItems: 'center',
            justifyContent: 'center', padding: 20,
          }}
          onClick={() => setDeleteTarget(null)}
        >
          <div
            style={{
              background: T.bg, borderRadius: 20,
              padding: '24px 20px 20px', width: '100%', maxWidth: 320,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 8 }}>카테고리 삭제</div>
            <div style={{ fontSize: 14, color: T.textSec, lineHeight: 1.6, marginBottom: 20 }}>
              <strong>{deleteTarget.name}</strong> 카테고리를 삭제할까요?<br />
              이미 저장된 지출 내역은 유지됩니다.
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <SecondaryButton onClick={() => setDeleteTarget(null)} style={{ flex: 1 }}>취소</SecondaryButton>
              <PrimaryButton
                onClick={() => handleDelete(deleteTarget)}
                style={{ flex: 1, background: T.danger }}
              >
                삭제
              </PrimaryButton>
            </div>
          </div>
        </div>
      )}
    </Screen>
  );
}
