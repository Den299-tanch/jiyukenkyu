import { useEffect, useState } from 'react';
import { getCategoryById } from '../data/categories';
import { apiGet } from '../services/api';
import { useResearch } from '../contexts/ResearchContext';
import Ruby from './Ruby';

export default function ThemeListScreen({ userId, onBack, onNext }) {
  const { research } = useResearch();
  const currentThemeId = research?.theme?.id;
  const [themes, setThemes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedTheme, setSelectedTheme] = useState(null); // ← 追加

  // 画面表示時に1回だけ実行
  useEffect(() => {
    async function fetchThemes() {
      try {
        const data = await apiGet('/api/themes');
        if (!data.success) throw new Error(data.error);
        setThemes(data.themes);
        // 戻るボタンで再度この画面に来たとき、前回選んでいたテーマの選択状態を復元する
        if (currentThemeId) {
          const matched = data.themes.find((t) => t.id === currentThemeId);
          if (matched) setSelectedTheme(matched);
        }
      } catch (err) {
        setError(err.message);
      }
      setLoading(false);
    }
    fetchThemes();
  }, [userId, currentThemeId]);

  return (
    <div className="theme-list-screen">
      <div className="screen-header">
        <button className="back-btn" onClick={onBack}>← <Ruby>{"戻[もど]る"}</Ruby></button>
        <h2>📋 <Ruby>{"きみのテーマ一覧[いちらん]（"}</Ruby>{userId}<Ruby>{"番[ばん]）"}</Ruby></h2>
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
              const isSelected = selectedTheme?.id === t.id; // ← 追加
              return (
                <li
                  key={t.id}
                  className={`theme-list-item ${isSelected ? 'selected' : ''}`} // ← 追加
                  onClick={() => setSelectedTheme(t)} // ← 追加
                  style={{ cursor: 'pointer' }} // ← 追加
                >
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
        <button
          className="next-btn"
          onClick={() => onNext(selectedTheme)}
          disabled={!selectedTheme}
        >
          <Ruby>{"仮説[かせつ]を考[かんが]える →"}</Ruby>
        </button>
      </div>
    </div>
  );
}
