export function loadWorkspace(storage, key) {
  try { const value = JSON.parse(storage.getItem(key) || 'null'); return value?.version === 2 ? value : null } catch (_) { return null }
}
export function saveWorkspace(storage, key, state) {
  // URL signatures expire. Keep only file identities when restoring a draft.
  const value = JSON.stringify({ ...state, version: 2 }, (name, value) => name === 'url' ? undefined : value)
  try { storage.setItem(key, value) } catch (_) { throw new Error('无法保存本地草稿，请允许本地存储后再发布') }
}

// Invalidate old bootstrap responses before a logout or a new account load.
export function createWorkspaceLoader(api, callbacks) {
  let generation = 0
  return {
    invalidate() { generation++ },
    async load() {
      const epoch = ++generation, actor = api.getSession()
      if (!actor) return
      const current = () => generation === epoch && api.getSession() === actor
      callbacks.start()
      try {
        await api.call('session')
        if (!current()) return
        const result = await api.call('bootstrap')
        if (current()) callbacks.loaded(result)
      } catch (error) { if (current()) callbacks.error(error) }
      finally { if (current()) callbacks.finish() }
    }
  }
}
