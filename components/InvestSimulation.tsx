'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { T } from '@/components/ui';
import { SectionCard, InputRow, ToggleRow, ResultRow, InfoBanner, NumberEditSheet } from '@/components/invest-ui';
import { calcDividendTax, calcCapitalGainTax, formatWon, solveMonthlyRate } from '@/lib/invest-tax';
import { getInvestSettings, getCategoryBudgetForMonth, getCurrentMonth } from '@/lib/supabase-storage';
import { useBudget, useGoalSettings } from '@/hooks/useSupabaseData';

type SimMode = 'forward' | 'goal';

// 목표 탭 하단에 들어가는 투자 시뮬레이션 섹션 (예전 투자탭에서 이동)
export default function InvestSimulation() {
  const [laborIncome, setLaborIncome] = useState(0);
  useEffect(() => {
    getInvestSettings().then(s => setLaborIncome((s.annualSalary || 0) + (s.bonusIncome || 0)));
  }, []);

  const [simMode, setSimMode] = useState<SimMode>('forward');
  const [editingField, setEditingField] = useState<string | null>(null);
  const [simInputs, setSimInputs] = useState({
    principal: 10_000_000,
    monthlyAdd: 500_000,
    annualReturn: 7,
    years: 10,
    dividendYield: 3,
    isDomestic: false,
    isHealthInsured: true,
    isPidayang: false,
  });

  const simResult = (() => {
    const { principal, monthlyAdd, annualReturn, years, dividendYield, isDomestic, isHealthInsured, isPidayang } = simInputs;
    const monthlyRate = annualReturn / 100 / 12;
    const months = years * 12;
    let balance = principal;
    let totalInvested = principal;
    let totalDividendGross = 0;
    let totalDividendNet = 0;

    for (let m = 0; m < months; m++) {
      balance += monthlyAdd;
      totalInvested += monthlyAdd;
      const monthlyDiv = balance * (dividendYield / 100 / 12);
      const divTax = calcDividendTax({ grossDividend: monthlyDiv, otherFinancialIncome: 0, laborIncome, isDomestic, isHealthInsured, isPidayang });
      totalDividendGross += monthlyDiv;
      totalDividendNet += divTax.netDividend;
      balance = balance * (1 + monthlyRate - dividendYield / 100 / 12) + divTax.netDividend;
    }

    const totalCapitalGainGross = Math.max(0, balance - totalInvested);
    const capTax = calcCapitalGainTax({
      gain: totalCapitalGainGross,
      salePrice: balance,
      isDomestic: simInputs.isDomestic,
      isMajorShareholder: false,
      market: simInputs.isDomestic ? 'kospi' : 'overseas',
    });

    const finalBalance = balance - capTax.tax;
    const totalReturn = finalBalance - totalInvested;
    const effectiveAnnualReturn = totalInvested > 0 ? (Math.pow(finalBalance / totalInvested, 1 / years) - 1) * 100 : 0;

    return { totalInvested, finalBalance, totalReturn, totalDividendGross, totalDividendNet, totalCapitalGainGross, capitalGainTax: capTax.tax, effectiveAnnualReturn };
  })();

  const fieldDefs: Record<string, {
    label: string; value: number; unit: string; step: number; min?: number; max?: number;
    set: (v: number) => void; presets?: { value: number; label: string }[];
  }> = {
    simPrincipal: {
      label: '초기 투자금', value: simInputs.principal, unit: '원', step: 1_000_000,
      set: (v) => setSimInputs(p => ({ ...p, principal: v })),
      presets: [{ value: 5_000_000, label: '500만' }, { value: 10_000_000, label: '1,000만' }, { value: 30_000_000, label: '3,000만' }, { value: 50_000_000, label: '5,000만' }],
    },
    simMonthlyAdd: {
      label: '월 추가 투자금', value: simInputs.monthlyAdd, unit: '원', step: 100_000,
      set: (v) => setSimInputs(p => ({ ...p, monthlyAdd: v })),
      presets: [{ value: 200_000, label: '20만' }, { value: 500_000, label: '50만' }, { value: 1_000_000, label: '100만' }],
    },
    simAnnualReturn: {
      label: '연간 수익률', value: simInputs.annualReturn, unit: '%', step: 1, min: 0, max: 30,
      set: (v) => setSimInputs(p => ({ ...p, annualReturn: v })),
      presets: [{ value: 5, label: '5%' }, { value: 7, label: '7%' }, { value: 10, label: '10%' }, { value: 12, label: '12%' }],
    },
    simYears: {
      label: '투자 기간', value: simInputs.years, unit: '년', step: 1, min: 1, max: 40,
      set: (v) => setSimInputs(p => ({ ...p, years: v })),
      presets: [{ value: 5, label: '5년' }, { value: 10, label: '10년' }, { value: 20, label: '20년' }, { value: 30, label: '30년' }],
    },
    simDividendYield: {
      label: '배당 수익률', value: simInputs.dividendYield, unit: '%', step: 0.5, min: 0, max: 20,
      set: (v) => setSimInputs(p => ({ ...p, dividendYield: v })),
      presets: [{ value: 0, label: '0%' }, { value: 2, label: '2%' }, { value: 3, label: '3%' }, { value: 5, label: '5%' }],
    },
  };

  return (
    <div>
      {/* 섹션 헤더 */}
      <div style={{ padding: '8px 20px 4px' }}>
        <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: '-0.02em', color: T.text }}>투자 시뮬레이션</div>
        <div style={{ fontSize: 13, color: T.textSec, marginTop: 2 }}>세후 예상 수익·목표 달성 수익률을 계산해요</div>
      </div>

      {/* 모드 세그먼트 */}
      <div style={{ padding: '8px 20px 4px' }}>
        <div style={{ display: 'flex', background: T.bgSoft, borderRadius: 10, padding: 3, border: `1px solid ${T.divider}` }}>
          {([
            { id: 'forward' as SimMode, label: '💰 얼마가 될까' },
            { id: 'goal' as SimMode, label: '🎯 목표 역산' },
          ]).map(m => (
            <button
              key={m.id}
              onClick={() => setSimMode(m.id)}
              style={{
                flex: 1, padding: '9px 0', borderRadius: 7, border: 0,
                background: simMode === m.id ? T.text : 'transparent',
                color: simMode === m.id ? '#fff' : T.textSec,
                fontSize: 13, fontWeight: simMode === m.id ? 700 : 600,
                cursor: 'pointer', letterSpacing: '-0.01em', transition: 'all .15s',
              }}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {simMode === 'forward' && (
        <div style={{ padding: '8px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <SectionCard title="투자 조건">
            <InputRow label="초기 투자금" value={formatWon(simInputs.principal)} onTap={() => setEditingField('simPrincipal')} />
            <InputRow label="월 추가 투자" value={formatWon(simInputs.monthlyAdd)} onTap={() => setEditingField('simMonthlyAdd')} />
            <InputRow label="연간 수익률" value={`${simInputs.annualReturn}%`} onTap={() => setEditingField('simAnnualReturn')} />
            <InputRow label="배당 수익률" value={`${simInputs.dividendYield}%`} onTap={() => setEditingField('simDividendYield')} />
            <InputRow label="투자 기간" value={`${simInputs.years}년`} onTap={() => setEditingField('simYears')} />
            <ToggleRow label="국내 주식" value={simInputs.isDomestic} onChange={v => setSimInputs(p => ({ ...p, isDomestic: v }))} />
            <ToggleRow label="직장 건강보험" value={simInputs.isHealthInsured} onChange={v => setSimInputs(p => ({ ...p, isHealthInsured: v }))} />
            <ToggleRow label="피부양자" value={simInputs.isPidayang} onChange={v => setSimInputs(p => ({ ...p, isPidayang: v }))} noBorder />
          </SectionCard>

          <div style={{ background: T.text, borderRadius: 18, padding: 20 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.6)', marginBottom: 8 }}>
              {simInputs.years}년 후 세후 평가액
            </div>
            <div style={{ fontSize: 32, fontWeight: 800, color: '#fff', letterSpacing: '-0.03em', fontVariantNumeric: 'tabular-nums', marginBottom: 4 }}>
              {formatWon(simResult.finalBalance)}
            </div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', fontWeight: 500 }}>
              실질 연평균 수익률 {simResult.effectiveAnnualReturn.toFixed(1)}% (세후)
            </div>
          </div>

          <SectionCard title="수익 내역">
            <ResultRow label="총 투자금" value={formatWon(simResult.totalInvested)} />
            <ResultRow label="총 배당금 (세전)" value={formatWon(simResult.totalDividendGross)} />
            <ResultRow label="배당세 후 실수령" value={formatWon(simResult.totalDividendNet)} color={T.accent} />
            <ResultRow label="양도차익" value={formatWon(simResult.totalCapitalGainGross)} />
            <ResultRow label="양도소득세" value={formatWon(simResult.capitalGainTax)} color={T.danger} />
            <div style={{ height: 1, background: T.divider, margin: '4px 0' }} />
            <ResultRow label="세후 총 수익" value={formatWon(simResult.totalReturn)} color={T.accent} big />
          </SectionCard>

          <button
            onClick={() => setSimMode('goal')}
            style={{
              border: `1px solid ${T.divider}`, background: T.bg, borderRadius: 14, padding: '14px 16px',
              cursor: 'pointer', width: '100%', textAlign: 'left', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}
          >
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: T.text, letterSpacing: '-0.01em', marginBottom: 2 }}>
                🎯 목표 역산으로 확인
              </div>
              <div style={{ fontSize: 12, color: T.textSec, fontWeight: 500 }}>
                목표 달성을 위해 필요한 수익률 계산
              </div>
            </div>
            <svg width="6" height="10" viewBox="0 0 6 10" fill="none">
              <path d="M1 1l4 4-4 4" stroke={T.textTer} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>

          <InfoBanner tone="neutral">
            배당은 매월 재투자하는 것으로 계산해요. 실제 세금은 소득 상황에 따라 달라질 수 있어요.
          </InfoBanner>
        </div>
      )}

      {simMode === 'goal' && (
        <GoalReverseSection laborIncome={laborIncome} onSwitchToSim={() => setSimMode('forward')} />
      )}

      {editingField && fieldDefs[editingField] && (() => {
        const f = fieldDefs[editingField];
        return (
          <NumberEditSheet
            title={f.label} value={f.value} unit={f.unit} step={f.step}
            min={f.min} max={f.max} presets={f.presets}
            onClose={() => setEditingField(null)}
            onSave={(v) => { f.set(v); setEditingField(null); }}
          />
        );
      })()}
    </div>
  );
}

// ─── 목표 역산 ────────────────────────────────────────────────────────────────

function GoalReverseSection({ laborIncome, onSwitchToSim }: { laborIncome: number; onSwitchToSim: () => void }) {
  void laborIncome;
  const router = useRouter();
  const { settings, loading: goalLoading } = useGoalSettings();
  const { budget, loading: budgetLoading } = useBudget();

  const currentMonth = getCurrentMonth();
  const monthlyIncome = settings.monthlyIncome || 4_000_000;
  const targetAmount = settings.goalAmount || 100_000_000;
  const currentAssets = settings.currentAssets || 0;
  const targetMonths = settings.goalMonths || 36;

  const totalBudget = budget
    ? Object.keys({ ...budget.categoryBudgets, ...(budget.monthlyCategoryBudgets?.[currentMonth] ?? {}) }).reduce(
        (sum, catId) => sum + getCategoryBudgetForMonth(budget, currentMonth, catId), 0
      )
    : 0;
  const savingCategoryBudget = budget ? getCategoryBudgetForMonth(budget, currentMonth, 'saving') : 0;
  const monthlyBudget = totalBudget - savingCategoryBudget;
  const monthlySavings = Math.max(0, monthlyIncome - monthlyBudget);
  const gap = Math.max(0, targetAmount - currentAssets);

  if (goalLoading || budgetLoading) {
    return <div style={{ padding: '20px', color: T.textSec, fontSize: 14 }}>로딩 중...</div>;
  }

  const requiredMonthlyRate = solveMonthlyRate(currentAssets, monthlySavings, targetAmount, targetMonths);
  const requiredAnnualRate = (Math.pow(1 + requiredMonthlyRate, 12) - 1) * 100;
  const isAchievableWithSavingsOnly = requiredMonthlyRate < 1e-6;

  const benchmarks = [
    { name: 'S&P 500 (10년 평균)', annualRate: 10, risk: '중', color: '#2563EB' },
    { name: 'QQQ (10년 평균)', annualRate: 14, risk: '중상', color: '#7C3AED' },
    { name: '글로벌 배당 ETF', annualRate: 7, risk: '중하', color: '#059669' },
    { name: '예금·채권 (국내)', annualRate: 3.5, risk: '낮음', color: '#6B7280' },
  ];

  const rateColor = requiredAnnualRate > 25 ? '#F87171' : requiredAnnualRate > 12 ? '#FCD34D' : '#34D399';

  return (
    <div style={{ padding: '8px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <SectionCard title="현재 목표 데이터">
        <ResultRow label="목표 금액" value={formatWon(targetAmount)} />
        <ResultRow label="현재 보유 자산" value={formatWon(currentAssets)} />
        <ResultRow label="남은 금액 (Gap)" value={formatWon(gap)} />
        <ResultRow label="목표 기간" value={`${targetMonths}개월 (${(targetMonths / 12).toFixed(1)}년)`} />
        <ResultRow label="월 저축 가능액" value={formatWon(monthlySavings)} color={monthlySavings > 0 ? T.accent : T.danger} big />
        <div style={{ padding: '8px 16px 12px' }}>
          <button
            onClick={() => router.push('/goals')}
            style={{ border: 0, background: 'transparent', color: T.textTer, fontSize: 12, fontWeight: 600, cursor: 'pointer', padding: 0 }}
          >
            목표 수정하기 →
          </button>
        </div>
      </SectionCard>

      {isAchievableWithSavingsOnly ? (
        <div style={{ background: T.accentSoft, borderRadius: 16, padding: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: T.accent, marginBottom: 6 }}>
            저축만으로 달성 가능해요!
          </div>
          <div style={{ fontSize: 14, color: T.accent, fontWeight: 600, lineHeight: 1.6 }}>
            현재 월 저축액({formatWon(monthlySavings)})으로 목표 기간 내 달성 가능해요.<br />
            투자까지 더하면 더 빠르게 달성하거나 목표를 높일 수 있어요.
          </div>
        </div>
      ) : (
        <div style={{ background: T.text, borderRadius: 18, padding: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.6)', marginBottom: 8 }}>
            목표 달성을 위한 필요 연 수익률 (세전)
          </div>
          <div style={{ fontSize: 40, fontWeight: 800, letterSpacing: '-0.03em', fontVariantNumeric: 'tabular-nums', marginBottom: 4, color: rateColor }}>
            {requiredAnnualRate.toFixed(1)}%
          </div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', fontWeight: 500 }}>
            월 저축 {formatWon(monthlySavings)} + 투자 수익 합산 기준
          </div>
          {requiredAnnualRate > 25 && (
            <div style={{ marginTop: 12, padding: '10px 12px', background: 'rgba(248,113,113,0.15)', borderRadius: 10, fontSize: 12, color: '#FCA5A5', fontWeight: 600, lineHeight: 1.6 }}>
              ⚠️ 연 25% 초과는 현실적으로 달성하기 매우 어려운 수익률이에요.<br />
              목표 금액을 낮추거나 기간을 늘려보세요.
            </div>
          )}
        </div>
      )}

      {!isAchievableWithSavingsOnly && (
        <SectionCard title="벤치마크 비교">
          {benchmarks.map((b, i) => {
            const isEnough = b.annualRate >= requiredAnnualRate;
            const isLast = i === benchmarks.length - 1;
            return (
              <div key={b.name} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '13px 16px',
                borderBottom: isLast ? 'none' : `1px solid ${T.divider}`,
                background: isEnough ? T.accentSoft : 'transparent',
              }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: T.text }}>{b.name}</div>
                  <div style={{ fontSize: 11, color: T.textTer, marginTop: 2 }}>리스크 {b.risk}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 17, fontWeight: 700, color: b.color, fontVariantNumeric: 'tabular-nums' }}>연 {b.annualRate}%</div>
                  <div style={{ fontSize: 11, fontWeight: 700, marginTop: 2, color: isEnough ? T.accent : T.danger }}>
                    {isEnough ? '✓ 달성 가능' : '✗ 부족'}
                  </div>
                </div>
              </div>
            );
          })}
        </SectionCard>
      )}

      <button
        onClick={onSwitchToSim}
        style={{
          border: `1px solid ${T.divider}`, background: T.bg, borderRadius: 14, padding: '14px 16px',
          cursor: 'pointer', width: '100%', textAlign: 'left', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}
      >
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: T.text, marginBottom: 2 }}>
            💰 투자 시뮬레이션으로 확인
          </div>
          <div style={{ fontSize: 12, color: T.textSec, fontWeight: 500 }}>
            수익률 입력 시 세후 예상 수익액 계산
          </div>
        </div>
        <svg width="6" height="10" viewBox="0 0 6 10" fill="none">
          <path d="M1 1l4 4-4 4" stroke={T.textTer} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      <InfoBanner tone="neutral">
        위 수익률은 세전(gross) 기준이에요. 실제 투자 시 배당세·양도세가 추가로 부과돼요.<br />
        과거 수익률이 미래를 보장하지 않으며, 원금 손실이 발생할 수 있어요.
      </InfoBanner>
    </div>
  );
}
