// Deployment fills the HTTPS management endpoint. No credentials belong here.
window.ADMIN_CONFIG = Object.freeze({
  // Switch explicitly only after migration, allowed Origin and admin login checks.
  // No runtime failover to the other database.
  mode: 'cloudbase',
  backendOrigin: 'https://collect.linkx.ink', apiUrl: 'https://cloud1-7gmtcu4s3aebce27-1383643768.ap-shanghai.app.tcloudbase.com/admin-api' })
