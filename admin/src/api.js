const SESSION_KEY = 'campus_admin_session_v1'

export function resolveEndpoint(value, origin) {
  const url = new URL(value || '/admin-api', origin)
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname))) {
    throw new Error('管理接口必须使用 HTTPS')
  }
  if (url.username || url.password || url.hash) throw new Error('管理接口地址无效')
  return url.href
}

const errors = {
  authentication_required: '登录已过期，请重新登录；未提交的内容仍保留在本页',
  session_invalid: '登录已过期，请重新登录；未提交的内容仍保留在本页',
  login_rate_limited: '登录尝试次数较多，请 15 分钟后再试',
  idempotency_conflict: '此条内容与原发布请求不一致，请核对已发布记录后再编辑',
  image_not_allowed: '此图片尚未获得使用授权，请重新选择并上传',
  invalid_community_config: '请检查群码有效期、公告内容和展示次数',
  service_unavailable: '服务暂时不可用，请稍后重试',
  item_save_failed: '保存结果尚未确认，请重试原批次以确认结果',
  missing_template_contact: '保存模板前请填写联系人和联系方式',
  missing_template_region: '保存模板前请选择城市、区域和细分区域',
  invalid_credentials: '账号或密码不正确', invalid_password: '账号或密码不正确',
  login_failed: '账号或密码不正确', too_many_attempts: '尝试次数较多，请稍后再登录',
  rate_limited: '操作过于频繁，请稍后再试', unauthorized: '登录已过期，请重新登录',
  session_expired: '登录已过期，请重新登录', forbidden: '当前账号没有此操作权限',
  invalid_origin: '此网站地址尚未获得管理接口授权', origin_not_allowed: '此网站地址尚未获得授权',
  not_configured: '管理后台尚未完成配置', conflict: '配置已被其他人更新，请重新加载后再保存',
  version_conflict: '配置已被其他人更新，请重新加载后再保存', missing_required_fields: '请补全必填项目',
  invalid_image: '图片格式无效，请选择 JPG、PNG 或 WebP 图片', image_too_large: '图片超过 2 MB，请换一张较小的图片',
  EXCEED_MAX_PAYLOAD_SIZE: '上传内容超过接口大小限制，请刷新后台后重试或选择较小的图片',
  invalid_file: '图片文件无效，请重新上传', file_not_owned: '这张图片不能用于当前发布，请重新上传',
  batch_conflict: '此批次内容已变化，请重新整理后发布', request_conflict: '这条发布内容已变化，请重新保存草稿',
  not_found: '记录不存在或已被移除', invalid_price: '请输入有效价格', invalid_dates: '请检查日期范围',
  invalid_pickup_range: '请检查开始和结束日期', invalid_expiry: '请填写将来的二维码到期时间'
}
export const errorMessage = code => errors[code] || '操作未完成，请稍后重试'

export function createApi({ endpoint, storage, fetcher = fetch, onUnauthorized = () => {} }) {
  let session = null
  try {
    const saved = JSON.parse(storage.getItem(SESSION_KEY) || 'null')
    if (saved && typeof saved.token === 'string' && saved.expiresAtMs > Date.now()) session = saved
    else storage.removeItem(SESSION_KEY)
  } catch (_) {}
  function clear() { session = null; try { storage.removeItem(SESSION_KEY) } catch (_) {} }
  async function call(action, data = {}, { anonymous = false } = {}) {
    if (!anonymous && (!session || session.expiresAtMs <= Date.now())) {
      clear(); onUnauthorized(); throw new Error('登录已过期，请重新登录')
    }
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 90000)
    try {
      const payload = JSON.stringify({ ...data, action })
      const binaryUpload = action === 'uploadImage'
      const response = await fetcher(endpoint, {
        method: 'POST', credentials: 'omit', cache: 'no-store', signal: controller.signal,
        // CloudBase's JSON/text gateway limit is 100 KB. Binary transport keeps
        // the original image intact and is decoded by the same authenticated API.
        headers: { 'Content-Type': binaryUpload ? 'application/octet-stream' : 'application/json', ...(anonymous ? {} : { Authorization: `Bearer ${session.token}` }) },
        body: binaryUpload ? new TextEncoder().encode(payload) : payload
      })
      let result
      try { result = await response.json() } catch (_) { throw new Error('管理接口暂时不可用，请确认网站已完成部署') }
      if (!response.ok || !result || result.ok !== true) {
        if (!anonymous && (response.status === 401 || ['unauthorized', 'session_expired', 'invalid_session', 'session_invalid', 'authentication_required'].includes(result?.error))) { clear(); onUnauthorized() }
        const code = result?.error || result?.code || (response.status === 413 ? 'EXCEED_MAX_PAYLOAD_SIZE' : 'request_failed')
        const error = new Error(errorMessage(code))
        error.code = code
        throw error
      }
      return result
    } catch (error) {
      if (error.name === 'AbortError') throw new Error('请求时间较长，请稍后重试；重复提交会自动去重')
      if (error instanceof TypeError) throw new Error('无法连接管理接口，请检查网络或网站授权配置')
      throw error
    } finally { clearTimeout(timeout) }
  }
  return {
    call, clear, getSession: () => session,
    async login(username, password) {
      const result = await call('login', { username, password }, { anonymous: true })
      if (typeof result.token !== 'string' || !Number.isFinite(result.expiresAtMs) || result.expiresAtMs <= Date.now()) throw new Error('登录响应无效')
      session = { token: result.token, expiresAtMs: result.expiresAtMs, admin: result.admin }
      try { storage.setItem(SESSION_KEY, JSON.stringify(session)) } catch (_) {}
      return session
    },
    async logout() { try { await call('logout') } finally { clear() } }
  }
}
