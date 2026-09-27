// Temporary CloudBase transport. Remove after the backend release is verified and
// all legacy admin drafts/receipts are reconciled. Never invoke as network fallback.
import { errorMessage } from '../errors.js'

export function createCloudbaseTransport({ endpoint, storage, fetcher = fetch, onUnauthorized = () => {} }) {
  const SESSION_KEY = `admin_session:cloudbase:${endpoint}`
  let session = null
  try {
    const saved = JSON.parse(storage.getItem(SESSION_KEY) || 'null')
    if (saved && typeof saved.token === 'string' && saved.expiresAtMs > Date.now()) session = saved
    else storage.removeItem(SESSION_KEY)
  } catch (_) {}
  function clear() { session = null; try { storage.removeItem(SESSION_KEY) } catch (_) {} }
  async function call(action, data = {}, { anonymous = false } = {}) {
    const actor = session
    if (!anonymous && (!session || session.expiresAtMs <= Date.now())) {
      clear(); onUnauthorized(); throw new Error('登录已过期，请重新登录')
    }
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 90000)
    try {
      const payload = JSON.stringify({ ...data, action })
      const binaryUpload = action === 'uploadImage'
      const response = await fetcher(endpoint, {
        method: 'POST', credentials: 'omit', cache: 'no-store', signal: controller.signal,
        // CloudBase's JSON/text gateway limit is 100 KB. Binary transport keeps
        // the original image intact and is decoded by the same authenticated API.
        headers: { 'Content-Type': binaryUpload ? 'application/octet-stream' : 'application/json', ...(anonymous ? {} : { Authorization: `Bearer ${session.token}` }) },
        body: binaryUpload ? new TextEncoder().encode(payload) : payload
      })
      let result
      try { result = await response.json() } catch (_) { throw new Error('管理接口暂时不可用，请确认网站已完成部署') }
      if (!response.ok || !result || result.ok !== true) {
        if (!anonymous && (response.status === 401 || ['unauthorized', 'session_expired', 'invalid_session', 'session_invalid', 'authentication_required'].includes(result?.error))) { if (session === actor) { clear(); onUnauthorized() } }
        const code = result?.error || result?.code || (response.status === 413 ? 'EXCEED_MAX_PAYLOAD_SIZE' : 'request_failed')
        const error = new Error(errorMessage(code))
        error.code = code
        throw error
      }
      return result
    } catch (error) {
      if (error.name === 'AbortError') throw new Error('请求时间较长，请稍后重试；重复提交会自动去重')
      if (error instanceof TypeError) throw new Error('无法连接管理接口，请检查网络或网站授权配置')
      throw error
    } finally { clearTimeout(timeout) }
  }
  return {
    call, clear, getSession: () => session,
    async login(username, password) {
      const result = await call('login', { username, password }, { anonymous: true })
      if (typeof result.token !== 'string' || !Number.isFinite(result.expiresAtMs) || result.expiresAtMs <= Date.now()) throw new Error('登录响应无效')
      session = { token: result.token, expiresAtMs: result.expiresAtMs, admin: result.admin }
      try { storage.setItem(SESSION_KEY, JSON.stringify(session)) } catch (_) {}
      return session
    },
    async logout() { const actor = session; try { await call('logout') } finally { if (session === actor) clear() } }
  }
}
