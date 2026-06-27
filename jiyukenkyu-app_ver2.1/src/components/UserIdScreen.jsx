import { useState } from 'react';

export default function UserIdScreen({ onSubmit }) {
  const [num, setNum] = useState('');

  function handleSubmit() {
    const n = parseInt(num);
    if (!n || n < 1 || n > 30) {
      alert('1〜30の番号を入れてね');
      return;
    }
    sessionStorage.setItem('userId', n);
    onSubmit(n);
  }

  return (
    <div className="userid-screen">
      <div className="userid-content">
        <h2 className="userid-title">📱 あなたの番号は？</h2>
        <p className="userid-sub">自分の番号を入力してね</p>
        <input
          type="number"
          className="userid-input"
          placeholder="例: 3"
          value={num}
          onChange={(e) => setNum(e.target.value)}
          min="1"
          max="30"
        />
        <button
          className="userid-btn"
          onClick={handleSubmit}
          disabled={!num}
        >
          はじめる！
        </button>
      </div>
    </div>
  );
}