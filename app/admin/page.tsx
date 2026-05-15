'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Screen,
  ScreenBody,
  AppHeader,
  T,
  PrimaryButton,
  SecondaryButton,
  BottomSheet,
  CatIcon,
} from '@/components/ui';
import { getExpenses, getBudget, deleteExpense } from '@/lib/storage';
import { getCategoryById } from '@/constants/categories';
import type { Expense, Budget } from '@/types';

type Tab = 'expenses' | 'budget' | 'raw';

export default function AdminPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [tab, setTab] = useState<Tab>('expenses');
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [budget, setBudget] = useState<Budget | null>(null);
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);
  const [rawData, setRawData] = useState<Record<string, string>>({});

  useEffect(() => {
    setMounted(true);
    loadData();
  }, []);

  const loadData = () => {
    setExpenses(getExpenses());
    setBudget(getBudget());

    // Raw localStorage data
    const raw: Record<string, string> = {};
    const keys = ['cashbook_expenses', 'cashbook_budget', 'cashbook_categories', 'cashbook_settings'];
    keys.forEach(key => {
      const data = localStorage.getItem(key);
      if (data) raw[key] = data;
    });
    setRawData(raw);
  };

  const handleDeleteExpense = (id: string) => {
    if (confirm('이 지출 내역을 삭제하시겠습니까?')) {
      deleteExpense(id);
      loadData();
      setSelectedExpense(null);
    }
  };

  const handleClearAll = () => {
    if (confirm('정말 모든 데이터를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) {
      if (confirm('마지막 확인: 정말로 삭제하시겠습니까?')) {
        localStorage.removeItem('cashbook_expenses');
        localStorage.removeItem('cashbook_budget');
        localStorage.removeItem('cashbook_categories');
        localStorage.removeItem('cashbook_settings');
        loadData();
        alert('모든 데이터가 삭제되었습니다.');
      }
    }
  };

  const handleExportData = () => {
    const data = {
      expenses: getExpenses(),
      budget: getBudget(),
      exportedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cashbook_backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // 중복 체크
  const findDuplicates = () => {
    const seen = new Map<string, Expense[]>();
    expenses.forEach(e => {
      const key = `${e.date}_${e.merchant}_${e.amount}`;
      if (!seen.has(key)) seen.set(key, []);
      seen.get(key)!.push(e);
    });
    return Array.from(seen.entries()).filter(([_, items]) => items.length > 1);
  };

  const duplicates = findDuplicates();

  // 월별 그룹화
  const groupByMonth = () => {
    const grouped: Record<string, Expense[]> = {};
    expenses.forEach(e => {
      const month = e.date.slice(0, 7);
      if (!grouped[month]) grouped[month] = [];
      grouped[month].push(e);
    });
    return Object.entries(grouped).sort((a, b) => b[0].localeCompare(a[0]));
  };

  if (!mounted) {
    return (
      <Screen>
        <div style={{ padding: 20, color: T.textSec }}>로딩 중...</div>
      </Screen>
    );
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: 'expenses', label: '지출 내역' },
    { id: 'budget', label: '예산' },
    { id: 'raw', label: 'Raw 데이터' },
  ];

  return (
    <Screen>
      <AppHeader title="관리자" onBack={() => router.push('/')} />

      {/* 탭 */}
      <div style={{ padding: '8px 20px', display: 'flex', gap: 8 }}>
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              flex: 1,
              padding: '10px 0',
              border: tab === t.id ? `2px solid ${T.accent}` : `1px solid ${T.divider}`,
              borderRadius: 10,
              background: tab === t.id ? T.accentSoft : 'transparent',
              color: tab === t.id ? T.accent : T.textSec,
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* 요약 정보 */}
      <div style={{ padding: '12px 20px', background: T.bgSoft, margin: '0 20px', borderRadius: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{ fontSize: 13, color: T.textSec }}>총 지출 건수</span>
          <span style={{ fontSize: 13, fontWeight: 700 }}>{expenses.length}건</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{ fontSize: 13, color: T.textSec }}>중복 의심</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: duplicates.length > 0 ? T.danger : T.text }}>
            {duplicates.length}건
          </span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 13, color: T.textSec }}>저장소 크기</span>
          <span style={{ fontSize: 13, fontWeight: 700 }}>
            {(JSON.stringify(rawData).length / 1024).toFixed(1)}KB
          </span>
        </div>
      </div>

      <ScreenBody>
        {/* 지출 내역 탭 */}
        {tab === 'expenses' && (
          <div style={{ padding: '0 20px' }}>
            {/* 중복 경고 */}
            {duplicates.length > 0 && (
              <div
                style={{
                  background: 'rgba(239,68,68,0.1)',
                  border: '1px solid rgba(239,68,68,0.3)',
                  borderRadius: 12,
                  padding: 14,
                  marginBottom: 16,
                }}
              >
                <div style={{ fontSize: 14, fontWeight: 700, color: '#EF4444', marginBottom: 8 }}>
                  ⚠️ 중복 의심 데이터 발견
                </div>
                {duplicates.map(([key, items]) => (
                  <div key={key} style={{ marginBottom: 8 }}>
                    <div style={{ fontSize: 12, color: T.textSec, marginBottom: 4 }}>
                      {key.replace(/_/g, ' / ')} - {items.length}건
                    </div>
                    {items.map(item => (
                      <div
                        key={item.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '6px 10px',
                          background: T.bg,
                          borderRadius: 8,
                          marginBottom: 4,
                          fontSize: 12,
                        }}
                      >
                        <span>ID: {item.id.slice(0, 8)}...</span>
                        <button
                          onClick={() => handleDeleteExpense(item.id)}
                          style={{
                            border: 0,
                            background: '#EF4444',
                            color: '#fff',
                            padding: '4px 10px',
                            borderRadius: 6,
                            fontSize: 11,
                            fontWeight: 600,
                            cursor: 'pointer',
                          }}
                        >
                          삭제
                        </button>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}

            {/* 월별 지출 목록 */}
            {groupByMonth().map(([month, items]) => (
              <div key={month} style={{ marginBottom: 20 }}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: 8,
                  }}
                >
                  <span style={{ fontSize: 14, fontWeight: 700, color: T.text }}>{month}</span>
                  <span style={{ fontSize: 12, color: T.textTer }}>
                    {items.length}건 / ₩{items.reduce((a, e) => a + e.amount, 0).toLocaleString()}
                  </span>
                </div>
                <div
                  style={{
                    background: T.bg,
                    border: `1px solid ${T.divider}`,
                    borderRadius: 12,
                    overflow: 'hidden',
                  }}
                >
                  {items.map((e, i) => (
                    <button
                      key={e.id}
                      onClick={() => setSelectedExpense(e)}
                      style={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        padding: '10px 12px',
                        border: 0,
                        background: 'transparent',
                        borderBottom: i < items.length - 1 ? `1px solid ${T.divider}` : 'none',
                        cursor: 'pointer',
                        textAlign: 'left',
                      }}
                    >
                      <CatIcon catId={e.category} size={32} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{e.merchant}</div>
                        <div style={{ fontSize: 11, color: T.textTer }}>
                          {e.date} · {getCategoryById(e.category)?.name} · {e.source}
                        </div>
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: T.text }}>
                        ₩{e.amount.toLocaleString()}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 예산 탭 */}
        {tab === 'budget' && budget && (
          <div style={{ padding: '0 20px' }}>
            <div
              style={{
                background: T.bg,
                border: `1px solid ${T.divider}`,
                borderRadius: 12,
                padding: 16,
                marginBottom: 16,
              }}
            >
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>연간 예산</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: T.accent }}>
                ₩{budget.annual.toLocaleString()}
              </div>
            </div>

            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>카테고리별 예산</div>
            <div
              style={{
                background: T.bg,
                border: `1px solid ${T.divider}`,
                borderRadius: 12,
                overflow: 'hidden',
              }}
            >
              {Object.entries(budget.categoryBudgets).map(([catId, amount], i, arr) => {
                const cat = getCategoryById(catId);
                return (
                  <div
                    key={catId}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '12px 14px',
                      borderBottom: i < arr.length - 1 ? `1px solid ${T.divider}` : 'none',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <CatIcon catId={catId} size={28} />
                      <span style={{ fontSize: 14, fontWeight: 600 }}>{cat?.name || catId}</span>
                    </div>
                    <span style={{ fontSize: 14, fontWeight: 700, color: T.textSec }}>
                      ₩{amount.toLocaleString()}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Raw 데이터 탭 */}
        {tab === 'raw' && (
          <div style={{ padding: '0 20px' }}>
            {Object.entries(rawData).map(([key, value]) => (
              <div key={key} style={{ marginBottom: 16 }}>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 700,
                    color: T.accent,
                    marginBottom: 6,
                    fontFamily: 'monospace',
                  }}
                >
                  {key}
                </div>
                <div
                  style={{
                    background: T.bgSoft,
                    borderRadius: 10,
                    padding: 12,
                    fontSize: 11,
                    fontFamily: 'monospace',
                    color: T.textSec,
                    overflow: 'auto',
                    maxHeight: 200,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-all',
                  }}
                >
                  {JSON.stringify(JSON.parse(value), null, 2)}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 액션 버튼 */}
        <div style={{ padding: '20px' }}>
          <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
            <div style={{ flex: 1 }}>
              <SecondaryButton onClick={handleExportData}>데이터 내보내기</SecondaryButton>
            </div>
            <div style={{ flex: 1 }}>
              <SecondaryButton onClick={loadData}>새로고침</SecondaryButton>
            </div>
          </div>
          <button
            onClick={handleClearAll}
            style={{
              width: '100%',
              padding: '14px 0',
              border: `1px solid ${T.danger}`,
              borderRadius: 12,
              background: 'transparent',
              color: T.danger,
              fontSize: 15,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            모든 데이터 삭제
          </button>
        </div>
      </ScreenBody>

      {/* 지출 상세 시트 */}
      {selectedExpense && (
        <ExpenseDetailSheet
          expense={selectedExpense}
          onClose={() => setSelectedExpense(null)}
          onDelete={() => handleDeleteExpense(selectedExpense.id)}
        />
      )}
    </Screen>
  );
}

function ExpenseDetailSheet({
  expense,
  onClose,
  onDelete,
}: {
  expense: Expense;
  onClose: () => void;
  onDelete: () => void;
}) {
  const cat = getCategoryById(expense.category);

  const fields = [
    { label: 'ID', value: expense.id },
    { label: '날짜', value: expense.date },
    { label: '사용처', value: expense.merchant },
    { label: '금액', value: `₩${expense.amount.toLocaleString()}` },
    { label: '카테고리', value: cat?.name || expense.category },
    { label: '메모', value: expense.memo || '-' },
    { label: '소스', value: expense.source },
    { label: '생성일', value: expense.createdAt },
  ];

  return (
    <BottomSheet open onClose={onClose} title="지출 상세" height="70%">
      <div style={{ padding: '0 20px 24px' }}>
        <div
          style={{
            background: T.bgSoft,
            borderRadius: 12,
            overflow: 'hidden',
            marginBottom: 20,
          }}
        >
          {fields.map((f, i) => (
            <div
              key={f.label}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                padding: '12px 14px',
                borderBottom: i < fields.length - 1 ? `1px solid ${T.divider}` : 'none',
              }}
            >
              <span style={{ fontSize: 13, color: T.textSec, flexShrink: 0 }}>{f.label}</span>
              <span
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: T.text,
                  textAlign: 'right',
                  wordBreak: 'break-all',
                  marginLeft: 12,
                }}
              >
                {f.value}
              </span>
            </div>
          ))}
        </div>

        <button
          onClick={onDelete}
          style={{
            width: '100%',
            padding: '14px 0',
            border: 0,
            borderRadius: 12,
            background: T.danger,
            color: '#fff',
            fontSize: 15,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          이 항목 삭제
        </button>
      </div>
    </BottomSheet>
  );
}
