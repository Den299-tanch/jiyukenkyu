import { useState, useEffect } from 'react';
import './App.css';
import TitleScreen from './components/TitleScreen';
import CategorySelect from './components/CategorySelect';
import ChatBox from './components/ChatBox';
import DictScreen from './components/DictScreen'; 
import { callClaude } from './services/Claudeapi';
import SaveThemeArea from './components/SaveThemeArea';
import UserIdScreen from './components/UserIdScreen';
import ThemeListScreen from './components/ThemeListScreen';
import HypothesisScreen from './components/HypothesisScreen';
import ResearchMethodScreen from './components/ResearchMethodScreen';
import ScheduleScreen from './components/ScheduleScreen';
import RecordScreen from './components/RecordScreen';
import ConsiderationScreen from './components/ConsiderationScreen';
import SummaryScreen from './components/SummaryScreen';
import GuideOverlay from './components/GuideOverlay';
import RocketProgress from './components/RocketProgress';
import { getFlowStepIndex, FLOW_STEPS } from './flowSteps';


// 画面の種類
// 'title'          → タイトル画面
// 'dict-category'  → 辞書機能のカテゴリ選択
// 'chat-category'  → テーマ決定のカテゴリ選択
// 'chat'           → チャット画面（テーマ決定）
// 'dict'           → 辞書のキーワード選択

// リロード復元で戻ってよい画面(scheduleContext.hypothesis が確定している画面)
const RESTORABLE_SCREENS = ['schedule', 'record', 'consideration', 'summary'];

