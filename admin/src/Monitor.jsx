import React, { useEffect, useRef, useState } from 'react'
import { Icon, Notice } from './App.jsx'
import { createVisiblePoller, collectionStatus, hostSampledAt, historySeries, monitorMetrics } from './monitor.js'
export function time(value) { return value === null || value === undefined ? '—' : new Date(value).toLocaleString() }
const number = value => Number.isFinite(value) ? value.toLocaleString(undefined, { maximumFractionDigits: 1 }) : '—'
function Metric({ label, icon, value, hint, percent }) { return <article className="panel metric"><span><Icon name={icon} size={19} />{label}</span><strong>{value}</strong>{Number.isFinite(percent) && <div className="meter"><i style={{ width: `${Math.max(0, Math.min(100, percent))}%` }} /></div>}<small>{hint}</small></article> }
function Status({ normal, children }) { return <span className={`status-pill ${normal ? 'on' : ''}`}><Icon name={normal ? 'check' : 'warning'} size={13} />{children}</span> }
const HistoryChart = React.memo(function HistoryChart({ history, metric }) {
  const series = historySeries(history, metric.key)
  const format = value => metric.key === 'cpu' ? `${value.toFixed(1)}%` : number(value)
  const tick = value => new Date(value).toLocaleString(undefined, { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  return <figure className={`history-chart chart-${metric.key}`}>
    <figcaption><div><h3><Icon name={metric.icon} size={18} />{metric.label}</h3><div className="chart-unit">{metric.unit} · 每 {history.bucketMs / 60000} 分钟均值</div></div><div className="chart-summary"><strong>{series.peak ? `峰值 ${format(series.peak.value)}` : '暂无记录'}</strong><small>{series.peak ? time(series.peak.at) : '新统计启用后开始记录'}</small></div></figcaption>
    <div className="chart-legend"><span><i className="legend-line" />分桶均值</span><span><i className="legend-band" />实际峰谷</span></div>
    <svg viewBox="0 0 720 208" role="img" aria-label={`${metric.label}历史，${series.count} 个有效分桶；峰值 ${series.peak ? `${format(series.peak.value)}，${time(series.peak.at)}` : '暂无'}。`}>
      <title>{metric.label}历史；均线和真实峰谷范围，空白表示没有完整记录。</title>
      {series.ticks.map(value => <g key={value}><line className="chart-grid" x1="54" x2="704" y1={16 + (1 - value / series.maximum) * 154} y2={16 + (1 - value / series.maximum) * 154} /><text className="chart-label" x="46" y={20 + (1 - value / series.maximum) * 154} textAnchor="end">{metric.key === 'cpu' ? `${value}%` : number(value)}</text></g>)}
      {series.segments.map((segment, index) => <g key={index}><polygon className="chart-band" points={[...segment.flatMap(point => [`${point.startX},${point.highY}`, `${point.endX},${point.highY}`]), ...[...segment].reverse().flatMap(point => [`${point.endX},${point.lowY}`, `${point.startX},${point.lowY}`])].join(' ')} />{segment.length > 1 && <polyline className="chart-line" points={segment.map(point => `${point.x},${point.y}`).join(' ')} />}{segment.map((point, i) => <circle className={`chart-point${segment.length === 1 || point === series.latest ? ' visible' : ''}`} key={i} cx={point.x} cy={point.y} r="3"><title>{time(point.at)} · 均值 {format(point.mean)} · 峰谷 {format(point.min)}—{format(point.max)} · {point.samples} 个有效{metric.key === 'cpu' ? '采样' : '分钟'}</title></circle>)}</g>)}
      {series.peak && <circle className="chart-peak" cx={series.peak.x} cy={series.peak.y} r="3"><title>实际峰值 {format(series.peak.value)} · {time(series.peak.at)}</title></circle>}
      {[0, 0.5, 1].map(ratio => <text key={ratio} className="chart-label" x={54 + ratio * 650} y="197" textAnchor={ratio === 0 ? 'start' : ratio === 1 ? 'end' : 'middle'}>{tick(series.from + ratio * (series.to - series.from))}</text>)}
      {!series.count && <text className="chart-empty" x="379" y="96" textAnchor="middle">暂无采样记录</text>}
    </svg>
    <div className="chart-caption">{series.latest ? `最近分桶均值 ${format(series.latest.mean)} · ${time(series.latest.at)}` : '空缺时段不补 0'}{metric.key === 'requests' && series.latest && <span>直连 {number(series.latest.direct)} · 转接 {number(series.latest.bridge)} · 采集 {number(series.latest.collection)} 次/分钟</span>}</div>
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
  const host = sample?.host, collector = sample?.collector, collection = collector?.collection
  return <>
    <div className="page-heading"><div><div className="eyebrow">最高管理员</div><h1>运行监控</h1><p>当前页面可见时，实时状态每 10 秒、历史曲线每分钟更新。</p></div><button className="button secondary" onClick={() => { void task.current?.refresh(); void historyTask.current?.refresh() }} disabled={busy || historyBusy}>{busy || historyBusy ? '更新中…' : '立即刷新'}</button></div>
    <Notice message={error ? `${error}；保留上次采样结果。` : ''} />
    {!sample ? <div className="panel empty-state" role="status">正在获取运行状态…</div> : <>
      <div className="sample-line"><Status normal={host.status === 'ready'}>{host.status === 'ready' ? '运行正常' : host.status === 'stale' ? '采样延迟' : '主机采样暂不可用'}</Status><span>主机采样 {time(hostSampledAt(sample))} · 页面刷新 {time(sample.sampledAt)}</span></div>
      <div className="metrics-grid"><Metric icon="requests" label="最近完整分钟调用" value={sample.requests ? `${number(sample.requests.total)} 次` : '—'} hint={sample.requests ? `分钟 ${time(sample.requests.at)}` : '新统计启用后开始记录'} /><Metric icon="users" label="最近一分钟活跃" value={collector?.status === 'ready' && Number.isFinite(collection?.activeLastMinute) ? `${collection.activeLastMinuteCapped ? '≥ ' : ''}${number(collection.activeLastMinute)} 人` : '—'} hint="产生已接收采集事件的真实账号" /><Metric icon="activity" label="最近一分钟事件" value={collector?.status === 'ready' && Number.isFinite(collection?.receivedLastMinute) ? `${collection.receivedLastMinuteCapped ? '≥ ' : ''}${number(collection.receivedLastMinute)} 条` : '—'} hint={`最后接收 ${time(collection?.latestReceivedAt)}`} /><Metric icon="cpu" label="主机 CPU" value={Number.isFinite(host.cpu?.percent) ? `${host.cpu.percent.toFixed(1)}%` : '—'} percent={host.cpu?.percent} hint={`${host.cpu?.cores || '—'} 核，主机总体占用`} /></div>
      <section className="panel history-panel"><div className="panel-heading"><div><h2><Icon name="history" size={20} />调用与用户活动</h2><p>请求频率、活跃账号、事件收集与 CPU 峰谷</p></div><div className="range-selector" role="group" aria-label="历史时间范围">{[['day', '1 天'], ['week', '7 天'], ['month', '30 天']].map(([key, label]) => <button type="button" key={key} aria-pressed={range === key} onClick={() => setRange(key)}>{label}</button>)}</div></div>
        <Notice message={historyError ? `${historyError}${history?.range === range ? '；保留上次曲线。' : ''}` : ''} />
        {history?.range !== range ? <div className="empty-list" role="status">{historyError ? '历史记录暂不可用，稍后可刷新。' : '正在读取历史记录…'}</div> : <><div className="history-charts">{monitorMetrics.map(metric => <HistoryChart key={metric.key} history={history} metric={metric} />)}</div><div className="history-note"><p>均线仅计算有效记录，淡色范围保留实际峰谷；断档不补 0，新统计启用前无记录。活跃用户是每分钟产生已接收事件的真实账号，非在线人数，跨分钟不累加。CPU 峰值以采样时刻为准。</p><span>更新于 {time(history.sampledAt)}{historyBusy ? ' · 更新中…' : ''}</span></div></>}
      </section>
      <section className="panel"><div className="panel-heading"><div><h2>服务运行</h2><p>CPU、重启和启动时间</p></div></div><div className="table-scroll"><table className="data-table"><thead><tr><th>服务</th><th>状态</th><th>CPU（单核）</th><th>重启次数</th><th>启动时间</th></tr></thead><tbody>{(host.services || []).map(item => <tr key={item.name}><td>{item.name}</td><td><Status normal={['running', 'healthy'].includes(item.state)}>{item.state}</Status></td><td>{Number.isFinite(item.cpuPercent) ? `${item.cpuPercent.toFixed(1)}%` : '—'}</td><td>{item.restarts}</td><td>{time(item.startedAt)}</td></tr>)}</tbody></table></div></section>
      <div className="monitor-details"><section className="panel"><h2>业务后端</h2><dl className="detail-list"><div><dt>进程 CPU</dt><dd>{Number.isFinite(sample.backend.cpuPercent) ? `${sample.backend.cpuPercent.toFixed(1)}%` : '—'}（单核基准）</dd></div><div><dt>已运行</dt><dd>{Math.floor(sample.backend.uptimeSeconds / 3600)} 小时 {Math.floor(sample.backend.uptimeSeconds / 60) % 60} 分钟</dd></div><div><dt>调用来源</dt><dd>{sample.requests ? `直连 ${number(sample.requests.direct)} · 转接 ${number(sample.requests.bridge)} · 采集 ${number(sample.requests.collection)}` : '暂无完整分钟记录'}</dd></div></dl></section><section className="panel"><h2>采集服务</h2><dl className="detail-list"><div><dt>状态</dt><dd><Status normal={collector?.status === 'ready' && collection?.enabled && collection?.restoreGate !== 'closed'}>{collectionStatus(collector)}</Status></dd></div><div><dt>进程 CPU</dt><dd>{Number.isFinite(collector?.process?.cpuPercent) ? `${collector.process.cpuPercent.toFixed(1)}%` : '—'}（单核基准）</dd></div><div><dt>最后接收</dt><dd>{time(collection?.latestReceivedAt)}</dd></div></dl></section></div>
    </>}
  </>
}
