// Public website gateway. This surface only accepts fixed, read-only preview operations.
// The CloudBase credential is a Worker secret; it must never enter the browser bundle.
// The existing Tencent gateway removes its /admin-api mapping prefix. Its nested
// /public-api path is dispatched exclusively to the secret-protected preview handler.
const UPSTREAM_URL = 'https://cloud1-7gmtcu4s3aebce27-1383643768.ap-shanghai.app.tcloudbase.com/admin-api/public-api';
const OPERATIONS = new Set(['tripList', 'tripDetail', 'marketList', 'marketDetail']);
const CITIES = new Set(['ny_nj', 'ny', 'nj', 'boston', 'philadelphia', 'dc', 'la', 'bay_area', 'san_diego', 'seattle', 'chicago', 'champaign', 'ann_arbor', 'columbus', 'dallas', 'houston', 'austin', 'atlanta', 'miami', 'orlando']);
const IMAGE_HOSTS = ['tcb.qcloud.la', 'tcloudbaseapp.com', 'myqcloud.com', 'tencentcos.cn', 'qcloud.com'];
const ID = /^[a-z\d_-]{1,128}$/i;
const MAX_RESPONSE_BYTES = 200 * 1024;
const SECURITY_HEADERS = {
  'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https://*.tcb.qcloud.la https://*.tcloudbaseapp.com https://*.myqcloud.com https://*.tencentcos.cn https://*.qcloud.com; connect-src 'self'; font-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'self'; form-action 'none'",
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'no-referrer',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()',
  'Strict-Transport-Security': 'max-age=31536000',
};

function headers(extra = {}) { return new Headers({ ...SECURITY_HEADERS, ...extra }); }
function json(body, status = 200, ttl = 0) {
  return new Response(JSON.stringify(body), {
    status,
    headers: headers({
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': ttl ? `public, max-age=${ttl}, s-maxage=${ttl}` : 'no-store',
    }),
  });
}
function failure(status, code) { return json({ ok: false, error: code }, status); }
function integer(raw, fallback, min, max) {
  if (raw === null) return fallback;
  if (!/^(?:0|[1-9]\d{0,2})$/.test(raw)) return null;
  const value = Number(raw);
  return value >= min && value <= max ? value : null;
}

export function parsePublicQuery(url) {
  if (url.search.length > 2048) return null;
  const params = url.searchParams;
  const operation = params.get('operation');
  if (!OPERATIONS.has(operation)) return null;
  const detail = operation.endsWith('Detail');
  const market = operation.startsWith('market');
  const allowed = new Set(detail ? ['operation', 'kind', 'id'] : ['operation', 'kind', 'limit', 'offset', 'cityKey']);
  for (const key of params.keys()) {
    if (!allowed.has(key) || params.getAll(key).length !== 1) return null;
  }
  const kind = params.get('kind') ?? (detail ? '' : market ? 'goods' : 'all');
  const kinds = market ? ['goods', 'sublet'] : ['carpool', 'request'];
  if (!kinds.includes(kind) && !(kind === 'all' && !detail)) return null;
  const payload = { operation, kind, locale: 'en' };
  if (detail) {
    const id = params.get('id');
    if (!id || !ID.test(id)) return null;
    payload.id = id;
  } else {
    const limit = integer(params.get('limit'), 20, 1, 20);
    const offset = integer(params.get('offset'), 0, 0, 80);
    if (limit === null || offset === null) return null;
    payload.limit = limit;
    payload.offset = offset;
    const cityKey = params.get('cityKey');
    if (cityKey !== null && cityKey !== 'all') {
      if (!CITIES.has(cityKey)) return null;
      payload.cityKey = cityKey;
    }
  }
  const canonical = new URL('https://catx.eu.org/api/public');
  for (const key of Object.keys(payload).sort()) canonical.searchParams.set(key, String(payload[key]));
  return { payload, detail, market, canonical: canonical.href, ttl: detail ? 60 : 120 };
}

