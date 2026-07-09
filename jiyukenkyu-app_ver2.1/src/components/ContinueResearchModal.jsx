import { useEffect, useState } from 'react';
import { apiGet } from '../services/api';
import { getCategoryById } from '../data/categories';

// TitleScreenの「🔄 つづきから」から開くモーダル。
// テーマ選択・仮説パートのために用意した既存エンドポイント(/api/themes・
// /api/hypotheses)で一覧を作り、選ぶと GET /api/research/:id で1回で
// hydrateする。着地画面(schedule/record/consideration/summary)の判定は
// 呼び出し側(App.jsx)が pickResearchLandingScreen で行う。
export default function ContinueResearchModal({ onClose, onSelect }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [openingId, setOpeningId] = useState(null);

  useEffect(() => {
    let ignore = false;
    async function fetchList() {
      try {
        const [themesRes, hypRes] = await Promise.all([
          apiGet('/api/themes'),
          apiGet('/api/hypotheses'),
        ]);
        if (ignore) return;
        if (!themesRes.success || !hypRes.success) {
          throw new Error(themesRes.error || hypRes.error || '読み込みに失敗したよ');
        }
        const themeById = new Map(themesRes.themes.map((t) => [t.id, t]));
        const list = hypRes.hypotheses
          .map((h) => ({
            id: h.id,
            hypothesis: h.hypothesis,
            theme: themeById.get(h.theme_id) ?? null,
          }))
          .reverse(); // 新しい順
        setItems(list);
      } catch (err) {
        if (!ignore) setError(err.message);
      }
      if (!ignore) setLoading(false);
    }
    fetchList();
    return () => {
      ignore = true;
    };
  }, []);

  async function handleOpen(hypothesisId) {
    if (openingId) return;
    setOpeningId(hypothesisId);
    try {
      const data = await apiGet(`/api/research/${hypothesisId}`);
      if (!data.success) throw new Error(data.error);
      onSelect(data);
    } catch (err) {
      alert('研究の読み込みに失敗しました: ' + err.message);
      setOpeningId(null);
    }
  }

  return (
    <div className="guide-backdrop" onClick={onClose}>
      <div className="continue-card" onClick={(e) => e.stopPropagation()}>
        <button className="guide-close-btn" onClick={onClose} aria-label="とじる">
          ✕
        </button>
        <h3 className="continue-title">🔄 つづきから えらぶ</h3>

        {loading && <p className="theme-list-msg">読み込み中…</p>}
        {error && <p className="theme-list-msg">エラー: {error}</p>}

        {!loading && !error && items.length === 0 && (
          <p className="theme-list-msg">まだ研究がないよ。新しくはじめよう！</p>
        )}

        {!loading && !error && items.length > 0 && (
          <ul className="continue-list">
            {items.map((item) => {
              const cat = getCategoryById(item.theme?.category);
              const isOpening = openingId === item.id;
              return (
                <li
                  key={item.id}
                  className="continue-item"
                  onClick={() => handleOpen(item.id)}
                  style={{
                    cursor: openingId ? 'wait' : 'pointer',
                    opacity: openingId && !isOpening ? 0.5 : 1,
                  }}
                >
                  <span className="continue-item-cat">
                    {cat ? `${cat.icon} ${cat.label}` : item.theme?.category}
                  </span>
                  <span className="continue-item-theme">{item.theme?.theme}</span>
                  <p className="continue-item-hypo">{item.hypothesis}</p>
                  {isOpening && (
                    <span className="continue-item-loading">読み込み中…</span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
