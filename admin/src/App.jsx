import React, { useEffect, useMemo, useState } from 'react'
import { createApi, resolveApiConfig } from './api.js'
import BulkManager from './BulkManager.jsx'
import CommunityManager from './CommunityManager.jsx'
import CommunityListings from './CommunityListings.jsx'
import Monitor from './Monitor.jsx'
import DataBrowser from './DataBrowser.jsx'
import CollectionLog from './CollectionLog.jsx'
import { isSuperadmin } from './catalog.js'
import { createWorkspaceLoader } from './workspace.js'

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
    monitor: <><rect x="3" y="4" width="18" height="13" rx="2" /><path d="M8 21h8M12 17v4m-6-9 3-3 3 4 5-6" /></>,
    cpu: <><rect x="6" y="6" width="12" height="12" rx="2" /><path d="M9 3v3m6-3v3M9 18v3m6-3v3M3 9h3m-3 6h3m12-6h3m-3 6h3M10 10h4v4h-4z" /></>,
    requests: <><path d="M4 7h15m-4-4 4 4-4 4M20 17H5m4-4-4 4 4 4" /></>,
    users: <><circle cx="9" cy="7" r="3" /><path d="M3 21v-3a6 6 0 0 1 12 0v3M17 4a3 3 0 0 1 0 6m1 5a5 5 0 0 1 3 4v2" /></>,
    warning: <><path d="m12 3 10 18H2Z" /><path d="M12 9v5m0 3h.01" /></>,
    activity: <path d="M3 12h4l3-8 4 16 3-8h4" />,
    history: <><path d="M3 11a9 9 0 1 1 2 7M3 4v7h7M12 7v5l3 2" /></>,
    data: <><ellipse cx="12" cy="5" rx="8" ry="3" /><path d="M4 5v14c0 4 16 4 16 0V5M4 12c0 4 16 4 16 0" /></>,
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
    <section className="login-card"><div className="eyebrow">管理后台</div><h1>欢迎回来</h1><p className="muted">管理社区发布、公告与服务运行。</p>
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
  const api = useMemo(() => createApi({ ...resolveApiConfig(window.ADMIN_CONFIG, window.location.origin), storage: window.sessionStorage, operationStorage: window.localStorage, onUnauthorized: () => { setSession(null); setBootstrap(null) } }), [])
  useEffect(() => { setSession(api.getSession()) }, [api])
  const loader = useMemo(() => createWorkspaceLoader(api, {
    start: () => { setLoading(true); setError('') }, loaded: setBootstrap,
    error: error => setError(error.message), finish: () => setLoading(false)
  }), [api])
  const load = () => loader.load()
  const superadmin = isSuperadmin(session)
  const titles = { bulk: '批量发布', listings: '社区管理', community: '群码与公告', monitor: '运行监控', data: '数据浏览', events: '采集记录' }
  const tabs = [...(superadmin ? [['monitor', 'monitor'], ['data', 'data'], ['events', 'activity']] : []), ['bulk', 'grid'], ['listings', 'grid'], ['community', 'qr']]
  useEffect(() => { setTab(isSuperadmin(session) ? 'monitor' : 'bulk'); setBootstrap(null); setLoading(false); if (session) void load(); return () => loader.invalidate() }, [session, loader])
  async function logout() { loader.invalidate(); setSession(null); setBootstrap(null); setLoading(false); try { await api.logout() } catch (_) {} }
  return <>{!session && <Login api={api} onLogin={setSession} />}<div className="app-shell" hidden={!session}>
    <aside className="sidebar"><a className="brand" href="./" aria-label="极链行管理后台"><div className="brand-mark">极</div><div>极链行<span>管理后台</span></div></a>
      <div className="nav-label">工作台</div><nav aria-label="管理功能">{tabs.map(([name, icon]) => <button type="button" key={name} className={tab === name ? 'active' : ''} onClick={() => setTab(name)}><Icon name={icon} /><span>{titles[name]}</span></button>)}</nav>
      <div className="sidebar-bottom"><div className="account-avatar">A</div><div className="account-name">{session?.admin?.accountId || session?.admin?.username || '管理员'}<span>{superadmin ? '最高管理员' : '普通管理员'}</span></div><button type="button" className="icon-button" aria-label="退出登录" title="退出登录" onClick={logout}><Icon name="logout" /></button></div>
    </aside>
    <div className="workspace"><header className="topbar"><span>共享生活 <span className="crumb">/</span> {titles[tab]}</span><button className="theme-switch" onClick={toggleTheme}>{dark ? '浅色模式' : '深色模式'}</button></header>
      <main className="main-content"><Notice message={error} />
        {loading && !bootstrap ? <div className="loading-state" role="status">正在读取管理数据…</div> : !bootstrap ? <div className="panel empty-state"><h2>数据暂未加载</h2><button className="button primary" onClick={load} disabled={loading}>重新加载</button></div> : <>
          {api.pendingOperations?.().length > 0 && <div className="notice" role="status">上次保存结果尚未确认。<button className="text-button" disabled={loading} onClick={async () => { setLoading(true); try { await api.recoverOperations(); await load() } catch (e) { setError(e.message) } finally { setLoading(false) } }}>核对上次保存结果</button></div>}
          <div hidden={tab !== 'bulk'}><BulkManager key={api.workspaceKey()} api={api} regionTree={bootstrap.regionTree || []} initialTemplates={bootstrap.templates || []} /></div>
          {tab === 'listings' && <CommunityListings api={api} />}
          {superadmin && tab === 'monitor' && <Monitor api={api} />}
          {superadmin && tab === 'data' && <DataBrowser api={api} onNavigate={setTab} />}
          {superadmin && tab === 'events' && <CollectionLog api={api} />}
          <div hidden={tab !== 'community'}><CommunityManager key={`${api.workspaceKey()}:${bootstrap.community.version}`} api={api} initialConfig={bootstrap.community} /></div>
        </>}
      </main>
    </div>
  </div></>
}
