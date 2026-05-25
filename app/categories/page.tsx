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
} from '@/components/ui';
import { CatIcon } from '@/components/ui/CatIcon';
import { getCategories, deleteCustomCategory, hideDefaultCategory } from '@/lib/supabase-storage';
import type { Category } from '@/types';

export default function CategoriesPage() {
  const router = useRouter();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    const cats = await getCategories();
    setCategories(cats);
    setLoading(false);
  }

  async function handleDelete(cat: Category) {
    try {
      if (cat.isCustom) {
        await deleteCustomCategory(cat.id);
      } else {
        await hideDefaultCategory(cat.id);
      }
      setDeleteTarget(null);
      await load();
    } catch {
      alert('삭제에 실패했습니다');
    }
  }

  return (
    <Screen>
      <AppHeader title="카테고리 관리" onBack={() => router.back()} />
      <ScreenBody padBottom={100}>

        <div style={{ padding: '16px 20px 8px' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: T.textTer, marginBottom: 10 }}>
            카테고리
          </div>
          {loading ? (
            <div style={{ color: T.textSec, fontSize: 14, padding: '12px 0' }}>불러오는 중...</div>
          ) : (
            <div style={{ background: T.bg, borderRadius: 16, overflow: 'hidden', border: `1px solid ${T.divider}` }}>
              {categories.map((cat, i) => (
                <div
                  key={cat.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '13px 16px',
                    borderBottom: i < categories.length - 1 ? `1px solid ${T.divider}` : 'none',
                  }}
                >
                  <CatIcon catId={cat.id} size={36} icon={cat.icon} color={cat.color} />
                  <span style={{ fontSize: 15, fontWeight: 600, flex: 1 }}>{cat.name}</span>
                  <button
                    onClick={() => setDeleteTarget(cat)}
                    style={{
                      border: 0, background: 'transparent',
                      color: T.textTer, cursor: 'pointer',
                      fontSize: 20, padding: '4px 6px',
                      lineHeight: 1,
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

      {/* 하단 저장 버튼 */}
      <div
        style={{
          position: 'fixed', left: 0, right: 0, bottom: 0,
          padding: '12px 20px 28px',
          background: 'linear-gradient(to top, rgba(255,255,255,1) 60%, rgba(255,255,255,0))',
          maxWidth: 512, margin: '0 auto', zIndex: 100,
        }}
      >
        <PrimaryButton onClick={() => router.back()}>
          저장
        </PrimaryButton>
      </div>

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
