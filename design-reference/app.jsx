// app.jsx — main app shell with navigation state.

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "palette": "accent",
  "demo": "normal",
  "showDevice": true
}/*EDITMODE-END*/;

function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);

  // navigation — a tiny stack so onBack can pop. We don't keep a deep history.
  // Pages: 'home' | 'history' | 'budget' | 'add' | 'manual' | 'upload' | 'ocr'
  const [route, setRoute] = React.useState({ name: 'home', params: {} });
  const [tab, setTab] = React.useState('home'); // last active bottom tab

  const navigate = (name, params) => {
    if (name === 'home' || name === 'history' || name === 'budget') setTab(name);
    if (name === 'add') setTab('add');
    setRoute({ name, params: params || {} });
  };

  // ── budget + expenses state (so demo data feels live)
  const [budget, setBudget] = React.useState(window.BUDGET_MAY);
  const [expenses, setExpenses] = React.useState(window.EXPENSES);

  // Tweak: demo data set — switch between "normal", "over budget", and "empty".
  React.useEffect(() => {
    if (t.demo === 'normal') {
      setBudget(window.BUDGET_MAY);
      setExpenses(window.EXPENSES);
    } else if (t.demo === 'over') {
      // bump expenses so everything is over budget
      const over = window.EXPENSES.concat([
        { id: 'ox1', date: '2026-05-14', amount: 240000, merchant: '백화점 식품관',     cat: 'food', sub: '외식', src: '카드' },
        { id: 'ox2', date: '2026-05-13', amount: 320000, merchant: '무신사',           cat: 'shop', sub: '무신사', src: '카드' },
        { id: 'ox3', date: '2026-05-12', amount: 180000, merchant: '카카오T',          cat: 'transit', sub: '택시', src: '카드' },
      ]);
      setExpenses(over);
      setBudget(window.BUDGET_MAY);
    } else if (t.demo === 'empty') {
      setExpenses([]);
      setBudget(window.BUDGET_MAY);
    }
  }, [t.demo]);

  // Render the active screen.
  let screen;
  switch (route.name) {
    case 'home':
      screen = <HomeScreen navigate={navigate} expenses={expenses} budget={budget} palette={t.palette} />;
      break;
    case 'history':
      screen = <HistoryScreen navigate={navigate} expenses={expenses} budget={budget} initialCat={route.params.cat} />;
      break;
    case 'budget':
      screen = <BudgetScreen navigate={navigate} budget={budget} setBudget={setBudget} />;
      break;
    case 'add':
      screen = <InputChoiceScreen navigate={navigate} />;
      break;
    case 'manual':
      screen = <ManualEntryScreen navigate={navigate}
        onSave={(e) => setExpenses([...expenses, e])} />;
      break;
    case 'upload':
      screen = <UploadScreen navigate={navigate} />;
      break;
    case 'ocr':
      screen = <OCRReviewScreen navigate={navigate}
        onSave={(rows) => {
          // Add OCR-confirmed rows to the live expense list (de-duped against
          // matching ids; demo data overlaps so this avoids visual doubling).
          const ids = new Set(expenses.map(e => e.id));
          const fresh = rows
            .filter(r => !ids.has(r.id))
            .map(({ confidence, needsReview, excluded, ...rest }) => rest);
          setExpenses([...expenses, ...fresh]);
        }}
      />;
      break;
    default:
      screen = <HomeScreen navigate={navigate} expenses={expenses} budget={budget} palette={t.palette} />;
  }

  // Determine bottom tab visibility — hide on flow screens that own a single task
  // (upload, ocr, manual) so the user is focused on completing the step.
  const showTabBar = ['home', 'history', 'budget'].includes(route.name);

  const content = (
    <div style={{
      width: '100%', height: '100%', position: 'relative',
      background: T.bg, overflow: 'hidden',
      fontFamily: 'Pretendard, system-ui, sans-serif',
      color: T.text,
    }}>
      {screen}
      {showTabBar && (
        <BottomTabBar active={tab} onNavigate={navigate} />
      )}
    </div>
  );

  return (
    <div style={{
      width: '100vw', minHeight: '100vh',
      background: 'radial-gradient(ellipse at top, #F4F5F7 0%, #ECEDF0 100%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '32px 20px',
    }}>
      {t.showDevice ? (
        <IOSDevice width={402} height={874}>
          <div style={{ width: '100%', height: '100%' }}>{content}</div>
        </IOSDevice>
      ) : (
        <div style={{
          width: 402, height: 874, borderRadius: 32, overflow: 'hidden',
          boxShadow: '0 30px 60px rgba(0,0,0,0.15)',
          background: T.bg,
        }}>{content}</div>
      )}

      <TweaksPanel>
        <TweakSection label="데이터" />
        <TweakRadio label="시나리오" value={t.demo}
                    options={[
                      { value: 'normal', label: '정상' },
                      { value: 'over',   label: '초과' },
                      { value: 'empty',  label: '빈 상태' },
                    ]}
                    onChange={(v) => setTweak('demo', v)} />
        <TweakSection label="스타일" />
        <TweakRadio label="카테고리 바 색상" value={t.palette}
                    options={[
                      { value: 'accent',   label: '단색' },
                      { value: 'category', label: '컬러' },
                    ]}
                    onChange={(v) => setTweak('palette', v)} />
        <TweakToggle label="아이폰 프레임" value={t.showDevice}
                     onChange={(v) => setTweak('showDevice', v)} />
        <TweakSection label="화면 이동" />
        <TweakSelect label="현재 화면" value={route.name}
                     options={[
                       { value: 'home',    label: '홈 대시보드' },
                       { value: 'history', label: '월별 내역' },
                       { value: 'budget',  label: '예산 설정' },
                       { value: 'add',     label: '지출 추가' },
                       { value: 'manual',  label: '직접 입력' },
                       { value: 'upload',  label: '이미지 업로드' },
                       { value: 'ocr',     label: 'OCR 검수' },
                     ]}
                     onChange={(v) => navigate(v)} />
      </TweaksPanel>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
