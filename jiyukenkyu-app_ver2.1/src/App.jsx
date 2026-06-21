import { useState } from 'react';
import './App.css';
import TitleScreen from './components/TitleScreen';
import CategorySelect from './components/CategorySelect';
import ChatBox from './components/ChatBox';
import DictScreen from './components/DictScreen'; 
import { callClaude } from './services/Claudeapi';

// 画面の種類
// 'title'          → タイトル画面
// 'dict-category'  → 辞書機能のカテゴリ選択
// 'chat-category'  → テーマ決定のカテゴリ選択
// 'chat'           → チャット画面（テーマ決定）
// 'dict'           → 辞書のキーワード選択

export default function App() {
  const [screen, setScreen] = useState('title');
  const [category, setCategory] = useState(null); // 選択されたカテゴリ

  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState([]);

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

    setInput('');
    setLoading(true);

    setMessages(prev => [...prev, { role: 'user', text }]);
    setMessages(prev => [...prev, { role: 'ai', text: '考えています…', isLoading: true }]);

    try {
      const { reply, updatedHistory } = await callClaude(text, history, category?.mode);
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
        </>
      )}

      {screen === 'dict' && (
        <DictScreen
          category={category}
          onBack={() => setScreen('dict-category')}
        />
      )}

    </div>
  );
}
