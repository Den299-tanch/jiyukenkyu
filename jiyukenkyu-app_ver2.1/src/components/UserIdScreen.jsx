import { useState } from 'react';
import { apiPost } from '../services/api';

export default function UserIdScreen({ onSubmit }) {
  const [num, setNum] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    if (loading) return;
    const n = parseInt(num, 10);
    if (!n || n < 1 || n > 200) {
      setError('1〜200の番号を入れてね');
      return;
    }
    if (!/^\d{4}$/.test(pin)) {
      setError('あんしょう番号は4けたの数字だよ');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const data = await apiPost('/api/auth', { user_id: n, pin });
      if (!data.success) throw new Error(data.error || 'ログインに失敗したよ');
      localStorage.setItem('userId', String(data.user_id));
      localStorage.setItem('token', data.token);
      onSubmit(data.user_id);
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  }

  return (
    <div className="userid-screen">
      <div className="userid-content">
        <h2 className="userid-title">📱 あなたの番号は？</h2>
        <p className="userid-sub">
          自分の番号と、あんしょう番号(4けた)を入れてね
        </p>
        <input
          type="number"
          className="userid-input"
          placeholder="例: 3"
          value={num}
          onChange={(e) => setNum(e.target.value)}
          min="1"
          max="200"
        />
        <input
          type="password"
          inputMode="numeric"
          className="userid-input userid-pin-input"
          placeholder="あんしょう番号"
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
          onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
          maxLength={4}
        />
        {error && <p className="userid-error">{error}</p>}
        <button
          className="userid-btn"
          onClick={handleSubmit}
          disabled={!num || pin.length !== 4 || loading}
        >
          {loading ? '確認中…' : 'はじめる！'}
        </button>
        <p className="userid-note">
          はじめての番号なら、そのままとうろくされるよ。
          <br />
          2回目からは、さいしょに決めたあんしょう番号を入れてね。
        </p>
      </div>
    </div>
  );
}