function safeText(value, max) {
  if (typeof value !== 'string' || value.length > max) throw new Error('Invalid public text');
  return value.replace(/<[^>]*>/g, '').replace(/[\u0000-\u0008\u000b-\u001f\u007f\u202a-\u202e\u2066-\u2069]/g, '');
}
function imageUrl(value) {
  if (typeof value !== 'string' || value.length > 4096) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password && !url.port &&
      IMAGE_HOSTS.some(host => url.hostname === host || url.hostname.endsWith(`.${host}`)) ? url.href : null;
  } catch { return null; }
}
function itemDto(value, request) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || typeof value.id !== 'string' || !ID.test(value.id)) throw new Error('Invalid public item');
  const kinds = request.market ? ['goods', 'sublet'] : ['carpool', 'request'];
  if (!kinds.includes(value.kind) || (request.payload.kind !== 'all' && value.kind !== request.payload.kind)) throw new Error('Invalid public kind');
  if (request.detail && value.id !== request.payload.id) throw new Error('Invalid public id');
  const result = { id: value.id, kind: value.kind };
  for (const [key, max] of Object.entries({ title: 300, description: 1600, priceText: 100, regionText: 200, timeText: 100, availabilityText: 100 })) {
    result[key] = safeText(value[key], max);
  }
  if (!Array.isArray(value.images) || value.images.length > 4 || !Array.isArray(value.tags) || value.tags.length > 8) throw new Error('Invalid public media');
  result.images = value.images.map(imageUrl).filter(Boolean);
  result.tags = value.tags.map(tag => safeText(tag, 80));
  if (!request.market) {
    for (const key of ['fromLabel', 'toLabel']) if (value[key] !== undefined) result[key] = safeText(value[key], 100);
    if (value.dateKey !== undefined) {
      if (typeof value.dateKey !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value.dateKey)) throw new Error('Invalid public date');
      result.dateKey = value.dateKey;
    }
    if (value.departureAtMs !== undefined) {
      if (!Number.isSafeInteger(value.departureAtMs) || value.departureAtMs < 0 || value.departureAtMs > 8640000000000000) throw new Error('Invalid public time');
      result.departureAtMs = value.departureAtMs;
    }
    if (value.seats !== undefined) {
      if (value.seats !== null && (!Number.isInteger(value.seats) || value.seats < 0 || value.seats > 99)) throw new Error('Invalid public seats');
      result.seats = value.seats;
    }
    if (value.full !== undefined) {
      if (typeof value.full !== 'boolean') throw new Error('Invalid public availability');
      result.full = value.full;
    }
  }
  return result;
}

export function publicDto(value, request) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || value.ok !== true) throw new Error('Invalid public response');
  if (request.detail) return { ok: true, item: itemDto(value.item, request) };
  if (!Array.isArray(value.items) || value.items.length > request.payload.limit || typeof value.hasMore !== 'boolean' ||
      !Number.isInteger(value.nextOffset) || value.nextOffset !== request.payload.offset + value.items.length || value.nextOffset > 100 ||
      (value.hasMore && !value.items.length)) throw new Error('Invalid public pagination');
  return { ok: true, items: value.items.map(item => itemDto(item, request)), hasMore: value.hasMore && value.nextOffset <= 80, nextOffset: value.nextOffset };
}

async function readBoundedJson(response) {
  const size = response.headers.get('content-length');
  if (size && (!/^\d+$/.test(size) || Number(size) > MAX_RESPONSE_BYTES)) throw new Error('Response too large');
  if (!/^application\/json(?:\s*;|$)/i.test(response.headers.get('content-type') || '') || !response.body) throw new Error('Invalid response type');
  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_RESPONSE_BYTES) throw new Error('Response too large');
      chunks.push(value);
    }
  } catch (error) {
    await reader.cancel().catch(() => {});
    throw error;
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
}

async function rateAllowed(binding, key) {
  if (!binding || typeof binding.limit !== 'function') throw new Error('Rate limit unavailable');
  const result = await binding.limit({ key });
  if (!result || typeof result.success !== 'boolean') throw new Error('Invalid rate limit');
  return result.success;
}

function secureStatic(response) {
  const result = new Response(response.body, response);
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) result.headers.set(key, value);
  result.headers.delete('Set-Cookie');
  result.headers.delete('Access-Control-Allow-Origin');
  result.headers.delete('Access-Control-Allow-Credentials');
  return result;
}

