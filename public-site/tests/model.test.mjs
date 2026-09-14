import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { filterItems, formatTripTime, itemHref, parseRoute, readItem, readPage, safeImageURL } from '../src/model.ts';

const ride = { id: 'trip_1', kind: 'carpool', title: 'Community ride', description: 'A seat.', priceText: '$10/person', regionText: 'Fort Lee → Columbia University', timeText: '2026-09-14 08:30', availabilityText: '2 seats available', images: [], tags: [], fromLabel: 'Fort Lee', toLabel: 'Columbia University', dateKey: '2026-09-14', seats: 2, full: false };
const blank = { from: '', to: '', date: '', query: '', hideFull: false };
test('public model projects known fields and drops identity/session data', () => {
  const result = readItem({ ...ride, _openid: 'private', phone: 'private', sessionToken: 'private' });
  assert.equal(result.fromLabel, 'Fort Lee');
  assert.equal(result.full, false);
  assert.equal('_openid' in result, false);
  assert.equal('phone' in result, false);
  assert.equal('sessionToken' in result, false);
  assert.equal(readItem({ ...ride, id: '<script>' }), null);
  assert.equal(readItem({ ...ride, kind: 'admin' }), null);
});
test('images reject scripts, non-https, credentials and deceptive hosts', () => {
  for (const value of ['javascript:alert(1)', 'data:image/svg+xml,bad', 'http://bucket.myqcloud.com/a.jpg', 'https://bucket.myqcloud.com.evil.test/a.jpg', 'https://name:password@bucket.myqcloud.com/a.jpg', 'https://evil.test/a.jpg']) assert.equal(safeImageURL(value), '');
  assert.equal(safeImageURL('https://bucket.myqcloud.com/image.jpg'), 'https://bucket.myqcloud.com/image.jpg');
  assert.deepEqual(readItem({ ...ride, images: ['javascript:alert(1)', 'https://bucket.myqcloud.com/image.jpg'] }).images, ['https://bucket.myqcloud.com/image.jpg']);
});
test('navigation keeps section and detail kind consistent, rejecting malformed identifiers', () => {
  assert.equal(itemHref(ride), '#/rides/carpool/trip_1');
  assert.deepEqual(parseRoute('#/rides/carpool/trip_1'), { section: 'rides', kind: 'carpool', id: 'trip_1' });
  assert.deepEqual(parseRoute('#/market/carpool/trip_1'), { section: 'market' });
  assert.deepEqual(parseRoute('#/rides/carpool/%2Fadmin'), { section: 'rides' });
  assert.deepEqual(parseRoute('#/rides/carpool/%ZZ'), { section: 'rides' });
});
test('filters use projected public places and distinguish a full car from ride requests', () => {
  const full = { ...ride, id: 'full', full: true, seats: 0, availabilityText: 'Full' };
  const wanted = { ...ride, id: 'wanted', kind: 'request', full: true, availabilityText: '3 seats requested' };
  assert.deepEqual(filterItems([ride], { ...blank, from: 'Fort Lee', to: 'Columbia', date: '2026-09-14' }), [ride]);
  assert.deepEqual(filterItems([ride], { ...blank, to: 'Flushing' }), []);
  assert.deepEqual(filterItems([ride, full, wanted], { ...blank, hideFull: true }).map(row => row.id), ['trip_1', 'wanted']);
  assert.equal(filterItems([{ ...ride, kind: 'goods', title: '<b>Desk</b>' }], { ...blank, query: 'DESK' }).length, 1);
});
test('date formatting preserves New York wall time without device timezone conversion', () => {
  assert.deepEqual(formatTripTime('2026-09-14 08:30'), { date: 'Mon, Sep 14', time: '8:30 AM' });
  assert.equal(formatTripTime('2026-09-14 00:05').time, '12:05 AM');
  assert.equal(formatTripTime('2026-09-14 12:05').time, '12:05 PM');
});
test('list envelopes bound pagination and fail closed on unavailable responses', () => {
  assert.throws(() => readPage({ ok: false, items: [] }));
  assert.throws(() => readPage({ ok: true, items: {} }));
  assert.equal(readPage({ ok: true, items: [ride], hasMore: true, nextOffset: 20 }).hasMore, true);
  assert.equal(readPage({ ok: true, items: [ride], hasMore: true, nextOffset: 100 }).hasMore, false);
  assert.equal(readPage({ ok: true, items: [ride], hasMore: true, nextOffset: 'NaN' }).hasMore, false);
});
test('public frontend contains no write transport, HTML injection or admin import', async () => {
  const api = await readFile(new URL('../src/api.ts', import.meta.url), 'utf8');
  const ui = await readFile(new URL('../src/main.tsx', import.meta.url), 'utf8');
  assert.match(api, /method: 'GET'/);
  assert.match(api, /credentials: 'omit'/);
  assert.doesNotMatch(api, /method:\s*['"](?:POST|PUT|DELETE|PATCH)['"]/);
  assert.doesNotMatch(ui, /dangerouslySetInnerHTML|admin-api|admin\/src|cloud\.callFunction/);
});
