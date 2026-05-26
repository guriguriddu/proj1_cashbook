'use client';

import { useRouter } from 'next/navigation';
import { Screen, ScreenBody, AppHeader, T } from '@/components/ui';
import { useAuth } from '@/contexts/AuthContext';

export default function MyPage() {
  const router = useRouter();
  const { user, signOut } = useAuth();

  const handleLogout = async () => {
    await signOut();
    router.push('/login');
  };

  return (
    <Screen>
      <AppHeader title="프로필" onBack={() => router.back()} />
      <ScreenBody>
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
                  width: 52, height: 52, borderRadius: 26,
                  background: T.accentSoft,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24,
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
                <div style={{
                  fontSize: 17, fontWeight: 700, color: T.text, letterSpacing: '-0.02em',
                  marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {user?.user_metadata?.full_name || user?.email?.split('@')[0] || '사용자'}
                </div>
                <div style={{ fontSize: 13, color: T.textSec, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {user?.email || ''}
                </div>
              </div>
            </div>

            <button
              onClick={() => router.push('/budget')}
              style={{
                width: '100%', marginTop: 16, padding: '12px 16px',
                border: `1px solid ${T.divider}`, borderRadius: 12,
                background: T.bgMuted, color: T.text,
                fontSize: 14, fontWeight: 600, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}
            >
              <span>예산 / 카테고리 관리</span>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>

            <button
              onClick={handleLogout}
              style={{
                width: '100%', marginTop: 8, padding: '12px 16px',
                border: `1px solid ${T.divider}`, borderRadius: 12,
                background: T.bgMuted, color: T.textSec,
                fontSize: 14, fontWeight: 600, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path
                  d="M6 14H3.33C2.97 14 2.63 13.86 2.38 13.61C2.13 13.36 2 13.02 2 12.67V3.33C2 2.97 2.14 2.63 2.38 2.38C2.63 2.13 2.97 2 3.33 2H6M10.67 11.33L14 8L10.67 4.67M14 8H6"
                  stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
                />
              </svg>
              로그아웃
            </button>
          </div>
        </div>
      </ScreenBody>
    </Screen>
  );
}
