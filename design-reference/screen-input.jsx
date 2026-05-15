// screen-input.jsx — 입력 방식 선택 (직접 입력 / 사진으로 추가)
// Also hosts the manual-entry form (one-screen).

function InputChoiceScreen({ navigate, onAddManual }) {
  return (
    <Screen>
      <AppHeader title="지출 추가" onBack={() => navigate('home')} />
      <ScreenBody>
        <div style={{ padding: '24px 20px 8px' }}>
          <div style={{
            fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em',
            color: T.text, marginBottom: 6, lineHeight: 1.3,
          }}>
            어떻게 추가할까요?
          </div>
          <div style={{ fontSize: 14, color: T.textSec, lineHeight: 1.5 }}>
            토스·카드·영수증 캡쳐를 올리면 자동으로 거래 내역을 추출해드려요.
          </div>
        </div>

        <div style={{ padding: '24px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <ChoiceCard
            onClick={() => navigate('upload')}
            accent
            iconBg={T.accentSoft}
            iconColor={T.accent}
            icon={
              <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                <rect x="3" y="6" width="22" height="17" rx="2.5" stroke="currentColor" strokeWidth="2"/>
                <circle cx="10" cy="13" r="2.2" stroke="currentColor" strokeWidth="2"/>
                <path d="M3 19l6-5 5 4 4-3 7 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            }
            title="사진으로 추가"
            desc="토스 / 카드 / 영수증 캡쳐 OCR"
            badge={<Badge tone="accent" size="md">추천</Badge>}
          />

          <ChoiceCard
            onClick={() => navigate('manual')}
            iconBg={T.bgMuted}
            iconColor={T.text}
            icon={
              <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                <path d="M14 4v20M4 14h20" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"/>
              </svg>
            }
            title="직접 입력"
            desc="금액과 사용처를 직접 입력"
          />
        </div>

        <div style={{ padding: '8px 20px 0', fontSize: 12, color: T.textTer, lineHeight: 1.6 }}>
          여러 장의 영수증을 한 번에 올려도 괜찮아요. 추출 후 검수 단계에서 자유롭게 수정·제외할 수 있어요.
        </div>
      </ScreenBody>
    </Screen>
  );
}

function ChoiceCard({ onClick, icon, iconBg, iconColor, title, desc, badge, accent }) {
  return (
    <button onClick={onClick} style={{
      width: '100%', border: 0, padding: 20, borderRadius: 18,
      background: accent ? T.accentSoft + '80' : T.bgSoft,
      display: 'flex', alignItems: 'center', gap: 16, cursor: 'pointer',
      textAlign: 'left', transition: 'transform .12s',
    }}>
      <div style={{
        width: 56, height: 56, borderRadius: 16,
        background: iconBg, color: iconColor,
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>{icon}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4,
        }}>
          <div style={{ fontSize: 17, fontWeight: 700, letterSpacing: '-0.02em' }}>{title}</div>
          {badge}
        </div>
        <div style={{ fontSize: 13, color: T.textSec, letterSpacing: '-0.01em' }}>{desc}</div>
      </div>
      <svg width="9" height="16" viewBox="0 0 9 16" style={{ flexShrink: 0 }}>
        <path d="M1.5 1.5l6 6.5-6 6.5" stroke={T.textTer} strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    </button>
  );
}

// ── Manual entry form — uses a numeric "calculator" rather than a real keyboard
function ManualEntryScreen({ navigate, onSave }) {
  const [amount, setAmount] = React.useState(0);
  const [merchant, setMerchant] = React.useState('');
  const [catId, setCatId] = React.useState('food');
  const [sub, setSub] = React.useState('카페');
  const [date, setDate] = React.useState('2026-05-14');
  const [catSheetOpen, setCatSheetOpen] = React.useState(false);

  const cat = window.CATEGORY_BY_ID[catId];

  const pressKey = (k) => {
    if (k === 'del') {
      setAmount(Math.floor(amount / 10));
    } else if (k === '00') {
      const next = amount * 100;
      if (next < 1_000_000_000) setAmount(next);
    } else {
      const next = amount * 10 + Number(k);
      if (next < 1_000_000_000) setAmount(next);
    }
  };

  const canSave = amount > 0 && merchant.trim().length > 0;

  const handleSave = () => {
    onSave && onSave({
      id: 'm' + Date.now(),
      date, amount, merchant: merchant.trim(),
      cat: catId, sub, src: '직접입력',
    });
    navigate('home');
  };

  return (
    <Screen>
      <AppHeader title="직접 입력" onBack={() => navigate('add')} />
      <ScreenBody padBottom={24}>
        {/* amount hero */}
        <div style={{
          padding: '32px 20px 24px',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: 13, color: T.textSec, fontWeight: 500, marginBottom: 12 }}>
            얼마를 썼나요?
          </div>
          <div style={{
            fontSize: 44, fontWeight: 800, letterSpacing: '-0.03em',
            color: amount === 0 ? T.textMuted : T.text,
            fontVariantNumeric: 'tabular-nums',
            display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: 6,
          }}>
            <span style={{ fontSize: 30, fontWeight: 700, color: amount === 0 ? T.textMuted : T.textSec }}>₩</span>
            {amount.toLocaleString('ko-KR')}
          </div>
        </div>

        {/* form fields */}
        <div style={{ padding: '0 20px', marginBottom: 16 }}>
          <div style={{
            background: T.bgSoft, borderRadius: 16, overflow: 'hidden',
          }}>
            <FieldRow label="사용처" style={{ background: 'transparent' }}>
              <input
                value={merchant}
                onChange={(e) => setMerchant(e.target.value)}
                placeholder="예: 스타벅스"
                style={{
                  border: 0, background: 'transparent', textAlign: 'right',
                  fontSize: 15, fontWeight: 600, color: T.text,
                  fontFamily: 'Pretendard, system-ui, sans-serif',
                  width: '100%', outline: 'none',
                }}
              />
            </FieldRow>
            <FieldRow label="카테고리" style={{ background: 'transparent' }}>
              <button onClick={() => setCatSheetOpen(true)} style={{
                border: 0, background: 'transparent', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 6,
                fontSize: 15, fontWeight: 600, color: T.text,
                fontFamily: 'Pretendard, system-ui, sans-serif',
              }}>
                <span style={{
                  width: 8, height: 8, borderRadius: 4, background: cat.color, display: 'inline-block',
                }} />
                {cat.name} · {sub}
                <svg width="14" height="14" viewBox="0 0 14 14"><path d="M4 5l3 3 3-3" stroke={T.textTer} strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </button>
            </FieldRow>
            <FieldRow label="날짜" style={{ background: 'transparent', borderBottom: 0 }}>
              <input
                type="date" value={date} onChange={(e) => setDate(e.target.value)}
                style={{
                  border: 0, background: 'transparent', textAlign: 'right',
                  fontSize: 15, fontWeight: 600, color: T.text,
                  fontFamily: 'Pretendard, system-ui, sans-serif',
                  outline: 'none',
                }}
              />
            </FieldRow>
          </div>
        </div>

        {/* numpad */}
        <div style={{ padding: '0 12px 12px' }}>
          <Numpad onKey={pressKey} />
        </div>

        {/* save */}
        <div style={{ padding: '8px 20px 16px' }}>
          <PrimaryButton onClick={handleSave} disabled={!canSave}>저장</PrimaryButton>
        </div>
      </ScreenBody>

      <BottomSheet
        open={catSheetOpen}
        onClose={() => setCatSheetOpen(false)}
        title="카테고리 선택"
        height="70%"
      >
        <CategoryPicker
          catId={catId} sub={sub}
          onPick={(cid, s) => { setCatId(cid); setSub(s); setCatSheetOpen(false); }}
        />
      </BottomSheet>
    </Screen>
  );
}

function Numpad({ onKey }) {
  const keys = [
    ['1','2','3'],
    ['4','5','6'],
    ['7','8','9'],
    ['00','0','del'],
  ];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {keys.map((row, i) => (
        <div key={i} style={{ display: 'flex', gap: 4 }}>
          {row.map(k => (
            <button key={k} onClick={() => onKey(k)} style={{
              flex: 1, height: 52, border: 0, background: 'transparent',
              fontFamily: 'Pretendard, system-ui, sans-serif',
              fontSize: 22, fontWeight: 600, color: T.text,
              cursor: 'pointer', borderRadius: 10,
              transition: 'background .1s',
            }}
            onMouseDown={(e) => e.currentTarget.style.background = T.bgMuted}
            onMouseUp={(e) => e.currentTarget.style.background = 'transparent'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
            >
              {k === 'del' ? (
                <svg width="22" height="16" viewBox="0 0 22 16" style={{ display: 'inline-block' }}>
                  <path d="M7 1h13a1.5 1.5 0 011.5 1.5v11A1.5 1.5 0 0120 15H7L1 8z" fill="none" stroke={T.text} strokeWidth="1.6"/>
                  <path d="M11 5l5 5M16 5l-5 5" stroke={T.text} strokeWidth="1.6" strokeLinecap="round"/>
                </svg>
              ) : k}
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}

// Category picker — used by manual + OCR edit sheet
function CategoryPicker({ catId, sub, onPick }) {
  const [selectedCat, setSelectedCat] = React.useState(catId);
  const cat = window.CATEGORY_BY_ID[selectedCat];
  return (
    <div>
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10,
        padding: '0 20px 16px',
      }}>
        {window.CATEGORIES.map(c => (
          <button key={c.id} onClick={() => setSelectedCat(c.id)} style={{
            border: 0, padding: '14px 8px', borderRadius: 14, cursor: 'pointer',
            background: c.id === selectedCat ? c.color + '18' : T.bgSoft,
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
            position: 'relative',
          }}>
            <div style={{
              fontSize: 22, lineHeight: 1,
              filter: c.id === selectedCat ? 'none' : 'grayscale(0.5)',
            }}>{c.emoji}</div>
            <div style={{
              fontSize: 12, fontWeight: 600,
              color: c.id === selectedCat ? c.color : T.textSec,
              letterSpacing: '-0.01em',
            }}>{c.name}</div>
          </button>
        ))}
      </div>
      <div style={{
        padding: '12px 20px 8px',
        fontSize: 12, fontWeight: 700, color: T.textTer,
        textTransform: 'uppercase', letterSpacing: '0.06em',
      }}>세부 항목</div>
      <div style={{ padding: '0 20px 8px', display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {cat.sub.map(s => (
          <button key={s} onClick={() => onPick(selectedCat, s)} style={{
            border: `1.5px solid ${s === sub && selectedCat === catId ? cat.color : T.divider}`,
            background: s === sub && selectedCat === catId ? cat.color + '12' : T.bg,
            color: s === sub && selectedCat === catId ? cat.color : T.text,
            fontFamily: 'Pretendard, system-ui, sans-serif',
            fontSize: 14, fontWeight: 600, letterSpacing: '-0.01em',
            padding: '10px 14px', borderRadius: 22, cursor: 'pointer',
          }}>{s}</button>
        ))}
      </div>
    </div>
  );
}

Object.assign(window, { InputChoiceScreen, ManualEntryScreen, CategoryPicker });
