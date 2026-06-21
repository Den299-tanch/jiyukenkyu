import { useState } from 'react';
import './App.css';
import ChatBox from './components/ChatBox';
import { callGemini } from './services/geminiAPI';

export default function App() {
  const [messages, setMessages] = useState([
    { role: 'ai', text: 'こんにちは！自由研究の相談にのるよ。どんなことが気になってる？' }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState([]);

  async function handleSend() {
    const text = input.trim();
    if (!text) return;

    setInput('');
    setLoading(true);

    setMessages(prev => [...prev, { role: 'user', text }]);
    setMessages(prev => [...prev, { role: 'ai', text: '考えています…', isLoading: true }]);

    try {
      const { reply, updatedHistory } = await callGemini(text, history);
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
      <h1>🔬 自由研究AIアシスタント</h1>
      <ChatBox
        messages={messages}
        input={input}
        setInput={setInput}
        onSend={handleSend}
        loading={loading}
      />
    </div>
  );
}