export function createWorker({ fetch: fetchUpstream = globalThis.fetch, cache: injectedCache, timeoutMs = 10000 } = {}) {
  const pending = new Map();
  return {
    async fetch(request, env, context) {
      const url = new URL(request.url);
      let path;
      try { path = decodeURIComponent(url.pathname); } catch { return failure(400, 'invalid_request'); }
      if (path.toLowerCase().startsWith('/admin')) return failure(404, 'not_found');
      if (path !== '/api/public') {
        if (path === '/api' || path.toLowerCase().startsWith('/api/')) return failure(404, 'not_found');
        if (request.method !== 'GET' && request.method !== 'HEAD') return failure(405, 'method_not_allowed');
        if (!env.ASSETS || typeof env.ASSETS.fetch !== 'function') return failure(503, 'service_unavailable');
        try { return secureStatic(await env.ASSETS.fetch(request)); } catch { return failure(503, 'service_unavailable'); }
      }
      if (request.method !== 'GET') return failure(405, 'method_not_allowed');
      const origin = request.headers.get('Origin');
      if ((origin && origin !== url.origin) || request.headers.get('Sec-Fetch-Site') === 'cross-site') return failure(403, 'request_not_allowed');
      const parsed = parsePublicQuery(url);
      if (!parsed) return failure(400, 'invalid_request');
      if (env.PUBLIC_API_URL !== UPSTREAM_URL || typeof env.PUBLIC_WEB_API_SECRET !== 'string' ||
          !/^[A-Za-z\d_-]{32,128}$/.test(env.PUBLIC_WEB_API_SECRET)) return failure(503, 'service_unavailable');
      const ip = request.headers.get('CF-Connecting-IP');
      if (!ip || ip.length > 45 || !/^[a-f\d:.]+$/i.test(ip)) return failure(503, 'service_unavailable');
      try {
        if (!await rateAllowed(env.PUBLIC_API_RATE_LIMIT, `public:${ip}`)) return failure(429, 'too_many_requests');
        // Require the origin budget even when a response happens to be cached.
        if (!env.UPSTREAM_RATE_LIMIT || typeof env.UPSTREAM_RATE_LIMIT.limit !== 'function') throw new Error('Missing origin budget');
      } catch { return failure(503, 'service_unavailable'); }
      const cache = injectedCache || globalThis.caches?.default;
      const cacheKey = new Request(parsed.canonical, { method: 'GET' });
      if (cache) {
        try {
          const cached = await cache.match(cacheKey);
          if (cached) return secureStatic(cached);
        } catch { /* The origin budget still bounds requests if the cache is unavailable. */ }
      }
      if (pending.has(parsed.canonical)) return (await pending.get(parsed.canonical)).clone();
      const load = (async () => {
        try {
          if (!await rateAllowed(env.UPSTREAM_RATE_LIMIT, 'public-origin-v1')) return failure(429, 'too_many_requests');
        } catch { return failure(503, 'service_unavailable'); }
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), timeoutMs);
        try {
          const upstream = await fetchUpstream(UPSTREAM_URL, {
            method: 'POST', redirect: 'manual', signal: controller.signal,
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'Authorization': `Bearer ${env.PUBLIC_WEB_API_SECRET}` },
            body: JSON.stringify(parsed.payload),
          });
          if (upstream.status !== 200) return failure(upstream.status === 404 ? 404 : 502, upstream.status === 404 ? 'not_found' : 'content_unavailable');
          const raw = await readBoundedJson(upstream);
          if (raw?.ok === false && raw.error === 'not_found') return failure(404, 'not_found');
          const response = json(publicDto(raw, parsed), 200, parsed.ttl);
          if (cache) {
            const save = Promise.resolve().then(() => cache.put(cacheKey, response.clone())).catch(() => {});
            if (context?.waitUntil) context.waitUntil(save); else await save;
          }
          return response;
        } catch { return failure(502, 'content_unavailable'); }
        finally { clearTimeout(timeout); }
      })();
      pending.set(parsed.canonical, load);
      try { return (await load).clone(); } finally { pending.delete(parsed.canonical); }
    },
  };
}

export default createWorker();
