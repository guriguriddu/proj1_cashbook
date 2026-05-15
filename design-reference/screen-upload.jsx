// screen-upload.jsx — 이미지 업로드 화면
// Drag from gallery, drop here, then "OCR 추출 시작"

function UploadScreen({ navigate, onExtract }) {
  // Picked images live as data URLs so the UI can show real thumbnails of
  // anything the user drops in. We pre-seed with three "demo" cards so the
  // empty state still has something to look at while testing.
  const [images, setImages] = React.useState([
    { id: 'd1', kind: 'toss', label: '토스 거래내역.png' },
    { id: 'd2', kind: 'card', label: '국민카드 5월.jpg' },
    { id: 'd3', kind: 'receipt', label: 'GS25_영수증.jpg' },
  ]);
  const [extracting, setExtracting] = React.useState(false);
  const [progress, setProgress] = React.useState(0);
  const fileInput = React.useRef(null);

  const onFiles = (files) => {
    const next = [...images];
    Array.from(files).slice(0, 12 - images.length).forEach((f) => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        next.push({
          id: 'u' + Date.now() + Math.random(),
          kind: 'photo',
          label: f.name,
          dataUrl: ev.target.result,
        });
        setImages([...next]);
      };
      reader.readAsDataURL(f);
    });
  };

  const remove = (id) => setImages(images.filter(i => i.id !== id));

  const startExtract = () => {
    setExtracting(true);
    setProgress(0);
    const t1 = setInterval(() => {
      setProgress(p => {
        const next = p + (5 + Math.random() * 10);
        if (next >= 100) {
          clearInterval(t1);
          setTimeout(() => navigate('ocr'), 350);
          return 100;
        }
        return next;
      });
    }, 120);
  };

  const [dragOver, setDragOver] = React.useState(false);

  return (
    <Screen>
      <AppHeader title="사진으로 추가" onBack={() => navigate('add')} />
      <ScreenBody padBottom={120}>

        {/* drop zone */}
        <div style={{ padding: '16px 20px 12px' }}>
          <div
            onClick={() => fileInput.current?.click()}
            onDragEnter={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
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
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              cursor: 'pointer', textAlign: 'center',
              transition: 'all .15s',
            }}
          >
            <div style={{
              width: 64, height: 64, borderRadius: 32,
              background: T.bg, color: T.accent,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              marginBottom: 14,
              boxShadow: '0 2px 6px rgba(10,13,20,0.06)',
            }}>
              <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                <path d="M14 4v16M6 12l8-8 8 8" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M4 22h20" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"/>
              </svg>
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, letterSpacing: '-0.02em', marginBottom: 4 }}>
              갤러리에서 끌어다 놓기
            </div>
            <div style={{ fontSize: 13, color: T.textSec, lineHeight: 1.5 }}>
              또는 탭해서 파일 선택<br/>
              토스 / 카드 캡쳐 / 영수증 사진 모두 가능
            </div>
            <input ref={fileInput} type="file" accept="image/*" multiple
                   onChange={(e) => onFiles(e.target.files)}
                   style={{ display: 'none' }} />
          </div>
        </div>

        {/* source-type quick chips — informational */}
        <div style={{ padding: '0 20px 16px', display: 'flex', gap: 8, overflowX: 'auto' }}>
          {[
            { label: '토스 거래내역', icon: '💸' },
            { label: '카드 명세서',  icon: '💳' },
            { label: '영수증 사진',  icon: '🧾' },
            { label: '계좌 거래',    icon: '🏦' },
          ].map(c => (
            <div key={c.label} style={{
              flexShrink: 0, padding: '8px 12px', borderRadius: 999,
              background: T.bgMuted, fontSize: 12, fontWeight: 600,
              color: T.textSec, display: 'flex', alignItems: 'center', gap: 6,
              letterSpacing: '-0.01em',
            }}>
              <span>{c.icon}</span>{c.label}
            </div>
          ))}
        </div>

        {/* selected images */}
        <div style={{ padding: '0 20px 16px' }}>
          <div style={{
            display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
            marginBottom: 10,
          }}>
            <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: '-0.01em' }}>
              선택한 이미지 <span style={{ color: T.accent }}>{images.length}</span>
            </div>
            {images.length > 0 && (
              <button onClick={() => setImages([])} style={{
                border: 0, background: 'transparent', color: T.textTer,
                fontSize: 13, fontWeight: 500, cursor: 'pointer', padding: 0,
              }}>전체 삭제</button>
            )}
          </div>
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10,
          }}>
            {images.map(img => (
              <ImageThumb key={img.id} img={img} onRemove={() => remove(img.id)} />
            ))}
            <button onClick={() => fileInput.current?.click()} style={{
              border: `1.5px dashed ${T.divider}`, background: T.bgSoft,
              aspectRatio: '3/4', borderRadius: 12, cursor: 'pointer',
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              justifyContent: 'center', gap: 6, color: T.textTer,
            }}>
              <svg width="20" height="20" viewBox="0 0 20 20"><path d="M10 4v12M4 10h12" stroke={T.textTer} strokeWidth="1.8" strokeLinecap="round"/></svg>
              <span style={{ fontSize: 11, fontWeight: 600 }}>추가</span>
            </button>
          </div>
        </div>

        {/* hint */}
        <div style={{ padding: '0 20px', fontSize: 12, color: T.textTer, lineHeight: 1.6 }}>
          ※ 업로드한 이미지는 인식 후 안전하게 삭제됩니다. 인식이 어려운 경우 일부 항목을 직접 수정하셔야 할 수 있어요.
        </div>
      </ScreenBody>

      {/* sticky bottom action */}
      <div style={{
        position: 'absolute', left: 0, right: 0, bottom: 0,
        padding: '12px 20px 28px',
        background: 'linear-gradient(to top, rgba(255,255,255,1) 60%, rgba(255,255,255,0))',
      }}>
        <PrimaryButton onClick={startExtract} disabled={images.length === 0}>
          OCR 추출 시작 {images.length > 0 && `(${images.length}장)`}
        </PrimaryButton>
      </div>

      {/* extracting overlay */}
      {extracting && (
        <div style={{
          position: 'absolute', inset: 0, background: 'rgba(255,255,255,0.96)',
          zIndex: 200, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', padding: 40,
        }}>
          <div style={{
            width: 80, height: 80, borderRadius: 40,
            background: T.accentSoft, color: T.accent,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            marginBottom: 24,
            animation: 'pulse 1.6s infinite',
          }}>
            <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
              <rect x="6" y="9" width="24" height="18" rx="2" stroke="currentColor" strokeWidth="2.2"/>
              <path d="M11 16h14M11 20h10" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"/>
            </svg>
          </div>
          <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8, letterSpacing: '-0.02em' }}>
            거래 내역을 추출하고 있어요
          </div>
          <div style={{ fontSize: 14, color: T.textSec, marginBottom: 28, textAlign: 'center', lineHeight: 1.5 }}>
            {images.length}장의 이미지에서 날짜, 금액, 사용처를<br/>인식하는 중입니다…
          </div>
          <div style={{ width: '100%', maxWidth: 260, marginBottom: 8 }}>
            <ProgressBar value={progress} height={8} />
          </div>
          <div style={{
            fontSize: 13, color: T.textTer, fontVariantNumeric: 'tabular-nums',
            fontWeight: 600,
          }}>{Math.round(progress)}%</div>
        </div>
      )}
    </Screen>
  );
}

