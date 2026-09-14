export type Kind = 'carpool' | 'request' | 'goods' | 'sublet';
export type Section = 'rides' | 'market' | 'sublets';
export type Item = {
  id: string; kind: Kind; title: string; description: string; priceText: string;
  regionText: string; timeText: string; availabilityText: string; images: string[]; tags: string[];
  fromLabel?: string; toLabel?: string; dateKey?: string; departureAtMs?: number; seats?: number | null; full?: boolean;
};
export type PageResult = { items: Item[]; hasMore: boolean; nextOffset: number };
export type Route = { section: 'home' | Section; kind?: Kind; id?: string };
export const MINI_NAME = '极链行服务';
export const MINI_SHARE = '#小程序://极链行服务/VGD7QITnczTep0F';
export const PLACE_OPTIONS = ['Fort Lee', 'Columbia', 'Newark', 'JFK', 'LaGuardia', 'Flushing'];
export const KIND_LABELS: Record<Kind, string> = { carpool: 'Ride offered', request: 'Ride wanted', goods: 'Secondhand', sublet: 'Sublet' };
export function isRide(kind: string) { return kind === 'carpool' || kind === 'request'; }
export function itemHref(item: Pick<Item, 'kind' | 'id'>) {
  return `#/${isRide(item.kind) ? 'rides' : item.kind === 'sublet' ? 'sublets' : 'market'}/${item.kind}/${encodeURIComponent(item.id)}`;
}
export function parseRoute(hash: string): Route {
  const parts = hash.replace(/^#\/?/, '').split('/');
  const section = ['rides', 'market', 'sublets'].includes(parts[0]) ? parts[0] as Section : 'home';
  const kind = parts[1] as Kind;
  const validKind = section === 'rides' ? ['carpool', 'request'].includes(kind) : section === 'market' ? kind === 'goods' : section === 'sublets' && kind === 'sublet';
  let id = '';
  try { id = decodeURIComponent(parts[2] || ''); } catch { /* Invalid routes safely fall back to the list. */ }
  return validKind && /^[a-z\d_-]{1,128}$/i.test(id) ? { section, kind, id } : { section };
}
export function safeImageURL(value: unknown): string {
  if (typeof value !== 'string' || value.length > 4096) return '';
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password || (url.port && url.port !== '443')) return '';
    return ['tcb.qcloud.la', 'tcloudbaseapp.com', 'myqcloud.com', 'tencentcos.cn', 'qcloud.com'].some(host => url.hostname === host || url.hostname.endsWith(`.${host}`)) ? url.href : '';
  } catch { return ''; }
}
function publicText(value: unknown, limit: number) { return typeof value === 'string' ? value.slice(0, limit) : ''; }
export function readItem(value: unknown): Item | null {
  if (!value || typeof value !== 'object') return null;
  const row = value as Record<string, unknown>;
  if (typeof row.id !== 'string' || !/^[a-z\d_-]{1,128}$/i.test(row.id) || !['carpool', 'request', 'goods', 'sublet'].includes(String(row.kind))) return null;
  return {
    id: row.id, kind: row.kind as Kind, title: publicText(row.title, 160), description: publicText(row.description, 2000),
    priceText: publicText(row.priceText, 80), regionText: publicText(row.regionText, 160), timeText: publicText(row.timeText, 100),
    availabilityText: publicText(row.availabilityText, 80),
    images: (Array.isArray(row.images) ? row.images : []).map(safeImageURL).filter(Boolean).slice(0, 4),
    tags: (Array.isArray(row.tags) ? row.tags : []).map(value => publicText(value, 40)).filter(Boolean).slice(0, 4),
    fromLabel: publicText(row.fromLabel, 80), toLabel: publicText(row.toLabel, 80), dateKey: publicText(row.dateKey, 10),
    departureAtMs: typeof row.departureAtMs === 'number' && Number.isFinite(row.departureAtMs) ? row.departureAtMs : undefined,
    seats: typeof row.seats === 'number' && row.seats >= 0 && row.seats <= 99 ? row.seats : null, full: row.full === true,
  };
}
export function readPage(value: unknown): PageResult {
  if (!value || typeof value !== 'object') throw new Error('invalid_response');
  const data = value as Record<string, unknown>;
  if (data.ok !== true || !Array.isArray(data.items)) throw new Error('unavailable');
  const items = data.items.slice(0, 20).map(readItem).filter((item): item is Item => !!item);
  const nextOffset = Number(data.nextOffset);
  return { items, hasMore: data.hasMore === true && Number.isInteger(nextOffset) && nextOffset > 0 && nextOffset < 100, nextOffset: Number.isInteger(nextOffset) && nextOffset >= 0 && nextOffset <= 100 ? nextOffset : 0 };
}
export function formatTripTime(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})$/.exec(value);
  if (!match) return { date: value || 'Time to confirm', time: '' };
  const date = new Date(Date.UTC(+match[1], +match[2] - 1, +match[3]));
  const hour = +match[4];
  return { date: new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', weekday: 'short', timeZone: 'UTC' }).format(date), time: `${hour % 12 || 12}:${match[5]} ${hour >= 12 ? 'PM' : 'AM'}` };
}
export type Filters = { from: string; to: string; date: string; query: string; hideFull: boolean };
const placeAliases: Record<string, RegExp> = {
  'fort lee': /fort\s?lee/i, columbia: /columbia|哥大/i, newark: /newark|纽瓦克/i,
  jfk: /jfk/i, laguardia: /laguardia|la guardia|lga|拉瓜迪亚/i, flushing: /flushing|法拉盛/i,
};
function matchesPlace(text: string, requested: string) { return !requested || (placeAliases[requested.toLowerCase()] || new RegExp(requested.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')).test(text); }
export function filterItems(items: Item[], filters: Filters) {
  return items.filter(item => {
    const [routeFrom = '', routeTo = ''] = item.regionText.split(/→|\s+to\s+/);
    const from = item.fromLabel || routeFrom;
    const to = item.toLabel || routeTo;
    return matchesPlace(from, filters.from) && matchesPlace(to, filters.to)
      && (!filters.date || item.timeText.startsWith(filters.date))
      && (!filters.hideFull || !isRide(item.kind) || item.kind === 'request' || (!item.full && !/\bfull\b|已满|^0\s*(?:seats?|座)/i.test(item.availabilityText)))
      && (!filters.query || [item.title, item.description, item.regionText, ...item.tags].join(' ').toLocaleLowerCase().includes(filters.query.trim().toLocaleLowerCase()));
  });
}
