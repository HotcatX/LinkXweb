import React, { useEffect, useState } from 'react'
import { ConfirmDialog, Field, Icon, Notice, usePendingChanges } from './App.jsx'
import { ImageDialog } from './BulkManager.jsx'
import { communityPayload, datetimeInput, normalizeEditableCommunity, validateCommunity, MAX_IMAGE_BYTES } from './model.js'
import { base64File, validateImageFile } from './images.js'

export default function CommunityManager({ api, initialConfig }) {
  const [config, setConfig] = useState(() => normalizeEditableCommunity(initialConfig))
  const [baseline, setBaseline] = useState(() => JSON.stringify(normalizeEditableCommunity(initialConfig)))
  const [urls, setUrls] = useState({}); const [busy, setBusy] = useState(false)
  const [error, setError] = useState(''); const [success, setSuccess] = useState(''); const [confirm, setConfirm] = useState(false)
  const [preview, setPreview] = useState(null)
  const dirty = JSON.stringify(config) !== baseline
  usePendingChanges(dirty || busy)
  useEffect(() => {
    const fileIDs = [...new Set([config.group.imageFileID, config.announcement.imageFileID].filter(Boolean))]
    let cancelled = false
    if (fileIDs.length) api.call('getImageURLs', { fileIDs }).then(result => {
      if (!cancelled) setUrls(old => ({ ...old, ...Object.fromEntries((result.files || []).map(file => [file.fileID, file.url])) }))
    }).catch(e => { if (!cancelled) setError(e.message) })
    return () => { cancelled = true }
  }, [config.group.imageFileID, config.announcement.imageFileID, api])
  function update(section, name, value) {
    setConfig(old => ({ ...old, [section]: { ...old[section], [name]: value } })); setError(''); setSuccess('')
  }
  function adopt(raw, version) {
    const next = normalizeEditableCommunity({ ...raw, version: version ?? raw.version })
    setConfig(next); setBaseline(JSON.stringify(next))
  }
  async function reload() {
    if (dirty && !window.confirm('有尚未保存的修改，重新加载会放弃这些修改。继续吗？')) return
    setBusy(true); setError(''); setSuccess('')
    try { const result = await api.call('getCommunity'); adopt(result.config, result.version) }
    catch (e) { setError(e.message) } finally { setBusy(false) }
  }
  async function upload(event, target) {
    const file = event.target.files[0]; event.target.value = ''
    if (!file) return
    setError(''); setSuccess(''); setBusy(true)
    try {
      validateImageFile(file)
      if (file.size > MAX_IMAGE_BYTES) throw new Error('公告或群码原图需在 2 MB 以内，请选择较小的原图')
      const result = await api.call('uploadImage', { purpose: 'community', filename: file.name, contentType: file.type, base64: await base64File(file) })
      setUrls(old => ({ ...old, [result.fileID]: result.url }))
      update(target, 'imageFileID', result.fileID)
      setSuccess('图片已上传，检查有效期后点击“保存更改”才会生效')
    } catch (e) { setError(e.message) } finally { setBusy(false) }
  }
  function review(event) {
    event.preventDefault(); setError(''); setSuccess('')
    const message = validateCommunity(config)
    if (message) { setError(message); return }
    setConfirm(true)
  }
  async function save() {
    setBusy(true); setError(''); setSuccess('')
    try {
      const result = await api.call('updateCommunity', { config: communityPayload(config), expectedVersion: config.version })
      adopt(result.config, result.version); setSuccess('已保存。用户再次进入首页、下拉刷新或点击群入口时会读取新内容。'); setConfirm(false)
    } catch (e) { setError(e.message); setConfirm(false) } finally { setBusy(false) }
  }
  const noticeImage = config.announcement.showGroupImage ? config.group.imageFileID : config.announcement.imageFileID
  const currentQrUrl = urls[config.group.imageFileID]
  const expired = config.group.expiresAt && new Date(config.group.expiresAt).getTime() <= Date.now()
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone
  return <>
    <div className="page-heading"><div><div className="eyebrow">社区运营</div><h1>群码与公告</h1><p>更新群二维码与公告，保存后由小程序读取。</p></div><button className="button secondary" onClick={reload} disabled={busy}>重新加载</button></div>
    <Notice message={error} /><Notice message={success} kind="success" />
    <form onSubmit={review}><fieldset className="unframed" disabled={busy}>
      <div className="community-layout"><div className="community-editors">
        <section className="panel"><div className="panel-heading"><div><h2>拼车群二维码</h2><p>上传原图，并在每次换码时更新有效期。</p></div><label className="switch-label"><input type="checkbox" role="switch" checked={config.group.enabled} onChange={e => update('group', 'enabled', e.target.checked)} /><span>开放群码</span></label></div>
          <div className="qr-editor"><div className="qr-image-box">{currentQrUrl ? <button type="button" className="qr-image-button" onClick={() => setPreview(currentQrUrl)} aria-label="查看群二维码原图"><img src={currentQrUrl} alt="当前拼车群二维码" referrerPolicy="no-referrer" /></button> : <div className="qr-placeholder"><Icon name="qr" size={44} /><span>{config.group.imageFileID ? '正在加载图片…' : '尚未设置群二维码'}</span></div>}</div>
            <div className="qr-fields"><Field label="群名称" required><input required maxLength={80} value={config.group.title} onChange={e => update('group', 'title', e.target.value)} /></Field><Field label="二维码到期时间" required={config.group.enabled} hint={`按当前设备时区填写：${timezone}`}><input type="datetime-local" required={config.group.enabled} value={datetimeInput(config.group.expiresAt)} onChange={e => update('group', 'expiresAt', e.target.value)} /></Field><label className="button secondary upload-button"><Icon name="image" />替换二维码<input type="file" accept="image/jpeg,image/png,image/webp" onChange={e => upload(e, 'group')} aria-label="选择新群二维码" /></label><p className="field-hint">JPG、PNG、WebP，原图不压缩，最大 2 MB。</p>{expired && <Notice message="当前二维码已到期，请更新图片与有效期。" />}</div>
          </div>
        </section>
        <section className="panel"><div className="panel-heading"><div><h2>公告内容</h2><p>首页“点击加入拼车群”打开这份公告。</p></div></div><div className="form-grid"><Field label="公告标题" required wide><input required maxLength={80} value={config.announcement.title} onChange={e => update('announcement', 'title', e.target.value)} /></Field><Field label="公告正文" wide><textarea rows={5} maxLength={2000} value={config.announcement.body} onChange={e => update('announcement', 'body', e.target.value)} placeholder="填写公告内容，支持换行" /></Field></div><label className="check-label"><input type="checkbox" checked={config.announcement.showGroupImage} onChange={e => update('announcement', 'showGroupImage', e.target.checked)} />使用上面的拼车群二维码作为公告图片</label>{!config.announcement.showGroupImage && <div className="announcement-upload-row"><label className="button secondary upload-button"><Icon name="image" />{config.announcement.imageFileID ? '替换公告图片' : '上传公告图片'}<input type="file" accept="image/jpeg,image/png,image/webp" onChange={e => upload(e, 'announcement')} aria-label="选择公告图片" /></label>{config.announcement.imageFileID && <button className="text-button danger" type="button" onClick={() => update('announcement', 'imageFileID', '')}>移除公告图片</button>}<span className="field-hint">不上传图片时可使用纯文字公告。</span></div>}</section>
        <section className="panel"><div className="panel-heading"><div><h2>自动弹窗</h2><p>关闭自动弹窗后，用户仍可手动查看。</p></div><label className="switch-label"><input type="checkbox" role="switch" checked={config.announcement.enabled} onChange={e => update('announcement', 'enabled', e.target.checked)} /><span>{config.announcement.enabled ? '已开启' : '已关闭'}</span></label></div><div className="form-grid"><Field label="每台设备最多展示" hint="按同一个公告编号累计，不是每天次数。"><div className="input-with-unit"><input type="number" min={1} max={100} step={1} required value={config.announcement.maxShows} onChange={e => update('announcement', 'maxShows', e.target.value)} /><span>次</span></div></Field><Field label="两次展示至少间隔" hint="填 0 表示每次进入首页最多弹一次。"><div className="input-with-unit"><input type="number" min={0} max={8760} step="any" required value={config.announcement.intervalHours} onChange={e => update('announcement', 'intervalHours', e.target.value)} /><span>小时</span></div></Field><Field label="公告编号" required={config.announcement.enabled} wide hint="修改文字、图片不会重置次数。发布新公告并重新计次时，换一个新编号。"><input required={config.announcement.enabled} pattern="[a-zA-Z0-9_-]{1,128}" maxLength={128} value={config.announcement.id} onChange={e => update('announcement', 'id', e.target.value)} placeholder="例如 carpool-2026-09" /></Field><Field label="公告开始时间（选填）"><input type="datetime-local" value={datetimeInput(config.announcement.startAt)} onChange={e => update('announcement', 'startAt', e.target.value)} /></Field><Field label="公告结束时间（选填）"><input type="datetime-local" value={datetimeInput(config.announcement.endAt)} onChange={e => update('announcement', 'endAt', e.target.value)} /></Field></div><p className="field-hint">手动查看不消耗自动次数。使用群二维码时，公告会在群码到期时停止展示。</p></section>
      </div>
      <aside className="announcement-preview-column"><div className="preview-caption"><span>公告预览</span><span className={`status-pill ${config.announcement.enabled ? 'on' : ''}`}>{config.announcement.enabled ? '自动弹出已开启' : '仅手动打开'}</span></div><div className="announcement-preview"><div className="preview-modal-header"><span><i />社区公告</span><span className="preview-close">×</span></div><div className="preview-modal-body"><h3>{config.announcement.title || '社区公告'}</h3><p>{config.announcement.body}</p>{noticeImage && urls[noticeImage] && <img src={urls[noticeImage]} alt="公告图片预览" referrerPolicy="no-referrer" />}</div><div className="preview-modal-footer"><span>知道了</span></div></div><p className="preview-note">这里展示尚未保存的编辑内容。</p></aside>
      </div>
      <div className="save-bar"><div><strong>{dirty ? '有尚未保存的更改' : '当前配置已保存'}</strong><span>保存前可检查右侧公告预览。</span></div><button className="button primary" disabled={busy || !dirty}><Icon name="check" />{busy ? '处理中…' : '保存更改'}</button></div>
    </fieldset></form>
    {confirm && <ConfirmDialog title="保存群码和公告更改？" confirmText="保存并生效" busy={busy} onConfirm={save} onClose={() => setConfirm(false)}><dl className="review-list"><div><dt>群码</dt><dd>{config.group.enabled ? '开放查看' : '关闭'}</dd></div><div><dt>自动弹窗</dt><dd>{config.announcement.enabled ? `开启，每台设备最多 ${config.announcement.maxShows} 次` : '关闭，仍可手动查看'}</dd></div><div><dt>公告</dt><dd>{config.announcement.title}</dd></div></dl><p className="field-hint">小程序用户下次读取配置时生效。上一版配置会保留记录。</p></ConfirmDialog>}
    {preview && <ImageDialog url={preview} onClose={() => setPreview(null)} />}
  </>
}
