import { useEffect, useState } from 'react';
import { apiGet } from '../services/api';
import { getCategoryById } from '../data/categories';

// ログイン後の主な入り口(DBベースの復元フロー)。
// 「番号+PINでログイン → 研究一覧が出る → 選ぶ → hydrate」の"選ぶ"にあたる画面。
// sessionStorageでの自動復元はこの画面をスキップする"おまけ"の近道にすぎず、
// 消えていてもここから必ず同じ場所へ戻れる。
export default function ResearchListScreen({ onSelect, onStartNew }) {
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
            createdAt: h.created_at,
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
      // theme/hypothesis/researchMethods等をまるごと呼び出し側(App.jsx)に渡す。
      onSelect(data);
    } catch (err) {
      alert('研究の読み込みに失敗しました: ' + err.message);
      setOpeningId(null);
    }
  }

  return (
    <div className="research-list-screen">
      <div className="screen-header">
        <h2>📚 あなたの研究一覧</h2>
      </div>

      <div className="research-list-content">
        {loading && <p className="theme-list-msg">読み込み中…</p>}
        {error && <p className="theme-list-msg">エラー: {error}</p>}

        {!loading && !error && items.length === 0 && (
          <p className="theme-list-msg">まだ研究がないよ。新しくはじめよう！</p>
        )}

        {!loading && !error && items.length > 0 && (
          <ul className="research-list">
            {items.map((item) => {
              const cat = getCategoryById(item.theme?.category);
              const isOpening = openingId === item.id;
              return (
                <li
                  key={item.id}
                  className="research-list-item"
                  onClick={() => handleOpen(item.id)}
                  style={{
                    cursor: openingId ? 'wait' : 'pointer',
                    opacity: openingId && !isOpening ? 0.5 : 1,
                  }}
                >
                  <span className="research-list-cat">
                    {cat ? `${cat.icon} ${cat.label}` : item.theme?.category}
                  </span>
                  <span className="research-list-theme">{item.theme?.theme}</span>
                  <p className="research-list-hypo">{item.hypothesis}</p>
                  {isOpening && (
                    <span className="research-list-loading">読み込み中…</span>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        <button className="next-btn research-list-new-btn" onClick={onStartNew}>
          ＋ 新しい研究をはじめる
        </button>
      </div>
    </div>
  );
}
