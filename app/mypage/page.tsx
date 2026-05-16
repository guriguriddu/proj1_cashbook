'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Screen,
  ScreenBody,
  AppHeader,
  T,
  BottomSheet,
  PrimaryButton,
  ProgressBar,
} from '@/components/ui';
import { useBudget } from '@/hooks/useSupabaseData';
import { useAuth } from '@/contexts/AuthContext';

// 금액 포맷 함수
function formatWon(n: number): string {
  return '₩' + Math.abs(n).toLocaleString('ko-KR');
}

function formatGoalAmount(n: number): string {
  if (n >= 100000000) {
    const eok = Math.floor(n / 100000000);
    const man = Math.floor((n % 100000000) / 10000);
    return man > 0 ? `${eok}억 ${man.toLocaleString()}만원` : `${eok}억원`;
  }
  if (n >= 10000) return `${Math.floor(n / 10000).toLocaleString()}만원`;
  return `${n.toLocaleString()}원`;
}

export default function MyPage() {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const { budget, loading: budgetLoading } = useBudget();

  const handleLogout = async () => {
    await signOut();
    router.push('/login');
  };

  // 목표 설정 상태
  const [monthlyIncome, setMonthlyIncome] = useState(4_000_000);
  const [targetAmount, setTargetAmount] = useState(100_000_000);
  const [currentAssets, setCurrentAssets] = useState(0);
  const [targetMonths, setTargetMonths] = useState(36);

  // 편집 상태
  const [editing, setEditing] = useState<string | null>(null);
  const [goalSheetOpen, setGoalSheetOpen] = useState(false);

  // 예산에서 계산
  const totalBudget = budget ? Object.values(budget.categoryBudgets).reduce((a, v) => a + v, 0) : 0;
  const finance = budget ? (budget.categoryBudgets['finance'] || 0) : 0;
  const monthlyBudget = totalBudget - finance;
  const savingsInvestmentBudget = finance;

  // 계산된 값들
  const yearlyIncome = monthlyIncome * 12;
  const monthlySavings = monthlyIncome - monthlyBudget;
  const yearlySavings = monthlySavings * 12;
  const savingsRate = monthlyIncome > 0 ? (monthlySavings / monthlyIncome) * 100 : 0;

  const gap = Math.max(0, targetAmount - currentAssets);
  const requiredMonthly = targetMonths > 0 ? gap / targetMonths : 0;
  const shortfall = requiredMonthly - monthlySavings;

  const projectedMonths = monthlySavings > 0
    ? Math.ceil(gap / monthlySavings)
    : Infinity;

  // 결과 상태
  let resultTone: 'success' | 'warn' | 'danger';
  let resultLabel: string;
  let resultDetail: string;

  if (monthlySavings <= 0) {
    resultTone = 'danger';
    resultLabel = '저축 불가';
    resultDetail = '월 예산이 월 수익을 넘었어요. 예산 탭에서 조정해주세요.';
  } else if (shortfall <= 0) {
    resultTone = 'success';
    resultLabel = '달성 가능';
    resultDetail = `매달 ${formatWon(-shortfall)}의 여유가 있어요.`;
  } else if (shortfall <= monthlySavings * 0.4) {
    resultTone = 'warn';
    resultLabel = '조정 필요';
    resultDetail = `목표 달성을 위해 월 ${formatWon(shortfall)} 추가 필요`;
  } else {
    resultTone = 'danger';
    resultLabel = '달성 어려움';
    resultDetail = `목표 달성을 위해 월 ${formatWon(shortfall)} 추가 필요`;
  }

  // 필드 설정
  const fields: Record<string, {
    title: string;
    unit: string;
    step: number;
    value: number;
    set: (v: number) => void;
    min?: number;
    max?: number;
    presets: { value: number; label: string }[];
  }> = {
    monthlyIncome: {
      title: '월 실수익',
      unit: '원',
      step: 100000,
      value: monthlyIncome,
      set: setMonthlyIncome,
      presets: [
        { value: 2500000, label: '250만' },
        { value: 3000000, label: '300만' },
        { value: 4000000, label: '400만' },
        { value: 5000000, label: '500만' },
        { value: 7000000, label: '700만' },
      ],
    },
    targetAmount: {
      title: '목표 금액',
      unit: '원',
      step: 1000000,
      value: targetAmount,
      set: setTargetAmount,
      presets: [
        { value: 50000000, label: '5,000만' },
        { value: 100000000, label: '1억' },
        { value: 200000000, label: '2억' },
        { value: 500000000, label: '5억' },
      ],
    },
    currentAssets: {
      title: '현재 보유 자산',
      unit: '원',
      step: 1000000,
      value: currentAssets,
      set: setCurrentAssets,
      presets: [
        { value: 0, label: '0원' },
        { value: 10000000, label: '1,000만' },
        { value: 30000000, label: '3,000만' },
        { value: 50000000, label: '5,000만' },
      ],
    },
    targetMonths: {
      title: '목표 기간',
      unit: '개월',
      step: 1,
      min: 1,
      max: 600,
      value: targetMonths,
      set: setTargetMonths,
      presets: [
        { value: 12, label: '1년' },
        { value: 24, label: '2년' },
        { value: 36, label: '3년' },
        { value: 60, label: '5년' },
        { value: 120, label: '10년' },
      ],
    },
  };

  if (budgetLoading) {
    return (
      <Screen>
        <div style={{ padding: 20, color: T.textSec }}>로딩 중...</div>
      </Screen>
    );
  }

  return (
    <Screen>
      <AppHeader title="마이페이지" onBack={() => router.push('/')} />

      <ScreenBody>
        {/* 0. 프로필 섹션 */}
        <div style={{ padding: '4px 20px 20px' }}>
          <div
            style={{
              background: T.bg,
              border: `1px solid ${T.divider}`,
              borderRadius: 18,
              padding: '20px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: 26,
                  background: T.accentSoft,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 24,
                }}
              >
                {user?.user_metadata?.avatar_url ? (
                  <img
                    src={user.user_metadata.avatar_url}
                    alt="프로필"
                    style={{ width: 52, height: 52, borderRadius: 26, objectFit: 'cover' }}
                  />
                ) : (
                  '👤'
                )}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 17,
                    fontWeight: 700,
                    color: T.text,
                    letterSpacing: '-0.02em',
                    marginBottom: 2,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {user?.user_metadata?.full_name || user?.email?.split('@')[0] || '사용자'}
                </div>
                <div
                  style={{
                    fontSize: 13,
                    color: T.textSec,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {user?.email || ''}
                </div>
              </div>
            </div>
            <button
              onClick={handleLogout}
              style={{
                width: '100%',
                marginTop: 16,
                padding: '12px 16px',
                border: `1px solid ${T.divider}`,
                borderRadius: 12,
                background: T.bgMuted,
                color: T.textSec,
                fontSize: 14,
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
              }}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path
                  d="M6 14H3.33C2.97 14 2.63 13.86 2.38 13.61C2.13 13.36 2 13.02 2 12.67V3.33C2 2.97 2.14 2.63 2.38 2.38C2.63 2.13 2.97 2 3.33 2H6M10.67 11.33L14 8L10.67 4.67M14 8H6"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              로그아웃
            </button>
          </div>
        </div>

        {/* 1. 목표 설정 카드 (GoalHero) */}
        <div style={{ padding: '0 20px 16px' }}>
          <GoalHero
            targetAmount={targetAmount}
            currentAssets={currentAssets}
            targetMonths={targetMonths}
            onEdit={() => setGoalSheetOpen(true)}
          />
        </div>

        {/* 2. 월 수익 섹션 */}
        <CardSection title="월 수익">
          <EditableRow
            label="월 실수익"
            value={formatWon(monthlyIncome)}
            onTap={() => setEditing('monthlyIncome')}
            primary
          />
          <ReadOnlyRow
            label="연 실수익"
            value={formatWon(yearlyIncome)}
            sub="월 실수익 × 12 자동 계산"
          />
        </CardSection>

        {/* 3. 월 예상 저축액 섹션 */}
        <CardSection title="월 예상 저축액">
          {savingsInvestmentBudget > 0 && (
            <div
              style={{
                margin: '0 12px 6px',
                padding: '10px 12px',
                background: T.accentSoft,
                borderRadius: 10,
                display: 'flex',
                gap: 8,
                alignItems: 'flex-start',
                fontSize: 12,
                lineHeight: 1.5,
                color: '#0F5132',
                fontWeight: 500,
              }}
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0, marginTop: 1 }}>
                <circle cx="7" cy="7" r="6" stroke="#0F5132" strokeWidth="1.4" />
                <path d="M7 6v4M7 4v.5" stroke="#0F5132" strokeWidth="1.4" strokeLinecap="round" />
              </svg>
              <span>
                예산 안의 <b>저축·투자 {formatWon(savingsInvestmentBudget)}</b>은 월 예산에서 빼고, 저축액에 자동으로 포함했어요.
              </span>
            </div>
          )}
          <FormulaRow label="월 수익" value={formatWon(monthlyIncome)} />
          <FormulaRow
            label="월 예산"
            value={formatWon(monthlyBudget)}
            action="예산 탭"
            external
            onTap={() => router.push('/budget')}
          />
          <DividerRow />
          <FormulaRow
            label="월 예상 저축액"
            value={formatWon(monthlySavings)}
            valueColor={monthlySavings < 0 ? T.danger : T.accent}
            big
          />

          {/* 저축률 진행바 */}
          <div style={{ padding: '8px 16px 14px' }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'baseline',
                marginBottom: 6,
                fontSize: 12,
                fontWeight: 600,
                color: T.textSec,
              }}
            >
              <span>저축률</span>
              <span
                style={{
                  color: savingsRate < 0 ? T.danger : savingsRate >= 30 ? T.accent : T.text,
                  fontWeight: 700,
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {Math.max(0, savingsRate).toFixed(1)}%
              </span>
            </div>
            <ProgressBar value={Math.max(0, savingsRate)} height={6} />
            <div style={{ marginTop: 8, fontSize: 11, color: T.textTer }}>
              연 예상 저축액 <b style={{ color: T.textSec, fontWeight: 700 }}>{formatWon(yearlySavings)}</b>
            </div>
          </div>
        </CardSection>

        {/* 4. 목표 달성 시뮬레이션 섹션 */}
        <CardSection title="목표 달성 시뮬레이션">
          <SimulationResult
            tone={resultTone}
            label={resultLabel}
            detail={resultDetail}
            monthlySavings={monthlySavings}
            requiredMonthly={requiredMonthly}
            projectedMonths={projectedMonths}
            targetMonths={targetMonths}
          />
        </CardSection>

        {/* 5. 목표 달성을 위한 옵션 */}
        {shortfall > 0 && monthlySavings > 0 && (
          <CardSection title="목표 달성을 위한 옵션" sub="아래 중 하나를 선택해보세요">
            <SolutionRow
              num="1"
              title="소비를 줄이기"
              desc={`월 예산에서 ${formatWon(shortfall)} 절감`}
              detail={`줄어든 월 예산 ${formatWon(monthlyBudget - shortfall)}`}
              tone="accent"
            />
            <SolutionRow
              num="2"
              title="수익을 늘리기"
              desc={`월 ${formatWon(shortfall)} 추가 수익 필요`}
              detail={`부수입·이직 등으로 월 실수익 ${formatWon(monthlyIncome + shortfall)} 만들기`}
              tone="blue"
            />
            <SolutionRow
              num="3"
              title="투자 수익으로 보완"
              desc={`월 ${formatWon(shortfall)} 추가 수익 필요`}
              detail={`참고: 1억 원 운용 시 연 ${Math.min(999, (shortfall * 12) / 100000000 * 100).toFixed(1)}% 수익률에 해당`}
              tone="warn"
            />
            <SolutionRow
              num="4"
              title="목표 기간 늘리기"
              desc={`최소 ${Math.max(targetMonths + 1, projectedMonths)}개월 (약 ${(Math.max(targetMonths + 1, projectedMonths) / 12).toFixed(1)}년)`}
              detail={`현재 페이스 기준 ${projectedMonths}개월이면 달성`}
              tone="neutral"
            />
            <div
              style={{
                padding: '14px 16px',
                borderTop: `1px solid ${T.divider}`,
                background: T.bgSoft,
                fontSize: 11,
                color: T.textTer,
                lineHeight: 1.6,
              }}
            >
              ※ 위 시뮬레이션은 단순 산술 계산이며, 투자 수익을 보장하지 않습니다.
            </div>
          </CardSection>
        )}

        <div style={{ height: 20 }} />
      </ScreenBody>

      {/* 편집 시트 */}
      {editing && (() => {
        const f = fields[editing];
        return (
          <NumberEditSheet
            title={f.title}
            value={f.value}
            unit={f.unit}
            min={f.min}
            max={f.max}
            step={f.step}
            presets={f.presets}
            onClose={() => setEditing(null)}
            onSave={(v) => {
              f.set(v);
              setEditing(null);
            }}
          />
        );
      })()}

      {/* 목표 수정 시트 */}
      {goalSheetOpen && (
        <GoalEditSheet
          targetAmount={targetAmount}
          targetMonths={targetMonths}
          currentAssets={currentAssets}
          onPick={(key) => setEditing(key)}
          onClose={() => setGoalSheetOpen(false)}
        />
      )}
    </Screen>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 컴포넌트들
// ─────────────────────────────────────────────────────────────────────────────

function GoalHero({
  targetAmount,
  currentAssets,
  targetMonths,
  onEdit,
}: {
  targetAmount: number;
  currentAssets: number;
  targetMonths: number;
  onEdit: () => void;
}) {
  return (
    <div
      style={{
        background: T.bg,
        border: `1px solid ${T.divider}`,
        borderRadius: 18,
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          padding: '20px 20px 18px',
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          gap: 12,
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: T.accent,
                padding: '3px 8px',
                borderRadius: 999,
                background: T.accentSoft,
                letterSpacing: '-0.01em',
              }}
            >
              🎯 목표
            </span>
          </div>
          <div
            style={{
              fontSize: 28,
              fontWeight: 800,
              color: T.text,
              letterSpacing: '-0.03em',
              lineHeight: 1.1,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {formatGoalAmount(targetAmount)}
          </div>
        </div>
        <button
          onClick={onEdit}
          style={{
            flexShrink: 0,
            padding: '7px 14px',
            borderRadius: 999,
            background: T.text,
            color: '#fff',
            border: 0,
            cursor: 'pointer',
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: '-0.01em',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            fontFamily: 'Pretendard, system-ui, sans-serif',
          }}
        >
          <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
            <path d="M7.5 1l2.5 2.5L4 9.5H1V6.5L7.5 1z" stroke="#fff" strokeWidth="1.3" />
          </svg>
          수정
        </button>
      </div>

      <div style={{ height: 1, background: T.divider, margin: '0 16px' }} />

      <div
        style={{
          padding: '12px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <span style={{ fontSize: 13, fontWeight: 600, color: T.textSec }}>목표 기간</span>
        <span
          style={{
            fontSize: 14,
            fontWeight: 700,
            color: T.text,
            fontVariantNumeric: 'tabular-nums',
            letterSpacing: '-0.02em',
          }}
        >
          {targetMonths}개월 · 약 {(targetMonths / 12).toFixed(1)}년
        </span>
      </div>

      <div style={{ height: 1, background: T.divider, margin: '0 16px' }} />

      <div
        style={{
          padding: '12px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <span style={{ fontSize: 13, fontWeight: 600, color: T.textSec }}>현재 보유 자산</span>
        <span
          style={{
            fontSize: 14,
            fontWeight: 700,
            color: T.text,
            fontVariantNumeric: 'tabular-nums',
            letterSpacing: '-0.02em',
          }}
        >
          {formatWon(currentAssets)}
        </span>
      </div>
    </div>
  );
}

function CardSection({
  title,
  sub,
  children,
}: {
  title: string;
  sub?: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ padding: '0 20px 14px' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          padding: '0 4px 8px',
        }}
      >
        <div style={{ fontSize: 13, fontWeight: 700, color: T.textTer, letterSpacing: '-0.01em' }}>
          {title}
        </div>
        {sub && <div style={{ fontSize: 11, color: T.textMuted, fontWeight: 500 }}>{sub}</div>}
      </div>
      <div
        style={{
          background: T.bg,
          border: `1px solid ${T.divider}`,
          borderRadius: 16,
          overflow: 'hidden',
        }}
      >
        {children}
      </div>
    </div>
  );
}

function EditableRow({
  label,
  value,
  sub,
  onTap,
  primary,
}: {
  label: string;
  value: string;
  sub?: string;
  onTap?: () => void;
  primary?: boolean;
}) {
  return (
    <button
      onClick={onTap}
      disabled={!onTap}
      style={{
        width: '100%',
        border: 0,
        background: 'transparent',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '14px 16px',
        cursor: onTap ? 'pointer' : 'default',
        textAlign: 'left',
        borderBottom: `1px solid ${T.divider}`,
      }}
    >
      <div>
        <div style={{ fontSize: 14, color: T.text, fontWeight: 600, letterSpacing: '-0.01em' }}>
          {label}
        </div>
        {sub && <div style={{ fontSize: 11, color: T.textTer, marginTop: 2 }}>{sub}</div>}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span
          style={{
            fontSize: primary ? 17 : 15,
            fontWeight: 700,
            color: T.text,
            letterSpacing: '-0.02em',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {value}
        </span>
        {onTap && (
          <svg width="6" height="10" viewBox="0 0 6 10" style={{ flexShrink: 0 }}>
            <path
              d="M1 1l4 4-4 4"
              stroke={T.textMuted}
              strokeWidth="1.5"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </div>
    </button>
  );
}

function ReadOnlyRow({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '14px 16px',
        borderBottom: `1px solid ${T.divider}`,
      }}
    >
      <div>
        <div style={{ fontSize: 14, color: T.textSec, fontWeight: 600 }}>{label}</div>
        {sub && <div style={{ fontSize: 11, color: T.textTer, marginTop: 2 }}>{sub}</div>}
      </div>
      <span
        style={{
          fontSize: 15,
          fontWeight: 700,
          color: T.textSec,
          fontVariantNumeric: 'tabular-nums',
          letterSpacing: '-0.02em',
        }}
      >
        {value}
      </span>
    </div>
  );
}

function FormulaRow({
  label,
  value,
  valueColor,
  big,
  action,
  external,
  onTap,
}: {
  label: string;
  value: string;
  valueColor?: string;
  big?: boolean;
  action?: string;
  external?: boolean;
  onTap?: () => void;
}) {
  return (
    <button
      onClick={onTap}
      disabled={!onTap}
      style={{
        width: '100%',
        border: 0,
        background: 'transparent',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: big ? '14px 16px' : '12px 16px',
        cursor: onTap ? 'pointer' : 'default',
        textAlign: 'left',
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: big ? 14 : 13,
            fontWeight: big ? 700 : 600,
            color: big ? T.text : T.textSec,
            letterSpacing: '-0.01em',
          }}
        >
          {label}
        </div>
      </div>
      <span
        style={{
          fontSize: big ? 20 : 15,
          fontWeight: big ? 800 : 700,
          color: valueColor || T.text,
          letterSpacing: '-0.02em',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {value}
      </span>
      {onTap && action && (
        <span
          style={{
            flexShrink: 0,
            padding: '4px 8px',
            borderRadius: 999,
            background: external ? T.bgSoft : T.bgMuted,
            color: T.textSec,
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '-0.01em',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 3,
          }}
        >
          {action}
          {external && (
            <svg width="9" height="9" viewBox="0 0 9 9" fill="none">
              <path
                d="M2 1h6v6M8 1L1 8"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}
        </span>
      )}
    </button>
  );
}

function DividerRow() {
  return <div style={{ height: 1, background: T.divider, margin: '4px 16px' }} />;
}

function SimulationResult({
  tone,
  label,
  detail,
  monthlySavings,
  requiredMonthly,
  projectedMonths,
  targetMonths,
}: {
  tone: 'success' | 'warn' | 'danger';
  label: string;
  detail: string;
  monthlySavings: number;
  requiredMonthly: number;
  projectedMonths: number;
  targetMonths: number;
}) {
  const palette = {
    success: { bg: T.accentSoft, fg: '#0F5132', accent: T.accent },
    warn: { bg: T.warnSoft, fg: '#92400E', accent: '#B45309' },
    danger: { bg: T.dangerSoft, fg: '#991B1B', accent: T.danger },
  }[tone];

  let projectedCopy = null;
  if (monthlySavings > 0 && projectedMonths < 9999) {
    const years = Math.floor(projectedMonths / 12);
    const rem = projectedMonths % 12;
    const dur =
      projectedMonths >= 24
        ? `${years}년 ${rem}개월`
        : projectedMonths > 600
        ? `${years}년 이상`
        : `${projectedMonths}개월`;
    const delta = projectedMonths - targetMonths;
    projectedCopy =
      delta <= 0
        ? `현재 페이스로 약 ${dur} 뒤 달성 (목표 내 가능)`
        : `현재 페이스로 약 ${dur} 뒤 달성 (목표보다 ${delta}개월 늦음)`;
  }

  return (
    <>
      <div
        style={{
          margin: '4px 12px 0',
          padding: '14px 14px',
          background: palette.bg,
          borderRadius: 12,
        }}
      >
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: palette.fg,
            marginBottom: 6,
            letterSpacing: '-0.01em',
          }}
        >
          {label}
        </div>
        <div
          style={{
            fontSize: 15,
            fontWeight: 700,
            color: palette.fg,
            letterSpacing: '-0.02em',
            lineHeight: 1.4,
          }}
        >
          {detail}
        </div>
        {projectedCopy && (
          <div
            style={{
              marginTop: 8,
              fontSize: 12,
              color: palette.fg,
              opacity: 0.85,
              fontWeight: 500,
              lineHeight: 1.45,
            }}
          >
            {projectedCopy}
          </div>
        )}
      </div>

      <div style={{ padding: '12px 16px 4px' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            justifyContent: 'space-between',
            padding: '6px 0',
            fontSize: 13,
          }}
        >
          <span style={{ color: T.textSec, fontWeight: 600 }}>필요한 월 저축액</span>
          <span
            style={{
              color: T.text,
              fontWeight: 700,
              fontVariantNumeric: 'tabular-nums',
              letterSpacing: '-0.02em',
            }}
          >
            {formatWon(requiredMonthly)}
          </span>
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            justifyContent: 'space-between',
            padding: '6px 0 12px',
            fontSize: 13,
          }}
        >
          <span style={{ color: T.textSec, fontWeight: 600 }}>현재 월 저축 가능액</span>
          <span
            style={{
              color: monthlySavings > 0 ? T.accent : T.danger,
              fontWeight: 700,
              fontVariantNumeric: 'tabular-nums',
              letterSpacing: '-0.02em',
            }}
          >
            {formatWon(Math.max(0, monthlySavings))}
          </span>
        </div>
      </div>
    </>
  );
}

function SolutionRow({
  num,
  title,
  desc,
  detail,
  tone,
}: {
  num: string;
  title: string;
  desc: string;
  detail: string;
  tone: 'accent' | 'blue' | 'warn' | 'neutral';
}) {
  const tones = {
    accent: { bg: T.accentSoft, fg: T.accent },
    blue: { bg: '#E0EDFF', fg: T.blue },
    warn: { bg: T.warnSoft, fg: '#B45309' },
    neutral: { bg: T.bgMuted, fg: T.textSec },
  };
  const t = tones[tone];

  return (
    <div
      style={{
        display: 'flex',
        gap: 12,
        padding: '14px 16px',
        borderBottom: `1px solid ${T.divider}`,
      }}
    >
      <div
        style={{
          width: 28,
          height: 28,
          borderRadius: 14,
          background: t.bg,
          color: t.fg,
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontWeight: 800,
          fontSize: 14,
        }}
      >
        {num}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 15,
            fontWeight: 700,
            color: T.text,
            marginBottom: 2,
            letterSpacing: '-0.01em',
          }}
        >
          {title}
        </div>
        <div
          style={{
            fontSize: 13,
            color: T.text,
            fontWeight: 600,
            marginBottom: 2,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {desc}
        </div>
        <div style={{ fontSize: 12, color: T.textTer, lineHeight: 1.45 }}>{detail}</div>
      </div>
    </div>
  );
}

function NumberEditSheet({
  title,
  value,
  onClose,
  onSave,
  unit = '원',
  min = 0,
  max,
  presets,
  step = 10000,
}: {
  title: string;
  value: number;
  onClose: () => void;
  onSave: (v: number) => void;
  unit?: string;
  min?: number;
  max?: number;
  presets?: { value: number; label: string }[];
  step?: number;
}) {
  const [v, setV] = useState(value);
  const isMoney = unit === '원';

  const displayed = isMoney ? Number(v || 0).toLocaleString('ko-KR') : String(v);

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/[^\d]/g, '');
    const n = Math.max(min, Math.floor(Number(raw) || 0));
    setV(max != null ? Math.min(max, n) : n);
  };

  const bump = (d: number) => {
    const next = Math.max(min, v + d);
    setV(max != null ? Math.min(max, next) : next);
  };

  return (
    <BottomSheet open onClose={onClose} title={title} height="55%">
      <div style={{ padding: '0 20px 24px' }}>
        <div
          style={{
            padding: '20px 0',
            textAlign: 'center',
            borderBottom: `1px solid ${T.divider}`,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'baseline',
              justifyContent: 'center',
              gap: 4,
              fontVariantNumeric: 'tabular-nums',
              maxWidth: '100%',
            }}
          >
            {isMoney && (
              <span style={{ fontSize: 20, fontWeight: 700, color: T.textSec, flexShrink: 0 }}>
                ₩
              </span>
            )}
            <input
              type="text"
              inputMode="numeric"
              value={displayed}
              onChange={onInputChange}
              style={{
                border: 0,
                background: 'transparent',
                textAlign: 'center',
                fontFamily: 'Pretendard, system-ui, sans-serif',
                fontSize: 30,
                fontWeight: 800,
                color: T.text,
                letterSpacing: '-0.02em',
                width: `${displayed.length}ch`,
                minWidth: 80,
                maxWidth: 240,
                outline: 'none',
                padding: 0,
              }}
            />
            <span style={{ fontSize: 18, fontWeight: 700, color: T.textSec, flexShrink: 0 }}>
              {unit}
            </span>
          </div>
          {isMoney && (
            <div style={{ marginTop: 6, fontSize: 13, color: T.textTer, fontWeight: 500 }}>
              {v >= 100000000
                ? Math.floor(v / 100000000) + '억 ' + Math.floor((v % 100000000) / 10000) + '만원'
                : v >= 10000
                ? Math.floor(v / 10000) + '만원'
                : v.toLocaleString() + '원'}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: 8, padding: '20px 0 8px' }}>
          {[-step * 10, -step, +step, +step * 10].map((d) => (
            <button
              key={d}
              onClick={() => bump(d)}
              style={{
                flex: 1,
                padding: '10px 0',
                border: 0,
                borderRadius: 10,
                background: T.bgMuted,
                color: T.text,
                fontFamily: 'Pretendard, system-ui, sans-serif',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {d > 0 ? '+' : '−'}
              {isMoney
                ? Math.abs(d) >= 10000
                  ? `${Math.abs(d) / 10000}만`
                  : Math.abs(d).toLocaleString()
                : Math.abs(d)}
            </button>
          ))}
        </div>

        {presets && presets.length > 0 && (
          <>
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: T.textTer,
                margin: '20px 0 8px',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
              }}
            >
              빠른 설정
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {presets.map((p) => (
                <button
                  key={p.value}
                  onClick={() => setV(p.value)}
                  style={{
                    border: 0,
                    padding: '8px 14px',
                    borderRadius: 999,
                    background: v === p.value ? T.accentSoft : T.bgSoft,
                    color: v === p.value ? T.accent : T.text,
                    fontFamily: 'Pretendard, system-ui, sans-serif',
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </>
        )}

        <div style={{ marginTop: 24 }}>
          <PrimaryButton onClick={() => onSave(v)}>저장</PrimaryButton>
        </div>
      </div>
    </BottomSheet>
  );
}

function GoalEditSheet({
  targetAmount,
  targetMonths,
  currentAssets,
  onPick,
  onClose,
}: {
  targetAmount: number;
  targetMonths: number;
  currentAssets: number;
  onPick: (key: string) => void;
  onClose: () => void;
}) {
  const rows = [
    { key: 'targetAmount', label: '목표 금액', value: formatGoalAmount(targetAmount) },
    {
      key: 'targetMonths',
      label: '목표 기간',
      value: `${targetMonths}개월 · 약 ${(targetMonths / 12).toFixed(1)}년`,
    },
    { key: 'currentAssets', label: '현재 보유 자산', value: formatWon(currentAssets) },
  ];

  return (
    <BottomSheet open onClose={onClose} title="목표 수정" height="50%">
      <div style={{ padding: '4px 8px 24px' }}>
        {rows.map((r) => (
          <button
            key={r.key}
            onClick={() => onPick(r.key)}
            style={{
              width: '100%',
              border: 0,
              background: 'transparent',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '16px 14px',
              margin: '2px 0',
              borderRadius: 12,
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'background .15s',
            }}
          >
            <span
              style={{
                fontSize: 15,
                fontWeight: 600,
                color: T.text,
                letterSpacing: '-0.01em',
              }}
            >
              {r.label}
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span
                style={{
                  fontSize: 15,
                  fontWeight: 700,
                  color: T.text,
                  fontVariantNumeric: 'tabular-nums',
                  letterSpacing: '-0.02em',
                }}
              >
                {r.value}
              </span>
              <svg width="7" height="12" viewBox="0 0 7 12" fill="none">
                <path
                  d="M1 1l5 5-5 5"
                  stroke={T.textMuted}
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
          </button>
        ))}
      </div>
    </BottomSheet>
  );
}
