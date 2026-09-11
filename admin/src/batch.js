import { draftPayload } from './model.js'
import { errorMessage } from './api.js'

// These errors are raised before a goods record is written. Other failures may
// have happened after commit; keep their original request identity for recovery.
const SAFE_TO_EDIT = new Set(['invalid_item', 'invalid_listing_type', 'invalid_price', 'invalid_location', 'invalid_images', 'too_many_images', 'invalid_external_id', 'invalid_pickup_range', 'invalid_available_range', 'missing_required_fields', 'image_not_allowed', 'invalid_file_id', 'invalid_dates'])
export function createBatch(rows, batchId) {
  const pending = rows.filter(row => row._status !== 'success')
  return { batchId, keys: pending.map(row => row._key), items: pending.map(row => structuredClone(draftPayload(row))) }
}
export function applyBatchResult(rows, batch, result) {
  return rows.map(row => {
    const index = batch.keys.indexOf(row._key)
    if (index < 0) return row
    const success = (result.results || []).find(item => item.index === index)
    if (success) return { ...row, _status: 'success', resultId: success.itemId || success.id, error: '' }
    // A later uncertain response must not downgrade an already confirmed item.
    if (row._status === 'success') return row
    const failure = (result.failures || []).find(item => item.index === index)
    return { ...row, _status: SAFE_TO_EDIT.has(failure?.error) ? 'failed' : 'unconfirmed', error: errorMessage(failure?.error || 'item_save_failed') }
  })
}
export function uncertainBatch(rows, batch) {
  return rows.map(row => batch.keys.includes(row._key) && row._status !== 'success' ? { ...row, _status: 'unconfirmed', error: '发布结果尚未确认，请重试原请求。确认前保留原内容，避免重复发布。' } : row)
}