export default function App() {
  const [screen, setScreen] = useState('title');
  const [showGuide, setShowGuide] = useState(false);

  // userId はアプリ内では常に number(または未入力なら null)として統一して扱う。
  // sessionStorage は文字列しか保存できないため、読み出し時に必ず数値へ変換する。
  const [userId, setUserId] = useState(() => {
    const stored = sessionStorage.getItem('userId');
    const n = parseInt(stored, 10);
    return Number.isFinite(n) ? n : null;
  });

  const [category, setCategory] = useState(null); // 選択されたカテゴリ
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState([]);
  const [specialMode, setSpecialMode] = useState(null);

  const [themeInput, setThemeInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [savedThemes, setSavedThemes] = useState([]);

  const [selectedTheme, setSelectedTheme] = useState(null);
  const [savedHypotheses, setSavedHypotheses] = useState([]);
  const [scheduleContext, setScheduleContext] = useState(null); // { researchMethods, hypothesis }

  // 復元中フラグ: sessionStorage に研究(仮説)が残っていればリロード直後だけ true。
  // 復元が終わるまで通常画面を出さず、チラつきを防ぐ。
  const [restoring, setRestoring] = useState(
    () => Number.isFinite(parseInt(sessionStorage.getItem('hypothesisId'), 10)),
  );

  // リロード時: sessionStorage に残した hypothesis_id から、④のエンドポイントで
  // 研究データ(テーマ・仮説・研究方法)をまとめて取り直し、続きの画面に戻す。
  useEffect(() => {
    const hid = parseInt(sessionStorage.getItem('hypothesisId'), 10);
    if (!Number.isFinite(hid)) return;

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `${import.meta.env.VITE_API_URL ?? ''}/api/research/${hid}`,
        );
        const data = await res.json();
        if (!data.success) throw new Error(data.error);
        if (cancelled) return;

        // 各画面が必要とする props(テーマ・仮説・研究方法)を組み立て直す。
        // 記録・グラフなどの中身は各画面がDBから読み直すので、ここでは背骨だけ戻す。
        setSelectedTheme(data.theme);
        setScheduleContext({
          hypothesis: data.hypothesis,
          researchMethods: data.researchMethods,
        });
        const savedScreen = sessionStorage.getItem('screen');
        setScreen(RESTORABLE_SCREENS.includes(savedScreen) ? savedScreen : 'schedule');
      } catch {
        // 復元できなければ保存情報を捨てて、通常のはじめからのフローに戻す
        sessionStorage.removeItem('hypothesisId');
        sessionStorage.removeItem('screen');
      } finally {
        if (!cancelled) setRestoring(false);
      }
    })();

    return () => { cancelled = true; };
  }, []);

  // 研究(仮説)が確定している間は、現在の hypothesis_id と画面を sessionStorage に反映する。
  // userId と同じく「文字列で保存し、読み出し時に数値へ戻す」方針にそろえる。
  useEffect(() => {
    const hid = scheduleContext?.hypothesis?.id;
    if (Number.isFinite(hid)) {
      sessionStorage.setItem('hypothesisId', String(hid));
      sessionStorage.setItem('screen', screen);
    }
  }, [scheduleContext, screen]);

  const DEV_CODE_ON  = 'den44bug';
  const DEV_CODE_OFF = 'den44bugoff';

  const DEBU_CODE_ON = 'den44gra';
  const DEBU_CODE_OFF = 'den44graoff';

  // 番号が未入力の間は、他の画面を一切マウントしない(スクロールでの回避を防ぐ)
  if (!userId) {
    return <UserIdScreen onSubmit={(n) => setUserId(n)} />;
  }

  // リロード直後の研究データ復元中は、通常画面を出さずに待つ
  if (restoring) {
    return (
      <div className="app">
        <p style={{ textAlign: 'center', padding: '2rem' }}>研究データを よみこみ中…</p>
      </div>
    );
  }

  // カテゴリが選択されたらチャット画面に遷移
  function handleCategorySelect(selectedCategory) {
    setCategory(selectedCategory);
    setMessages([
      { role: 'ai', text: `「${selectedCategory.label}」について、どんなことが気になってる？` }
    ]);
    setHistory([]);
    setScreen('chat');
  }

  async function handleSend() {
    const text = input.trim();
    if (!text) return;
    if (loading) return; // 連打防止

    if (text === DEV_CODE_OFF) {
      setInput('');
      setSpecialMode(null);
      setMessages(prev => [...prev, { role: 'ai', text: '帰還' }]);
      return;
    }
    if (text === DEV_CODE_ON) {
      setInput('');
      setSpecialMode('dev');
      setMessages(prev => [...prev, { role: 'ai', text: '開発者！！！🫠🎉🫠🎉🫠🎉' }]);
      return;
    }


     if (text === DEBU_CODE_OFF) {
      setInput('');
      setSpecialMode(null);
      setMessages(prev => [...prev, { role: 'ai', text: '帰還' }]);
      return;
    }
    if (text === DEBU_CODE_ON) {
      setInput('');
      setSpecialMode('debu');
      setMessages(prev => [...prev, { role: 'ai', text: '🫃🫃🫃もう食べられないでぶー！！！🍔🍔🍔' }]);
      return;
    }

    setInput('');
    setLoading(true);

    setMessages(prev => [...prev, { role: 'user', text }]);
    setMessages(prev => [...prev, { role: 'ai', text: '考えています…', isLoading: true }]);

    try {
      const { reply, updatedHistory } = await callClaude(text, history, category?.mode, specialMode);
      setHistory(updatedHistory);

      setMessages(prev => {
        const newMessages = [...prev];
        newMessages[newMessages.length - 1] = { role: 'ai', text: reply, isLoading: false };
        return newMessages;
      });
    } catch (err) {
      setMessages(prev => {
        const newMessages = [...prev];
        newMessages[newMessages.length - 1] = { role: 'ai', text: 'エラー: ' + err.message, isLoading: false };
        return newMessages;
      });
    }

    setLoading(false);
  }

  async function handleSaveTheme() {
    const theme = themeInput.trim();
    if (!theme) return;

    setSaving(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL ?? ''}/api/save-theme`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          category: category?.id,
          theme,
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);

      setSavedThemes(prev => [...prev, theme]);
      setThemeInput('');
      setMessages(prev => [...prev, { role: 'ai', text: `テーマ「${theme}」を保存したよ！🎉 他にもあったら追加してね！` }]);
    } catch (err) {
      alert('保存に失敗しました: ' + err.message);
    }
    setSaving(false);
  }

  return (
    <div className="app">
      <RocketProgress currentIndex={getFlowStepIndex(screen)} steps={FLOW_STEPS} />

      {showGuide && <GuideOverlay onClose={() => setShowGuide(false)} />}

      {screen === 'title' && (
        <TitleScreen
          onDict={() => setScreen('dict-category')}
          onChat={() => setScreen('chat-category')}
          onGuide={() => setShowGuide(true)}
        />
      )}

      {screen === 'dict-category' && (
        <CategorySelect
          mode="dict"
          onSelect={(cat) => {
            setCategory(cat);
            setScreen('dict'); // 辞書画面（後で実装）
          }}
          onBack={() => setScreen('title')}
        />
      )}

      {screen === 'chat-category' && (
        <CategorySelect
          mode="chat"
          onSelect={handleCategorySelect}
          onBack={() => setScreen('title')}
        />
      )}

      {screen === 'chat' && (
        <>
          <div className="screen-header">
            <button className="back-btn" onClick={() => setScreen('chat-category')}>← 戻る</button>
            <h2>🔬 {category?.label} のテーマを考えよう</h2>
          </div>
          <ChatBox
            messages={messages}
            input={input}
            setInput={setInput}
            onSend={handleSend}
            loading={loading}
          />
          <SaveThemeArea
            themeInput={themeInput}
            setThemeInput={setThemeInput}
            onSave={handleSaveTheme}
            saving={saving}
            savedThemes={savedThemes}
          />
          <div className="chat-next-row">
            <button
              className="next-btn"
              onClick={() => setScreen('theme-list')}
            >
              テーマ一覧へ →
            </button>
          </div>
        </>
      )}

      {screen === 'dict' && (
        <DictScreen
          category={category}
          onBack={() => setScreen('dict-category')}
        />
      )}

      {screen === 'theme-list' && (
        <ThemeListScreen
          userId={userId}
          currentThemeId={selectedTheme?.id}
          onBack={() => setScreen('chat')}
          onNext={(theme) => {
            setSelectedTheme(theme);
            setScreen('hypothesis');
          }}
        />
      )}

      {screen === 'hypothesis' && (
        <HypothesisScreen
          userId={userId}
          theme={selectedTheme}
          onBack={() => setScreen('theme-list')}
          onNext={(savedHypothesis) => {
            setSavedHypotheses(savedHypothesis);
            setScreen('research-method');
          }}
        />
      )}

      {screen === 'research-method' && (
        <ResearchMethodScreen
          userId={userId}
          theme={selectedTheme}
          savedHypotheses={savedHypotheses}
          onBack={() => setScreen('hypothesis')}
          onNext={(context) => {
            setScheduleContext(context);
            setScreen('schedule');
          }}
        />
      )}

      {screen === 'schedule' && (
        <ScheduleScreen
          userId={userId}
          theme={selectedTheme}
          hypothesis={scheduleContext?.hypothesis}
          researchMethods={scheduleContext?.researchMethods}
          onBack={() => setScreen('research-method')}
          onNext={() => {
            // スケジュール保存後は STEP5(記録パート)へ
            setScreen('record');
          }}
        />
      )}

      {screen === 'record' && (
        <RecordScreen
          userId={userId}
          theme={selectedTheme}
          hypothesis={scheduleContext?.hypothesis}
          onBack={() => setScreen('schedule')}
          onNext={() => setScreen('consideration')}
        />
      )}

      {screen === 'consideration' && (
        <ConsiderationScreen
          userId={userId}
          hypothesis={scheduleContext?.hypothesis}
          onBack={() => setScreen('record')}
          onNext={() => setScreen('summary')}
        />
      )}

      {screen === 'summary' && (
        <SummaryScreen
          userId={userId}
          theme={selectedTheme}
          hypothesis={scheduleContext?.hypothesis}
          onBack={() => setScreen('consideration')}
        />
      )}

    </div>
  );
}
