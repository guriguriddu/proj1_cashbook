// screen-ocr.jsx — OCR 검수 화면
// List of extracted txns. Tap a row → bottom sheet to edit / exclude.

// Demo extracted batch — what the OCR "found".
window.OCR_EXTRACTED = [
  { id: 'o1', date: '2026-05-14', amount: 14500, merchant: '스타벅스 강남R점', cat: 'food',    sub: '카페',     src: '토스',   confidence: 0.97 },
  { id: 'o2', date: '2026-05-14', amount: 28900, merchant: '배달의민족',        cat: 'food',    sub: '배달',     src: '카드',   confidence: 0.95 },
  { id: 'o3', date: '2026-05-14', amount: 12500, merchant: '카카오T',           cat: 'transit', sub: '카카오T',  src: '카드',   confidence: 0.93 },
  { id: 'o4', date: '2026-05-13', amount: 89000, merchant: '쿠팡',              cat: 'shop',    sub: '쿠팡',     src: '카드',   confidence: 0.98 },
  { id: 'o5', date: '2026-05-13', amount: 4500,  merchant: 'GS25 역삼점',        cat: 'food',    sub: '편의점',   src: '영수증', confidence: 0.88 },
  { id: 'o6', date: '2026-05-13', amount: 6800,  merchant: '메가커피',          cat: 'food',    sub: '카페',     src: '토스',   confidence: 0.94 },
  { id: 'o7', date: '2026-05-12', amount: 158000, merchant: '무신사',           cat: 'shop',    sub: '무신사',   src: '토스',   confidence: 0.91 },
  { id: 'o8', date: '2026-05-12', amount: 32000, merchant: '한촌설렁탕',         cat: 'food',    sub: '외식',     src: '카드',   confidence: 0.86 },
  // intentionally low-confidence ones for the user to verify
  { id: 'o9', date: '2026-05-11', amount: 65000, merchant: 'SK주유 강남',        cat: 'etc',     sub: '기타',     src: '카드',   confidence: 0.62, needsReview: true },
  { id: 'o10', date: '2026-05-11', amount: 22000, merchant: '배달의민족',        cat: 'food',    sub: '배달',     src: '카드',   confidence: 0.93 },
  { id: 'o11', date: '2026-05-10', amount: 49000, merchant: '인프런 (강의)',     cat: 'etc',     sub: '기타',     src: '카드',   confidence: 0.71, needsReview: true },
  { id: 'o12', date: '2026-05-09', amount: 41000, merchant: '오마카세 료',       cat: 'food',    sub: '외식',     src: '토스',   confidence: 0.83 },
];

