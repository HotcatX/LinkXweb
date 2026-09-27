export const GOODS_CATEGORIES = ['家具', '厨具', '电器', '服包鞋饰', '电子产品', '运动装备', '食品', '其他']
export const ROOM_TYPES = ['Studio', '1B1B', '2B1B', '2B2B', '3B2B', '其他']
export const MAX_IMAGES = 6
export const MAX_IMAGE_BYTES = 2 * 1024 * 1024
export function localDate(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}
export function blankDraft(previous = {}) {
  const end = new Date(); end.setDate(end.getDate() + 14)
  return {
    listingType: 'goods', title: '', price: '', category: '其他', condition: '99新', desc: '',
    sellerName: '', sellerWechat: '', sellerPhone: '', regionState: '', regionCounty: '', regionArea: '',
    cityKey: '', cityLabel: '', regionKey: '', regionGroupKey: '', buildingName: '', detailAddress: '',
    latitude: '', longitude: '', pickupStartDate: localDate(), pickupEndDate: localDate(end),
    deposit: '', housingType: '', furnished: false, utilitiesIncluded: false, genderPreference: '不限', roommateCount: '',
    ...previous, images: [], clientRequestId: '', externalId: ''
  }
}
export function validateDraft(draft) {
  const required = [['title', '标题'], ['sellerName', '联系人'], ['sellerWechat', '微信号'], ['regionState', '城市'], ['regionCounty', '区域'], ['regionArea', '细分区域']]
  for (const [key, label] of required) if (!String(draft[key] || '').trim()) return `请填写${label}`
  if (draft.price === '' || !Number.isFinite(Number(draft.price)) || Number(draft.price) < 0) return '请输入有效价格，可填写 0'
  if (!/^\d{4}-\d{2}-\d{2}$/.test(draft.pickupStartDate) || !/^\d{4}-\d{2}-\d{2}$/.test(draft.pickupEndDate) || draft.pickupEndDate < draft.pickupStartDate) return '请填写有效的起止日期'
  if ((draft.images || []).length > MAX_IMAGES) return '每条最多 6 张图片'
  const hasLat = String(draft.latitude ?? '') !== ''; const hasLng = String(draft.longitude ?? '') !== ''
  if (hasLat !== hasLng || hasLat && (!Number.isFinite(Number(draft.latitude)) || !Number.isFinite(Number(draft.longitude)) || Math.abs(Number(draft.latitude)) > 90 || Math.abs(Number(draft.longitude)) > 180)) return '请同时填写有效经纬度，或同时留空'
  try { cents(draft.price); if (draft.listingType === 'sublet' && draft.deposit !== '') cents(draft.deposit) } catch (error) { return error.message }
  if (draft.listingType === 'sublet' && draft.roommateCount !== '' && (!Number.isSafeInteger(Number(draft.roommateCount)) || Number(draft.roommateCount) < 0)) return '室友数量应为非负整数'
  return ''
}
// View inputs use dollars/local dates; network payloads use integer cents and
// canonical nested fields. Temporary image URLs never enter saved content.
export function cents(value) {
  const text = String(value ?? '').trim()
  if (!/^\d+(?:\.\d{1,2})?$/.test(text)) throw new Error('金额最多保留两位小数')
  const [whole, fraction = ''] = text.split('.')
  const number = Number(whole) * 100 + Number(fraction.padEnd(2, '0'))
  if (!Number.isSafeInteger(number) || number > 10000000000) throw new Error('金额超出允许范围')
  return number
}
export function draftPayload(draft) {
  return {
    listingType: draft.listingType, title: draft.title.trim(), description: draft.desc || '',
    priceCents: cents(draft.price), category: draft.category, condition: draft.condition || '',
    region: { state: draft.regionState, county: draft.regionCounty, area: draft.regionArea },
    buildingName: draft.buildingName || '',
    location: { displayName: draft.detailAddress || draft.buildingName || '', address: draft.detailAddress || '',
      latitude: draft.latitude === '' || draft.latitude == null ? null : Number(draft.latitude),
      longitude: draft.longitude === '' || draft.longitude == null ? null : Number(draft.longitude) },
    startDate: draft.pickupStartDate, endDate: draft.pickupEndDate,
    sellerContact: { name: draft.sellerName.trim(), wechat: draft.sellerWechat.trim(), phone: draft.sellerPhone || '', avatar: draft.sellerAvatar || '', note: draft.sellerNote || '' },
    sublet: draft.listingType === 'sublet' ? { housingType: draft.housingType || '',
      depositCents: draft.deposit === '' || draft.deposit == null ? null : cents(draft.deposit),
      furnished: !!draft.furnished, utilitiesIncluded: !!draft.utilitiesIncluded,
      genderPreference: draft.genderPreference || '', roommateCount: draft.roommateCount === '' || draft.roommateCount == null ? null : Number(draft.roommateCount) } : null,
    images: (draft.images || []).map(image => ({ fileId: image.fileId, ...(image.thumbFileId ? { thumbFileId: image.thumbFileId } : {}) }))
  }
}
export function templatePayload(draft) {
  const { images, ...data } = draftPayload({ ...draft, price: draft.price === '' ? '0' : draft.price })
  data.sellerContact.avatar = '' // Templates never carry a saved contact avatar.
  for (const key of ['title', 'startDate', 'endDate']) if (!data[key]) delete data[key]
  return data
}
export function contentDraft(content, images = []) {
  const c = content || {}; const sublet = c.sublet || {}; const seller = c.sellerContact || {}
  return { ...blankDraft(), listingType: c.listingType || 'goods', title: c.title || '',
    price: c.priceCents == null ? '' : String(c.priceCents / 100), category: c.category || '其他', condition: c.condition || '', desc: c.description || '',
    regionState: c.region?.state || '', regionCounty: c.region?.county || '', regionArea: c.region?.area || '',
    buildingName: c.buildingName || '', detailAddress: c.location?.address || c.location?.displayName || '',
    latitude: c.location?.latitude ?? '', longitude: c.location?.longitude ?? '',
    ...(c.startDate ? { pickupStartDate: c.startDate } : {}), ...(c.endDate ? { pickupEndDate: c.endDate } : {}),
    sellerName: seller.name || '', sellerWechat: seller.wechat || '', sellerPhone: seller.phone || '', sellerAvatar: seller.avatar || '', sellerNote: seller.note || '',
    deposit: sublet.depositCents == null ? '' : String(sublet.depositCents / 100), housingType: sublet.housingType || '',
    furnished: !!sublet.furnished, utilitiesIncluded: !!sublet.utilitiesIncluded, genderPreference: sublet.genderPreference || '不限',
    roommateCount: sublet.roommateCount ?? '', images }
}
export function datetimeInput(value) {
  if (!value) return ''
  const date = new Date(typeof value === 'object' ? value.$date : value)
  if (!Number.isFinite(date.getTime())) return ''
  return `${localDate(date)}T${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}
export function datetimeISO(value) {
  if (!value) return ''
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) throw new Error('日期格式无效')
  return date.toISOString()
}
export function normalizeEditableCommunity(raw = {}) {
  return {
    version: Number(raw.version) || 0,
    group: { enabled: false, title: 'Fort Lee 拼车群', imageFileId: null, expiresAt: '', ...raw.group },
    announcement: { enabled: false, id: '', title: '加入拼车群', body: '', showGroupImage: true, imageFileId: null, maxShows: 1, intervalHours: 24, startAt: '', endAt: '', ...raw.announcement }
  }
}
export function communityPayload(config) {
  return {
    group: { enabled: !!config.group.enabled, title: config.group.title.trim(), imageFileId: config.group.imageFileId || null, expiresAt: datetimeISO(config.group.expiresAt) || null },
    announcement: { enabled: !!config.announcement.enabled, id: config.announcement.id.trim(), title: config.announcement.title.trim(), body: config.announcement.body.trim(), showGroupImage: !!config.announcement.showGroupImage, imageFileId: config.announcement.imageFileId || null, maxShows: Number(config.announcement.maxShows), intervalHours: Number(config.announcement.intervalHours), startAt: datetimeISO(config.announcement.startAt) || null, endAt: datetimeISO(config.announcement.endAt) || null }
  }
}
export function validateCommunity(config, now = Date.now()) {
  if (config.group.enabled && (!config.group.imageFileId || !config.group.expiresAt || !Number.isFinite(new Date(config.group.expiresAt).getTime()) || new Date(config.group.expiresAt).getTime() <= now)) return '请上传群二维码，并填写将来的到期时间'
  const notice = config.announcement
  if (!notice.enabled && !notice.id && !notice.body.trim() && !notice.imageFileId) return ''
  if ([notice.startAt, notice.endAt].some(value => value && !Number.isFinite(new Date(value).getTime()))) return '请填写有效的公告时间'
  if (!/^[a-zA-Z0-9_-]{1,128}$/.test(notice.id)) return '公告编号请使用字母、数字、短横线或下划线'
  if (!Number.isInteger(Number(notice.maxShows)) || Number(notice.maxShows) < 1 || Number(notice.maxShows) > 100) return '自动展示次数需为 1–100 的整数'
  if (!Number.isFinite(Number(notice.intervalHours)) || Number(notice.intervalHours) < 0 || Number(notice.intervalHours) > 8760) return '展示间隔应在 0–8760 小时之间'
  if (notice.startAt && notice.endAt && new Date(notice.startAt) >= new Date(notice.endAt)) return '公告结束时间需要晚于开始时间'
  if (!notice.body.trim() && !notice.imageFileId && !(notice.showGroupImage && config.group.imageFileId)) return '请填写公告正文或选择一张图片'
  return ''
}
