// Temporary migration fallback, selected only by deployment mode. Delete after
// backend release verification and reconciliation of legacy pending batches.
// A backend request failure MUST NEVER call this transport or the old database.
import { createCloudbaseTransport } from './cloudbase-transport.js'
import { base64File } from '../images.js'

export function toLegacyListing(c) {
  const seller = c.sellerContact || {}; const sublet = c.sublet || {}; const images = c.images || []
  const value = {
    listingType: c.listingType, title: c.title, desc: c.description, price: c.priceCents / 100,
    category: c.category, condition: c.condition, regionState: c.region?.state, regionCounty: c.region?.county,
    regionArea: c.region?.area, buildingName: c.buildingName, Apartment: c.buildingName,
    pickupStartDate: c.startDate, pickupEndDate: c.endDate,
    sellerName: seller.name, sellerWechat: seller.wechat, sellerPhone: seller.phone, sellerNote: seller.note,
    location: c.location ? Object.fromEntries(Object.entries(c.location).filter(([, value]) => value != null)) : {},
    imageFileIDs: images.map(i => i.fileId), thumbFileIDs: images.map(i => i.thumbFileId || ''),
    imageFileID: images[0]?.fileId || '', thumbFileID: images[0]?.thumbFileId || ''
  }
  if (c.listingType === 'sublet') Object.assign(value, { roomType: c.category, availableStartDate: c.startDate, leaseEndDate: c.endDate,
    housingType: sublet.housingType, deposit: sublet.depositCents == null ? '' : String(sublet.depositCents / 100), furnished: sublet.furnished,
    utilitiesIncluded: sublet.utilitiesIncluded, genderPreference: sublet.genderPreference, roommateCount: sublet.roommateCount == null ? '' : String(sublet.roommateCount) })
  return value
}
export function fromLegacyListing(row = {}) {
  const nullableNumber = value => value == null || value === '' ? null : Number(value)
  const content = {
    listingType: row.listingType || 'goods', title: row.title || '', description: row.desc || '', priceCents: Math.round(Number(row.price || 0) * 100),
    category: row.category || row.roomType || '其他', condition: row.condition || '',
    region: { state: row.regionState || '', county: row.regionCounty || '', area: row.regionArea || '' }, buildingName: row.buildingName || row.Apartment || '',
    location: row.location ? { displayName: row.location.displayName || row.location.name || '', address: row.location.address || '', latitude: nullableNumber(row.location.latitude), longitude: nullableNumber(row.location.longitude) } : null,
    sellerContact: { name: row.sellerName || '', wechat: row.sellerWechat || '', phone: row.sellerPhone || '', avatar: '', note: row.sellerNote || '' },
    sublet: row.listingType === 'sublet' ? { housingType: row.housingType || '', depositCents: nullableNumber(row.deposit) == null ? null : Math.round(Number(row.deposit) * 100), furnished: !!row.furnished, utilitiesIncluded: !!row.utilitiesIncluded, genderPreference: row.genderPreference || '', roommateCount: nullableNumber(row.roommateCount) } : null
  }
  if (row.pickupStartDate || row.availableStartDate) content.startDate = row.pickupStartDate || row.availableStartDate
  if (row.pickupEndDate || row.leaseEndDate) content.endDate = row.pickupEndDate || row.leaseEndDate
  return { id: row.id || row._id, version: row.version, status: row.status, content,
    images: (row.imageFileIDs || (row.imageFileID ? [row.imageFileID] : [])).map((fileId, i) => ({ fileId, ...(row.thumbFileIDs?.[i] ? { thumbFileId: row.thumbFileIDs[i] } : {}) })) }
}
function community(value, legacy = false) {
  return Object.fromEntries(['group', 'announcement'].map(section => {
    const { imageFileID, imageFileId, ...data } = value[section] || {}
    return [section, { ...data, [legacy ? 'imageFileID' : 'imageFileId']: (legacy ? imageFileId : imageFileID) || (legacy ? '' : null) }]
  }))
}
const templates = result => ({ templates: (result.templates || []).map(t => ({ id: t.id || t._id, name: t.name, data: fromLegacyListing(t.data).content })) })
export function createCloudbaseApi(options) {
  const transport = createCloudbaseTransport(options)
  async function call(action, input = {}) {
    if (action === 'bootstrap') {
      const result = await transport.call(action)
      return { regionTree: result.regionTree, ...templates(result), community: { ...community(result.community), version: result.community.version } }
    }
    if (action === 'bulkCreate') return transport.call(action, { batchId: input.batchId, items: input.items.map(({ item, ...identity }) => ({ ...toLegacyListing(item), ...identity })) })
    if (action === 'getItem') return fromLegacyListing((await transport.call(action, input)).item)
    if (action === 'updateItem') {
      const result = await transport.call(action, { ...input, patch: toLegacyListing(input.patch) })
      return { id: result.id, version: result.item.version, status: result.item.status }
    }
    if (action === 'listTemplates') return templates(await transport.call(action))
    if (action === 'saveTemplate') return transport.call(action, { template: { ...input, data: toLegacyListing(input.data) } })
    if (action === 'getCommunity' || action === 'updateCommunity') {
      const result = await transport.call(action, action === 'updateCommunity' ? { ...input, config: community(input.config, true) } : {})
      return { config: community(result.config), version: result.version }
    }
    if (action === 'getImageURLs') {
      const result = await transport.call(action, { fileIDs: input.fileIds })
      return { items: (result.files || []).map(f => ({ fileId: f.fileID, url: f.url })), expiresIn: 300 }
    }
    if (action === 'session' || action === 'deleteTemplate') return transport.call(action, input)
    throw new Error('不支持的管理操作')
  }
  return { ...transport, call, async uploadImage(blob, { purpose, filename } = {}) {
    const result = await transport.call('uploadImage', { purpose, filename, contentType: blob.type, base64: await base64File(blob) })
    return { fileId: result.fileID }
  } }
}
