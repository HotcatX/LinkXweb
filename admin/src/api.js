import { createBackendApi } from './backend.js'
export { errorMessage } from './errors.js'

export function resolveEndpoint(value, origin) {
  const url = new URL(value, origin)
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname))) throw new Error('管理接口必须使用 HTTPS')
  if (url.username || url.password || url.hash || url.search) throw new Error('管理接口地址无效')
  return url.href
}
export function resolveApiConfig(config = {}, origin) {
  if (config.mode && config.mode !== 'backend') throw new Error('旧管理接口已停用，请刷新页面')
  if (!config.backendOrigin) throw new Error('管理接口尚未配置')
  const endpoint = resolveEndpoint(config.backendOrigin, origin)
  if (new URL(endpoint).pathname !== '/') throw new Error('服务器接口请填写 HTTPS 域名，不含路径')
  return { mode: 'backend', endpoint }
}
export function createApi({ mode = 'backend', ...options }) {
  if (mode !== 'backend') throw new Error('旧管理接口已停用，请刷新页面')
  const transport = createBackendApi(options)
  return { ...transport, mode, workspaceKey() {
    const admin = transport.getSession()?.admin
    const account = admin?.accountId || admin?.username
    if (!account) throw new Error('请先登录')
    return `admin_workspace:v2:backend:${options.endpoint}:${account}`
  } }
}
