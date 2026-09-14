import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorker, parsePublicQuery, publicDto } from '../public-worker/index.mjs';

const PUBLIC_API_URL = 'https://cloud1-7gmtcu4s3aebce27-1383643768.ap-shanghai.app.tcloudbase.com/admin-api/public-api';
const SECRET = 'test-secret-only-0000000000000000000000000000';
const baseItem = {
  id: 'trip_123', kind: 'carpool', title: 'Fort Lee → Columbia', description: 'Confirm pickup in the mini-program.',
  priceText: '$10', regionText: 'Fort Lee → Columbia', timeText: '2026-09-16 10:00', availabilityText: '3 seats available',
  images: [], tags: ['Carpool'], fromLabel: 'Fort Lee', toLabel: 'Columbia', dateKey: '2026-09-16',
  departureAtMs: 1789581600000, seats: 3, full: false,
};
function rate(success = true) {
  return { calls: [], async limit(value) { this.calls.push(value); return { success }; } };
}
function environment(overrides = {}) {
  return { PUBLIC_API_URL, PUBLIC_WEB_API_SECRET: SECRET, PUBLIC_API_RATE_LIMIT: rate(), UPSTREAM_RATE_LIMIT: rate(), ...overrides };
}
function request(query = 'operation=tripList', options = {}) {
  return new Request(`https://catx.eu.org/api/public?${query}`, {
    ...options, headers: { 'CF-Connecting-IP': '203.0.113.7', ...options.headers },
  });
}
function successful(items = [baseItem], offset = 0) {
  return new Response(JSON.stringify({ ok: true, items, hasMore: false, nextOffset: offset + items.length }), {
    headers: { 'Content-Type': 'application/json', 'Set-Cookie': 'private-session=must-not-leak', 'X-Secret': SECRET },
  });
}
function cacheStore() {
  const data = new Map();
  return { data, async match(key) { return data.get(key.url)?.clone(); }, async put(key, response) { data.set(key.url, response.clone()); } };
}

test('normalizes equivalent public requests into a shared cache key across hostnames', () => {
  const first = parsePublicQuery(new URL('https://catx.eu.org/api/public?operation=tripList'));
  const second = parsePublicQuery(new URL('https://example.workers.dev/api/public?offset=0&kind=all&cityKey=all&operation=tripList&limit=20'));
  assert.equal(first.canonical, second.canonical);
  assert.deepEqual(first.payload, { operation: 'tripList', kind: 'all', locale: 'en', limit: 20, offset: 0 });
  assert.equal(first.ttl, 120);
});

test('rejects arbitrary actions, queries, duplicate keys, collection names and unbounded pagination', () => {
  const queries = [
    '', 'operation=joinTrip', 'operation=tripList&action=joinTrip', 'operation=tripList&operation=marketList',
    'operation=tripList&collection=WebAdminAccounts', 'operation=tripList&sellerId=somebody',
    'operation=tripList&url=https://evil.example', 'operation=tripList&locale=zh',
    'operation=tripList&limit=21', 'operation=tripList&limit=0', 'operation=tripList&limit=1.5',
    'operation=tripList&limit=01', 'operation=tripList&offset=81', 'operation=tripList&offset=-1',
    'operation=tripList&offset=1e2', 'operation=tripList&cityKey=unknown_city',
    'operation=tripList&cityKey=%24where', 'operation=tripList&cityKey=',
    'operation=tripList&kind=goods', 'operation=marketList&kind=carpool',
    'operation=tripDetail&id=valid_id', 'operation=tripDetail&kind=all&id=valid_id',
    'operation=marketDetail&kind=goods&id=valid_id&limit=20',
    'operation=marketDetail&kind=goods&id=../../secrets',
    `operation=marketDetail&kind=goods&id=${'x'.repeat(129)}`,
    'operation=tripList&id=not-a-filter', 'operation=tripList&limit=',
  ];
  for (const query of queries) assert.equal(parsePublicQuery(new URL(`https://catx.eu.org/api/public?${query}`)), null, query);
});

test('accepts fixed cities and four explicitly read-only operations', () => {
  for (const query of [
    'operation=tripList&kind=request&cityKey=ny_nj&offset=80&limit=20',
    'operation=marketList&kind=sublet&cityKey=boston',
    'operation=marketDetail&kind=goods&id=item_ABC-12',
    'operation=tripDetail&kind=carpool&id=route-2',
  ]) assert.ok(parsePublicQuery(new URL(`https://catx.eu.org/api/public?${query}`)), query);
});

