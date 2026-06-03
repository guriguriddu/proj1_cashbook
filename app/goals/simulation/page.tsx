'use client';

import { useRouter } from 'next/navigation';
import { Screen, AppHeader, ScreenBody } from '@/components/ui';
import InvestSimulation from '@/components/InvestSimulation';

export default function InvestSimulationPage() {
  const router = useRouter();
  return (
    <Screen>
      <AppHeader title="투자 시뮬레이션" onBack={() => router.back()} />
      <ScreenBody padBottom={40}>
        <InvestSimulation />
      </ScreenBody>
    </Screen>
  );
}
