import React, { useEffect, useRef, useState } from 'react'
import { Icon, Notice } from './App.jsx'
import { createVisiblePoller, collectionStatus, hostSampledAt, historySeries } from './monitor.js'
export function bytes(value) { if (!Number.isFinite(value)) return '—'; const units = ['B', 'KB', 'MB', 'GB', 'TB']; let unit = 0; while (value >= 1024 && unit < units.length - 1) { value /= 1024; unit++ }; return `${value.toFixed(unit ? 1 : 0)} ${units[unit]}` }
export function time(value) { return value === null || value === undefined ? '—' : new Date(value).toLocaleString() }
function Metric({ label, icon, value, hint, percent }) { return <article className="panel metric"><span><Icon name={icon} size={19} />{label}</span><strong>{value}</strong>{Number.isFinite(percent) && <div className="meter"><i style={{ width: `${Math.max(0, Math.min(100, percent))}%` }} /></div>}<small>{hint}</small></article> }
const HistoryChart = React.memo(function HistoryChart({ history, metric, label }) {
  const series = historySeries(history, metric)
  const format = value => metric === 'cpu' ? `${value.toFixed(1)}%` : bytes(value)
  const tick = value => new Date(value).toLocaleString(undefined, { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  return <figure className={`history-chart chart-${metric}`}>
    <figcaption><h3><Icon name={metric} size={18} />{label}</h3><span>{series.latest ? format(series.latest.value) : '—'}</span></figcaption>
    <svg viewBox="0 0 720 208" role="img" aria-label={`${label}历史，${series.count} 个有效采样点`}>
      <title>{label}历史；空白表示没有采样记录。最新记录 {series.latest ? `${time(series.latest.at)}，${format(series.latest.value)}` : '暂无'}</title>
      {[0, 0.5, 1].map(ratio => <g key={ratio}><line className="chart-grid" x1="54" x2="704" y1={16 + ratio * 154} y2={16 + ratio * 154} /><text className="chart-label" x="46" y={20 + ratio * 154} textAnchor="end">{series.count || metric === 'cpu' ? format((1 - ratio) * series.maximum) : '—'}</text></g>)}
      {series.segments.map((segment, index) => <g key={index}>{segment.length > 1 && <polyline className="chart-line" points={segment.map(point => `${point.x},${point.y}`).join(' ')} />}{segment.map((point, i) => <circle className={`chart-point${segment.length === 1 || point === series.latest ? ' visible' : ''}`} key={i} cx={point.x} cy={point.y} r="3"><title>{time(point.at)} · {format(point.value)}</title></circle>)}</g>)}
      {[0, 0.5, 1].map(ratio => <text key={ratio} className="chart-label" x={54 + ratio * 650} y="197" textAnchor={ratio === 0 ? 'start' : ratio === 1 ? 'end' : 'middle'}>{tick(series.from + ratio * (series.to - series.from))}</text>)}
      {!series.count && <text className="chart-empty" x="379" y="96" textAnchor="middle">暂无采样记录</text>}
    </svg>
    <div className="chart-caption">{series.latest ? `最后记录 ${time(series.latest.at)}` : '启用监控后开始记录'}</div>
  </figure>
})
export default function Monitor({ api }) {
  const [sample, setSample] = useState(null), [error, setError] = useState(''), [busy, setBusy] = useState(false), task = useRef(null)
  const [range, setRange] = useState('day'), [history, setHistory] = useState(null), [historyError, setHistoryError] = useState(''), [historyBusy, setHistoryBusy] = useState(false), historyTask = useRef(null), historyRange = useRef('day')
  useEffect(() => {
    task.current = createVisiblePoller(async () => { setBusy(true); try { return await api.call('consoleStatus') } finally { setBusy(false) } }, { document, onResult: value => { setSample(value); setError('') }, onError: error => setError(error.message) })
    void task.current.refresh(); return () => { task.current.dispose(); task.current = null }
  }, [api])
  useEffect(() => {
    let active = true
    setHistoryError('')
    historyTask.current = createVisiblePoller(async () => { setHistoryBusy(true); setHistoryError(''); try { return await api.call('consoleHistory', { range: historyRange.current }) } finally { if (active) setHistoryBusy(false) } }, { document, interval: 60000, onResult: value => { if (value.range === historyRange.current) { setHistory(value); setHistoryError('') } }, onError: error => setHistoryError(error.message) })
    void historyTask.current.refresh(); return () => { active = false; historyTask.current.dispose(); historyTask.current = null }
  }, [api])
  useEffect(() => { if (historyRange.current !== range) { historyRange.current = range; setHistoryError(''); void historyTask.current?.refresh(true) } }, [range])
  const host = sample?.host, collector = sample?.collector, memory = host?.memory, disk = host?.disk
  const used = memory ? memory.totalBytes - memory.availableBytes : null
  return <>
    <div className="page-heading"><div><div className="eyebrow">最高管理员</div><h1>运行监控</h1><p>当前页面可见时，实时状态每 10 秒、历史曲线每分钟更新。</p></div><button className="button secondary" onClick={() => { void task.current?.refresh(); void historyTask.current?.refresh() }} disabled={busy || historyBusy}>{busy || historyBusy ? '更新中…' : '立即刷新'}</button></div>
    <Notice message={error ? `${error}；保留上次采样结果。` : ''} />
    {!sample ? <div className="panel empty-state" role="status">正在获取运行状态…</div> : <>
      <div className="sample-line"><span className={`status-pill ${host.status === 'ready' ? 'on' : ''}`}>{host.status === 'ready' ? '运行正常' : host.status === 'stale' ? '采样延迟' : '主机采样暂不可用'}</span><span>主机采样 {time(hostSampledAt(sample))} · 页面刷新 {time(sample.sampledAt)}</span></div>
      <div className="metrics-grid"><Metric icon="cpu" label="主机 CPU" value={Number.isFinite(host.cpu?.percent) ? `${host.cpu.percent.toFixed(1)}%` : '—'} percent={host.cpu?.percent} hint={`${host.cpu?.cores || '—'} 核，主机总体占用`} /><Metric icon="memory" label="主机内存" value={bytes(used)} percent={memory ? used / memory.totalBytes * 100 : null} hint={`可用 ${bytes(memory?.availableBytes)} / 总计 ${bytes(memory?.totalBytes)}`} /><Metric icon="disk" label="磁盘使用" value={disk ? bytes(disk.totalBytes - disk.availableBytes) : '—'} percent={disk ? (1 - disk.availableBytes / disk.totalBytes) * 100 : null} hint={`可用 ${bytes(disk?.availableBytes)} / 总计 ${bytes(disk?.totalBytes)}`} /><Metric icon="activity" label="最近一分钟采集" value={collector?.status === 'ready' ? `${collector.collection?.receivedLastMinuteCapped ? '≥ ' : ''}${collector.collection?.receivedLastMinute ?? 0} 条` : '—'} hint={`最后接收 ${time(collector?.collection?.latestReceivedAt)}`} /></div>
      <section className="panel history-panel"><div className="panel-heading"><div><h2><Icon name="history" size={20} />资源历史</h2><p>CPU 使用率、内存与磁盘已用量</p></div><div className="range-selector" role="group" aria-label="历史时间范围">{[['day', '1 天'], ['week', '7 天'], ['month', '30 天']].map(([key, label]) => <button type="button" key={key} aria-pressed={range === key} onClick={() => setRange(key)}>{label}</button>)}</div></div>
        <Notice message={historyError ? `${historyError}${history?.range === range ? '；保留上次曲线。' : ''}` : ''} />
        {history?.range !== range ? <div className="empty-list" role="status">{historyError ? '历史记录暂不可用，稍后可刷新。' : '正在读取历史记录…'}</div> : <><div className="history-charts"><HistoryChart history={history} metric="cpu" label="CPU 使用率" /><HistoryChart history={history} metric="memory" label="内存已用" /><HistoryChart history={history} metric="disk" label="磁盘已用" /></div><div className="history-note">历史从监控启用后开始记录，空白时段不补数据。{history.points.length > 0 && history.points[0].at > history.from + (history.to - history.from) / 720 * 2 ? `当前记录始于 ${time(history.points[0].at)}。` : ''}<span>更新于 {time(history.sampledAt)}{historyBusy ? ' · 更新中…' : ''}</span></div></>}
      </section>
      <section className="panel"><div className="panel-heading"><div><h2>服务运行</h2><p>资源限制、重启和启动时间</p></div></div><div className="table-scroll"><table className="data-table"><thead><tr><th>服务</th><th>状态</th><th>CPU（单核）</th><th>内存 / 限额</th><th>重启次数</th><th>启动时间</th></tr></thead><tbody>{(host.services || []).map(item => <tr key={item.name}><td>{item.name}</td><td><span className={`status-pill ${['running', 'healthy'].includes(item.state) ? 'on' : ''}`}>{item.state}</span></td><td>{Number.isFinite(item.cpuPercent) ? `${item.cpuPercent.toFixed(1)}%` : '—'}</td><td>{bytes(item.memoryBytes)} / {bytes(item.memoryLimitBytes)}</td><td>{item.restarts}</td><td>{time(item.startedAt)}</td></tr>)}</tbody></table></div></section>
      <div className="monitor-details"><section className="panel"><h2>业务后端</h2><dl className="detail-list"><div><dt>进程内存</dt><dd>{bytes(sample.backend.memory.rssBytes)}</dd></div><div><dt>进程 CPU</dt><dd>{Number.isFinite(sample.backend.cpuPercent) ? `${sample.backend.cpuPercent.toFixed(1)}%` : '—'}（单核基准）</dd></div><div><dt>已运行</dt><dd>{Math.floor(sample.backend.uptimeSeconds / 3600)} 小时 {Math.floor(sample.backend.uptimeSeconds / 60) % 60} 分钟</dd></div></dl></section><section className="panel"><h2>采集服务</h2><dl className="detail-list"><div><dt>状态</dt><dd>{collectionStatus(collector)}</dd></div><div><dt>数据库大小</dt><dd>{bytes(collector?.storage?.databaseBytes)}</dd></div><div><dt>写入日志大小</dt><dd>{bytes(collector?.storage?.walBytes)}</dd></div></dl></section></div>
    </>}
  </>
}
