import { createBackendApi } from './backend.js'
import { createCloudbaseApi } from './compat/cloudbase.js'
export { errorMessage } from './errors.js'

export function resolveEndpoint(value, origin) {
  const url = new URL(value || '/admin-api', origin)
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname))) throw new Error('管理接口必须使用 HTTPS')
  if (url.username || url.password || url.hash || url.search) throw new Error('管理接口地址无效')
  return url.href
}
export function resolveApiConfig(config = {}, origin) {
  const mode = config.mode || 'cloudbase'
  if (!['cloudbase', 'backend'].includes(mode)) throw new Error('管理接口模式无效')
  const endpoint = resolveEndpoint(mode === 'backend' ? config.backendOrigin : config.apiUrl, origin)
  if (mode === 'backend' && (!config.backendOrigin || new URL(endpoint).pathname !== '/')) throw new Error('服务器接口请填写 HTTPS 域名，不含路径')
  return { mode, endpoint }
}
export function createApi({ mode = 'cloudbase', ...options }) {
  if (!['cloudbase', 'backend'].includes(mode)) throw new Error('管理接口模式无效')
  const transport = mode === 'backend' ? createBackendApi(options) : createCloudbaseApi(options)
  return { ...transport, mode, workspaceKey() {
    const admin = transport.getSession()?.admin
    const account = admin?.accountId || admin?.username
    if (!account) throw new Error('请先登录')
    return `admin_workspace:v2:${mode}:${options.endpoint}:${account}`
  } }
}
