export function createVisiblePoller(read, { document, onResult, onError, interval = 10000, schedule = setTimeout, cancel = clearTimeout }) {
  let stopped = false, running = null, timer = null, again = false
  const arm = () => { if (!stopped && document.visibilityState === 'visible') timer = schedule(() => { timer = null; void refresh() }, interval) }
  async function refresh(afterCurrent = false) {
    if (stopped || document.visibilityState !== 'visible') return
    if (running) { if (afterCurrent) again = true; return running }
    if (timer !== null) { cancel(timer); timer = null }
    running = (async () => { try { const result = await read(); if (!stopped) onResult(result) } catch (error) { if (!stopped) onError(error) } finally { running = null; if (again && !stopped) { again = false; void refresh() } else arm() } })()
    return running
  }
  function visibility() { if (timer !== null) { cancel(timer); timer = null }; if (document.visibilityState === 'visible') void refresh() }
  document.addEventListener('visibilitychange', visibility)
  return { refresh, dispose() { stopped = true; if (timer !== null) cancel(timer); document.removeEventListener('visibilitychange', visibility) } }
}

export const collectionStatus = collector => collector?.status !== 'ready' ? '暂不可用' : collector.collection?.restoreGate === 'closed' ? '恢复中' : collector.collection?.enabled ? '正在采集' : '采集关闭'
export const hostSampledAt = status => status?.host?.sampledAt ?? null

export const monitorMetrics = [
  { key: 'requests', icon: 'requests', label: '接口请求', unit: '次/分钟' },
  { key: 'activeUsers', icon: 'users', label: '活跃用户', unit: '人/分钟' },
  { key: 'events', icon: 'activity', label: '采集事件', unit: '条/分钟' },
  { key: 'cpu', icon: 'cpu', label: 'CPU 使用率', unit: '%' }
]

export function historySeries(history, metric) {
  const from = history.from, to = history.to
  const points = (history.points || []).map(point => {
    const summary = point[metric]
    return Number.isFinite(point.at) && point.at >= from && point.at <= to && summary && Number.isFinite(summary.mean) && Number.isFinite(summary.min) && Number.isFinite(summary.max) && summary.min >= 0 && summary.min <= summary.mean && summary.mean <= summary.max && Number.isSafeInteger(summary.samples) && summary.samples > 0 && (metric !== 'cpu' || summary.max <= 100) && Number.isFinite(summary.peakAt) && summary.peakAt >= from && summary.peakAt <= to ? { at: point.at, ...summary } : null
  })
  const largest = Math.max(0, ...points.filter(Boolean).map(point => point.max))
  const magnitude = 10 ** Math.floor(Math.log10(Math.max(1, largest / 4)))
  const step = Math.ceil([1, 2, 2.5, 5, 10].find(value => value * magnitude >= largest / 4) * magnitude)
  const maximum = metric === 'cpu' ? 100 : Math.max(1, step) * 4
  const segments = [], valid = []
  let segment = [], previous = null
  const x = at => 54 + (at - from) / Math.max(1, to - from) * 650, y = value => 16 + (1 - value / maximum) * 154
  for (const point of points) {
    if (!point || previous !== null && point.at - previous > history.bucketMs * 1.5) { if (segment.length) segments.push(segment); segment = [] }
    if (point) { const startX = x(point.at), endX = x(Math.min(to, point.at + history.bucketMs)); const item = { ...point, startX, endX, x: (startX + endX) / 2, y: y(point.mean), lowY: y(point.min), highY: y(point.max) }; segment.push(item); valid.push(item); previous = point.at }
    else previous = null
  }
  if (segment.length) segments.push(segment)
  const peak = valid.reduce((best, point) => !best || point.max > best.value ? { value: point.max, at: point.peakAt, x: x(point.peakAt), y: y(point.max) } : best, null)
  return { from, to, maximum, ticks: Array.from({ length: 5 }, (_, i) => maximum / 4 * i), segments, count: valid.length, firstAt: valid[0]?.at ?? null, latest: valid.at(-1) ?? null, peak }
}
