'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  Screen,
  AppHeader,
  ScreenBody,
  T,
  PrimaryButton,
  ProgressBar,
} from '@/components/ui';
import { performOcr, parseGeminiResponse, parseOcrText, OcrProgressCallback } from '@/lib/ocr';
import { generateId } from '@/lib/supabase-storage';
import type { ExtractedTransaction } from '@/types';

interface ImagePreview {
  id: string;
  file: File | null;
  url: string;
  label: string;
  kind: 'toss' | 'card' | 'receipt' | 'photo';
}

export default function PhotoUploadPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [images, setImages] = useState<ImagePreview[]>([]);
  const [extracting, setExtracting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 파일 선택 처리
  const onFiles = (files: FileList | null) => {
    if (!files) return;

    const newImages: ImagePreview[] = [];
    const filesToProcess = Array.from(files).slice(0, 12 - images.length);

    filesToProcess.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        newImages.push({
          id: 'u' + Date.now() + Math.random(),
          file,
          url: ev.target?.result as string,
          label: file.name,
          kind: 'photo',
        });
        setImages((prev) => [...prev, ...newImages.filter((n) => !prev.some((p) => p.id === n.id))]);
      };
      reader.readAsDataURL(file);
    });
  };

  // 이미지 삭제
  const removeImage = (id: string) => {
    setImages(images.filter((i) => i.id !== id));
  };

  // 부드러운 프로그레스 증가 함수
  const smoothProgress = (from: number, to: number, duration: number) => {
    const startTime = Date.now();
    const step = () => {
      const elapsed = Date.now() - startTime;
      const ratio = Math.min(elapsed / duration, 1);
      // easeOutQuad for smooth deceleration
      const eased = 1 - (1 - ratio) * (1 - ratio);
      const current = from + (to - from) * eased;
      setProgress(Math.round(current));
      if (ratio < 1) {
        requestAnimationFrame(step);
      }
    };
    requestAnimationFrame(step);
  };

  // OCR 추출 시작
  const startExtract = async () => {
    if (images.length === 0) return;

    setExtracting(true);
    setProgress(0);
    setError(null);

    const allTransactions: ExtractedTransaction[] = [];
    const totalImages = images.filter(img => img.file).length;

    // 각 이미지당 할당되는 진행률 (전체 90%, 마지막 10%는 파싱용)
    const perImageProgress = 85 / totalImages;

    let processedCount = 0;

    for (let i = 0; i < images.length; i++) {
      const img = images[i];
      if (!img.file) continue;

      const baseProgress = processedCount * perImageProgress;

      // 시작 애니메이션 (이미지 준비 중)
      smoothProgress(baseProgress, baseProgress + perImageProgress * 0.1, 200);
      await new Promise(r => setTimeout(r, 200));

      const handleProgress: OcrProgressCallback = (prog, status) => {
        // API 진행률을 해당 이미지 구간 내에서 세분화
        // prog: 0-100을 baseProgress + 10% ~ baseProgress + 90% 구간에 매핑
        const imageStart = baseProgress + perImageProgress * 0.1;
        const imageEnd = baseProgress + perImageProgress * 0.9;
        const mappedProgress = imageStart + (prog / 100) * (imageEnd - imageStart);
        setProgress(Math.round(mappedProgress));
      };

      try {
        const ocrText = await performOcr(img.file, handleProgress);

        // 파싱 진행 (90% → 100% of this image)
        smoothProgress(
          baseProgress + perImageProgress * 0.9,
          baseProgress + perImageProgress,
          150
        );

        let extracted = parseGeminiResponse(ocrText);
        if (extracted.length === 0) {
          extracted = parseOcrText(ocrText);
        }
        allTransactions.push(...extracted);
      } catch (error) {
        console.error(`이미지 ${i + 1} OCR 실패:`, error);
        const errorMessage = error instanceof Error ? error.message : 'OCR 처리 실패';
        setError(errorMessage);
        setExtracting(false);
        return;
      }

      processedCount++;
    }

    // 최종 정리 단계 (85% → 100%)
    smoothProgress(85, 95, 200);
    await new Promise(r => setTimeout(r, 200));

    // 추출된 데이터를 sessionStorage에 저장하고 리뷰 페이지로 이동
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('ocrTransactions', JSON.stringify(allTransactions));
    }

    smoothProgress(95, 100, 150);

    setTimeout(() => {
      router.push('/add/photo/review');
    }, 350);
  };

  return (
    <Screen>
      <AppHeader title="사진으로 추가" onBack={() => router.push('/add')} />

      <ScreenBody padBottom={120}>
        {/* 드래그 & 드롭 영역 */}
        <div style={{ padding: '16px 20px 12px' }}>
          <div
            onClick={() => fileInputRef.current?.click()}
            onDragEnter={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              if (e.dataTransfer?.files?.length) onFiles(e.dataTransfer.files);
            }}
            style={{
              padding: '32px 20px',
              borderRadius: 18,
              border: `2px dashed ${dragOver ? T.accent : T.divider}`,
              background: dragOver ? T.accentSoft + '60' : T.bgSoft,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              cursor: 'pointer',
              textAlign: 'center',
              transition: 'all .15s',
            }}
          >
            <div
              style={{
                width: 64,
                height: 64,
                borderRadius: 32,
                background: T.bg,
                color: T.accent,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 14,
                boxShadow: '0 2px 6px rgba(10,13,20,0.06)',
              }}
            >
              <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                <path
                  d="M14 4v16M6 12l8-8 8 8"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path d="M4 22h20" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
              </svg>
            </div>
            <div
              style={{
                fontSize: 16,
                fontWeight: 700,
                letterSpacing: '-0.02em',
                marginBottom: 4,
              }}
            >
              갤러리에서 끌어다 놓기
            </div>
            <div style={{ fontSize: 13, color: T.textSec, lineHeight: 1.5 }}>
              또는 탭해서 파일 선택
              <br />
              토스 소비내역 캡쳐 / 카드 명세서 / 영수증 사진
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => onFiles(e.target.files)}
              style={{ display: 'none' }}
            />
          </div>
        </div>

        {/* 선택된 이미지 */}
        <div style={{ padding: '0 20px 16px' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'baseline',
              justifyContent: 'space-between',
              marginBottom: 10,
            }}
          >
            <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: '-0.01em' }}>
              선택한 이미지 <span style={{ color: T.accent }}>{images.length}</span>
            </div>
            {images.length > 0 && (
              <button
                onClick={() => setImages([])}
                style={{
                  border: 0,
                  background: 'transparent',
                  color: T.textTer,
                  fontSize: 13,
                  fontWeight: 500,
                  cursor: 'pointer',
                  padding: 0,
                }}
              >
                전체 삭제
              </button>
            )}
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 10,
            }}
          >
            {images.map((img) => (
              <ImageThumb key={img.id} img={img} onRemove={() => removeImage(img.id)} />
            ))}
            <button
              onClick={() => fileInputRef.current?.click()}
              style={{
                border: `1.5px dashed ${T.divider}`,
                background: T.bgSoft,
                aspectRatio: '3/4',
                borderRadius: 12,
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                color: T.textTer,
              }}
            >
              <svg width="20" height="20" viewBox="0 0 20 20">
                <path
                  d="M10 4v12M4 10h12"
                  stroke={T.textTer}
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
              </svg>
              <span style={{ fontSize: 11, fontWeight: 600 }}>추가</span>
            </button>
          </div>
        </div>

        {/* 힌트 */}
        <div
          style={{
            padding: '0 20px',
            fontSize: 12,
            color: T.textTer,
            lineHeight: 1.6,
          }}
        >
          ※ 업로드한 이미지는 인식 후 안전하게 삭제됩니다. 인식이 어려운 경우 일부 항목을 직접 수정하셔야 할 수 있어요.
        </div>

        {/* 에러 메시지 */}
        {error && (
          <div
            style={{
              margin: '16px 20px',
              padding: '14px 16px',
              background: T.dangerSoft,
              borderRadius: 12,
              border: `1px solid ${T.danger}20`,
            }}
          >
            <div style={{ fontSize: 14, fontWeight: 600, color: T.danger, marginBottom: 4 }}>
              OCR 처리 실패
            </div>
            <div style={{ fontSize: 13, color: T.danger, opacity: 0.85 }}>
              {error}
            </div>
          </div>
        )}
      </ScreenBody>

      {/* 하단 고정 버튼 - 탭 바 위에 위치 */}
      <div
        style={{
          position: 'fixed',
          left: 0,
          right: 0,
          bottom: 84,
          padding: '12px 20px 16px',
          background: 'linear-gradient(to top, rgba(255,255,255,1) 60%, rgba(255,255,255,0))',
          maxWidth: 512,
          margin: '0 auto',
          zIndex: 100,
        }}
      >
        <PrimaryButton onClick={startExtract} disabled={images.length === 0}>
          소비 내역 추가 {images.length > 0 && `(${images.length}장)`}
        </PrimaryButton>
      </div>

      {/* 추출 중 오버레이 */}
      {extracting && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(255,255,255,0.96)',
            zIndex: 200,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 40,
          }}
        >
          <div
            style={{
              width: 80,
              height: 80,
              borderRadius: 40,
              background: T.accentSoft,
              color: T.accent,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 24,
              animation: 'pulse 1.6s infinite',
            }}
          >
            <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
              <rect x="6" y="9" width="24" height="18" rx="2" stroke="currentColor" strokeWidth="2.2" />
              <path d="M11 16h14M11 20h10" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
            </svg>
          </div>
          <div
            style={{
              fontSize: 18,
              fontWeight: 700,
              marginBottom: 8,
              letterSpacing: '-0.02em',
            }}
          >
            거래 내역을 추출하고 있어요
          </div>
          <div
            style={{
              fontSize: 14,
              color: T.textSec,
              marginBottom: 28,
              textAlign: 'center',
              lineHeight: 1.5,
            }}
          >
            {images.length}장의 이미지에서 날짜, 금액, 사용처를
            <br />
            인식하는 중입니다…
          </div>
          <div style={{ width: '100%', maxWidth: 260, marginBottom: 8 }}>
            <ProgressBar value={progress} height={8} />
          </div>
          <div
            style={{
              fontSize: 13,
              color: T.textTer,
              fontVariantNumeric: 'tabular-nums',
              fontWeight: 600,
            }}
          >
            {Math.round(progress)}%
          </div>
        </div>
      )}

      {/* CSS Animations */}
      <style jsx global>{`
        @keyframes pulse {
          0%,
          100% {
            transform: scale(1);
            opacity: 1;
          }
          50% {
            transform: scale(1.05);
            opacity: 0.85;
          }
        }
      `}</style>
    </Screen>
  );
}

