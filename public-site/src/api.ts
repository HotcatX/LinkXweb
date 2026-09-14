import { readItem, readPage, type Item, type Kind, type PageResult } from './model';
const cache = new Map<string, { until: number; promise: Promise<unknown> }>();
const CACHE_MS = 60_000;
export function clearPublicCache() { cache.clear(); }
async function getPublic(params: Record<string, string | number>) {
  const url = `/api/public?${new URLSearchParams(Object.entries(params).map(([key, value]) => [key, String(value)]))}`;
  const hit = cache.get(url);
  if (hit && hit.until > Date.now()) return hit.promise;
  const promise = (async () => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);
    try {
      const response = await fetch(url, { method: 'GET', credentials: 'omit', headers: { Accept: 'application/json' }, signal: controller.signal });
      if (!response.ok) throw new Error(response.status === 404 ? 'not_found' : response.status === 429 ? 'rate_limited' : 'unavailable');
      if (!(response.headers.get('content-type') || '').includes('application/json')) throw new Error('invalid_response');
      const result = await response.json();
      if (!result || result.ok !== true) throw new Error(result?.error === 'not_found' ? 'not_found' : 'unavailable');
      return result;
    } finally { clearTimeout(timeout); }
  })();
  cache.set(url, { until: Date.now() + CACHE_MS, promise });
  if (cache.size > 30) cache.delete(cache.keys().next().value!);
  promise.catch(() => { if (cache.get(url)?.promise === promise) cache.delete(url); });
  return promise;
}
export async function getListings(kind: Kind | 'all', market: boolean, offset = 0): Promise<PageResult> {
  return readPage(await getPublic({ operation: market ? 'marketList' : 'tripList', kind, limit: 20, offset }));
}
export async function getListing(kind: Kind, id: string): Promise<Item> {
  const data = await getPublic({ operation: kind === 'goods' || kind === 'sublet' ? 'marketDetail' : 'tripDetail', kind, id }) as Record<string, unknown>;
  const item = readItem(data.item);
  if (!item || item.id !== id || item.kind !== kind) throw new Error('not_found');
  return item;
}
