// バックエンドへの全アクセスの共通窓口。
// ログイン(POST /api/auth)で得たトークンを localStorage から読んで
// Authorization ヘッダーに自動で付与する(呼び出し側は user_id を意識しなくてよい)。
const BASE = import.meta.env.VITE_API_URL ?? '';

// トークンが無効になった(PINリセットなど)ときに呼ばれるハンドラ。
// App.jsx がログイン画面に戻す処理をここに登録する。
let onUnauthorized = null;
export function setUnauthorizedHandler(fn) {
  onUnauthorized = fn;
}

function authHeaders() {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function handleResponse(res) {
  if (res.status === 401 && onUnauthorized) onUnauthorized();
  return res.json();
}

export async function apiGet(path) {
  const res = await fetch(`${BASE}${path}`, { headers: authHeaders() });
  return handleResponse(res);
}

export async function apiPost(path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(body ?? {}),
  });
  return handleResponse(res);
}

export async function apiDelete(path) {
  const res = await fetch(`${BASE}${path}`, { method: 'DELETE', headers: authHeaders() });
  return handleResponse(res);
}
