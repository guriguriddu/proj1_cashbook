'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Screen,
  ScreenBody,
  AppHeader,
  T,
  PrimaryButton,
  SecondaryButton,
  CatIcon,
  BottomSheet,
} from '@/components/ui';
import { detectMonths, parseExcel, type ParsedRow, type ExcelParseResult } from '@/lib/excel-import';
import {
  getExpenses,
  saveExpenses,
  generateId,
  getSettings,
  saveDefaultTransferCategory,
} from '@/lib/supabase-storage';
import type { Expense } from '@/types';
import { DEFAULT_CATEGORIES } from '@/constants/categories';

type Stage = 'upload' | 'processing' | 'review' | 'saving' | 'done';
type ReviewTab = 'include' | 'review' | 'excluded';

function formatWon(n: number) {
  return '₩' + Math.floor(n).toLocaleString('ko-KR');
}

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  include: { label: '포함', color: T.accent },
  dutch_pay: { label: 'n빵', color: '#F97316' },
  transfer_nudge: { label: '이체', color: '#F59E0B' },
  finance_nudge: { label: '금융', color: '#F59E0B' },
  charge_nudge: { label: '충전', color: '#F59E0B' },
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
  const [selectedMonths, setSelectedMonths] = useState<Set<string>>(new Set());
  const [result, setResult] = useState<ExcelParseResult | null>(null);
  const [activeTab, setActiveTab] = useState<ReviewTab>('include');
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [savedCount, setSavedCount] = useState(0);
  const [error, setError] = useState('');

  // 카테고리 커스터마이징
  const [defaultTransferCat, setDefaultTransferCat] = useState('food');
  const [rowCategories, setRowCategories] = useState<Record<number, string>>({});
  const [catSheetRow, setCatSheetRow] = useState<ParsedRow | null>(null);

  useEffect(() => {
    getSettings().then((s) => setDefaultTransferCat(s.defaultTransferCategory ?? 'food'));
  }, []);

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
        setSelectedMonths(new Set(months[0] ? [months[0]] : []));
      } catch {
        setError('파일을 읽을 수 없습니다. 뱅크샐러드 엑셀 파일인지 확인해주세요.');
      }
    };
    reader.readAsArrayBuffer(file);
  }, []);

  const handleAnalyze = useCallback(async () => {
    if (!fileBuffer || selectedMonths.size === 0) return;
    setStage('processing');
    setError('');
    setRowCategories({});
    try {
      const existing = await getExpenses();
      const parsed = parseExcel(fileBuffer, [...selectedMonths], existing, defaultTransferCat);
      setResult(parsed);

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
  }, [fileBuffer, selectedMonths, defaultTransferCat]);

  const toggleMonth = useCallback((m: string) => {
    setSelectedMonths((prev) => {
      const next = new Set(prev);
      if (next.has(m)) next.delete(m);
      else next.add(m);
      return next;
    });
  }, []);

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
        category: rowCategories[r.idx] ?? r.category,
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
  }, [result, selected, rowCategories]);

  const monthLabel = (m: string) => {
    const [y, mm] = m.split('-');
    return `${y}년 ${parseInt(mm)}월`;
  };

  const allMonthsSelected =
    availableMonths.length > 0 && selectedMonths.size === availableMonths.length;
  const selectedMonthsTitle = (() => {
    const arr = [...selectedMonths].sort().reverse();
    if (arr.length === 0) return '';
    if (arr.length === 1) return monthLabel(arr[0]);
    return `${arr.length}개월`;
  })();

  // 카테고리 변경 적용
  const applyCategoryChange = useCallback(
    async (row: ParsedRow, newCat: string, scope: 'this' | 'all') => {
      if (scope === 'all' && row.status === 'transfer_nudge') {
        await saveDefaultTransferCategory(newCat);
        setDefaultTransferCat(newCat);
        // 현재 결과의 모든 transfer_nudge 행에도 적용
        if (result) {
          const allRows = [...result.toInclude, ...result.needsReview];
          setRowCategories((prev) => {
            const next = { ...prev };
            allRows.filter((r) => r.status === 'transfer_nudge').forEach((r) => {
              next[r.idx] = newCat;
            });
            return next;
          });
        }
      } else {
        setRowCategories((prev) => ({ ...prev, [row.idx]: newCat }));
      }
      setCatSheetRow(null);
    },
    [result]
  );

  // ── Upload 화면 ──────────────────────────────────────────────
  if (stage === 'upload') {
    return (
      <Screen>
        <AppHeader title="엑셀 가져오기" onBack={() => router.push('/add')} />
        <ScreenBody>
          <div style={{ padding: '24px 20px', display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div style={{ background: T.accentSoft, borderRadius: 16, padding: '16px 18px' }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: T.accent, marginBottom: 6 }}>
                뱅크샐러드 엑셀 가져오기
              </div>
              <div style={{ fontSize: 13, color: T.text, lineHeight: 1.65 }}>
                뱅크샐러드 앱 → 더보기 → 내보내기에서 받은 <b>.xlsx</b> 파일을 올려주세요.{'\n'}
                지출·이체 항목을 자동 분류하고 중복 내역은 걸러드려요.
              </div>
            </div>

            <div>
              <input ref={fileRef} type="file" accept=".xlsx" onChange={handleFileChange} style={{ display: 'none' }} />
              <button
                onClick={() => fileRef.current?.click()}
                style={{
                  width: '100%', padding: '20px',
                  border: `2px dashed ${fileBuffer ? T.accent : T.divider}`,
                  borderRadius: 16, background: fileBuffer ? T.accentSoft : T.bgSoft,
                  cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
                }}
              >
                <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
                  <path d="M6 4l18 0 8 8v20a3 3 0 01-3 3H9a3 3 0 01-3-3V4z" stroke={fileBuffer ? T.accent : T.textTer} strokeWidth="2" fill="none" />
                  <path d="M24 4v8h8" stroke={fileBuffer ? T.accent : T.textTer} strokeWidth="2" strokeLinecap="round" />
                  <path d="M12 20h12M18 14v12" stroke={fileBuffer ? T.accent : T.textTer} strokeWidth="2" strokeLinecap="round" />
                </svg>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: fileBuffer ? T.accent : T.text }}>
                    {fileBuffer ? '파일 선택됨 ✓ (다시 선택하려면 탭)' : '.xlsx 파일 선택'}
                  </div>
                  <div style={{ fontSize: 12, color: T.textTer, marginTop: 4 }}>뱅크샐러드 내보내기 파일만 지원</div>
                </div>
              </button>
            </div>

            {availableMonths.length > 0 && (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: T.textSec }}>
                    가져올 월 선택 {selectedMonths.size > 0 && <span style={{ color: T.accent, fontWeight: 700 }}>({selectedMonths.size})</span>}
                  </div>
                  <button
                    onClick={() => setSelectedMonths(allMonthsSelected ? new Set() : new Set(availableMonths))}
                    style={{ border: 0, background: 'transparent', color: T.accent, fontSize: 13, fontWeight: 700, cursor: 'pointer', padding: 0, fontFamily: 'Pretendard, system-ui, sans-serif' }}
                  >
                    {allMonthsSelected ? '전체 해제' : '전체 선택'}
                  </button>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {availableMonths.map((m) => {
                    const on = selectedMonths.has(m);
                    return (
                      <button
                        key={m}
                        onClick={() => toggleMonth(m)}
                        style={{
                          padding: '10px 16px', borderRadius: 999,
                          border: on ? `2px solid ${T.accent}` : `1px solid ${T.divider}`,
                          background: on ? T.accentSoft : T.bg,
                          color: on ? T.accent : T.text,
                          fontSize: 14, fontWeight: 600, cursor: 'pointer',
                          fontFamily: 'Pretendard, system-ui, sans-serif',
                          display: 'flex', alignItems: 'center', gap: 6,
                        }}
                      >
                        {on && (
                          <svg width="12" height="10" viewBox="0 0 13 10" fill="none">
                            <path d="M1.5 5l3.5 3.5 7-7" stroke={T.accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                        {monthLabel(m)}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {error && (
              <div style={{ fontSize: 13, color: T.danger, fontWeight: 500, padding: '12px 16px', background: T.dangerSoft, borderRadius: 12 }}>
                {error}
              </div>
            )}

            <PrimaryButton onClick={handleAnalyze} disabled={!fileBuffer || selectedMonths.size === 0}>
              {selectedMonths.size > 1 ? `${selectedMonths.size}개월 분석하기` : '분석하기'}
            </PrimaryButton>
          </div>
        </ScreenBody>
      </Screen>
    );
  }

  // ── Processing ──────────────────────────────────────────────
  if (stage === 'processing') {
    return (
      <Screen>
        <AppHeader title="엑셀 가져오기" onBack={() => {}} />
        <div style={{ minHeight: '80vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
          <div style={{ width: 44, height: 44, border: `3px solid ${T.divider}`, borderTopColor: T.accent, borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
          <div style={{ fontSize: 15, color: T.textSec, fontWeight: 600 }}>분석 중...</div>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      </Screen>
    );
  }

  // ── Done ─────────────────────────────────────────────────────
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
            {selectedMonthsTitle} 내역이 가계부에 추가됐어요.
          </div>
          <div style={{ width: '100%', display: 'flex', gap: 8, marginTop: 8 }}>
            <SecondaryButton
              onClick={() => { setStage('upload'); setFileBuffer(null); setAvailableMonths([]); setSelectedMonths(new Set()); }}
              style={{ flex: 1 }}
            >
              다른 월 가져오기
            </SecondaryButton>
            <PrimaryButton onClick={() => router.push('/')} style={{ flex: 1 }}>홈으로</PrimaryButton>
          </div>
        </div>
      </Screen>
    );
  }

  // ── Review / Saving ──────────────────────────────────────────
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
      <AppHeader title={`${selectedMonthsTitle} 분석 결과`} onBack={() => setStage('upload')} />

      {/* 탭 */}
      <div style={{ padding: '12px 16px 4px', display: 'flex', gap: 6, borderBottom: `1px solid ${T.divider}` }}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              flex: 1, padding: '10px 4px', border: 0, borderRadius: 12,
              background: activeTab === tab.id ? (tab.color ? tab.color + '15' : T.bgMuted) : T.bgSoft,
              cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
              outline: activeTab === tab.id ? `2px solid ${tab.color || T.text}` : 'none',
              outlineOffset: -2, fontFamily: 'Pretendard, system-ui, sans-serif',
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
          <div style={{ padding: '48px 20px', textAlign: 'center', color: T.textTer, fontSize: 14 }}>항목이 없어요</div>
        ) : (
          <div style={{ padding: '8px 0' }}>
            {activeTab === 'review' && result.needsReview.some((r) => r.status === 'duplicate_suspect') && (
              <div style={{ margin: '8px 16px 12px', padding: '12px 14px', background: T.dangerSoft, borderRadius: 12, fontSize: 12, color: T.danger, fontWeight: 600, lineHeight: 1.6 }}>
                ⚠️ 중복 의심 항목은 기본적으로 미선택 상태입니다. 확인 후 필요하면 직접 선택하세요.
              </div>
            )}

            {tabRows[activeTab].map((row) => {
              const effectiveCat = rowCategories[row.idx] ?? row.category;
              const cat = DEFAULT_CATEGORIES.find((c) => c.id === effectiveCat);
              const isReviewable = activeTab !== 'excluded';
              const isChecked = selected.has(row.idx);
              const statusInfo = STATUS_LABEL[row.status] ?? { label: row.status, color: T.textTer };
              const isDutchPay = row.status === 'dutch_pay';

              return (
                <div
                  key={row.idx}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '13px 16px', borderBottom: `1px solid ${T.divider}`,
                    background: isChecked ? T.accentSoft + '40' : 'transparent',
                  }}
                >
                  {/* 체크박스 */}
                  {isReviewable && (
                    <button
                      onClick={() => toggleRow(row.idx)}
                      style={{
                        width: 22, height: 22, borderRadius: 6, flexShrink: 0,
                        background: isChecked ? T.accent : T.bgMuted,
                        border: isChecked ? 'none' : `1.5px solid ${T.divider}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        cursor: 'pointer', padding: 0,
                      }}
                    >
                      {isChecked && (
                        <svg width="13" height="10" viewBox="0 0 13 10" fill="none">
                          <path d="M1.5 5l3.5 3.5 7-7" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </button>
                  )}

                  {/* 카테고리 아이콘 — 이체 행은 탭하면 카테고리 변경 */}
                  <button
                    onClick={() => { if (isReviewable) setCatSheetRow(row); }}
                    disabled={!isReviewable}
                    style={{ background: 'transparent', border: 0, padding: 0, cursor: isReviewable ? 'pointer' : 'default', flexShrink: 0, position: 'relative' }}
                  >
                    <CatIcon catId={effectiveCat} size={36} icon={cat?.icon} color={cat?.color} />
                    {isReviewable && (
                      <div style={{
                        position: 'absolute', bottom: -2, right: -2,
                        width: 14, height: 14, borderRadius: 7,
                        background: T.bgSoft, border: `1px solid ${T.divider}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                          <path d="M5.5 1l1.5 1.5-4 4H1.5V5l4-4z" stroke={T.textTer} strokeWidth="1" strokeLinejoin="round" />
                        </svg>
                      </div>
                    )}
                  </button>

                  {/* 텍스트 */}
                  <button
                    onClick={() => isReviewable && toggleRow(row.idx)}
                    disabled={!isReviewable}
                    style={{ flex: 1, minWidth: 0, background: 'transparent', border: 0, padding: 0, cursor: isReviewable ? 'pointer' : 'default', textAlign: 'left' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                      <span style={{ fontSize: 14, fontWeight: 600, color: T.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {row.merchant}
                      </span>
                      <span style={{ flexShrink: 0, fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 999, background: statusInfo.color + '18', color: statusInfo.color }}>
                        {statusInfo.label}
                      </span>
                      {row.overseasSettled && (
                        <span style={{ flexShrink: 0, fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 999, background: T.accent + '18', color: T.accent }}>
                          해외 실청구
                        </span>
                      )}
                      {row.learnedCategory && (
                        <span style={{ flexShrink: 0, fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 999, background: T.accent + '18', color: T.accent }}>
                          학습
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 11, color: T.textTer, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      <span>{row.date}</span>
                      <span>·</span>
                      <span style={{ color: cat?.color }}>{cat?.name || row.rawBigCat}</span>
                      {row.payMethod && <><span>·</span><span style={{ overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 100 }}>{row.payMethod}</span></>}
                    </div>
                    {isDutchPay && row.dutchPay && (
                      <div style={{ fontSize: 11, color: '#F97316', fontWeight: 600, marginTop: 3 }}>
                        ↳ n빵 감지 · {row.dutchPay.peopleCount}명 · 원금 {formatWon(row.dutchPay.originalAmount)} → 내 몫 {formatWon(row.dutchPay.myShare)}
                      </div>
                    )}
                    {row.nudgeMessage && !isDutchPay && (
                      <div style={{ fontSize: 11, color: '#F59E0B', fontWeight: 600, marginTop: 3 }}>
                        ↳ {row.nudgeMessage}
                      </div>
                    )}
                    {row.excludeReason && (
                      <div style={{ fontSize: 11, color: T.textTer, marginTop: 3 }}>↳ {row.excludeReason}</div>
                    )}
                  </button>

                  {/* 금액 */}
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: T.text, fontVariantNumeric: 'tabular-nums' }}>
                      {formatWon(row.amount)}
                    </div>
                    {isDutchPay && row.dutchPay && (
                      <div style={{ fontSize: 10, color: T.textTer, textDecoration: 'line-through', fontVariantNumeric: 'tabular-nums' }}>
                        {formatWon(row.dutchPay.originalAmount)}
                      </div>
                    )}
                    {row.overseasSettled && row.overseasOriginalAmount != null && (
                      <div style={{ fontSize: 10, color: T.textTer, textDecoration: 'line-through', fontVariantNumeric: 'tabular-nums' }}>
                        {formatWon(row.overseasOriginalAmount)}
                      </div>
                    )}
                  </div>
                </div>
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
        <PrimaryButton onClick={handleSave} disabled={selectedCount === 0 || stage === 'saving'}>
          {stage === 'saving' ? '저장 중...' : `${selectedCount}건 저장하기`}
        </PrimaryButton>
      </div>

      {/* 카테고리 변경 시트 */}
      {catSheetRow && (
        <CategoryChangeSheet
          row={catSheetRow}
          currentCategory={rowCategories[catSheetRow.idx] ?? catSheetRow.category}
          onClose={() => setCatSheetRow(null)}
          onApply={applyCategoryChange}
        />
      )}
    </Screen>
  );
}

function CategoryChangeSheet({
  row,
  currentCategory,
  onClose,
  onApply,
}: {
  row: ParsedRow;
  currentCategory: string;
  onClose: () => void;
  onApply: (row: ParsedRow, cat: string, scope: 'this' | 'all') => void;
}) {
  const [selectedCat, setSelectedCat] = useState(currentCategory);
  const [scope, setScope] = useState<'this' | 'all'>('this');
  const isTransfer = row.status === 'transfer_nudge';
  const cats = DEFAULT_CATEGORIES.filter((c) => c.id !== 'other');

  return (
    <BottomSheet open onClose={onClose} title="카테고리 변경" height="80%">
      <div style={{ padding: '0 20px 24px' }}>
        {/* 카테고리 그리드 */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 16 }}>
          {cats.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCat(cat.id)}
              style={{
                border: selectedCat === cat.id ? `2px solid ${cat.color}` : `1px solid ${T.divider}`,
                padding: '10px 4px', borderRadius: 12, cursor: 'pointer',
                background: selectedCat === cat.id ? cat.color + '12' : 'transparent',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
              }}
            >
              <CatIcon catId={cat.id} size={28} icon={cat.icon} color={cat.color} />
              <span style={{ fontSize: 11, fontWeight: 600, color: selectedCat === cat.id ? cat.color : T.textSec }}>
                {cat.name}
              </span>
            </button>
          ))}
        </div>

        {/* 이체 행만: 이번만 / 앞으로 쭉 */}
        {isTransfer && (
          <div style={{ marginBottom: 16, borderTop: `1px solid ${T.divider}`, paddingTop: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: T.textTer, marginBottom: 10 }}>적용 범위</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {([
                { value: 'this' as const, label: '이번만', sub: '이 항목에만 적용' },
                { value: 'all' as const, label: '앞으로 쭉', sub: '타인 송금 기본 카테고리로 저장' },
              ]).map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setScope(opt.value)}
                  style={{
                    width: '100%', border: `2px solid ${scope === opt.value ? T.accent : T.divider}`,
                    borderRadius: 12, padding: '12px 14px', background: scope === opt.value ? T.accentSoft : T.bg,
                    cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 12,
                    fontFamily: 'Pretendard, system-ui, sans-serif',
                  }}
                >
                  <div style={{
                    width: 18, height: 18, borderRadius: 9, flexShrink: 0,
                    border: `2px solid ${scope === opt.value ? T.accent : T.divider}`,
                    background: scope === opt.value ? T.accent : 'transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {scope === opt.value && <div style={{ width: 6, height: 6, borderRadius: 3, background: '#fff' }} />}
                  </div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: T.text }}>{opt.label}</div>
                    <div style={{ fontSize: 11, color: T.textSec, marginTop: 2 }}>{opt.sub}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        <PrimaryButton onClick={() => onApply(row, selectedCat, scope)}>적용</PrimaryButton>
      </div>
    </BottomSheet>
  );
}
