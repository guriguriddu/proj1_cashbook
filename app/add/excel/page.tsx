'use client';

import { useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Screen,
  ScreenBody,
  AppHeader,
  T,
  PrimaryButton,
  SecondaryButton,
  CatIcon,
} from '@/components/ui';
import { detectMonths, parseExcel, type ParsedRow, type ExcelParseResult } from '@/lib/excel-import';
import { getExpenses, saveExpenses, generateId } from '@/lib/supabase-storage';
import type { Expense } from '@/types';
import { DEFAULT_CATEGORIES } from '@/constants/categories';

type Stage = 'upload' | 'processing' | 'review' | 'saving' | 'done';
type ReviewTab = 'include' | 'review' | 'excluded';

function formatWon(n: number) {
  return '₩' + Math.floor(n).toLocaleString('ko-KR');
}

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  include: { label: '포함', color: T.accent },
  transfer_nudge: { label: '이체', color: '#F59E0B' },
  finance_nudge: { label: '금융', color: '#F59E0B' },
  duplicate_suspect: { label: '중복의심', color: T.danger },
  refund_partial: { label: '부분환불', color: '#6366F1' },
  refund_cancel: { label: '상계됨', color: T.textTer },
  excluded: { label: '제외', color: T.textTer },
};

export default function ExcelImportPage() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [stage, setStage] = useState<Stage>('upload');
  const [fileBuffer, setFileBuffer] = useState<ArrayBuffer | null>(null);
  const [availableMonths, setAvailableMonths] = useState<string[]>([]);
  const [selectedMonth, setSelectedMonth] = useState('');
  const [result, setResult] = useState<ExcelParseResult | null>(null);
  const [activeTab, setActiveTab] = useState<ReviewTab>('include');
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [savedCount, setSavedCount] = useState(0);
  const [error, setError] = useState('');

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.endsWith('.xlsx')) {
      setError('.xlsx 파일만 지원됩니다.');
      return;
    }
    setError('');
    const reader = new FileReader();
    reader.onload = (ev) => {
      const buf = ev.target?.result as ArrayBuffer;
      setFileBuffer(buf);
      try {
        const months = detectMonths(buf);
        setAvailableMonths(months);
        setSelectedMonth(months[0] || '');
      } catch {
        setError('파일을 읽을 수 없습니다. 뱅크샐러드 엑셀 파일인지 확인해주세요.');
      }
    };
    reader.readAsArrayBuffer(file);
  }, []);

  const handleAnalyze = useCallback(async () => {
    if (!fileBuffer || !selectedMonth) return;
    setStage('processing');
    setError('');
    try {
      const existing = await getExpenses();
      const parsed = parseExcel(fileBuffer, selectedMonth, existing);
      setResult(parsed);

      // 기본 선택 세트 구성
      const initSelected = new Set<number>();
      [...parsed.toInclude, ...parsed.needsReview].forEach((r) => {
        if (r.selected) initSelected.add(r.idx);
      });
      setSelected(initSelected);
      setActiveTab('include');
      setStage('review');
    } catch (err) {
      setError((err as Error).message || '분석 중 오류가 발생했습니다.');
      setStage('upload');
    }
  }, [fileBuffer, selectedMonth]);

  const toggleRow = useCallback((idx: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  }, []);

  const handleSave = useCallback(async () => {
    if (!result) return;
    setStage('saving');
    try {
      const allRows = [...result.toInclude, ...result.needsReview];
      const toSave = allRows.filter((r) => selected.has(r.idx));
      const expenses: Expense[] = toSave.map((r) => ({
        id: generateId(),
        date: r.date,
        amount: r.amount,
        merchant: r.merchant,
        category: r.category,
        memo: r.rawBigCat !== r.rawSmallCat && r.rawSmallCat !== '미분류' ? r.rawSmallCat : '',
        source: 'manual' as const,
        createdAt: new Date().toISOString(),
      }));
      await saveExpenses(expenses);
      setSavedCount(expenses.length);
      setStage('done');
    } catch {
      setError('저장 중 오류가 발생했습니다. 다시 시도해주세요.');
      setStage('review');
    }
  }, [result, selected]);

  const monthLabel = (m: string) => {
    const [y, mm] = m.split('-');
    return `${y}년 ${parseInt(mm)}월`;
  };

  // ── Upload 화면 ──────────────────────────────────────────────
  if (stage === 'upload') {
    return (
      <Screen>
        <AppHeader title="엑셀 가져오기" onBack={() => router.push('/add')} />
        <ScreenBody>
          <div style={{ padding: '24px 20px', display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* 안내 */}
            <div style={{ background: T.accentSoft, borderRadius: 16, padding: '16px 18px' }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: T.accent, marginBottom: 6 }}>
                뱅크샐러드 엑셀 가져오기
              </div>
              <div style={{ fontSize: 13, color: T.text, lineHeight: 1.65 }}>
                뱅크샐러드 앱 → 더보기 → 내보내기에서 받은 <b>.xlsx</b> 파일을 올려주세요.{'\n'}
                지출·이체 항목을 자동 분류하고 중복 내역은 걸러드려요.
              </div>
            </div>

            {/* 파일 선택 */}
            <div>
              <input
                ref={fileRef}
                type="file"
                accept=".xlsx"
                onChange={handleFileChange}
                style={{ display: 'none' }}
              />
              <button
                onClick={() => fileRef.current?.click()}
                style={{
                  width: '100%',
                  padding: '20px',
                  border: `2px dashed ${fileBuffer ? T.accent : T.divider}`,
                  borderRadius: 16,
                  background: fileBuffer ? T.accentSoft : T.bgSoft,
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 10,
                }}
              >
                <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
                  <rect x="6" y="4" width="18" height="28" rx="3" stroke={fileBuffer ? T.accent : T.textTer} strokeWidth="2" />
                  <path d="M24 4v8h8" stroke={fileBuffer ? T.accent : T.textTer} strokeWidth="2" strokeLinecap="round" />
                  <path d="M6 4l18 0 8 8v20a3 3 0 01-3 3H9a3 3 0 01-3-3V4z" stroke={fileBuffer ? T.accent : T.textTer} strokeWidth="2" fill="none" />
                  <path d="M12 20h12M18 14v12" stroke={fileBuffer ? T.accent : T.textTer} strokeWidth="2" strokeLinecap="round" />
                </svg>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: fileBuffer ? T.accent : T.text }}>
                    {fileBuffer ? '파일 선택됨 ✓ (다시 선택하려면 탭)' : '.xlsx 파일 선택'}
                  </div>
                  <div style={{ fontSize: 12, color: T.textTer, marginTop: 4 }}>
                    뱅크샐러드 내보내기 파일만 지원
                  </div>
                </div>
              </button>
            </div>

            {/* 월 선택 */}
            {availableMonths.length > 0 && (
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: T.textSec, marginBottom: 10 }}>
                  가져올 월 선택
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {availableMonths.map((m) => (
                    <button
                      key={m}
                      onClick={() => setSelectedMonth(m)}
                      style={{
                        padding: '10px 16px',
                        borderRadius: 999,
                        border: selectedMonth === m ? `2px solid ${T.accent}` : `1px solid ${T.divider}`,
                        background: selectedMonth === m ? T.accentSoft : T.bg,
                        color: selectedMonth === m ? T.accent : T.text,
                        fontSize: 14,
                        fontWeight: 600,
                        cursor: 'pointer',
                        fontFamily: 'Pretendard, system-ui, sans-serif',
                      }}
                    >
                      {monthLabel(m)}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {error && (
              <div style={{ fontSize: 13, color: T.danger, fontWeight: 500, padding: '12px 16px', background: T.dangerSoft, borderRadius: 12 }}>
                {error}
              </div>
            )}

            <PrimaryButton
              onClick={handleAnalyze}
              disabled={!fileBuffer || !selectedMonth}
            >
              분석하기
            </PrimaryButton>
          </div>
        </ScreenBody>
      </Screen>
    );
  }

  // ── Processing 화면 ──────────────────────────────────────────
  if (stage === 'processing') {
    return (
      <Screen>
        <AppHeader title="엑셀 가져오기" onBack={() => {}} />
        <div style={{ minHeight: '80vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
          <div style={{
            width: 44, height: 44,
            border: `3px solid ${T.divider}`,
            borderTopColor: T.accent,
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
          }} />
          <div style={{ fontSize: 15, color: T.textSec, fontWeight: 600 }}>분석 중...</div>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      </Screen>
    );
  }

  // ── Done 화면 ────────────────────────────────────────────────
  if (stage === 'done') {
    return (
      <Screen>
        <AppHeader title="가져오기 완료" onBack={() => router.push('/')} />
        <div style={{ minHeight: '70vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20, padding: '0 24px' }}>
          <div style={{ fontSize: 48 }}>✅</div>
          <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em', textAlign: 'center' }}>
            {savedCount}건 저장 완료
          </div>
          <div style={{ fontSize: 14, color: T.textSec, textAlign: 'center', lineHeight: 1.6 }}>
            {monthLabel(selectedMonth)} 내역이 가계부에 추가됐어요.
          </div>
          <div style={{ width: '100%', display: 'flex', gap: 8, marginTop: 8 }}>
            <SecondaryButton onClick={() => { setStage('upload'); setFileBuffer(null); setAvailableMonths([]); setSelectedMonth(''); }} style={{ flex: 1 }}>
              다른 월 가져오기
            </SecondaryButton>
            <PrimaryButton onClick={() => router.push('/')} style={{ flex: 1 }}>
              홈으로
            </PrimaryButton>
          </div>
        </div>
      </Screen>
    );
  }

  // ── Review / Saving 화면 ──────────────────────────────────────
  if (!result) return null;

  const allRows = [...result.toInclude, ...result.needsReview];
  const selectedCount = allRows.filter((r) => selected.has(r.idx)).length;

  const tabRows: Record<ReviewTab, ParsedRow[]> = {
    include: result.toInclude,
    review: result.needsReview,
    excluded: result.excluded,
  };

  const tabs: { id: ReviewTab; label: string; count: number; color?: string }[] = [
    { id: 'include', label: '가져올 항목', count: result.toInclude.length, color: T.accent },
    { id: 'review', label: '확인 필요', count: result.needsReview.length, color: '#F59E0B' },
    { id: 'excluded', label: '제외됨', count: result.excluded.length },
  ];

  return (
    <Screen>
      <AppHeader
        title={`${monthLabel(selectedMonth)} 분석 결과`}
        onBack={() => setStage('upload')}
      />

      {/* 요약 칩 */}
      <div style={{ padding: '12px 16px 4px', display: 'flex', gap: 6, borderBottom: `1px solid ${T.divider}` }}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              flex: 1,
              padding: '10px 4px',
              border: 0,
              borderRadius: 12,
              background: activeTab === tab.id ? (tab.color ? tab.color + '15' : T.bgMuted) : T.bgSoft,
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 2,
              outline: activeTab === tab.id ? `2px solid ${tab.color || T.text}` : 'none',
              outlineOffset: -2,
              fontFamily: 'Pretendard, system-ui, sans-serif',
            }}
          >
            <span style={{ fontSize: 18, fontWeight: 800, color: tab.color || T.textSec, fontVariantNumeric: 'tabular-nums' }}>
              {tab.count}
            </span>
            <span style={{ fontSize: 10, fontWeight: 700, color: tab.color || T.textTer, letterSpacing: '-0.01em' }}>
              {tab.label}
            </span>
          </button>
        ))}
      </div>

      <ScreenBody padBottom={100}>
        {tabRows[activeTab].length === 0 ? (
          <div style={{ padding: '48px 20px', textAlign: 'center', color: T.textTer, fontSize: 14 }}>
            항목이 없어요
          </div>
        ) : (
          <div style={{ padding: '8px 0' }}>
            {/* 확인필요 탭 안내 */}
            {activeTab === 'review' && result.needsReview.some((r) => r.status === 'duplicate_suspect') && (
              <div style={{ margin: '8px 16px 12px', padding: '12px 14px', background: T.dangerSoft, borderRadius: 12, fontSize: 12, color: T.danger, fontWeight: 600, lineHeight: 1.6 }}>
                ⚠️ 중복 의심 항목은 기본적으로 미선택 상태입니다. 확인 후 필요하면 직접 선택하세요.
              </div>
            )}

            {tabRows[activeTab].map((row) => {
              const cat = DEFAULT_CATEGORIES.find((c) => c.id === row.category);
              const isReviewable = activeTab !== 'excluded';
              const isChecked = selected.has(row.idx);
              const statusInfo = STATUS_LABEL[row.status];

              return (
                <button
                  key={row.idx}
                  onClick={() => isReviewable && toggleRow(row.idx)}
                  disabled={!isReviewable}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '13px 16px',
                    border: 0,
                    background: isChecked ? T.accentSoft + '40' : 'transparent',
                    cursor: isReviewable ? 'pointer' : 'default',
                    textAlign: 'left',
                    borderBottom: `1px solid ${T.divider}`,
                  }}
                >
                  {/* 체크박스 */}
                  {isReviewable && (
                    <div
                      style={{
                        width: 22, height: 22, borderRadius: 6, flexShrink: 0,
                        background: isChecked ? T.accent : T.bgMuted,
                        border: isChecked ? 'none' : `1.5px solid ${T.divider}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}
                    >
                      {isChecked && (
                        <svg width="13" height="10" viewBox="0 0 13 10" fill="none">
                          <path d="M1.5 5l3.5 3.5 7-7" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </div>
                  )}

                  {/* 카테고리 아이콘 */}
                  <CatIcon catId={row.category} size={36} icon={cat?.icon} color={cat?.color} />

                  {/* 텍스트 */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                      <span style={{
                        fontSize: 14, fontWeight: 600, color: T.text,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {row.merchant}
                      </span>
                      <span style={{
                        flexShrink: 0, fontSize: 10, fontWeight: 700,
                        padding: '2px 6px', borderRadius: 999,
                        background: statusInfo.color + '18', color: statusInfo.color,
                      }}>
                        {statusInfo.label}
                      </span>
                    </div>
                    <div style={{ fontSize: 11, color: T.textTer, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      <span>{row.date}</span>
                      <span>·</span>
                      <span>{cat?.name || row.rawBigCat}</span>
                      {row.payMethod && <><span>·</span><span style={{ overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 100 }}>{row.payMethod}</span></>}
                    </div>
                    {row.nudgeMessage && (
                      <div style={{ fontSize: 11, color: '#F59E0B', fontWeight: 600, marginTop: 3 }}>
                        ↳ {row.nudgeMessage}
                      </div>
                    )}
                    {row.excludeReason && (
                      <div style={{ fontSize: 11, color: T.textTer, marginTop: 3 }}>
                        ↳ {row.excludeReason}
                      </div>
                    )}
                  </div>

                  {/* 금액 */}
                  <div style={{ fontSize: 14, fontWeight: 700, color: T.text, flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>
                    {formatWon(row.amount)}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </ScreenBody>

      {/* 하단 저장 버튼 */}
      <div style={{
        position: 'fixed', left: 0, right: 0, bottom: 0,
        padding: '12px 20px 28px',
        background: 'linear-gradient(to top, rgba(255,255,255,1) 60%, rgba(255,255,255,0))',
        maxWidth: 512, margin: '0 auto', zIndex: 100,
      }}>
        <PrimaryButton
          onClick={handleSave}
          disabled={selectedCount === 0 || stage === 'saving'}
        >
          {stage === 'saving' ? '저장 중...' : `${selectedCount}건 저장하기`}
        </PrimaryButton>
      </div>
    </Screen>
  );
}
