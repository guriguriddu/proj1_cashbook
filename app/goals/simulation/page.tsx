'use client';

import { useRouter } from 'next/navigation';
import { Screen, AppHeader } from '@/components/ui';
import InvestSimulation from '@/components/InvestSimulation';

export default function InvestSimulationPage() {
  const router = useRouter();
  return (
    <Screen>
      <AppHeader title="투자 시뮬레이션" onBack={() => router.back()} />
      {/* ScreenBody(overflow:auto)를 쓰지 않음 — window 스크롤로 InvestSimulation 내부 sticky 헤더가 동작하도록 */}
      <div style={{ paddingBottom: 96 }}>
        <InvestSimulation />
      </div>
    </Screen>
  );
}
