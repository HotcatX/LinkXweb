/* eslint-disable @next/next/no-img-element -- This is a Vite static site with bounded, lazy-loaded public images, not a Next.js runtime. */
import React, { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { clearPublicCache, getListing, getListings } from './api';
import { filterItems, formatTripTime, isRide, itemHref, KIND_LABELS, MINI_NAME, MINI_SHARE, parseRoute, PLACE_OPTIONS, type Filters, type Item, type Kind, type Route, type Section } from './model';
import './styles.css';

function Icon({ name, size = 22 }: { name: string; size?: number }) {
  const paths: Record<string, ReactNode> = {
    arrow: <path d="M4 12h15m-6-6 6 6-6 6" />,
    search: <><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 4 4" /></>,
    pin: <><path d="M19 10c0 5-7 10-7 10S5 15 5 10a7 7 0 0 1 14 0Z" /><circle cx="12" cy="10" r="2.5" /></>,
    car: <><path d="m5 8 2-5h10l2 5M4 17h16V9H4v8Zm2 0v3m12-3v3M7 12h1m8 0h1" /><path d="M2 8h20" /></>,
    bag: <><path d="M4 7h16l-1 14H5L4 7Z" /><path d="M8 8V6a4 4 0 0 1 8 0v2" /></>,
    house: <><path d="m3 10 9-7 9 7v11H3V10Z" /><path d="M9 21v-8h6v8" /></>,
    moon: <path d="M20 14A9 9 0 0 1 10 3a9 9 0 1 0 10 11Z" />,
    sun: <><circle cx="12" cy="12" r="4" /><path d="M12 1v2m0 18v2M1 12h2m18 0h2M4 4l2 2m12 12 2 2M4 20l2-2M18 6l2-2" /></>,
    swap: <><path d="M3 7h17m-4-4 4 4-4 4M21 17H4m4-4-4 4 4 4" /></>,
    close: <path d="m5 5 14 14M5 19 19 5" />,
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
    people: <><circle cx="9" cy="7" r="3" /><path d="M3 21v-3a6 6 0 0 1 12 0v3M17 4a3 3 0 0 1 0 6m2 4a5 5 0 0 1 2 4v3" /></>,
    chat: <><path d="M21 11a9 9 0 0 1-9 9H3l2-5a9 9 0 1 1 16-4Z" /><path d="M8 10h8m-8 4h5" /></>,
    check: <path d="m5 12 4 4L19 6" />,
    refresh: <><path d="M20 5v6h-6M4 19v-6h6" /><path d="M5.5 8a7 7 0 0 1 12-3L20 8M4 16l2.5 3a7 7 0 0 0 12-3" /></>,
    plus: <path d="M12 4v16M4 12h16" />,
    copy: <><rect x="8" y="8" width="12" height="13" rx="2" /><path d="M15 8V3H3v13h5" /></>,
    leaf: <><path d="M20 3C8 2 3 7 4 14c1 6 10 8 13 1 2-4 3-12 3-12Z" /><path d="m3 21 12-12" /></>,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name] || paths.arrow}</svg>;
}
function Brand() {
  return <span className="brand"><svg viewBox="0 0 40 40" width="37" height="37" aria-hidden="true"><path d="m7 7 13 13L33 7M7 33l13-13 13 13" stroke="currentColor" strokeWidth="7" fill="none" strokeLinecap="round" /><path d="m17 10 7 7" stroke="var(--brand-cut)" strokeWidth="10" /><path d="m16 9 8 8" stroke="currentColor" strokeWidth="7" strokeLinecap="round" /></svg><span>Link<span className="brand-x">X</span></span></span>;
}
function useRoute() {
  const [route, setRoute] = useState(() => parseRoute(location.hash));
  useEffect(() => {
    const change = () => { setRoute(parseRoute(location.hash)); window.scrollTo({ top: 0 }); };
    addEventListener('hashchange', change); return () => removeEventListener('hashchange', change);
  }, []);
  return route;
}
function useListings(kind: Kind | 'all', market: boolean) {
  const [version, setVersion] = useState(0);
  const key = `${kind}:${market}:${version}`;
  const [state, setState] = useState({ key: '', items: [] as Item[], loading: false, error: '', more: false, offset: 0 });
  const current = state.key === key ? state : { key, items: [] as Item[], loading: true, error: '', more: false, offset: 0 };
  const activeKey = useRef(key);
  const busy = useRef(false);
  useEffect(() => {
    let active = true;
    activeKey.current = key;
    busy.current = true;
    getListings(kind, market).then(result => {
      if (active) setState({ key, items: result.items, loading: false, error: '', more: result.hasMore, offset: result.nextOffset });
    }).catch(error => {
      if (active) setState({ key, items: [], loading: false, error: error.message, more: false, offset: 0 });
    }).finally(() => { if (active) busy.current = false; });
    return () => { active = false; };
  }, [kind, market, key]);
  const loadMore = async () => {
    if (busy.current || !current.more) return;
    busy.current = true;
    setState(previous => ({ ...previous, loading: true, error: '' }));
    try {
      const result = await getListings(kind, market, current.offset);
      if (activeKey.current !== key) return;
      setState(previous => ({ key, loading: false, error: '',
        items: [...new Map([...previous.items, ...result.items].map(item => [`${item.kind}/${item.id}`, item])).values()],
        more: result.hasMore && result.nextOffset > current.offset, offset: result.nextOffset,
      }));
    } catch (error) { if (activeKey.current === key) setState(previous => ({ ...previous, loading: false, error: (error as Error).message })); }
    finally { if (activeKey.current === key) busy.current = false; }
  };
  return { ...current, loadMore, reload: () => { clearPublicCache(); setVersion(v => v + 1); } };
}
function Header({ route, open }: { route: Route; open: () => void }) {
  const [theme, setTheme] = useState(() => document.documentElement.dataset.theme || 'light');
  const toggle = () => {
    const next = theme === 'dark' ? 'light' : 'dark'; setTheme(next); document.documentElement.dataset.theme = next;
    try { localStorage.setItem('linkx-public-theme', next); } catch { /* Theme still works without storage. */ }
  };
  return <header className="site-header"><div className="wrap header-inner">
    <a href="#/" className="home-link" aria-label="LinkX home"><Brand /></a>
    <nav aria-label="Main navigation">
      {([['rides', 'Rides'], ['market', 'Secondhand'], ['sublets', 'Sublets']] as const).map(([section, label]) => <a key={section} href={`#/${section}`} className={route.section === section ? 'active' : ''} aria-current={route.section === section ? 'page' : undefined}>{label}</a>)}
    </nav>
    <div className="header-actions"><button className="icon-button theme-toggle" onClick={toggle} aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}><Icon name={theme === 'light' ? 'moon' : 'sun'} size={20} /></button><button className="button small header-wechat" onClick={open}>Continue in WeChat <Icon name="arrow" size={17} /></button></div>
  </div></header>;
}
const EMPTY_FILTERS: Filters = { from: '', to: '', date: '', query: '', hideFull: false };
function RouteSearch({ filters, onChange, onSearch, compact = false }: { filters: Filters; onChange: (value: Filters) => void; onSearch?: () => void; compact?: boolean }) {
  const submit = (event: FormEvent) => { event.preventDefault(); onSearch?.(); };
  const place = (key: 'from' | 'to', label: string) => <label className="route-field"><Icon name="pin" size={21} /><span><span className="field-label">{label}</span><select aria-label={label} value={filters[key]} onChange={event => onChange({ ...filters, [key]: event.target.value })}><option value="">Anywhere</option>{PLACE_OPTIONS.map(value => <option key={value}>{value}</option>)}</select></span></label>;
  return <form className={`route-search ${compact ? 'compact-search' : ''}`} onSubmit={submit}>
    {place('from', 'Leaving from')}<button type="button" className="icon-button swap-button" aria-label="Swap departure and destination" onClick={() => onChange({ ...filters, from: filters.to, to: filters.from })}><Icon name="swap" size={19} /></button>{place('to', 'Going to')}
    <label className="route-field date-field"><Icon name="clock" size={21} /><span><span className="field-label">Departure date</span><input type="date" aria-label="Departure date" value={filters.date} onChange={event => onChange({ ...filters, date: event.target.value })} /></span></label>
    {onSearch && <button className="button search-submit" type="submit"><Icon name="search" size={20} />Find a ride</button>}
  </form>;
}
function RideCard({ item }: { item: Item }) {
  const time = formatTripTime(item.timeText);
  const [fallbackFrom, fallbackTo] = item.regionText.split(/→|\s+to\s+/);
  const from = item.fromLabel || fallbackFrom;
  const to = item.toLabel || fallbackTo;
  const full = item.full || /\bfull\b/i.test(item.availabilityText);
  return <a className={`ride-card ${item.kind === 'request' ? 'request-card' : ''}`} href={itemHref(item)} aria-label={`${KIND_LABELS[item.kind]}: ${item.regionText}, ${item.timeText}, ${item.priceText}`}>
    <div className="ride-card-top"><span className={`kind-pill ${item.kind}`}><span />{KIND_LABELS[item.kind]}</span><span className="card-date">{time.date}</span></div>
    <div className="ride-route"><span className="route-node" /><div><span className="trip-time">{time.time || 'Departure'}</span><h3>{from || item.title}</h3></div><span className="route-track" /><div className="ride-to"><span className="route-node end" /><h3>{to || 'See route details'}</h3></div></div>
    <div className="ride-card-bottom"><span className={`availability ${full ? 'full' : ''}`}><Icon name="people" size={17} />{item.availabilityText || 'Check availability'}</span><span className="price">{item.priceText || 'Price to confirm'}{item.priceText.startsWith('$') && !/\/(?:person|seat)|per person/i.test(item.priceText) && <small> / person</small>}</span><Icon name="arrow" size={19} /></div>
  </a>;
}
function ListingImage({ item, index = 0, className = '' }: { item: Item; index?: number; className?: string }) {
  const [failed, setFailed] = useState('');
  const src = item.images[index];
  return src && src !== failed ? <img className={className} src={src} alt={item.title || KIND_LABELS[item.kind]} loading="lazy" referrerPolicy="no-referrer" onError={() => setFailed(src)} /> : <div className={`image-placeholder ${className}`}><Icon name={item.kind === 'sublet' ? 'house' : 'bag'} size={40} /><span>No photo available</span></div>;
}
function MarketCard({ item }: { item: Item }) {
  return <a href={itemHref(item)} className="market-card"><div className="market-image"><ListingImage item={item} /><span className="image-category">{KIND_LABELS[item.kind]}</span></div><div className="market-card-copy"><div className="market-title-row"><h3>{item.title || 'Untitled listing'}</h3><Icon name="arrow" size={19} /></div><p className="market-location"><Icon name="pin" size={15} />{item.regionText || 'Area to confirm'}</p><div className="market-card-bottom"><span className="price">{item.priceText || 'Price to confirm'}</span>{item.tags[0] && <span className="item-tag">{item.tags[0]}</span>}</div></div></a>;
}
function LoadingCards({ market = false }: { market?: boolean }) { return <div className={market ? 'market-grid' : 'rides-grid'} aria-label="Loading listings" role="status">{Array.from({ length: market ? 4 : 3 }, (_, i) => <div className={`skeleton-card ${market ? 'skeleton-market' : ''}`} key={i}><span /><span /><span /></div>)}<span className="sr-only">Loading current listings…</span></div>; }
function Empty({ error = '', onRetry, hasFilters = false, more = false, onMore }: { error?: string; onRetry?: () => void; hasFilters?: boolean; more?: boolean; onMore?: () => void }) {
  return <div className="empty-state"><span className="empty-icon"><Icon name={error ? 'refresh' : 'search'} size={28} /></span><h3>{error ? 'A little pause in the journey.' : hasFilters ? 'No matches in these previews.' : 'Nothing listed here right now.'}</h3><p>{error === 'rate_limited' ? 'There have been a few too many requests. Please wait a moment, then try again.' : error ? 'We couldn’t load current listings. Please try again in a moment.' : hasFilters ? 'Try another direction or date, clear your filters, or load more previews.' : 'Check back soon for new community listings.'}</p>{error && onRetry && <button className="button secondary" onClick={onRetry}><Icon name="refresh" size={17} />Try again</button>}{!error && more && onMore && <button className="button secondary" onClick={onMore}>Load more previews <Icon name="arrow" size={17} /></button>}</div>;
}
function Home({ open, startSearch }: { open: (intent?: string) => void; startSearch: (filters: Filters) => void }) {
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const listing = useListings('carpool', false);
  return <>
    <section className="hero" aria-labelledby="hero-title"><img src="/carpool-hero.png" alt="Illustration of friends meeting beside the river for a shared ride" width="1967" height="800" fetchPriority="high" /><div className="hero-overlay" /><div className="wrap hero-copy"><p className="eyebrow"><span className="status-dot" />NEW YORK & NEW JERSEY</p><h1 id="hero-title">Going your way.<br /><span>Better together.</span></h1><p>From your everyday commute to somewhere new.<br className="desktop-break" /> Find your people. Share the ride.</p></div></section>
    <div className="wrap hero-search"><RouteSearch filters={filters} onChange={setFilters} onSearch={() => startSearch(filters)} /><p className="search-caption">Browse here. Connect and confirm your plans in WeChat.</p></div>
    <section className="wrap section current-rides" aria-labelledby="rides-heading"><div className="section-heading"><div><p className="eyebrow">A SEAT FOR YOUR NEXT CHAPTER</p><h2 id="rides-heading">Where are we heading?</h2></div><a className="text-link" href="#/rides">Explore rides <Icon name="arrow" size={19} /></a></div>
      {listing.loading ? <LoadingCards /> : listing.error ? <Empty error={listing.error} onRetry={listing.reload} /> : listing.items.length ? <div className="rides-grid">{listing.items.slice(0, 6).map(item => <RideCard item={item} key={`${item.kind}/${item.id}`} />)}</div> : <Empty />}
      <p className="listing-note">Current community previews · Times shown in New York time · Availability is confirmed in the mini program.</p>
    </section>
    <section className="wrap section benefit-section"><div className="benefit-grid">{[{ icon: 'search', title: 'A route that fits your day.', text: 'Browse real rides and compare the departure time, direction and listed price.' }, { icon: 'people', title: 'Good company. Shared costs.', text: 'Make room for someone going your way, and agree on the details together.' }, { icon: 'chat', title: 'Meet in a familiar place.', text: 'Continue in our WeChat mini program to register and connect with the community.' }].map(item => <article key={item.title}><span className="benefit-icon"><Icon name={item.icon} size={27} /></span><h3>{item.title}</h3><p>{item.text}</p></article>)}</div></section>
    <section className="life-section"><div className="wrap section"><div className="section-heading"><div><p className="eyebrow">SAME COMMUNITY, MORE POSSIBILITIES</p><h2>A little more than a ride.</h2></div><p>Good finds. New beginnings.<br />All a little closer to home.</p></div><div className="service-grid"><a className="service-card secondhand-service" href="#/market"><div><span className="service-eyebrow"><Icon name="bag" size={18} /> SECONDHAND</span><h3>Someone’s next<br />favorite thing.</h3><p>Give good things another chapter.</p><span className="text-link">Browse the market <Icon name="arrow" size={19} /></span></div><div className="service-art market-art" aria-hidden="true"><div className="lamp"><span /></div><div className="books"><span /><span /><span /></div><div className="plant"><i /><i /><i /><span /></div></div></a><a className="service-card sublet-service" href="#/sublets"><div><span className="service-eyebrow"><Icon name="house" size={18} /> SUBLETS</span><h3>Your next place.<br />A familiar community.</h3><p>Explore places for your next stay.</p><span className="text-link">Find a sublet <Icon name="arrow" size={19} /></span></div><div className="service-art home-art" aria-hidden="true"><div className="window-art"><i /><i /></div><div className="sofa"><i /></div></div></a></div></div></section>
    <section className="wrap section drive-section"><div className="drive-copy"><p className="eyebrow">HAVE A SPARE SEAT?</p><h2>You’re going anyway.<br />Take someone along.</h2><p>Share your route, choose your departure time, and meet someone headed in the same direction.</p><button className="button" onClick={() => open('offer a ride')}>Offer a ride in WeChat <Icon name="plus" size={19} /></button></div><div className="drive-photo"><img src="/bridge.jpg" alt="The George Washington Bridge connecting New Jersey and New York" loading="lazy" width="800" height="533" /><span>Across the river. Closer together.</span></div></section>
    <section className="how-section"><div className="wrap section how-layout"><div><p className="eyebrow">LINKX × WECHAT</p><h2>Browse here.<br />Make it happen there.</h2><p>When you find the right ride or listing, continue in our WeChat mini program.</p><button className="button" onClick={() => open()}>Get started <Icon name="arrow" size={18} /></button></div><ol className="steps"><li><span>01</span><div><h3>Find something that fits.</h3><p>Explore current rides, secondhand finds and sublets right here.</p></div></li><li><span>02</span><div><h3>Open 极链行服务 in WeChat.</h3><p>Search for the mini program or copy our share link into a chat.</p></div></li><li><span>03</span><div><h3>Register, connect, and confirm.</h3><p>Join a ride or contact a seller after signing in. Keep all arrangements in the mini program.</p></div></li></ol></div></section>
    <section className="wrap section faq-section"><h2>A few good things to know.</h2><div className="faq-list">{[
      ['Can I book or buy on this website?', 'You can browse current public previews here. To join a ride, arrange a purchase, contact someone or publish a listing, open 极链行服务 in WeChat and register or sign in.'],
      ['Are the prices and seats final?', 'The website shows the listed price and a recent availability preview. Listings can change, so confirm the current price, available seats and meeting details in the mini program before making plans.'],
      ['Why are some details not visible?', 'Public previews include the basics you need to explore. Personal contact information, exact meeting points and other private details are kept in the mini program. Member-written listing descriptions may be in their original language.'],
    ].map(([question, answer]) => <details key={question}><summary>{question}<Icon name="plus" size={20} /></summary><p>{answer}</p></details>)}</div></section>
  </>;
}
function Browse({ section, initialFilters, open }: { section: Section; initialFilters: Filters; open: (intent?: string) => void }) {
  const market = section !== 'rides';
  const [kind, setKind] = useState<Kind | 'all'>(section === 'rides' ? 'all' : section === 'market' ? 'goods' : 'sublet');
  const [filters, setFilters] = useState(initialFilters);
  const listing = useListings(kind, market);
  const items = filterItems(listing.items, filters);
  const filtered = Object.entries(filters).some(([, value]) => Boolean(value));
  const titles = { rides: ['FIND YOUR NEXT RIDE', 'A shared ride. A better day.', 'See who’s heading your way.'], market: ['GOOD THINGS, ANOTHER CHAPTER', 'Find your next favorite.', 'Secondhand finds from people in your community.'], sublets: ['A PLACE FOR YOUR NEXT CHAPTER', 'Make yourself at home.', 'Explore current sublets around the community.'] }[section];
  return <div className="browse-page"><section className="browse-intro"><div className="wrap"><a href="#/" className="back-link">← Home</a><p className="eyebrow">{titles[0]}</p><h1>{titles[1]}</h1><p>{titles[2]}</p></div></section><div className="wrap browse-content">
    {!market ? <><div className="browse-filter-box"><RouteSearch filters={filters} onChange={setFilters} compact /><div className="filter-bottom"><div className="segmented" aria-label="Ride type">{([['all', 'All rides'], ['carpool', 'Seats offered'], ['request', 'Ride requests']] as const).map(([value, text]) => <button key={value} aria-pressed={kind === value} className={kind === value ? 'active' : ''} onClick={() => setKind(value)}>{value !== 'all' && <span className={`type-dot ${value}`} />}{text}</button>)}</div><label className="checkbox-label"><input type="checkbox" checked={filters.hideFull} onChange={event => setFilters({ ...filters, hideFull: event.target.checked })} />Hide full rides</label></div></div></> : <div className="market-search"><label><Icon name="search" size={21} /><input type="search" aria-label="Search loaded listing previews" placeholder={section === 'sublets' ? 'Search these sublets…' : 'Search these finds…'} value={filters.query} onChange={event => setFilters({ ...filters, query: event.target.value })} /></label><button className="button secondary" onClick={() => open(section === 'sublets' ? 'list a sublet' : 'sell an item')}><Icon name="plus" size={18} />{section === 'sublets' ? 'List your place' : 'Sell an item'}</button></div>}
    <div className="results-heading"><div><h2>{listing.loading && !listing.items.length ? 'Finding current listings…' : `${items.length} ${market ? 'listing' : 'ride'}${items.length === 1 ? '' : 's'} to explore`}</h2><p>{filtered ? `Filters apply to the ${listing.items.length} loaded previews.` : `${listing.items.length} public previews loaded.`}{!market && ' All times are New York time.'}</p></div><div className="result-actions">{filtered && <button className="text-link" onClick={() => setFilters(EMPTY_FILTERS)}>Clear filters</button>}<button className="icon-button refresh-button" aria-label="Refresh current listings" disabled={listing.loading} onClick={listing.reload}><Icon name="refresh" size={19} /></button></div></div>
    {listing.loading && !listing.items.length ? <LoadingCards market={market} /> : items.length ? <div className={market ? 'market-grid' : 'rides-grid'}>{items.map(item => market ? <MarketCard item={item} key={`${item.kind}/${item.id}`} /> : <RideCard item={item} key={`${item.kind}/${item.id}`} />)}</div> : <Empty error={listing.error} onRetry={listing.reload} hasFilters={filtered} more={listing.more} onMore={listing.loadMore} />}
    {listing.error && items.length > 0 && <div className="inline-error" role="alert">More previews couldn’t be loaded. <button onClick={listing.loadMore}>Try again</button></div>}
    {listing.more && items.length > 0 && <div className="load-more"><button className="button secondary" disabled={listing.loading} onClick={listing.loadMore}>{listing.loading ? 'Loading…' : 'Load more previews'}<Icon name="arrow" size={18} /></button><p>{filtered ? 'More loaded previews may match your filters.' : 'Keep exploring the community.'}</p></div>}
    {!listing.loading && !listing.error && !listing.more && listing.items.length > 0 && <p className="end-note">You’re up to date with the available public previews.</p>}
    <div className="browse-wechat"><span className="browse-wechat-icon"><Icon name="chat" size={27} /></span><div><h3>Found something you like?</h3><p>Register in our WeChat mini program to connect and confirm.</p></div><button className="button" onClick={() => open()}>Continue in WeChat <Icon name="arrow" size={18} /></button></div>
  </div></div>;
}
function Detail({ route, open }: { route: Route; open: (intent?: string, item?: Item) => void }) {
  const [item, setItem] = useState<Item | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [version, setVersion] = useState(0);
  const [imageIndex, setImageIndex] = useState(0);
  useEffect(() => {
    let active = true;
    getListing(route.kind!, route.id!).then(item => { if (active) setItem(item); }).catch(error => { if (active) setError(error.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [route.kind, route.id, version]);
  const retry = () => { clearPublicCache(); setLoading(true); setItem(null); setError(''); setImageIndex(0); setVersion(v => v + 1); };
  const ride = !!item && isRide(item.kind);
  const time = item ? formatTripTime(item.timeText) : { date: '', time: '' };
  const action = item?.kind === 'carpool' ? 'Join this ride' : item?.kind === 'request' ? 'Offer a ride' : item?.kind === 'sublet' ? 'Ask about this place' : 'Arrange a purchase';
  return <section className="wrap section detail-page"><a className="back-link" href={`#/${route.section}`}>← Back to {route.section === 'market' ? 'secondhand' : route.section}</a>
    {loading ? <LoadingCards market={route.section !== 'rides'} /> : error === 'not_found' ? <div className="empty-state"><span className="empty-icon"><Icon name="search" size={28} /></span><h1>This listing is no longer available.</h1><p>It may have been filled, sold, removed, or completed. There’s more to explore.</p><a className="button" href={`#/${route.section}`}>Browse current listings <Icon name="arrow" size={18} /></a></div> : error || !item ? <Empty error={error || 'unavailable'} onRetry={retry} /> : <>
      <div className={`detail-layout ${ride ? 'ride-detail-layout' : ''}`}><div className="detail-main">
        {!ride && <div className="gallery"><div className="gallery-main"><ListingImage item={item} index={imageIndex} /></div>{item.images.length > 1 && <div className="gallery-thumbs">{item.images.map((url, index) => <button key={url} aria-label={`View photo ${index + 1}`} aria-pressed={imageIndex === index} className={imageIndex === index ? 'active' : ''} onClick={() => setImageIndex(index)}><img src={url} alt={`Photo ${index + 1}`} referrerPolicy="no-referrer" /></button>)}</div>}</div>}
        <div className="detail-title"><span className={`kind-pill ${item.kind}`}><span />{KIND_LABELS[item.kind]}</span><h1>{ride ? item.regionText || item.title : item.title}</h1><p><Icon name={ride ? 'clock' : 'pin'} size={18} />{ride ? `${time.date}${time.time ? ` · ${time.time}` : ''} · New York time` : item.regionText}</p></div>
        {ride && <div className="detail-journey"><div><span className="journey-dot" /><p>Leaving from<strong>{item.fromLabel || item.regionText.split('→')[0] || 'Area to confirm'}</strong></p></div><div><span className="journey-dot end" /><p>Going to<strong>{item.toLabel || item.regionText.split('→')[1] || 'Area to confirm'}</strong></p></div><p className="privacy-note">Exact meeting points are shared in the mini program.</p></div>}
        <section className="detail-description"><h2>{ride ? 'About this ride' : 'About this listing'}</h2><p className="ugc-text">{item.description || 'No additional description has been provided.'}</p>{item.tags.length > 0 && <div className="tags">{item.tags.map((tag, index) => <span key={`${tag}/${index}`}>{tag}</span>)}</div>}{!ride && <p className="original-note">Member-written content is shown in its original language.</p>}</section>
        {!ride && item.timeText && <section className="detail-description"><h2>{item.kind === 'sublet' ? 'Available dates' : 'Pickup window'}</h2><p>{item.timeText}</p></section>}
      </div><aside className="detail-summary"><div className="summary-card"><p className="eyebrow">{ride ? 'YOUR NEXT RIDE' : 'A COMMUNITY FIND'}</p><div className="detail-price">{item.priceText || 'Price to confirm'}{ride && item.priceText.startsWith('$') && !/\/(?:person|seat)|per person/i.test(item.priceText) && <span>per person</span>}</div><p className="summary-availability"><Icon name={ride ? 'people' : 'check'} size={18} />{item.availabilityText || 'Confirm in WeChat'}</p><button className="button full-width" onClick={() => open(action.toLowerCase(), item)}>{action}<Icon name="arrow" size={18} /></button><p className="summary-note">Continue in WeChat and register to {ride ? 'connect with your travel companion' : 'contact the person who posted this listing'}.</p><div className="summary-divider" /><ul><li><Icon name="check" size={16} />Confirm the latest availability</li><li><Icon name="check" size={16} />Agree on the details together</li><li><Icon name="check" size={16} />Keep contact details in WeChat</li></ul></div><p className="preview-footnote">This is a public preview. Prices and availability can change.</p></aside></div>
    </>}
  </section>;
}
function WeChatDialog({ intent, selected, close }: { intent: string; selected?: Item; close: () => void }) {
  const titleId = useId(); const bodyId = useId();
  const panel = useRef<HTMLDivElement>(null); const closeButton = useRef<HTMLButtonElement>(null);
  const [copy, setCopy] = useState('');
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow; document.body.style.overflow = 'hidden'; closeButton.current?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
      if (event.key !== 'Tab') return;
      const elements = panel.current?.querySelectorAll<HTMLElement>('button, a[href], input, textarea, [tabindex="0"]');
      if (!elements?.length) return;
      const first = elements[0], last = elements[elements.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    addEventListener('keydown', keydown);
    return () => { document.body.style.overflow = overflow; removeEventListener('keydown', keydown); previous?.focus(); };
  }, [close]);
  const copyValue = async (value: string, name: boolean) => {
    try { await navigator.clipboard.writeText(value); setCopy(name ? 'Name copied. Open WeChat and paste it into search.' : 'Share link copied. Paste it into a WeChat chat, send it, then tap it to open.'); }
    catch { setCopy('Copy is not available here. Select and copy the name or share link below.'); }
  };
  return <div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) close(); }}><div ref={panel} className="wechat-dialog" role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={bodyId}><button ref={closeButton} className="icon-button modal-close" aria-label="Close WeChat instructions" onClick={close}><Icon name="close" /></button><span className="wechat-mark"><Icon name="chat" size={34} /></span><p className="eyebrow">THE NEXT STEP IS IN WECHAT</p><h2 id={titleId}>Let’s make it happen.</h2><p id={bodyId}>Open our mini program and register or sign in{intent ? ` to ${intent}` : ' to connect with the community'}.</p>{selected && <div className="selected-preview"><span>{KIND_LABELS[selected.kind]}</span><strong>{isRide(selected.kind) ? selected.regionText : selected.title}</strong><small>{selected.timeText}{selected.priceText ? ` · ${selected.priceText}` : ''}</small></div>}<div className="mini-name"><span>Search in WeChat → Mini Programs</span><strong tabIndex={0}>{MINI_NAME}</strong><button className="text-link" onClick={() => copyValue(MINI_NAME, true)}><Icon name="copy" size={16} />Copy name</button></div><button className="button full-width" onClick={() => copyValue(MINI_SHARE, false)}><Icon name="copy" size={19} />Copy mini program share link</button><p className="share-instruction">Paste the link into a WeChat chat, send it, then tap to open. Find this listing in the mini program to continue.</p><details className="manual-share"><summary>Show the share link</summary><p tabIndex={0}>{MINI_SHARE}</p></details><p className="copy-status" role="status">{copy}</p></div></div>;
}
function Footer() { return <footer className="site-footer"><div className="wrap"><div className="footer-top"><a href="#/" aria-label="LinkX home"><Brand /></a><p>A little closer.<br />A little more connected.</p><div><a href="#/rides">Rides</a><a href="#/market">Secondhand</a><a href="#/sublets">Sublets</a></div></div><div className="footer-bottom"><span>© {new Date().getFullYear()} LinkX · 极链行服务</span><span>New York & New Jersey</span><a href="/image-credits.html">Image credits</a></div></div></footer>; }
function App() {
  const route = useRoute();
  const [dialog, setDialog] = useState<{ intent: string; item?: Item } | null>(null);
  const [initialFilters, setInitialFilters] = useState(EMPTY_FILTERS);
  const open = (intent = '', item?: Item) => setDialog({ intent, item });
  const close = React.useCallback(() => setDialog(null), []);
  useEffect(() => { document.title = route.id ? 'Listing details · LinkX' : `${route.section === 'home' ? 'Going your way.' : route.section === 'market' ? 'Secondhand finds' : route.section === 'sublets' ? 'Community sublets' : 'Find a shared ride'} · LinkX`; }, [route.section, route.id]);
  const startSearch = (filters: Filters) => { setInitialFilters(filters); location.hash = '/rides'; };
  return <><a href="#main" className="skip-link" onClick={event => { event.preventDefault(); document.getElementById('main')?.focus(); }}>Skip to content</a><Header route={route} open={() => open()} /><main id="main" tabIndex={-1}>{route.id ? <Detail key={`${route.kind}/${route.id}`} route={route} open={open} /> : route.section === 'home' ? <Home open={open} startSearch={startSearch} /> : <Browse key={route.section} section={route.section} initialFilters={route.section === 'rides' ? initialFilters : EMPTY_FILTERS} open={open} />}</main><Footer />{dialog && <WeChatDialog intent={dialog.intent} selected={dialog.item} close={close} />}</>;
}
createRoot(document.getElementById('root')!).render(<App />);
