'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { T } from '@/components/ui';

interface NavItem {
  id: string;
  href: string;
  label: string;
  icon: 'home' | 'plus' | 'flag' | 'wallet' | 'chart';
}

const navItems: NavItem[] = [
  { id: 'home', href: '/', label: '홈', icon: 'home' },
  { id: 'budget', href: '/budget', label: '예산', icon: 'wallet' },
  { id: 'add', href: '/add', label: '추가', icon: 'plus' },
  { id: 'goals', href: '/goals', label: '목표', icon: 'flag' },
  { id: 'invest', href: '/invest', label: '투자', icon: 'chart' },
];

export default function BottomNav() {
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href);
  };

  return (
    <nav
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 50,
        height: 84,
        background: 'rgba(255,255,255,0.96)',
        backdropFilter: 'blur(20px) saturate(180%)',
        WebkitBackdropFilter: 'blur(20px) saturate(180%)',
        borderTop: `1px solid ${T.divider}`,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        paddingTop: 10,
        paddingBottom: 24,
        maxWidth: 512,
        margin: '0 auto',
      }}
    >
      {navItems.map((item) => {
        const active = isActive(item.href);
        return (
          <Link
            key={item.id}
            href={item.href}
            style={{
              flex: 1,
              height: 50,
              border: 0,
              background: 'transparent',
              padding: 0,
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'flex-start',
              gap: 4,
              textDecoration: 'none',
            }}
          >
            <TabIcon icon={item.icon} active={active} />
            <div
              style={{
                fontSize: 11,
                fontWeight: active ? 700 : 500,
                color: active ? T.text : T.textTer,
                letterSpacing: '-0.01em',
              }}
            >
              {item.label}
            </div>
          </Link>
        );
      })}
    </nav>
  );
}

function TabIcon({ icon, active }: { icon: string; active: boolean }) {
  const c = active ? T.text : T.textTer;
  const w = active ? 2.2 : 1.8;

  if (icon === 'home') {
    return (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <path
          d="M3.5 10.5L12 4l8.5 6.5V20a1 1 0 01-1 1h-4v-6h-7v6h-4a1 1 0 01-1-1v-9.5z"
          stroke={c}
          strokeWidth={w}
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  if (icon === 'plus') {
    return (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="9" stroke={c} strokeWidth={w} />
        <path d="M12 8v8M8 12h8" stroke={c} strokeWidth={w} strokeLinecap="round" />
      </svg>
    );
  }
  if (icon === 'flag') {
    return (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <path d="M5 3v18" stroke={c} strokeWidth={w} strokeLinecap="round" />
        <path d="M5 4h11l-2.5 4.5L16 13H5" stroke={c} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (icon === 'wallet') {
    return (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <rect x="2" y="6" width="20" height="14" rx="2.5" stroke={c} strokeWidth={w} />
        <path d="M2 10h20" stroke={c} strokeWidth={w} strokeLinecap="round" />
        <circle cx="17" cy="15" r="1.5" fill={c} />
      </svg>
    );
  }
  if (icon === 'chart') {
    return (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <path d="M4 20L9 14l4 3 7-9" stroke={c} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="9" cy="14" r="1.2" fill={c} />
        <circle cx="13" cy="17" r="1.2" fill={c} />
        <circle cx="20" cy="8" r="1.2" fill={c} />
      </svg>
    );
  }
  return null;
}
