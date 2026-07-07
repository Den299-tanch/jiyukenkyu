import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './summary.css'
import App from './App.jsx'
import AdminApp from './AdminApp.jsx'

// 管理者モードは隠しルート。エンドユーザーの画面には入口を出さない。
// URL末尾が /admin か、ハッシュ #admin のときだけ管理者アプリを描画する。
function isAdminRoute() {
  const path = window.location.pathname.replace(/\/+$/, '')
  const hash = window.location.hash.replace(/^#/, '')
  return path.endsWith('/admin') || hash === 'admin'
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {isAdminRoute() ? <AdminApp /> : <App />}
  </StrictMode>,
)