function OCRReviewScreen({ navigate, onSave }) {
  const [items, setItems] = React.useState(() => {
    // each item gets an "excluded" boolean; we work on a copy so leaving
    // the screen doesn't dirty the global demo dataset
    return window.OCR_EXTRACTED.map(i => ({ ...i, excluded: false }));
  });
  const [editing, setEditing] = React.useState(null);

  const active = items.filter(i => !i.excluded);
  const total = active.reduce((a, i) => a + i.amount, 0);
  const needsReviewCount = active.filter(i => i.needsReview).length;

  const update = (id, patch) => {
    setItems(items.map(i => i.id === id ? { ...i, ...patch } : i));
  };

  // group by date (desc)
  const byDate = {};
  active.forEach(i => {
    if (!byDate[i.date]) byDate[i.date] = [];
    byDate[i.date].push(i);
  });
  const dates = Object.keys(byDate).sort((a, b) => b.localeCompare(a));

  // also show excluded as a collapsed section at the bottom
  const excluded = items.filter(i => i.excluded);

  return (
    <Screen>
      <AppHeader title="추출 결과 검수" onBack={() => navigate('upload')} />
      <ScreenBody padBottom={120}>
        {/* summary banner */}
        <div style={{ padding: '16px 20px 12px' }}>
          <div style={{
            background: T.accentSoft, borderRadius: 16, padding: 16,
          }}>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              marginBottom: 4,
            }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#166534' }}>
                {active.length}건 인식 완료
              </span>
              <span style={{ fontSize: 11, fontWeight: 600, color: '#166534', opacity: 0.7 }}>
                3장의 이미지에서
              </span>
            </div>
            <MoneyText value={total} size={26} weight={800} color="#0F5132" />
            {needsReviewCount > 0 && (
              <div style={{
                marginTop: 12, padding: '10px 12px', borderRadius: 10,
                background: 'rgba(245,158,11,0.16)',
                display: 'flex', alignItems: 'center', gap: 8,
                fontSize: 12, fontWeight: 600, color: '#92400E',
              }}>
                <svg width="14" height="14" viewBox="0 0 14 14"><path d="M7 1l6.5 11.5h-13L7 1zM7 5.5v3M7 10.5v.5" stroke="#92400E" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" fill="none"/></svg>
                {needsReviewCount}건은 카테고리를 확인해주세요
              </div>
            )}
          </div>
        </div>

        {/* helper text */}
        <div style={{ padding: '4px 20px 8px', fontSize: 12, color: T.textTer, lineHeight: 1.5 }}>
          항목을 탭하면 수정할 수 있어요. 잘못 인식된 거래는 제외할 수 있어요.
        </div>

        {/* list grouped by date */}
        {dates.map(d => (
          <div key={d} style={{ marginBottom: 8 }}>
            <div style={{
              padding: '12px 20px 6px', fontSize: 12, fontWeight: 700,
              color: T.textTer, letterSpacing: '-0.01em',
            }}>{window.formatDate(d)}</div>
            <div style={{ background: T.bg }}>
              {byDate[d].map((it, idx, arr) => (
                <OCRRow key={it.id} item={it}
                        last={idx === arr.length - 1}
                        onTap={() => setEditing(it.id)} />
              ))}
            </div>
          </div>
        ))}

        {/* excluded section */}
        {excluded.length > 0 && (
          <div style={{ marginTop: 16, padding: '12px 20px' }}>
            <div style={{
              fontSize: 12, fontWeight: 700, color: T.textTer,
              marginBottom: 8,
            }}>제외된 {excluded.length}건</div>
            <div style={{
              background: T.bgSoft, borderRadius: 12, padding: '4px 0',
            }}>
              {excluded.map(it => (
                <div key={it.id} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '10px 14px', fontSize: 13,
                  color: T.textTer, textDecoration: 'line-through',
                }}>
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {it.merchant}
                  </span>
                  <span style={{ fontVariantNumeric: 'tabular-nums' }}>
                    {window.formatWon(it.amount)}
                  </span>
                  <button onClick={() => update(it.id, { excluded: false })} style={{
                    border: 0, background: 'transparent', cursor: 'pointer',
                    color: T.accent, fontSize: 13, fontWeight: 600, padding: '4px 0',
                  }}>복구</button>
                </div>
              ))}
            </div>
          </div>
        )}
      </ScreenBody>

      {/* bottom action */}
      <div style={{
        position: 'absolute', left: 0, right: 0, bottom: 0,
        padding: '12px 20px 28px',
        background: 'linear-gradient(to top, rgba(255,255,255,1) 60%, rgba(255,255,255,0))',
      }}>
        <PrimaryButton onClick={() => { onSave?.(active); navigate('home'); }}>
          {active.length}건 저장하기
        </PrimaryButton>
      </div>

      {/* edit sheet */}
      {editing && (
        <EditTxnSheet
          item={items.find(i => i.id === editing)}
          onClose={() => setEditing(null)}
          onChange={(patch) => update(editing, patch)}
          onExclude={() => { update(editing, { excluded: true }); setEditing(null); }}
        />
      )}
    </Screen>
  );
}

function OCRRow({ item, last, onTap }) {
  const cat = window.CATEGORY_BY_ID[item.cat];
  return (
    <button onClick={onTap} style={{
      width: '100%', display: 'flex', alignItems: 'center', gap: 12,
      padding: '12px 20px', border: 0, background: 'transparent',
      borderBottom: last ? 'none' : `1px solid ${T.divider}`,
      cursor: 'pointer', textAlign: 'left',
    }}>
      <CatIcon cat={cat} size={40} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 2,
        }}>
          <div style={{
            fontSize: 15, fontWeight: 600, color: T.text,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            letterSpacing: '-0.01em',
          }}>{item.merchant}</div>
          {item.needsReview && (
            <Badge tone="warn" size="sm">확인 필요</Badge>
          )}
        </div>
        <div style={{
          fontSize: 12, color: T.textTer,
          display: 'flex', alignItems: 'center', gap: 4,
        }}>
          <span style={{ color: cat.color, fontWeight: 600 }}>{cat.name}</span>
          <span>·</span>
          <span>{item.sub}</span>
          <span>·</span>
          <span style={{
            padding: '1px 6px', borderRadius: 4, background: T.bgMuted,
            fontSize: 10, fontWeight: 600,
          }}>{item.src}</span>
        </div>
      </div>
      <div style={{ textAlign: 'right' }}>
        <div style={{
          fontSize: 16, fontWeight: 700, color: T.text,
          fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em',
        }}>−{window.formatWon(item.amount).replace('₩','₩ ')}</div>
      </div>
    </button>
  );
}

