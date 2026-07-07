import { useState } from 'react';
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


// 画面の種類
// 'title'          → タイトル画面
// 'dict-category'  → 辞書機能のカテゴリ選択
// 'chat-category'  → テーマ決定のカテゴリ選択
// 'chat'           → チャット画面（テーマ決定）
// 'dict'           → 辞書のキーワード選択

export default function App() {
  const [screen, setScreen] = useState('title');

  const [userId, setUserId] = useState(sessionStorage.getItem('userId') || null);

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

  const DEV_CODE_ON  = 'den44bug';
  const DEV_CODE_OFF = 'den44bugoff';

  const DEBU_CODE_ON = 'den44gra';
  const DEBU_CODE_OFF = 'den44graoff';

  // 番号が未入力の間は、他の画面を一切マウントしない(スクロールでの回避を防ぐ)
  if (!userId) {
    return <UserIdScreen onSubmit={(n) => setUserId(n)} />;
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
      {screen === 'title' && (
        <TitleScreen
          onDict={() => setScreen('dict-category')}
          onChat={() => setScreen('chat-category')}
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
          onNext={(savedSchedule) => {
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
          theme={selectedTheme}
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
