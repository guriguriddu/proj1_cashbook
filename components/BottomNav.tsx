'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { T } from '@/components/ui';

interface NavItem {
  id: string;
  href: string;
  label: string;
  icon: 'home' | 'list' | 'plus' | 'target' | 'goal';
}

const navItems: NavItem[] = [
  { id: 'home', href: '/', label: '홈', icon: 'home' },
  { id: 'history', href: '/expenses', label: '내역', icon: 'list' },
  { id: 'add', href: '/add', label: '입력', icon: 'plus' },
  { id: 'budget', href: '/budget', label: '예산', icon: 'target' },
  { id: 'goal', href: '/goal', label: '목표', icon: 'goal' },
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
  if (icon === 'list') {
    return (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <path d="M4 7h16M4 12h16M4 17h10" stroke={c} strokeWidth={w} strokeLinecap="round" />
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
  if (icon === 'target') {
    return (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <rect x="4" y="4" width="16" height="16" rx="2" stroke={c} strokeWidth={w} />
        <path d="M8 12h8M12 8v8" stroke={c} strokeWidth={w} strokeLinecap="round" />
      </svg>
    );
  }
  if (icon === 'goal') {
    return (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="8.5" stroke={c} strokeWidth={w} />
        <circle cx="12" cy="12" r="4" stroke={c} strokeWidth={w} />
        <circle cx="12" cy="12" r="1.2" fill={c} />
      </svg>
    );
  }
  return null;
}
