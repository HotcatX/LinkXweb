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

export function historySeries(history, metric) {
  const from = history.from, to = history.to, points = history.points || []
  const keys = metric === 'memory' ? ['memoryUsedBytes', 'memoryTotalBytes'] : ['diskUsedBytes', 'diskTotalBytes']
  const maximum = metric === 'cpu' ? 100 : Math.max(1, ...points.map(point => Number.isFinite(point[keys[1]]) ? point[keys[1]] : 0))
  const segments = [], valid = []
  let segment = [], previous = null
  for (const point of points) {
    const value = metric === 'cpu' ? point.cpuPercent : point[keys[0]]
    const usable = Number.isFinite(point.at) && point.at >= from && point.at <= to && Number.isFinite(value) && value >= 0 && value <= maximum && (metric === 'cpu' || Number.isFinite(point[keys[1]]) && point[keys[1]] > 0 && value <= point[keys[1]])
    if (!usable || previous !== null && point.at - previous > (to - from) / 720 * 3) { if (segment.length) segments.push(segment); segment = [] }
    if (usable) {
      const item = { at: point.at, value, x: 54 + (point.at - from) / Math.max(1, to - from) * 650, y: 16 + (1 - value / maximum) * 154 }
      segment.push(item); valid.push(item)
    }
    previous = point.at
  }
  if (segment.length) segments.push(segment)
  return { from, to, maximum, segments, count: valid.length, firstAt: valid[0]?.at ?? null, latest: valid.at(-1) ?? null }
}
