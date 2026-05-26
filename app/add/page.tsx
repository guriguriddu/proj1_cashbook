'use client';

import { useRouter } from 'next/navigation';
import {
  Screen,
  ScreenBody,
  AppHeader,
  T,
  Badge,
} from '@/components/ui';

export default function AddPage() {
  const router = useRouter();

  return (
    <Screen>
      <AppHeader title="지출 추가" onBack={() => router.push('/')} />
      <ScreenBody>
        <div style={{ padding: '24px 20px 8px' }}>
          <div
            style={{
              fontSize: 22,
              fontWeight: 700,
              letterSpacing: '-0.02em',
              color: T.text,
              marginBottom: 6,
              lineHeight: 1.3,
            }}
          >
            어떻게 추가할까요?
          </div>
          <div style={{ fontSize: 14, color: T.textSec, lineHeight: 1.5 }}>
            토스·카드·영수증 캡쳐를 올리면 자동으로 거래 내역을 추출해드려요.
          </div>
        </div>

        <div
          style={{
            padding: '24px 20px',
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}
        >
          {/* 사진으로 추가 */}
          <ChoiceCard
            onClick={() => router.push('/add/photo')}
            accent
            iconBg={T.accentSoft}
            iconColor={T.accent}
            icon={
              <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                <rect
                  x="3"
                  y="6"
                  width="22"
                  height="17"
                  rx="2.5"
                  stroke="currentColor"
                  strokeWidth="2"
                />
                <circle
                  cx="10"
                  cy="13"
                  r="2.2"
                  stroke="currentColor"
                  strokeWidth="2"
                />
                <path
                  d="M3 19l6-5 5 4 4-3 7 6"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            }
            title="사진으로 추가"
            desc="토스 / 카드 / 영수증 캡쳐 OCR"
            badge={<Badge tone="accent" size="md">추천</Badge>}
          />

          {/* 파일 가져오기 */}
          <ChoiceCard
            onClick={() => router.push('/add/import')}
            iconBg="#E8F5E9"
            iconColor="#16A34A"
            icon={
              <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                <rect x="4" y="3" width="14" height="22" rx="2" stroke="currentColor" strokeWidth="2" />
                <path d="M4 3l14 0 6 6v16a2 2 0 01-2 2H6a2 2 0 01-2-2V3z" stroke="currentColor" strokeWidth="2" fill="none" />
                <path d="M18 3v6h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                <path d="M8 14l3 3 3-3M11 17v-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            }
            title="파일 가져오기"
            desc="엑셀·PDF → AI가 자동으로 분석 (.xlsx / .pdf)"
          />

          {/* 직접 입력 */}
          <ChoiceCard
            onClick={() => router.push('/add/manual')}
            iconBg={T.bgMuted}
            iconColor={T.text}
            icon={
              <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                <path
                  d="M14 4v20M4 14h20"
                  stroke="currentColor"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                />
              </svg>
            }
            title="직접 입력"
            desc="금액과 사용처를 직접 입력"
          />
        </div>

        <div
          style={{
            padding: '8px 20px 0',
            fontSize: 12,
            color: T.textTer,
            lineHeight: 1.6,
          }}
        >
          여러 장의 영수증을 한 번에 올려도 괜찮아요. 추출 후 검수 단계에서 자유롭게
          수정·제외할 수 있어요.
        </div>
      </ScreenBody>
    </Screen>
  );
}

function ChoiceCard({
  onClick,
  icon,
  iconBg,
  iconColor,
  title,
  desc,
  badge,
  accent,
}: {
  onClick: () => void;
  icon: React.ReactNode;
  iconBg: string;
  iconColor: string;
  title: string;
  desc: string;
  badge?: React.ReactNode;
  accent?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        width: '100%',
        border: 0,
        padding: 20,
        borderRadius: 18,
        background: accent ? T.accentSoft + '80' : T.bgSoft,
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        cursor: 'pointer',
        textAlign: 'left',
        transition: 'transform .12s',
      }}
    >
      <div
        style={{
          width: 56,
          height: 56,
          borderRadius: 16,
          background: iconBg,
          color: iconColor,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        {icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginBottom: 4,
          }}
        >
          <div
            style={{
              fontSize: 17,
              fontWeight: 700,
              letterSpacing: '-0.02em',
            }}
          >
            {title}
          </div>
          {badge}
        </div>
        <div
          style={{
            fontSize: 13,
            color: T.textSec,
            letterSpacing: '-0.01em',
          }}
        >
          {desc}
        </div>
      </div>
      <svg
        width="9"
        height="16"
        viewBox="0 0 9 16"
        style={{ flexShrink: 0 }}
      >
        <path
          d="M1.5 1.5l6 6.5-6 6.5"
          stroke={T.textTer}
          strokeWidth="1.8"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}
