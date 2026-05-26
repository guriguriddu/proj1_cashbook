'use client';

import { Screen, ScreenBody, T } from '@/components/ui';

export default function InvestPage() {
  return (
    <Screen>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: '60px 20px 8px',
          position: 'sticky',
          top: 0,
          background: T.bg,
          zIndex: 5,
        }}
      >
        <span style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em' }}>투자</span>
      </div>
      <ScreenBody>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '80px 40px',
            textAlign: 'center',
            gap: 16,
          }}
        >
          <div style={{ fontSize: 48 }}>📈</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: T.text, letterSpacing: '-0.02em' }}>
            투자 분석
          </div>
          <div style={{ fontSize: 14, color: T.textSec, lineHeight: 1.6, letterSpacing: '-0.01em' }}>
            배당소득세, 종합소득세, 건강보험료까지<br />
            고려한 투자 시뮬레이터가 준비 중이에요.
          </div>
        </div>
      </ScreenBody>
    </Screen>
  );
}