// Bottom sheet for editing one transaction
function EditTxnSheet({ item, onClose, onChange, onExclude }) {
  if (!item) return null;
  const [merchant, setMerchant] = React.useState(item.merchant);
  const [amount, setAmount] = React.useState(item.amount);
  const [date, setDate] = React.useState(item.date);
  const [catId, setCatId] = React.useState(item.cat);
  const [sub, setSub] = React.useState(item.sub);
  const [pickerOpen, setPickerOpen] = React.useState(false);

  const apply = () => {
    onChange({ merchant, amount: Number(amount) || 0, date, cat: catId, sub, needsReview: false });
    onClose();
  };

  const cat = window.CATEGORY_BY_ID[catId];

  return (
    <BottomSheet open onClose={onClose} title="거래 편집" height="80%">
      <div style={{ padding: '0 20px 20px' }}>
        {/* amount input — large */}
        <div style={{
          padding: '20px 0 24px', textAlign: 'center',
          borderBottom: `1px solid ${T.divider}`, marginBottom: 16,
        }}>
          <div style={{ fontSize: 12, color: T.textSec, fontWeight: 500, marginBottom: 6 }}>금액</div>
          <div style={{
            display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: 4,
            fontSize: 28, fontWeight: 800, letterSpacing: '-0.02em',
            fontVariantNumeric: 'tabular-nums',
          }}>
            <span style={{ fontSize: 18, fontWeight: 700, color: T.textSec, flexShrink: 0 }}>₩</span>
            <input
              type="text" inputMode="numeric"
              value={Number(amount || 0).toLocaleString('ko-KR')}
              onChange={(e) => {
                const digits = e.target.value.replace(/[^\d]/g, '');
                setAmount(Math.max(0, Math.floor(Number(digits) || 0)));
              }}
              style={{
                border: 0, background: 'transparent', textAlign: 'center',
                fontFamily: 'Pretendard, system-ui, sans-serif',
                fontSize: 28, fontWeight: 800, color: T.text,
                fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em',
                width: `${Number(amount || 0).toLocaleString('ko-KR').length}ch`,
                minWidth: 80, maxWidth: 220,
                outline: 'none', padding: 0,
              }}
            />
            <span style={{ fontSize: 16, fontWeight: 700, color: T.textSec, flexShrink: 0 }}>원</span>
          </div>
        </div>

        {/* fields */}
        <div style={{
          background: T.bgSoft, borderRadius: 14, overflow: 'hidden', marginBottom: 16,
        }}>
          <FieldRow label="사용처" style={{ background: 'transparent' }}>
            <input
              value={merchant}
              onChange={(e) => setMerchant(e.target.value)}
              style={{
                border: 0, background: 'transparent', textAlign: 'right',
                fontSize: 15, fontWeight: 600, color: T.text,
                fontFamily: 'Pretendard, system-ui, sans-serif',
                width: '100%', outline: 'none',
              }}
            />
          </FieldRow>
          <FieldRow label="카테고리" style={{ background: 'transparent' }}>
            <button onClick={() => setPickerOpen(true)} style={{
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

        {/* OCR confidence */}
        <div style={{
          padding: '12px 14px', background: T.bgMuted, borderRadius: 10,
          fontSize: 12, color: T.textSec, marginBottom: 16,
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <circle cx="7" cy="7" r="6" stroke={T.textTer} strokeWidth="1.4"/>
            <path d="M7 4v3.5L9 9" stroke={T.textTer} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          인식 정확도 {(item.confidence * 100).toFixed(0)}% · 원본: {item.src}
        </div>

        {/* actions */}
        <div style={{ display: 'flex', gap: 8 }}>
          <SecondaryButton onClick={onExclude} style={{ flex: 1, color: T.danger }}>제외하기</SecondaryButton>
          <PrimaryButton onClick={apply} style={{ flex: 1.4 }}>완료</PrimaryButton>
        </div>
      </div>

      {pickerOpen && (
        <BottomSheet open onClose={() => setPickerOpen(false)} title="카테고리 선택" height="70%">
          <CategoryPicker
            catId={catId} sub={sub}
            onPick={(cid, s) => { setCatId(cid); setSub(s); setPickerOpen(false); }}
          />
        </BottomSheet>
      )}
    </BottomSheet>
  );
}

Object.assign(window, { OCRReviewScreen });
