import React, { useEffect, useMemo, useState } from 'react'
import { createApi, resolveEndpoint } from './api.js'
import BulkManager from './BulkManager.jsx'
import CommunityManager from './CommunityManager.jsx'

export function Icon({ name, size = 20 }) {
  const paths = {
    grid: <><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></>,
    qr: <><path d="M3 3h6v6H3zM15 3h6v6h-6zM3 15h6v6H3zM15 15h3v3h3v3h-6zM21 12v3M12 3v3M12 9v6M3 12h6M12 21v-3" /></>,
    logout: <><path d="M9 4H4v16h5M13 8l4 4-4 4M8 12h13" /></>,
    plus: <path d="M12 5v14M5 12h14" />,
    image: <><rect x="3" y="3" width="18" height="18" rx="3" /><circle cx="8" cy="8" r="1.5" /><path d="m3 16 5-5 5 5 3-3 5 5" /></>,
    check: <path d="m5 12 4 4L19 6" />,
    edit: <><path d="m15 5 4 4M4 20l5-1L20 8a2.8 2.8 0 0 0-4-4L5 15l-1 5Z" /></>,
    close: <path d="m6 6 12 12M18 6 6 18" />,
    arrow: <path d="M4 12h16m-6-6 6 6-6 6" />,
    lock: <><rect x="5" y="10" width="14" height="11" rx="3" /><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3" /></>
  }
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name] || paths.grid}</svg>
}
export function Field({ label, required, hint, children, wide = false }) {
  return <label className={`field${wide ? ' wide' : ''}`}><span className="field-label">{label}{required && <span className="required"> *</span>}</span>{children}{hint && <span className="field-hint">{hint}</span>}</label>
}
export function Notice({ message, kind = 'error' }) {
  return message ? <div className={`notice ${kind}`} role={kind === 'error' ? 'alert' : 'status'}>{message}</div> : null
}
export function usePendingChanges(dirty) {
  useEffect(() => {
    if (!dirty) return
    const handler = event => { event.preventDefault(); event.returnValue = '' }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [dirty])
}
export function ConfirmDialog({ title, children, confirmText = '确认', busy, onConfirm, onClose }) {
  const ref = React.useRef(null)
  useEffect(() => { ref.current.showModal() }, [])
  return <dialog ref={ref} className="confirm-dialog" onCancel={event => { event.preventDefault(); if (!busy) onClose() }}>
    <h2>{title}</h2><div className="dialog-body">{children}</div>
    <div className="button-row end"><button type="button" className="button secondary" disabled={busy} onClick={onClose}>返回检查</button><button type="button" className="button primary" disabled={busy} onClick={onConfirm}>{busy ? '正在保存…' : confirmText}</button></div>
  </dialog>
}

function Login({ api, onLogin }) {
  const [username, setUsername] = useState('admin'); const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false); const [error, setError] = useState('')
  async function submit(event) {
    event.preventDefault(); setError(''); setBusy(true)
    try { const session = await api.login(username.trim(), password); setPassword(''); onLogin(session) }
    catch (e) { setError(e.message) } finally { setBusy(false) }
  }
  return <main className="login-shell">
    <div className="login-brand"><div className="brand-mark">极</div><span>极链行 <small>ADMIN</small></span></div>
    <section className="login-card"><div className="eyebrow">管理后台</div><h1>欢迎回来</h1><p className="muted">登录后管理商品发布和拼车群公告。</p>
      <form onSubmit={submit}><Field label="管理员账号"><input autoComplete="username" required value={username} onChange={e => setUsername(e.target.value)} maxLength={64} autoCapitalize="none" /></Field><Field label="密码"><input type="password" autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)} maxLength={256} /></Field><Notice message={error} /><button className="button primary full" disabled={busy}>{busy ? '正在登录…' : '登录管理后台'}<Icon name="arrow" /></button></form>
      <div className="login-note"><Icon name="lock" size={16} /><span>仅限已授权管理员</span></div>
    </section><p className="login-footer">Campus Rides · 共享生活</p>
  </main>
}

export default function App() {
  const [session, setSession] = useState(null); const [tab, setTab] = useState('bulk')
  const [dark, setDark] = useState(() => document.documentElement.dataset.theme === 'dark')
  function toggleTheme() { const next = !dark; setDark(next); document.documentElement.dataset.theme = next ? 'dark' : 'light'; try { localStorage.setItem('linkx-theme', next ? 'dark' : 'light') } catch (_) {} }
  const [bootstrap, setBootstrap] = useState(null); const [loading, setLoading] = useState(false); const [error, setError] = useState('')
  const api = useMemo(() => createApi({ endpoint: resolveEndpoint(window.ADMIN_CONFIG?.apiUrl, window.location.origin), storage: window.sessionStorage, onUnauthorized: () => { setSession(null) } }), [])
  useEffect(() => { setSession(api.getSession()) }, [api])
  async function load() {
    setLoading(true); setError('')
    try { const result = await api.call('bootstrap'); setBootstrap(result) }
    catch (e) { setError(e.message) } finally { setLoading(false) }
  }
  useEffect(() => { if (session) load() }, [session])
  async function logout() { try { await api.logout() } catch (_) {} setSession(null); setBootstrap(null) }
  return <>{!session && <Login api={api} onLogin={setSession} />}<div className="app-shell" hidden={!session}>
    <aside className="sidebar"><a className="brand" href="./" aria-label="极链行管理后台"><div className="brand-mark">极</div><div>极链行<span>管理后台</span></div></a>
      <div className="nav-label">工作台</div><nav aria-label="管理功能"><button type="button" className={tab === 'bulk' ? 'active' : ''} onClick={() => setTab('bulk')}><Icon name="grid" /><span>批量发布</span></button><button type="button" className={tab === 'community' ? 'active' : ''} onClick={() => setTab('community')}><Icon name="qr" /><span>群码与公告</span></button></nav>
      <div className="sidebar-bottom"><div className="account-avatar">A</div><div className="account-name">{session?.admin?.username || '管理员'}<span>管理员账号</span></div><button type="button" className="icon-button" aria-label="退出登录" title="退出登录" onClick={logout}><Icon name="logout" /></button></div>
    </aside>
    <div className="workspace"><header className="topbar"><span>共享生活 <span className="crumb">/</span> {tab === 'bulk' ? '批量发布' : '群码与公告'}</span><button className="theme-switch" onClick={toggleTheme}>{dark ? '浅色模式' : '深色模式'}</button></header>
      <main className="main-content"><Notice message={error} />
        {loading && !bootstrap ? <div className="loading-state" role="status">正在读取管理数据…</div> : !bootstrap ? <div className="panel empty-state"><h2>数据暂未加载</h2><button className="button primary" onClick={load} disabled={loading}>重新加载</button></div> : <>
          <div hidden={tab !== 'bulk'}><BulkManager api={api} regionTree={bootstrap.regionTree || []} initialTemplates={bootstrap.templates || []} /></div>
          <div hidden={tab !== 'community'}><CommunityManager api={api} initialConfig={bootstrap.community} /></div>
        </>}
      </main>
    </div>
  </div></>
}
