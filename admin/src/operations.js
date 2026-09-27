const encoder = new TextEncoder()
export async function digest(value) {
  const bytes = typeof value === 'string' ? encoder.encode(value) : value
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(x => x.toString(16).padStart(2, '0')).join('')
}
// A pending write's key and exact body survive reloads and re-login. The server
// retains receipts permanently; only an acknowledged operation is removed here.
export function createOperations(storage, namespace, { maxPending = Infinity } = {}) {
  function read() {
    try { return JSON.parse(storage.getItem(namespace) || '{}') } catch (_) { throw new Error('无法读取待确认操作，请检查浏览器存储设置') }
  }
  function write(value) {
    try { storage.setItem(namespace, JSON.stringify(value)) } catch (_) { throw new Error('无法保留操作编号，请允许本地存储后重试') }
  }
  return {
    async begin(scope, body) {
      const fingerprint = await digest(body); const records = read(); const previous = records[scope]
      if (previous && previous.fingerprint !== fingerprint) throw new Error('上次保存结果尚未确认，请重试原内容；也可刷新页面后点击“核对上次保存结果”，完成后再编辑')
      if (!previous && Object.keys(records).length >= maxPending) throw new Error('待确认图片过多，请先重新选择原图片确认上传结果')
      const record = previous || { key: `web_${crypto.randomUUID()}`, fingerprint, body }
      records[scope] = record; write(records)
      return { ...record, wasPending: !!previous }
    },
    complete(scope, key) {
      const records = read()
      if (records[scope]?.key === key) { delete records[scope]; write(records) }
    },
    pending() { return Object.entries(read()).map(([scope, record]) => ({ scope, ...record })) }
  }
}
