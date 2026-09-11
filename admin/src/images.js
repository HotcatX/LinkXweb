import { MAX_IMAGE_BYTES } from './model.js'

export function validateImageFile(file) {
  if (!file || !['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('请选择 JPG、PNG 或 WebP 图片')
  if (!file.size || file.size > 20 * 1024 * 1024) throw new Error('原图大小需在 20 MB 以内')
}
export async function base64File(blob) {
  const buffer = new Uint8Array(await blob.arrayBuffer())
  let binary = ''
  for (let offset = 0; offset < buffer.length; offset += 32768) binary += String.fromCharCode(...buffer.subarray(offset, offset + 32768))
  return btoa(binary)
}
export async function compressMarketImage(file, { thumbnail = false } = {}) {
  validateImageFile(file)
  const bitmap = await createImageBitmap(file)
  try {
    const maximum = thumbnail ? 480 : 1600
    const ratio = Math.min(1, maximum / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(bitmap.width * ratio)); canvas.height = Math.max(1, Math.round(bitmap.height * ratio))
    const context = canvas.getContext('2d')
    context.fillStyle = '#fff'; context.fillRect(0, 0, canvas.width, canvas.height)
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', thumbnail ? 0.55 : 0.75))
    if (!blob || blob.size > MAX_IMAGE_BYTES) throw new Error('图片压缩后仍超过 2 MB，请选择较小的图片')
    return blob
  } finally { bitmap.close() }
}
