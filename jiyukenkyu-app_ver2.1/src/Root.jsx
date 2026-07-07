import { useState, useEffect } from 'react'
import App from './App.jsx'
import AdminApp from './AdminApp.jsx'

// 管理者モードは隠しルート。エンドユーザーの画面には入口を出さない。
// URL末尾が /admin か、ハッシュ #admin のときだけ管理者アプリを描画する。
function isAdminRoute() {
  const path = window.location.pathname.replace(/\/+$/, '')
  const hash = window.location.hash.replace(/^#/, '')
  return path.endsWith('/admin') || hash === 'admin'
}

// ハッシュだけの変更(例: 通常モードを表示中のタブでURLに#adminを足す)は
// ブラウザがページの再読み込みをしないため、起動時の判定だけでは切り替わらない。
// hashchangeを監視して、リロードなしでも管理者モードに切り替えられるようにする。
export default function Root() {
  const [admin, setAdmin] = useState(isAdminRoute())
  useEffect(() => {
    const onHashChange = () => setAdmin(isAdminRoute())
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])
  return admin ? <AdminApp /> : <App />
}