test('forwards only the approved JSON body and server secret, with no client identity or cookies', async () => {
  let received;
  const env = environment();
  const worker = createWorker({ fetch: async (url, options) => { received = { url, options }; return successful(); } });
  const response = await worker.fetch(request('operation=tripList', {
    headers: { Cookie: 'adminToken=sensitive', Authorization: 'Bearer attacker', 'X-Forwarded-For': 'attacker', Origin: 'https://catx.eu.org' },
  }), env);
  assert.equal(response.status, 200);
  assert.equal(received.url, PUBLIC_API_URL);
  assert.equal(received.options.method, 'POST');
  assert.equal(received.options.redirect, 'manual');
  assert.deepEqual(received.options.headers, { 'Content-Type': 'application/json', Accept: 'application/json', Authorization: `Bearer ${SECRET}` });
  assert.deepEqual(JSON.parse(received.options.body), { operation: 'tripList', kind: 'all', locale: 'en', limit: 20, offset: 0 });
  assert.deepEqual(await response.json(), { ok: true, items: [baseItem], hasMore: false, nextOffset: 1 });
  assert.equal(response.headers.get('Set-Cookie'), null);
  assert.equal(response.headers.get('X-Secret'), null);
  assert.equal(response.headers.get('Access-Control-Allow-Origin'), null);
  assert.equal(response.headers.get('X-Content-Type-Options'), 'nosniff');
  assert.equal(response.headers.get('Cache-Control'), 'public, max-age=120, s-maxage=120');
  assert.deepEqual(env.PUBLIC_API_RATE_LIMIT.calls, [{ key: 'public:203.0.113.7' }]);
  assert.deepEqual(env.UPSTREAM_RATE_LIMIT.calls, [{ key: 'public-origin-v1' }]);
});

test('all mutation methods and unknown API/admin routes are rejected before any upstream call', async () => {
  let calls = 0;
  const worker = createWorker({ fetch: async () => { calls++; return successful(); } });
  for (const method of ['POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD']) {
    const response = await worker.fetch(request('operation=tripList', { method }), environment());
    assert.equal(response.status, 405, method);
  }
  for (const path of ['/api', '/api/write', '/api/admin', '/admin', '/admin/', '/admin-api', '/ADMIN/settings', '/%61dmin/']) {
    const response = await worker.fetch(new Request(`https://catx.eu.org${path}`), environment());
    assert.equal(response.status, 404, path);
  }
  assert.equal(calls, 0);
});

test('cross-site browser access cannot turn the gateway into a CORS relay', async () => {
  let calls = 0;
  const worker = createWorker({ fetch: async () => { calls++; return successful(); } });
  for (const headers of [{ Origin: 'https://evil.example' }, { Origin: 'null' }, { 'Sec-Fetch-Site': 'cross-site' }]) {
    const response = await worker.fetch(request('operation=tripList', { headers }), environment());
    assert.equal(response.status, 403);
    assert.equal(response.headers.get('Access-Control-Allow-Origin'), null);
  }
  assert.equal(calls, 0);
});

test('requires valid production configuration and both rate-limit bindings, failing closed', async () => {
  let calls = 0;
  const worker = createWorker({ fetch: async () => { calls++; return successful(); } });
  const badSettings = [
    { PUBLIC_API_URL: 'https://evil.example/public-api' }, { PUBLIC_API_URL: `${PUBLIC_API_URL}?action=write` },
    { PUBLIC_API_URL: PUBLIC_API_URL.replace('/public-api', '/admin-api') },
    { PUBLIC_WEB_API_SECRET: '' }, { PUBLIC_WEB_API_SECRET: `${SECRET}\nheader` },
    { PUBLIC_WEB_API_SECRET: 'x'.repeat(129) }, { PUBLIC_WEB_API_SECRET: `${SECRET}+` },
    { PUBLIC_API_RATE_LIMIT: undefined }, { UPSTREAM_RATE_LIMIT: undefined },
    { PUBLIC_API_RATE_LIMIT: { limit: async () => { throw new Error('private binding failure'); } } },
    { PUBLIC_API_RATE_LIMIT: { limit: async () => ({}) } },
    { UPSTREAM_RATE_LIMIT: { limit: async () => { throw new Error('private origin failure'); } } },
  ];
  for (const settings of badSettings) {
    const response = await worker.fetch(request(), environment(settings));
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), { ok: false, error: 'service_unavailable' });
  }
  const missingIp = await worker.fetch(new Request('https://catx.eu.org/api/public?operation=tripList'), environment());
  assert.equal(missingIp.status, 503);
  assert.equal(calls, 0);
});

