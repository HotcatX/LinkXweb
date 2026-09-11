import React, { useEffect, useState } from 'react'
import { Field, Icon, Notice, ConfirmDialog, usePendingChanges } from './App.jsx'
import { blankDraft, draftPayload, validateDraft, GOODS_CATEGORIES, ROOM_TYPES, MAX_IMAGES } from './model.js'
import { compressMarketImage, base64File } from './images.js'
import { createBatch, applyBatchResult, uncertainBatch } from './batch.js'

const text = value => String(value ?? '')
const key = () => crypto.randomUUID()

export default function BulkManager({ api, regionTree, initialTemplates }) {
  const [form, setForm] = useState(blankDraft); const [queue, setQueue] = useState([])
  const [editingKey, setEditingKey] = useState(''); const [publishedId, setPublishedId] = useState('')
  const [busy, setBusy] = useState(false); const [uploadProgress, setUploadProgress] = useState('')
  const [error, setError] = useState(''); const [success, setSuccess] = useState(''); const [confirm, setConfirm] = useState(false)
  const [dispatch, setDispatch] = useState(null); const [templates, setTemplates] = useState(initialTemplates)
  const [templateName, setTemplateName] = useState(''); const [selectedTemplate, setSelectedTemplate] = useState('')
  const [preview, setPreview] = useState(null)
  const [deleteTemplate, setDeleteTemplate] = useState(null)
  const pendingCount = queue.filter(row => row._status !== 'success').length
  usePendingChanges(pendingCount > 0 || !!form.title || busy)
  const selectedCity = regionTree.find(city => city.key === form.cityKey || city.key === form.regionState || city.label === form.regionState)
  const groups = selectedCity?.groups || []
  const selectedGroup = groups.find(group => group.key === form.regionGroupKey || group.key === form.regionCounty || group.label === form.regionCounty)
  const areas = selectedGroup?.areas || []
  function update(name, value) { setForm(old => ({ ...old, [name]: value })); setError(''); setSuccess('') }
  const input = (name, options = {}) => <input {...options} value={text(form[name])} onChange={e => update(name, e.target.value)} />
  function reset() { setForm(blankDraft()); setEditingKey(''); setPublishedId(''); setError(''); setSuccess('') }
  function chooseCity(value) {
    const city = regionTree.find(item => item.key === value)
    setForm(old => ({ ...old, cityKey: value, cityLabel: city?.label || value, regionState: city?.key || value, regionCounty: '', regionArea: '', regionGroupKey: '', regionKey: '' }))
  }
  function chooseGroup(value) {
    const group = groups.find(item => item.key === value)
    setForm(old => ({ ...old, regionCounty: group?.label || value, regionGroupKey: value, regionArea: '', regionKey: '' }))
  }
  function chooseArea(value) {
    const area = areas.find(item => (typeof item === 'string' ? item : item.key || item.label) === value)
    setForm(old => ({ ...old, regionArea: typeof area === 'string' ? area : area?.label || value, regionKey: value }))
  }
  function changeType(value) {
    setForm(old => ({ ...old, listingType: value, category: value === 'sublet' ? 'Studio' : '其他', condition: value === 'sublet' ? '转租' : '99新', images: [] }))
  }
  async function addImages(event) {
    const files = [...event.target.files]; event.target.value = ''
    if (!files.length) return
    if (files.length + form.images.length > MAX_IMAGES) { setError('每条最多 6 张图片，请减少选择数量'); return }
    setBusy(true); setError(''); setSuccess('')
    try {
      for (let index = 0; index < files.length; index++) {
        setUploadProgress(`上传图片 ${index + 1} / ${files.length}`)
        const main = await compressMarketImage(files[index]); const thumb = await compressMarketImage(files[index], { thumbnail: true })
        const image = await api.call('uploadImage', { purpose: 'market', filename: 'goods.jpg', contentType: main.type, base64: await base64File(main) })
        const small = await api.call('uploadImage', { purpose: 'market_thumb', filename: 'thumb.jpg', contentType: thumb.type, base64: await base64File(thumb) })
        setForm(old => ({ ...old, images: [...old.images, { fileID: image.fileID, thumbFileID: small.fileID, url: image.url, name: files[index].name }] }))
      }
    } catch (e) { setError(e.message) } finally { setUploadProgress(''); setBusy(false) }
  }
  async function addToQueue(event) {
    event.preventDefault(); setError(''); setSuccess('')
    const message = validateDraft(form)
    if (message) { setError(message); return }
    if (publishedId) {
      setBusy(true)
      try {
        await api.call('updateItem', { id: publishedId, expectedVersion: Number(form.version) || 0, patch: draftPayload(form) })
        setQueue(rows => rows.map(row => row.resultId === publishedId ? { ...row, ...form, _status: 'success' } : row))
        setPublishedId(''); setForm(blankDraft(form)); setSuccess('已更新发布内容')
      } catch (e) { setError(e.message) } finally { setBusy(false) }
      return
    }
    if (!editingKey && queue.length >= 50) { setError('每批最多 50 条，请先完成当前批次'); return }
    const rowKey = editingKey || key()
    // A changed draft gets a fresh request key; an unchanged retry keeps the old key.
    const row = { ...structuredClone(form), _key: rowKey, _status: 'pending', clientRequestId: key(), error: '' }
    setQueue(old => editingKey ? old.map(item => item._key === editingKey ? row : item) : [...old, row])
    setDispatch(null); setEditingKey(''); setForm(blankDraft(form)); setSuccess(editingKey ? '已更新待发布内容' : '已加入待发布列表，可以继续添加下一条')
  }
  function editDraft(row) { setForm(structuredClone(row)); setEditingKey(row._key); setPublishedId(''); setError(''); setSuccess(''); document.getElementById('publish-form-title').focus() }
  function removeDraft(row) { setQueue(old => old.filter(item => item._key !== row._key)); setDispatch(null); if (editingKey === row._key) reset() }
  async function editPublished(row) {
    setBusy(true); setError(''); setSuccess('')
    try {
      const { item } = await api.call('getItem', { id: row.resultId })
      const ids = item.imageFileIDs || []
      const { files = [] } = ids.length ? await api.call('getImageURLs', { fileIDs: ids }) : {}
      const next = { ...blankDraft(item), detailAddress: item.location?.address || item.location?.displayName || '', latitude: item.location?.latitude ?? '', longitude: item.location?.longitude ?? '', images: ids.map((fileID, index) => ({ fileID, thumbFileID: item.thumbFileIDs?.[index] || '', url: files.find(file => file.fileID === fileID)?.url || '' })) }
      setForm(next); setPublishedId(item._id || row.resultId); setEditingKey('')
      document.getElementById('publish-form-title').focus()
    } catch (e) { setError(e.message) } finally { setBusy(false) }
  }
  async function publish() {
    if (busy) return
    const batch = dispatch || createBatch(queue, `web_${key()}`); setDispatch(batch); setBusy(true); setError(''); setSuccess('')
    // Keep the exact full batch when retrying a partial or uncertain response.
    try {
      const result = await api.call('bulkCreate', { batchId: batch.batchId, items: batch.items })
      setQueue(old => applyBatchResult(old, batch, result))
      setSuccess(`发布完成：成功 ${result.success} 条，失败 ${result.failed} 条`)
      setConfirm(false)
    } catch (e) { setQueue(old => uncertainBatch(old, batch)); setError(e.message); setConfirm(false) } finally { setBusy(false) }
  }
  async function applyTemplate() {
    const template = templates.find(item => (item.id || item._id) === selectedTemplate)
    if (!template) return
    setForm(blankDraft(template.data || template)); setEditingKey(''); setPublishedId(''); setSuccess('已载入模板，补充图片和本次日期后可加入待发布'); setError('')
  }
  async function saveTemplate() {
    if (!templateName.trim()) { setError('请先填写模板名称'); return }
    setBusy(true); setError('')
    try {
      await api.call('saveTemplate', { template: { name: templateName.trim(), data: draftPayload(form) } })
      const result = await api.call('listTemplates'); setTemplates(result.templates || []); setTemplateName(''); setSuccess('模板已保存')
    } catch (e) { setError(e.message) } finally { setBusy(false) }
  }
  async function removeTemplate() {
    setBusy(true)
    try { await api.call('deleteTemplate', { id: deleteTemplate.id || deleteTemplate._id }); setTemplates(items => items.filter(item => item !== deleteTemplate)); setSelectedTemplate(''); setDeleteTemplate(null); setSuccess('模板已移除') }
    catch (e) { setError(e.message); setDeleteTemplate(null) } finally { setBusy(false) }
  }
  return <>
    <div className="page-heading"><div><div className="eyebrow">商品管理</div><h1>批量发布</h1><p>整理二手商品或转租信息，检查后一次发布。</p></div><div className="heading-count"><strong>{String(pendingCount).padStart(2, '0')}</strong><span>条待发布</span></div></div>
    <div className="bulk-layout">
      <section className="panel editor-panel"><div className="panel-heading"><div><h2 id="publish-form-title" tabIndex={-1}>{publishedId ? '编辑已发布内容' : editingKey ? '编辑待发布内容' : '添加发布内容'}</h2><p>{publishedId ? '保存后更新原有商品，不会重复发布。' : '带 * 的项目为必填。'}</p></div>{(editingKey || publishedId) && <button className="text-button" onClick={reset} disabled={busy}>取消编辑</button>}</div>
        <Notice message={error} /><Notice message={success} kind="success" />
        <form onSubmit={addToQueue}><fieldset disabled={busy} className="unframed">
          <div className="segmented" aria-label="发布类型"><button type="button" aria-pressed={form.listingType === 'goods'} className={form.listingType === 'goods' ? 'selected' : ''} onClick={() => changeType('goods')}>二手商品</button><button type="button" aria-pressed={form.listingType === 'sublet'} className={form.listingType === 'sublet' ? 'selected' : ''} onClick={() => changeType('sublet')}>房屋转租</button></div>
          <div className="form-grid"><Field label="标题" required wide>{input('title', { required: true, maxLength: 120, placeholder: form.listingType === 'goods' ? '例如：宜家书桌，九成新' : '例如：Fort Lee 一室一厅转租' })}</Field><Field label={form.listingType === 'sublet' ? '月租（美元）' : '价格（美元）'} required>{input('price', { required: true, type: 'number', min: 0, step: '0.01', placeholder: '0.00' })}</Field><Field label={form.listingType === 'sublet' ? '房型' : '分类'} required><select value={form.category} onChange={e => update('category', e.target.value)}>{(form.listingType === 'sublet' ? ROOM_TYPES : GOODS_CATEGORIES).map(option => <option key={option}>{option}</option>)}</select></Field>{form.listingType === 'goods' && <Field label="新旧程度">{input('condition', { maxLength: 30, placeholder: '99新' })}</Field>}<Field label="详细描述" wide><textarea rows={4} value={form.desc} maxLength={5000} placeholder="补充尺寸、使用情况、交接方式等信息" onChange={e => update('desc', e.target.value)} /></Field></div>
          <div className="field-label image-label">商品图片 <span className="muted">{form.images.length} / 6</span></div><div className="image-grid">{form.images.map((image, index) => <div className="image-tile" key={image.fileID}><button type="button" className="image-preview-button" aria-label={`预览第 ${index + 1} 张图片`} onClick={() => setPreview(image.url)}><img src={image.url} alt={`商品图片 ${index + 1}`} referrerPolicy="no-referrer" /></button><span className="image-index">{index === 0 ? '主图' : index + 1}</span><button type="button" className="image-remove" aria-label={`移除第 ${index + 1} 张图片`} onClick={() => update('images', form.images.filter((_, i) => i !== index))}><Icon name="close" size={14} /></button></div>)}{form.images.length < MAX_IMAGES && <label className="image-upload"><Icon name="plus" size={24} /><span>添加图片</span><input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={addImages} aria-label="选择商品图片" /></label>}</div><p className="field-hint">支持 JPG、PNG、WebP。自动生成缩略图，第一张作为主图。</p>{uploadProgress && <p className="upload-progress" role="status">{uploadProgress}…</p>}
          <h3 className="form-section-title">联系人与位置</h3><div className="form-grid"><Field label="联系人" required>{input('sellerName', { required: true, maxLength: 80 })}</Field><Field label="微信号" required>{input('sellerWechat', { required: true, maxLength: 80 })}</Field><Field label="电话">{input('sellerPhone', { type: 'tel', maxLength: 40 })}</Field><Field label="城市" required><select required value={selectedCity?.key || ''} onChange={e => chooseCity(e.target.value)}><option value="">选择城市</option>{regionTree.map(city => <option key={city.key} value={city.key}>{city.label || city.key}</option>)}</select></Field><Field label="区域" required><select required value={selectedGroup?.key || ''} onChange={e => chooseGroup(e.target.value)}><option value="">选择区域</option>{groups.map(group => <option key={group.key} value={group.key}>{group.label || group.key}</option>)}</select></Field><Field label="细分区域" required><select required value={form.regionKey || form.regionArea} onChange={e => chooseArea(e.target.value)}><option value="">选择细分区域</option>{areas.map(area => { const value = typeof area === 'string' ? area : area.key || area.label; return <option key={value} value={value}>{typeof area === 'string' ? area : area.label || value}</option> })}</select></Field><Field label="公寓 / 大楼">{input('buildingName', { maxLength: 120 })}</Field><Field label="详细地址">{input('detailAddress', { maxLength: 250 })}</Field></div>
          <details className="optional-section"><summary>精确坐标（选填）</summary><p className="field-hint">填写坐标可用于距离展示；不清楚时可以留空。</p><div className="form-grid"><Field label="纬度">{input('latitude', { type: 'number', min: -90, max: 90, step: 'any' })}</Field><Field label="经度">{input('longitude', { type: 'number', min: -180, max: 180, step: 'any' })}</Field></div></details>
          <h3 className="form-section-title">{form.listingType === 'sublet' ? '租期与房源信息' : '取货日期'}</h3><div className="form-grid"><Field label={form.listingType === 'sublet' ? '可入住日期' : '开始日期'} required>{input('pickupStartDate', { required: true, type: 'date' })}</Field><Field label={form.listingType === 'sublet' ? '租期结束' : '结束日期'} required>{input('pickupEndDate', { required: true, type: 'date', min: form.pickupStartDate })}</Field>{form.listingType === 'sublet' && <><Field label="押金（美元）">{input('deposit', { type: 'number', min: 0, step: '0.01' })}</Field><Field label="房源类型">{input('housingType', { maxLength: 80, placeholder: '例如：整租、单间' })}</Field><Field label="室友要求">{input('genderPreference', { maxLength: 80 })}</Field><Field label="室友数量">{input('roommateCount', { type: 'number', min: 0, step: 1 })}</Field><label className="check-label"><input type="checkbox" checked={!!form.furnished} onChange={e => update('furnished', e.target.checked)} />带家具</label><label className="check-label"><input type="checkbox" checked={!!form.utilitiesIncluded} onChange={e => update('utilitiesIncluded', e.target.checked)} />包含水电网</label></>}</div>
          <details className="optional-section"><summary>常用模板</summary><p className="field-hint">模板保留文字与联系人，图片每次重新选择。</p>{templates.length > 0 && <div className="template-row"><select aria-label="选择模板" value={selectedTemplate} onChange={e => setSelectedTemplate(e.target.value)}><option value="">选择已保存模板</option>{templates.map(item => <option key={item.id || item._id} value={item.id || item._id}>{item.name}</option>)}</select><button type="button" className="button secondary" disabled={!selectedTemplate} onClick={applyTemplate}>载入</button><button type="button" className="text-button danger" disabled={!selectedTemplate} onClick={() => setDeleteTemplate(templates.find(item => (item.id || item._id) === selectedTemplate))}>移除</button></div>}<div className="template-row"><input value={templateName} onChange={e => setTemplateName(e.target.value)} placeholder="模板名称" maxLength={60} aria-label="新模板名称" /><button type="button" className="button secondary" onClick={saveTemplate}>保存模板</button></div></details>
          <div className="form-actions"><button type="button" className="button secondary" onClick={reset}>清空表单</button><button className="button primary" disabled={busy}><Icon name={publishedId ? 'check' : 'plus'} />{busy ? '处理中…' : publishedId ? '保存修改' : editingKey ? '更新待发布内容' : '加入待发布'}</button></div>
        </fieldset></form>
      </section>
      <aside className="queue-column"><section className="panel queue-panel"><div className="panel-heading"><div><h2>待发布列表 <span className="number-badge">{queue.length}</span></h2><p>每批最多 50 条</p></div>{queue.length > 0 && pendingCount === 0 && <button className="text-button" disabled={busy} onClick={() => { setQueue([]); setDispatch(null) }}>开始新批次</button>}</div>
        {queue.length === 0 ? <div className="queue-empty"><div className="empty-icon"><Icon name="grid" size={28} /></div><h3>还没有待发布内容</h3><p>填写左侧资料，点击“加入待发布”。</p></div> : <div className="queue-list">{queue.map((row, index) => <article className="queue-item" key={row._key}><div className="queue-item-main"><div className="queue-thumb">{row.images[0]?.url ? <img src={row.images[0].url} alt="" referrerPolicy="no-referrer" /> : <Icon name="image" size={26} />}</div><div className="queue-item-info"><span className="item-kind">{String(index + 1).padStart(2, '0')} · {row.listingType === 'sublet' ? '转租' : '二手'}</span><h3>{row.title}</h3><p>${Number(row.price).toLocaleString()} <span>· {row.regionArea}</span></p><span className={`item-status ${row._status}`}>{row._status === 'success' ? '已发布' : row._status === 'failed' ? '发布失败' : row._status === 'unconfirmed' ? '待确认结果' : '待发布'}</span></div></div>{row.error && <p className="row-error">{row.error}</p>}<div className="queue-item-actions">{row._status === 'success' ? <button className="text-button" disabled={busy} onClick={() => editPublished(row)}><Icon name="edit" size={15} />编辑已发布内容</button> : <><button className="text-button" disabled={busy || row._status === 'unconfirmed'} onClick={() => editDraft(row)}>编辑</button><button className="text-button danger" disabled={busy || row._status === 'unconfirmed'} onClick={() => removeDraft(row)}>移除</button></>}</div></article>)}</div>}
        <div className="queue-footer"><div className="queue-total"><span>本次待发布</span><strong>{pendingCount} 条</strong></div><button className="button primary full" disabled={!pendingCount || busy || !!editingKey || !!publishedId} onClick={() => setConfirm(true)}>{busy ? '正在处理…' : queue.some(row => ['failed', 'unconfirmed'].includes(row._status)) ? '重试未完成发布' : '检查并发布'}<Icon name="arrow" /></button><p>加入列表不会立即上线，确认发布后才展示。</p></div>
      </section></aside>
    </div>
    {confirm && <ConfirmDialog title={`确认发布 ${pendingCount} 条内容？`} confirmText="确认发布" busy={busy} onConfirm={publish} onClose={() => setConfirm(false)}><p>发布成功的内容会立即出现在小程序中，请确认标题、价格、联系人和图片准确。</p><div className="confirm-summary"><span>待处理</span><strong>{pendingCount} 条</strong></div><p className="field-hint">网络中断后可重试，已成功的内容会自动去重。</p></ConfirmDialog>}
    {deleteTemplate && <ConfirmDialog title="移除这个模板？" confirmText="移除模板" busy={busy} onConfirm={removeTemplate} onClose={() => setDeleteTemplate(null)}><p>{deleteTemplate.name}</p><p className="field-hint">已经发布的商品不会受影响。</p></ConfirmDialog>}
    {preview && <ImageDialog url={preview} onClose={() => setPreview(null)} />}
  </>
}

export function ImageDialog({ url, onClose }) {
  const ref = React.useRef(null)
  useEffect(() => { ref.current.showModal() }, [])
  return <dialog className="image-dialog" ref={ref} onCancel={event => { event.preventDefault(); onClose() }}><button className="icon-button" autoFocus onClick={onClose} aria-label="关闭图片"><Icon name="close" /></button><img src={url} alt="图片预览" referrerPolicy="no-referrer" /></dialog>
}