// 이미지 썸네일 컴포넌트
function ImageThumb({ img, onRemove }: { img: ImagePreview; onRemove: () => void }) {
  return (
    <div
      style={{
        position: 'relative',
        aspectRatio: '3/4',
        borderRadius: 12,
        overflow: 'hidden',
        background: T.bgSoft,
        border: `1px solid ${T.divider}`,
      }}
    >
      {img.url ? (
        <img
          src={img.url}
          alt={img.label}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      ) : (
        <FauxImage kind={img.kind} />
      )}

      {/* 그라데이션 + 라벨 */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          padding: '14px 6px 6px',
          background: 'linear-gradient(to top, rgba(0,0,0,0.55), rgba(0,0,0,0))',
          color: '#fff',
          fontSize: 10,
          fontWeight: 500,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {img.label}
      </div>

      {/* 삭제 버튼 */}
      <button
        onClick={onRemove}
        aria-label="삭제"
        style={{
          position: 'absolute',
          top: 6,
          right: 6,
          width: 22,
          height: 22,
          borderRadius: 11,
          border: 0,
          background: 'rgba(10,13,20,0.7)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <svg width="9" height="9" viewBox="0 0 9 9">
          <path d="M1 1l7 7M8 1l-7 7" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  );
}

// 데모 이미지 (파일이 없을 때)
function FauxImage({ kind }: { kind: 'toss' | 'card' | 'receipt' | 'photo' }) {
  if (kind === 'toss') {
    return (
      <div
        style={{
          width: '100%',
          height: '100%',
          background: 'linear-gradient(165deg, #4393FF 0%, #1B64DA 100%)',
          padding: '14px 10px',
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
        }}
      >
        <div style={{ color: '#fff', fontSize: 10, fontWeight: 700, letterSpacing: '-0.01em' }}>
          toss
        </div>
        <div style={{ color: '#fff', fontSize: 8, opacity: 0.9, marginBottom: 4 }}>5월 거래내역</div>
      </div>
    );
  }
  if (kind === 'card') {
    return (
      <div
        style={{
          width: '100%',
          height: '100%',
          background: '#1B1B1B',
          padding: '12px 10px',
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
        }}
      >
        <div style={{ color: '#FFD23F', fontSize: 9, fontWeight: 700 }}>KB 국민카드</div>
        <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: 7, marginBottom: 4 }}>5월 명세서</div>
      </div>
    );
  }
  // receipt or photo
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        background: '#FAF7F0',
        padding: '12px 8px',
        fontFamily: 'ui-monospace, monospace',
      }}
    >
      <div
        style={{
          textAlign: 'center',
          fontSize: 9,
          fontWeight: 700,
          color: '#222',
          marginBottom: 6,
        }}
      >
        영수증
      </div>
    </div>
  );
}