// ── thumbnail ——— rendered as a faux receipt/card preview when no real image
function ImageThumb({ img, onRemove }) {
  return (
    <div style={{
      position: 'relative', aspectRatio: '3/4', borderRadius: 12,
      overflow: 'hidden', background: T.bgSoft, border: `1px solid ${T.divider}`,
    }}>
      {img.dataUrl
        ? <img src={img.dataUrl} alt={img.label} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        : <FauxImage kind={img.kind} />}

      {/* gradient + label */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        padding: '14px 6px 6px',
        background: 'linear-gradient(to top, rgba(0,0,0,0.55), rgba(0,0,0,0))',
        color: '#fff', fontSize: 10, fontWeight: 500,
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>{img.label}</div>

      {/* remove */}
      <button onClick={onRemove} aria-label="삭제" style={{
        position: 'absolute', top: 6, right: 6,
        width: 22, height: 22, borderRadius: 11, border: 0,
        background: 'rgba(10,13,20,0.7)', cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <svg width="9" height="9" viewBox="0 0 9 9"><path d="M1 1l7 7M8 1l-7 7" stroke="#fff" strokeWidth="1.5" strokeLinecap="round"/></svg>
      </button>
    </div>
  );
}

// Faux preview for demo seed images (no real upload).
function FauxImage({ kind }) {
  if (kind === 'toss') {
    return (
      <div style={{
        width: '100%', height: '100%',
        background: 'linear-gradient(165deg, #4393FF 0%, #1B64DA 100%)',
        padding: '14px 10px',
        display: 'flex', flexDirection: 'column', gap: 6,
      }}>
        <div style={{ color: '#fff', fontSize: 10, fontWeight: 700, letterSpacing: '-0.01em' }}>toss</div>
        <div style={{ color: '#fff', fontSize: 8, opacity: 0.9, marginBottom: 4 }}>5월 거래내역</div>
        {[14500, 28900, 4500, 6800].map((v, i) => (
          <div key={i} style={{
            background: 'rgba(255,255,255,0.16)', borderRadius: 4,
            padding: '4px 5px', fontSize: 7, color: '#fff',
            display: 'flex', justifyContent: 'space-between',
          }}>
            <span style={{ opacity: 0.85 }}>5.{14-i}</span>
            <span style={{ fontWeight: 700 }}>−{v.toLocaleString()}</span>
          </div>
        ))}
      </div>
    );
  }
  if (kind === 'card') {
    return (
      <div style={{
        width: '100%', height: '100%', background: '#1B1B1B',
        padding: '12px 10px',
        display: 'flex', flexDirection: 'column', gap: 4,
      }}>
        <div style={{ color: '#FFD23F', fontSize: 9, fontWeight: 700 }}>KB 국민카드</div>
        <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: 7, marginBottom: 4 }}>5월 명세서</div>
        {['스타벅스', '쿠팡', '카카오T', '메가커피', '배민'].map((m, i) => (
          <div key={i} style={{
            fontSize: 7, color: 'rgba(255,255,255,0.85)',
            display: 'flex', justifyContent: 'space-between',
            borderBottom: '0.5px solid rgba(255,255,255,0.15)', padding: '2px 0',
          }}>
            <span>{m}</span>
            <span style={{ fontWeight: 600, color: '#fff' }}>{(8000 + i*4500).toLocaleString()}</span>
          </div>
        ))}
      </div>
    );
  }
  // receipt
  return (
    <div style={{
      width: '100%', height: '100%', background: '#FAF7F0',
      padding: '12px 8px', position: 'relative',
      fontFamily: 'ui-monospace, monospace',
    }}>
      <div style={{ textAlign: 'center', fontSize: 9, fontWeight: 700, color: '#222', marginBottom: 6 }}>
        GS25 역삼점
      </div>
      <div style={{ fontSize: 6, color: '#444', textAlign: 'center', marginBottom: 6, lineHeight: 1.4 }}>
        2026-05-13 19:42<br/>TEL 02-555-1234
      </div>
      <div style={{ borderTop: '1px dashed #888', borderBottom: '1px dashed #888', padding: '4px 0' }}>
        {['삼각김밥 1,500','컵라면 1,800','음료 1,200'].map((s, i) => (
          <div key={i} style={{ fontSize: 6.5, color: '#222', display: 'flex', justifyContent: 'space-between' }}>
            <span>{s.split(' ')[0]}</span><span>{s.split(' ')[1]}</span>
          </div>
        ))}
      </div>
      <div style={{
        display: 'flex', justifyContent: 'space-between',
        fontSize: 8, fontWeight: 700, color: '#000', marginTop: 4,
      }}>
        <span>합계</span><span>4,500</span>
      </div>
    </div>
  );
}

Object.assign(window, { UploadScreen });