test('per-visitor and shared origin budgets independently prevent upstream calls', async () => {
  let calls = 0;
  const worker = createWorker({ fetch: async () => { calls++; return successful(); } });
  for (const settings of [{ PUBLIC_API_RATE_LIMIT: rate(false) }, { UPSTREAM_RATE_LIMIT: rate(false) }]) {
    const response = await worker.fetch(request(), environment(settings));
    assert.equal(response.status, 429);
    assert.equal(response.headers.get('Cache-Control'), 'no-store');
  }
  assert.equal(calls, 0);
});

test('cached successes are shared across hosts and query ordering without reusing the origin budget', async () => {
  const cache = cacheStore();
  let calls = 0;
  const worker = createWorker({ cache, fetch: async () => { calls++; return successful(); } });
  const env = environment();
  await worker.fetch(request(), env);
  const second = new Request('https://linkx.workers.dev/api/public?kind=all&operation=tripList&limit=20&offset=0', { headers: { 'CF-Connecting-IP': '2001:db8::1' } });
  const response = await worker.fetch(second, env);
  assert.equal(response.status, 200);
  assert.equal(calls, 1);
  assert.equal(env.PUBLIC_API_RATE_LIMIT.calls.length, 2);
  assert.equal(env.UPSTREAM_RATE_LIMIT.calls.length, 1);
  assert.equal(cache.data.size, 1);
  assert.ok([...cache.data.keys()][0].startsWith('https://catx.eu.org/api/public?'));
});

test('visitor rate limit still applies to cached content', async () => {
  const cache = cacheStore();
  const worker = createWorker({ cache, fetch: async () => successful() });
  await worker.fetch(request(), environment());
  const response = await worker.fetch(request(), environment({ PUBLIC_API_RATE_LIMIT: rate(false) }));
  assert.equal(response.status, 429);
});

test('concurrent equivalent misses share one upstream request and independently readable responses', async () => {
  let complete;
  let calls = 0;
  const worker = createWorker({ fetch: async () => { calls++; return new Promise(resolve => { complete = resolve; }); } });
  const env = environment();
  const first = worker.fetch(request(), env);
  const second = worker.fetch(request('operation=tripList&kind=all&offset=0&limit=20'), env);
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(calls, 1);
  complete(successful());
  const responses = await Promise.all([first, second]);
  assert.deepEqual(await responses[0].json(), await responses[1].json());
  assert.equal(env.UPSTREAM_RATE_LIMIT.calls.length, 1);
});

test('response projection drops private fields and untrusted image URLs', () => {
  const parsed = parsePublicQuery(new URL('https://catx.eu.org/api/public?operation=tripList'));
  const result = publicDto({
    ok: true, _openid: 'leak', secret: SECRET,
    items: [{ ...baseItem, title: '<b>Public route</b>', _openid: 'private', driverPhone: '+1234567890', driver: { contact: 'private' },
      images: ['https://bucket.myqcloud.com/market/image.jpg', 'https://myqcloud.com.evil.example/image.jpg', 'javascript:alert(1)', 'https://user:password@bucket.myqcloud.com/image.jpg'] }],
    hasMore: false, nextOffset: 1,
  }, parsed);
  assert.equal(result.secret, undefined);
  assert.equal(result.items[0]._openid, undefined);
  assert.equal(result.items[0].driverPhone, undefined);
  assert.equal(result.items[0].driver, undefined);
  assert.equal(result.items[0].title, 'Public route');
  assert.deepEqual(result.items[0].images, ['https://bucket.myqcloud.com/market/image.jpg']);
});

