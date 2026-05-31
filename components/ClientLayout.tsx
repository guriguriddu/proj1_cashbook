'use client';

import { usePathname } from 'next/navigation';
import BottomNav from '@/components/BottomNav';
import { AuthGuard } from '@/components/AuthGuard';

const PUBLIC_ROUTES = ['/login'];

export function ClientLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isPublicRoute = PUBLIC_ROUTES.includes(pathname);

  if (isPublicRoute) {
    return (
      <main className="flex-1 max-w-lg mx-auto w-full">
        {children}
      </main>
    );
  }

  return (
    <AuthGuard>
      <main className="flex-1 max-w-lg mx-auto w-full" style={{ paddingBottom: 'calc(64px + max(20px, env(safe-area-inset-bottom)))' }}>
        {children}
      </main>
      <BottomNav />
    </AuthGuard>
  );
}
