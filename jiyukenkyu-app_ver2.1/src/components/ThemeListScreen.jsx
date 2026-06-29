import { useEffect, useState } from 'react';
import { getCategoryById } from '../data/categories';

export default function ThemeListScreen({ userId, onBack, onNext }) {
  const [themes, setThemes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // 画面表示時に1回だけ実行
  useEffect(() => {
    async function fetchThemes() {
      try {
        const res = await fetch(`${import.meta.env.VITE_API_URL ?? ''}/api/themes/${userId}`);
        const data = await res.json();
        if (!data.success) throw new Error(data.error);
        setThemes(data.themes);
      } catch (err) {
        setError(err.message);
      }
      setLoading(false);
    }
    fetchThemes();
  }, [userId]);

  return (
    <div className="theme-list-screen">
      <div className="screen-header">
        <button className="back-btn" onClick={onBack}>← 戻る</button>
        <h2>📋 きみのテーマ一覧（{userId}番）</h2>
      </div>

      <div className="theme-list-content">
        {loading && <p className="theme-list-msg">読み込み中…</p>}
        {error && <p className="theme-list-msg">エラー: {error}</p>}

        {!loading && !error && themes.length === 0 && (
          <p className="theme-list-msg">まだテーマが保存されていないよ</p>
        )}

        {!loading && !error && themes.length > 0 && (
          <ul className="theme-list">
            {themes.map((t) => {
              const cat = getCategoryById(t.category);
              return (
                <li key={t.id} className="theme-list-item">
                  <span className="theme-list-cat">
                    {cat ? `${cat.icon} ${cat.label}` : t.category}
                  </span>
                  <span className="theme-list-text">{t.theme}</span>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="theme-list-footer">
        <button className="next-btn" onClick={onNext}>
          仮説を考える →
        </button>
      </div>
    </div>
  );
}