test('details require matching kind/id, use a 60 second cache and preserve only public data', async () => {
  const worker = createWorker({ fetch: async () => new Response(JSON.stringify({ ok: true, item: baseItem, admin: SECRET }), { headers: { 'Content-Type': 'application/json' } }) });
  const response = await worker.fetch(request('operation=tripDetail&kind=carpool&id=trip_123'), environment());
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('Cache-Control'), 'public, max-age=60, s-maxage=60');
  assert.deepEqual(await response.json(), { ok: true, item: baseItem });
  const parsed = parsePublicQuery(new URL('https://catx.eu.org/api/public?operation=tripDetail&kind=carpool&id=other'));
  assert.throws(() => publicDto({ ok: true, item: baseItem }, parsed));
});

test('malformed DTOs and oversized responses fail closed without raw server error leakage', async () => {
  const responses = [
    () => new Response('private upstream stack and token', { status: 500 }),
    () => new Response('', { status: 302, headers: { Location: 'https://evil.example' } }),
    () => new Response('<html>admin login</html>', { headers: { 'Content-Type': 'text/html' } }),
    () => new Response('{bad json', { headers: { 'Content-Type': 'application/json' } }),
    () => successful([{ ...baseItem, kind: 'admin' }]),
    () => successful([{ ...baseItem, title: 'x'.repeat(301) }]),
    () => successful([{ ...baseItem, seats: -1 }]),
    () => successful([{ ...baseItem, full: 'false' }]),
    () => new Response(JSON.stringify({ ok: true, items: [baseItem], hasMore: true, nextOffset: 1000 }), { headers: { 'Content-Type': 'application/json' } }),
    () => new Response(JSON.stringify({ ok: true, items: [], hasMore: true, nextOffset: 0 }), { headers: { 'Content-Type': 'application/json' } }),
    () => new Response(JSON.stringify({ ok: false, error: `database credentials ${SECRET}` }), { headers: { 'Content-Type': 'application/json' } }),
    () => new Response(' '.repeat(205 * 1024), { headers: { 'Content-Type': 'application/json' } }),
    () => new Response('{}', { headers: { 'Content-Type': 'application/json', 'Content-Length': '999999999' } }),
  ];
  for (const build of responses) {
    const cache = cacheStore();
    const worker = createWorker({ cache, fetch: async () => build() });
    const response = await worker.fetch(request(), environment());
    assert.equal(response.status, 502);
    assert.deepEqual(await response.json(), { ok: false, error: 'content_unavailable' });
    assert.equal(cache.data.size, 0);
  }
});

test('a missing listing is a generic uncached 404', async () => {
  const cache = cacheStore();
  const worker = createWorker({ cache, fetch: async () => new Response(JSON.stringify({ ok: false, error: 'not_found' }), { headers: { 'Content-Type': 'application/json' } }) });
  const response = await worker.fetch(request('operation=tripDetail&kind=carpool&id=trip_123'), environment());
  assert.equal(response.status, 404);
  assert.deepEqual(await response.json(), { ok: false, error: 'not_found' });
  assert.equal(cache.data.size, 0);
});

test('upstream timeout aborts the request and returns a safe response', async () => {
  let aborted = false;
  const worker = createWorker({ timeoutMs: 5, fetch: (_url, options) => new Promise((_resolve, reject) => {
    options.signal.addEventListener('abort', () => { aborted = true; reject(new Error('private network trace')); });
  }) });
  const response = await worker.fetch(request(), environment());
  assert.equal(response.status, 502);
  assert.equal(aborted, true);
  assert.deepEqual(await response.json(), { ok: false, error: 'content_unavailable' });
});

test('static assets gain security headers and mutation requests cannot reach assets', async () => {
  let calls = 0;
  const env = environment({ ASSETS: { async fetch() {
    calls++;
    return new Response('landing page', { headers: { 'Content-Type': 'text/html', 'Set-Cookie': 'accidental=secret', 'Access-Control-Allow-Origin': '*' } });
  } } });
  const worker = createWorker();
  const response = await worker.fetch(new Request('https://catx.eu.org/rides'), env);
  assert.equal(response.status, 200);
  assert.equal(await response.text(), 'landing page');
  assert.match(response.headers.get('Content-Security-Policy'), /frame-ancestors 'none'/);
  assert.equal(response.headers.get('Set-Cookie'), null);
  assert.equal(response.headers.get('Access-Control-Allow-Origin'), null);
  assert.equal(response.headers.get('Referrer-Policy'), 'no-referrer');
  const rejected = await worker.fetch(new Request('https://catx.eu.org/rides', { method: 'POST' }), env);
  assert.equal(rejected.status, 405);
  assert.equal(calls, 1);
});
