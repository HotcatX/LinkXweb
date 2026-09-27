import { errorMessage } from './errors.js'
import { createOperations, digest } from './operations.js'

export function marketRegions(tree) {
  if (!Array.isArray(tree?.states) || !tree.states.length) throw new Error('地区目录暂时不可用，请重新加载')
  return tree.states.map(state => {
    const groups = new Map()
    for (const area of state.areas || []) {
      const key = area.groupKey || 'all'
      if (!groups.has(key)) groups.set(key, { key, label: area.groupLabel || '全部区域', areas: [] })
      groups.get(key).areas.push({ key: area.key, label: area.label })
    }
    return { key: state.key, label: state.label, groups: [...groups.values()] }
  })
}
export function createBackendApi({ endpoint, storage, operationStorage = storage, fetcher = fetch, onUnauthorized = () => {} }) {
  const sessionKey = `admin_session:backend:${endpoint}`
  let session = null
  try { const saved = JSON.parse(storage.getItem(sessionKey)); if (saved?.token && saved.expiresAtMs > Date.now()) session = saved } catch (_) {}
  function clear() { session = null; try { storage.removeItem(sessionKey) } catch (_) {} }
  const operations = () => createOperations(operationStorage, `admin_operations:${endpoint}:${session.admin.accountId}`)
  async function request(path, { method = 'GET', data, raw, key, anonymous = false } = {}) {
    const actor = session
    if (!anonymous && (!actor || actor.expiresAtMs <= Date.now())) { clear(); onUnauthorized(); throw new Error('登录已过期，请重新登录') }
    if (!/^\/api\/v1\/[a-zA-Z0-9_/%-]+$/.test(path) || new URL(path, endpoint).origin !== new URL(endpoint).origin) throw new Error('管理接口路径无效')
    const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), 90000)
    try {
      const response = await fetcher(new URL(path, endpoint).href, { method, credentials: 'omit', cache: 'no-store', redirect: 'error', signal: controller.signal,
        headers: { ...(data !== undefined || raw ? { 'Content-Type': raw ? 'application/octet-stream' : 'application/json' } : {}),
          ...(anonymous ? {} : { Authorization: `Bearer ${actor.token}` }), ...(key ? { 'Idempotency-Key': key } : {}) },
        ...(raw ? { body: raw } : data !== undefined ? { body: JSON.stringify(data) } : {}) })
      let result
      try { result = await response.json() } catch (_) { throw new Error('管理接口响应无效，请重试原操作确认结果') }
      if (!response.ok || result?.ok !== true) {
        const code = result?.error?.code || (response.status === 413 ? 'EXCEED_MAX_PAYLOAD_SIZE' : 'REQUEST_FAILED')
        if (!anonymous && response.status === 401 && session === actor) { clear(); onUnauthorized() }
        const error = new Error(errorMessage(code)); error.code = code; error.status = response.status; throw error
      }
      if (!result.data || typeof result.data !== 'object') throw new Error('管理接口响应无效，请重试原操作确认结果')
      return result.data
    } catch (error) {
      if (error.name === 'AbortError') throw new Error('请求超时，请重试原操作确认结果；操作编号会保留')
      if (error instanceof TypeError) throw new Error('无法连接管理接口，请检查网络后重试原操作')
      throw error
    } finally { clearTimeout(timeout) }
  }
  async function mutate(path, data, supplied) {
    if (!session) { onUnauthorized(); throw new Error('登录已过期，请重新登录') }
    const actor = session
    const journal = operations(); const operation = supplied || await journal.begin(path, JSON.stringify(data))
    const wasPending = !!supplied || operation.wasPending
    if (session !== actor) throw new Error('登录账号已变化，请重新加载后操作')
    try {
      const result = await request(path, { method: 'POST', data: JSON.parse(operation.body), key: operation.key })
      const valid = path.endsWith('/community') ? Number.isSafeInteger(result.version) && result.config?.group && result.config?.announcement
        : path.endsWith('/market/templates') ? typeof result.template?.id === 'string'
        : path.endsWith('/edit') ? typeof result.id === 'string' && Number.isSafeInteger(result.version)
        : path.endsWith('/delete') ? typeof result.id === 'string' && result.status === 'deleted' : false
      if (!valid) throw new Error('保存响应无效，请重试原操作确认结果')
      journal.complete(path, operation.key); return result
    } catch (error) {
      // A later rejection cannot disprove an earlier unknown commit. Only a
      // fresh operation's definite rejection may retire its key; retries keep it.
      if (!wasPending && [400, 401, 403, 404, 409, 413, 415, 422].includes(error.status)) journal.complete(path, operation.key)
      throw error
    }
  }
  async function call(action, data = {}) {
    const base = '/api/v1/admin'; const id = value => encodeURIComponent(value)
    switch (action) {
      case 'session': return request(`${base}/session`)
      case 'bootstrap': {
        const [locations, templates, community] = await Promise.all([request('/api/v1/locations', { anonymous: true }), request(`${base}/market/templates`), request(`${base}/community`)])
        return { regionTree: marketRegions(locations.marketRegionTree), templates: templates.templates, community: { ...community.config, version: community.version } }
      }
      case 'getItem': return request(`${base}/market/listings/${id(data.id)}`)
      case 'bulkCreate': return request(`${base}/market/batches`, { method: 'POST', data })
      case 'updateItem': return mutate(`${base}/market/listings/${id(data.id)}/edit`, { expectedVersion: data.expectedVersion, patch: data.patch })
      case 'listTemplates': return request(`${base}/market/templates`)
      case 'saveTemplate': return mutate(`${base}/market/templates`, data)
      case 'deleteTemplate': return mutate(`${base}/market/templates/${id(data.id)}/delete`, {})
      case 'getCommunity': return request(`${base}/community`)
      case 'updateCommunity': return mutate(`${base}/community`, data)
      case 'getImageURLs': return request(`${base}/files/urls`, { method: 'POST', data })
      default: throw new Error('不支持的管理操作')
    }
  }
  return {
    call, clear, getSession: () => session,
    pendingOperations: () => { try { return session ? operations().pending() : [] } catch (_) { return [] } },
    // Explicit recovery replays the exact saved body/key, never a new write.
    async recoverOperations() {
      const actor = session
      for (const operation of operations().pending()) {
        if (session !== actor) throw new Error('登录账号已变化，请重新加载后操作')
        await mutate(operation.scope, null, operation)
      }
    },
    async login(username, password) {
      const result = await request('/api/v1/admin/auth/login', { method: 'POST', data: { username, password }, anonymous: true })
      const expiresAtMs = Date.parse(result.expiresAt)
      if (!/^[a-f0-9]{64}$/.test(result.token) || !result.admin?.accountId || !Number.isFinite(expiresAtMs) || expiresAtMs <= Date.now()) throw new Error('登录响应无效')
      session = { token: result.token, expiresAtMs, admin: result.admin }
      try { storage.setItem(sessionKey, JSON.stringify(session)) } catch (_) {}
      return session
    },
    async logout() { const actor = session; try { await request('/api/v1/admin/auth/logout', { method: 'POST', data: {} }) } finally { if (session === actor) clear() } },
    async uploadImage(blob) {
      if (!(blob instanceof Blob) || !blob.size || blob.size > 2 * 1024 * 1024) throw new Error('图片需在 2 MB 以内')
      const actor = session
      if (!actor) { onUnauthorized(); throw new Error('登录已过期，请重新登录') }
      const bytes = await blob.arrayBuffer(), hash = await digest(bytes)
      if (session !== actor) throw new Error('登录账号已变化，请重新加载后操作')
      // Only unacknowledged uploads reuse a key. After a confirmed upload, the
      // same bytes may be a new image intent (including after safe deletion).
      // Persist hashes/keys only, never raw image bytes or base64 content.
      const journal = createOperations(operationStorage, `admin_image_operations:${endpoint}:${actor.admin.accountId}`, { maxPending: 64 })
      const operation = await journal.begin(hash, JSON.stringify({ sha256: hash }))
      if (session !== actor) throw new Error('登录账号已变化，请重新加载后操作')
      try {
        const result = await request('/api/v1/admin/files/images', { method: 'POST', raw: bytes, key: operation.key })
        if (typeof result.fileId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(result.fileId)) throw new Error('图片上传响应无效，请重试原图片')
        journal.complete(hash, operation.key)
        return result
      } catch (error) {
        if (!operation.wasPending && [400, 401, 403, 404, 409, 413, 415, 422].includes(error.status)) journal.complete(hash, operation.key)
        throw error
      }
    }
  }
}
