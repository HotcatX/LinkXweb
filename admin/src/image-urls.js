// Signed URLs are display cache only; every saved reference is a stable file ID.
export function createImageURLCache(api, now = Date.now) {
  const cache = new Map(); let owner = ''; let pending = Promise.resolve()
  async function load(ids, force, isCurrent) {
    if (!isCurrent()) return null
    const current = api.workspaceKey()
    if (current !== owner) { cache.clear(); owner = current }
    const valid = () => isCurrent() && api.workspaceKey() === current && owner === current
    const unique = [...new Set(ids.filter(Boolean))]
    const missing = unique.filter(id => force || !cache.has(id) || cache.get(id).expiresAt <= now())
    for (let offset = 0; offset < missing.length; offset += 50) {
      if (!valid()) return null
      const fileIds = missing.slice(offset, offset + 50), startedAt = now()
      const result = await api.call('getImageURLs', { fileIds })
      if (!valid()) return null
      if (!Number.isFinite(result.expiresIn) || result.expiresIn <= 0 || result.expiresIn > 300 || !Array.isArray(result.items) || result.items.length !== fileIds.length) throw new Error('图片链接响应不完整，请重新加载')
      // TTL starts when the request was dispatched, not when a slow reply arrived.
      const expiresAt = startedAt + result.expiresIn * 1000 - 30000
      if (expiresAt <= now()) throw new Error('图片链接已过期，请重新加载')
      const received = new Set(), next = []
      for (const file of result.items) {
        if (!file || typeof file !== 'object' || typeof file.url !== 'string') throw new Error('图片链接响应无效，请重新加载')
        let url
        try { url = new URL(file.url) } catch (_) { throw new Error('图片链接响应无效，请重新加载') }
        if (!fileIds.includes(file.fileId) || received.has(file.fileId) || url.protocol !== 'https:' || url.username || url.password) throw new Error('图片链接响应无效，请重新加载')
        received.add(file.fileId); next.push([file.fileId, { url: url.href, expiresAt }])
      }
      for (const [id, value] of next) cache.set(id, value)
    }
    if (!valid()) return null
    if (unique.some(id => !cache.has(id) || cache.get(id).expiresAt <= now())) throw new Error('图片链接已过期，请重新加载')
    // Keep only displayed IDs; removed drafts must not grow this cache forever.
    for (const id of cache.keys()) if (!unique.includes(id)) cache.delete(id)
    return Object.fromEntries(unique.map(id => [id, cache.get(id).url]))
  }
  return { get(ids, force = false, isCurrent = () => true) {
    const work = pending.catch(() => {}).then(() => load(ids, force, isCurrent)); pending = work; return work
  } }
}

// Intervals/focus/image errors share one in-flight refresh. Disposal also stops
// any queued cache work before it dispatches another network request.
export function createImageRefresh(cache, ids, { onResult, onError, now = Date.now }) {
  let disposed = false, flight = null, lastForced = -Infinity
  return {
    refresh(force = false) {
      if (disposed || flight || force && now() - lastForced < 15000) return flight || Promise.resolve()
      if (force) lastForced = now()
      flight = Promise.resolve().then(() => cache.get(ids, force, () => !disposed))
        .then(value => { if (!disposed && value !== null) onResult(value) })
        .catch(error => { if (!disposed) { onResult({}); onError(error) } })
        .finally(() => { flight = null })
      return flight
    },
    dispose() { disposed = true }
  }
}
