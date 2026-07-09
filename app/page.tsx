"use client";

import { useEffect, useMemo, useState, type CSSProperties, type PointerEvent } from "react";

type Locale = "zh" | "en";
type ProductKey = "rides" | "market" | "sublet";
type LocalizedText = Record<Locale, string>;

type Product = {
  key: ProductKey;
  index: string;
  eyebrow: string;
  name: LocalizedText;
  title: LocalizedText;
  description: LocalizedText;
  note: LocalizedText;
  accent: string;
  soft: string;
  icon: string;
  screen: "route" | "goods" | "home";
};

const LOCALE_STORAGE_KEY = "linkx-locale";

const copy = {
  zh: {
    navAria: "主导航",
    homeAria: "LinkX 首页",
    navExperience: "产品体验",
    navNetwork: "社区网络",
    navAbout: "关于 LinkX",
    navCta: "进入体验",
    menuOpen: "打开菜单",
    menuClose: "关闭菜单",
    languageToggle: "切换为英文",
    heroTitleOne: "把生活",
    heroTitleTwo: "连成网络",
    heroDescriptionOne: "LinkX 连接真实的同路人、闲置好物和下一间房。",
    heroDescriptionTwo: "一个平台，承接留学生活里每一个重要坐标。",
    heroCta: "探索 LinkX",
    servicesAria: "LinkX 服务概览",
    metricMainLabel: "拼车累计服务",
    metricMainDescription: "近 10,000 人次，真实社区持续连接中。",
    metricLocationDescription: "专注纽约与新泽西的学生出行。",
    metricLoopTitle: "全国社区",
    metricLoopDescription: "二手与转租信息，跨区域持续流动。",
    productHeadingOne: "一个入口，",
    productHeadingTwo: "三种连接。",
    productIntro: "点选功能，查看 LinkX 如何让城市里的留学生活彼此相连。",
    productTabsAria: "LinkX 功能",
    visionIntro: "不只是信息列表。",
    visionHeadingOne: "我们在做一张",
    visionHeadingTwo: "生活关系网。",
    visionPeopleTitle: "真实的人",
    visionPeopleDescription: "从同学之间出发，让每条信息都更接近真实需求。",
    visionDistanceTitle: "真实的距离",
    visionDistanceDescription: "位置和区域不是标签，而是连接与行动的起点。",
    visionLoopTitle: "持续的循环",
    visionLoopDescription: "一次拼车、一件闲置、一间转租，都能成为下一次连接。",
    finalHeadingOne: "城市很大，",
    finalHeadingTwo: "但我们可以",
    finalHeadingAccent: "更近。",
    finalCta: "体验 LinkX",
    footer: "连接纽约留学生活的每一个坐标。",
    rideTitle: "一起出发",
    routeStart: "发起路线",
    routeJoin: "加入路线",
    seats: "2 座",
    goodsTitle: "发现好物",
    goodsFurniture: "家具",
    goodsLiving: "生活",
    goodsTech: "数码",
    goodsBooks: "教材",
    goodsNew: "刚刚上新",
    goodsFlow: "让闲置继续流动",
    homeTitle: "住进生活里",
    homeAvailable: "可入住",
    homeType: "房型",
    homeTerm: "租期",
  },
  en: {
    navAria: "Main navigation",
    homeAria: "LinkX home",
    navExperience: "Experience",
    navNetwork: "Network",
    navAbout: "About LinkX",
    navCta: "Explore",
    menuOpen: "Open menu",
    menuClose: "Close menu",
    languageToggle: "Switch to Chinese",
    heroTitleOne: "Life,",
    heroTitleTwo: "connected",
    heroDescriptionOne: "LinkX connects real rides, secondhand finds, and your next place to call home.",
    heroDescriptionTwo: "One platform for every coordinate that shapes student life.",
    heroCta: "Explore LinkX",
    servicesAria: "LinkX services overview",
    metricMainLabel: "RIDERS CONNECTED",
    metricMainDescription: "Nearly 10,000 rides served—and the network keeps growing.",
    metricLocationDescription: "Student rides across New York and New Jersey.",
    metricLoopTitle: "Nationwide",
    metricLoopDescription: "Secondhand and sublet listings moving across communities.",
    productHeadingOne: "One entry,",
    productHeadingTwo: "three connections.",
    productIntro: "Choose a service and see how LinkX connects everyday student life across the city.",
    productTabsAria: "LinkX services",
    visionIntro: "More than a list of posts.",
    visionHeadingOne: "We are building a",
    visionHeadingTwo: "network for life.",
    visionPeopleTitle: "Real people",
    visionPeopleDescription: "Built around student-to-student needs, so every post feels closer to real life.",
    visionDistanceTitle: "Real distance",
    visionDistanceDescription: "Location is not just a label—it is where connection and action begin.",
    visionLoopTitle: "A living loop",
    visionLoopDescription: "A shared ride, a second life for an item, a new home—each starts the next connection.",
    finalHeadingOne: "The city is big.",
    finalHeadingTwo: "We can make it",
    finalHeadingAccent: "closer.",
    finalCta: "Experience LinkX",
    footer: "Connecting every coordinate of student life in New York.",
    rideTitle: "Ride together",
    routeStart: "Create a ride",
    routeJoin: "Join a ride",
    seats: "2 seats",
    goodsTitle: "Find a good thing",
    goodsFurniture: "Furniture",
    goodsLiving: "Living",
    goodsTech: "Tech",
    goodsBooks: "Books",
    goodsNew: "Just listed",
    goodsFlow: "Keep good things moving",
    homeTitle: "Live connected",
    homeAvailable: "AVAILABLE",
    homeType: "TYPE",
    homeTerm: "TERM",
  },
} as const;

const products: Product[] = [
  {
    key: "rides",
    index: "01",
    eyebrow: "RIDE NETWORK",
    name: { zh: "拼车", en: "Rides" },
    title: { zh: "同路的人，\n现在就能遇见。", en: "Meet the people\ngoing your way." },
    description: {
      zh: "发布路线、寻找同伴、管理行程。连接纽约与新泽西的真实出行需求，让每一次出发都更简单。",
      en: "Create routes, find companions, and manage each trip. LinkX connects real travel needs across New York and New Jersey.",
    },
    note: { zh: "服务范围 · NEW YORK / NEW JERSEY", en: "COVERAGE · NEW YORK / NEW JERSEY" },
    accent: "#7df4d5",
    soft: "rgba(125, 244, 213, .14)",
    icon: "/ride.png",
    screen: "route",
  },
  {
    key: "market",
    index: "02",
    eyebrow: "CIRCULAR MARKET",
    name: { zh: "二手", en: "Market" },
    title: { zh: "好东西，\n继续被需要。", en: "Good things\nkeep moving." },
    description: {
      zh: "按距离发现附近同学的闲置，从家具到数码、从教材到生活用品，让物品在社区里继续流动。",
      en: "Discover secondhand finds nearby—from furniture and tech to books and daily essentials—and keep them moving through the community.",
    },
    note: { zh: "更少浪费 · MORE CONNECTION", en: "LESS WASTE · MORE CONNECTION" },
    accent: "#ff7a5c",
    soft: "rgba(255, 122, 92, .14)",
    icon: "/market.png",
    screen: "goods",
  },
  {
    key: "sublet",
    index: "03",
    eyebrow: "LIVING, CONNECTED",
    name: { zh: "转租", en: "Sublets" },
    title: { zh: "下一间房，\n来自真实社区。", en: "Your next place,\nfrom your community." },
    description: {
      zh: "清楚查看区域、房型与入住日期，直接联系发布者。把找房从信息迷宫，变成一次可信的连接。",
      en: "See location, room type, and move-in dates clearly, then contact the lister directly. Find housing through a network you can trust.",
    },
    note: { zh: "区域筛选 · DIRECT CONTACT", en: "AREA FILTERS · DIRECT CONTACT" },
    accent: "#b8c8ff",
    soft: "rgba(184, 200, 255, .14)",
    icon: "/sublease.png",
    screen: "home",
  },
];

function detectDeviceLocale(): Locale {
  if (typeof navigator === "undefined") return "zh";
  const languages = navigator.languages?.length ? navigator.languages : [navigator.language];
  return languages.some((language) => language.toLowerCase().startsWith("zh")) ? "zh" : "en";
}

function applyDocumentLocale(locale: Locale) {
  document.documentElement.lang = locale === "zh" ? "zh-CN" : "en";
  document.documentElement.dataset.locale = locale;
}

function RouteScreen({ locale }: { locale: Locale }) {
  const t = copy[locale];
  return (
    <div className="demo-screen route-screen">
      <div className="screen-topline">
        <span>Campus rides</span>
        <span className="live-dot">LIVE</span>
      </div>
      <h3>{t.rideTitle}</h3>
      <div className="route-map" aria-hidden="true">
        <div className="map-ring map-ring-one" />
        <div className="map-ring map-ring-two" />
        <div className="route-line" />
        <span className="map-pin pin-a" />
        <span className="map-pin pin-b" />
        <span className="map-label label-a">NYC</span>
        <span className="map-label label-b">NJ</span>
      </div>
      <div className="route-card">
        <div>
          <span className="micro-label">TODAY · 6:40 PM</span>
          <strong>Manhattan → Jersey City</strong>
        </div>
        <span className="seat-pill">{t.seats}</span>
      </div>
      <div className="screen-actions">
        <span>{t.routeStart}</span>
        <span>{t.routeJoin}</span>
      </div>
    </div>
  );
}

function GoodsScreen({ locale }: { locale: Locale }) {
  const t = copy[locale];
  return (
    <div className="demo-screen goods-screen">
      <div className="screen-topline">
        <span>Near you</span>
        <span className="distance-pill">2.4 mi</span>
      </div>
      <h3>{t.goodsTitle}</h3>
      <div className="goods-grid" aria-hidden="true">
        <div className="goods-item coral-item">
          <span className="object-shape chair-shape" />
          <small>{t.goodsFurniture}</small>
        </div>
        <div className="goods-item cream-item">
          <span className="object-shape lamp-shape" />
          <small>{t.goodsLiving}</small>
        </div>
        <div className="goods-item mint-item">
          <span className="object-shape tech-shape" />
          <small>{t.goodsTech}</small>
        </div>
        <div className="goods-item blue-item">
          <span className="object-shape book-shape" />
          <small>{t.goodsBooks}</small>
        </div>
      </div>
      <div className="market-ticker">
        <span>{t.goodsNew}</span>
        <strong>{t.goodsFlow}</strong>
      </div>
    </div>
  );
}

function HomeScreen({ locale }: { locale: Locale }) {
  const t = copy[locale];
  return (
    <div className="demo-screen home-screen">
      <div className="screen-topline">
        <span>Sublet</span>
        <span className="verified-pill">VERIFIED</span>
      </div>
      <h3>{t.homeTitle}</h3>
      <div className="apartment-visual" aria-hidden="true">
        <div className="window-grid">
          {Array.from({ length: 12 }, (_, index) => (
            <i key={index} className={index === 6 || index === 9 ? "lit" : ""} />
          ))}
        </div>
        <span>JERSEY CITY</span>
      </div>
      <div className="home-meta">
        <div><small>{t.homeAvailable}</small><strong>AUG 01</strong></div>
        <div><small>{t.homeType}</small><strong>1B1B</strong></div>
        <div><small>{t.homeTerm}</small><strong>4 MO</strong></div>
      </div>
    </div>
  );
}

function ProductScreen({ type, locale }: { type: Product["screen"]; locale: Locale }) {
  if (type === "goods") return <GoodsScreen locale={locale} />;
  if (type === "home") return <HomeScreen locale={locale} />;
  return <RouteScreen locale={locale} />;
}

export default function Home() {
  const [activeKey, setActiveKey] = useState<ProductKey>("rides");
  const [menuOpen, setMenuOpen] = useState(false);
  const [locale, setLocale] = useState<Locale>("zh");
  const t = copy[locale];
  const active = useMemo(
    () => products.find((product) => product.key === activeKey) ?? products[0],
    [activeKey],
  );

  useEffect(() => {
    const savedLocale = window.localStorage.getItem(LOCALE_STORAGE_KEY);
    const initialLocale = savedLocale === "zh" || savedLocale === "en" ? savedLocale : detectDeviceLocale();
    setLocale(initialLocale);
    applyDocumentLocale(initialLocale);

    const followDeviceLanguage = () => {
      if (window.localStorage.getItem(LOCALE_STORAGE_KEY)) return;
      const deviceLocale = detectDeviceLocale();
      setLocale(deviceLocale);
      applyDocumentLocale(deviceLocale);
    };

    window.addEventListener("languagechange", followDeviceLanguage);
    return () => window.removeEventListener("languagechange", followDeviceLanguage);
  }, []);

  const changeLocale = (nextLocale: Locale) => {
    setLocale(nextLocale);
    setMenuOpen(false);
    window.localStorage.setItem(LOCALE_STORAGE_KEY, nextLocale);
    applyDocumentLocale(nextLocale);
  };

  const moveSpotlight = (event: PointerEvent<HTMLElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    event.currentTarget.style.setProperty("--pointer-x", `${event.clientX - rect.left}px`);
    event.currentTarget.style.setProperty("--pointer-y", `${event.clientY - rect.top}px`);
  };

  const activeStyle = {
    "--product-accent": active.accent,
    "--product-soft": active.soft,
  } as CSSProperties;

  return (
    <main className={`locale-${locale}`}>
      <nav className="site-nav" aria-label={t.navAria}>
        <a className="brand" href="#top" aria-label={t.homeAria}>
          <span className="brand-mark" aria-hidden="true"><i /><i /></span>
          <span>LinkX</span>
        </a>
        <div className={`nav-links ${menuOpen ? "is-open" : ""}`}>
          <a href="#experience" onClick={() => setMenuOpen(false)}>{t.navExperience}</a>
          <a href="#network" onClick={() => setMenuOpen(false)}>{t.navNetwork}</a>
          <a href="#vision" onClick={() => setMenuOpen(false)}>{t.navAbout}</a>
        </div>
        <button
          className="language-toggle"
          type="button"
          aria-label={t.languageToggle}
          onClick={() => changeLocale(locale === "zh" ? "en" : "zh")}
        >
          <span className={locale === "zh" ? "is-active" : ""}>中</span>
          <span className={locale === "en" ? "is-active" : ""}>EN</span>
        </button>
        <a className="nav-cta" href="#experience">
          <span>{t.navCta}</span>
          <span className="arrow-up-right" aria-hidden="true" />
        </a>
        <button
          className="menu-toggle"
          type="button"
          aria-label={menuOpen ? t.menuClose : t.menuOpen}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((value) => !value)}
        >
          <span /><span />
        </button>
      </nav>

      <section id="top" className="hero" onPointerMove={moveSpotlight}>
        <div className="hero-grid" aria-hidden="true" />
        <div className="pointer-glow" aria-hidden="true" />
        <div className="hero-copy">
          <div className="hero-kicker reveal reveal-one">
            <span className="pulse-orb" />
            <span>LIVE IN NEW YORK · BUILT FOR STUDENTS</span>
          </div>
          <h1 className="reveal reveal-two">
            <span>{t.heroTitleOne}</span>
            <span className="outline-line">{t.heroTitleTwo}<span className="accent-dot">.</span></span>
          </h1>
          <div className="hero-bottom reveal reveal-three">
            <p>{t.heroDescriptionOne}<br />{t.heroDescriptionTwo}</p>
            <a className="primary-button" href="#experience">
              <span>{t.heroCta}</span>
              <span className="button-arrow" aria-hidden="true">↓</span>
            </a>
          </div>
        </div>

        <div className="hero-orbit reveal reveal-four" aria-label={t.servicesAria}>
          <div className="orbit-ring orbit-ring-a" />
          <div className="orbit-ring orbit-ring-b" />
          <div className="hero-device">
            <div className="device-head">
              <span className="device-logo">LX</span>
              <span className="device-status">ONLINE</span>
            </div>
            <div className="device-statement"><span>YOUR CAMPUS</span><strong>CONNECTED.</strong></div>
            <div className="mini-services">
              {products.map((product) => (
                <div className="mini-service" key={product.key}>
                  <img src={product.icon} alt="" />
                  <span>{product.name[locale]}</span>
                  <small>{product.index}</small>
                </div>
              ))}
            </div>
          </div>
          <div className="orbit-tag tag-one"><span>01</span> RIDE</div>
          <div className="orbit-tag tag-two"><span>02</span> MARKET</div>
          <div className="orbit-tag tag-three"><span>03</span> SUBLET</div>
          <div className="orbit-coordinate coordinate-a">40.7128° N</div>
          <div className="orbit-coordinate coordinate-b">74.0060° W</div>
        </div>

        <div className="scroll-cue" aria-hidden="true"><span>SCROLL TO CONNECT</span><i /></div>
      </section>

      <div className="signal-strip" aria-hidden="true">
        <div className="signal-track">
          <span>RIDE TOGETHER</span><i>✦</i><span>REUSE BETTER</span><i>✦</i><span>LIVE CLOSER</span><i>✦</i>
          <span>RIDE TOGETHER</span><i>✦</i><span>REUSE BETTER</span><i>✦</i><span>LIVE CLOSER</span><i>✦</i>
        </div>
      </div>

      <section id="network" className="metrics section-shell">
        <div className="section-label"><span>00 / NETWORK STATUS</span><span className="label-line" /><span>ACTIVE</span></div>
        <div className="metric-grid">
          <article className="metric-card metric-main">
            <div className="metric-top"><span>{t.metricMainLabel}</span><span className="metric-status"><i /> VERIFIED</span></div>
            <strong className="metric-number">10K<span>−</span></strong>
            <p>{t.metricMainDescription}</p>
          </article>
          <article className="metric-card metric-location">
            <div className="location-crosshair" aria-hidden="true"><i /><i /></div>
            <span className="metric-eyebrow">RIDE COVERAGE</span>
            <strong>NY ↔ NJ</strong>
            <p>{t.metricLocationDescription}</p>
          </article>
          <article className="metric-card metric-loop">
            <div className="loop-symbol" aria-hidden="true">∞</div>
            <span className="metric-eyebrow">MARKETPLACE</span>
            <strong>{t.metricLoopTitle}</strong>
            <p>{t.metricLoopDescription}</p>
          </article>
        </div>
      </section>

      <section id="experience" className="product-section" style={activeStyle}>
        <div className="section-shell">
          <div className="section-label light-label"><span>01—03 / PRODUCT SYSTEM</span><span className="label-line" /><span>INTERACTIVE DEMO</span></div>
          <div className="product-intro">
            <h2>{t.productHeadingOne}<br /><span>{t.productHeadingTwo}</span></h2>
            <p>{t.productIntro}</p>
          </div>
          <div className="product-console">
            <div className="product-tabs" role="tablist" aria-label={t.productTabsAria}>
              {products.map((product) => (
                <button
                  key={product.key}
                  type="button"
                  role="tab"
                  aria-selected={product.key === activeKey}
                  className={product.key === activeKey ? "is-active" : ""}
                  onClick={() => setActiveKey(product.key)}
                >
                  <span>{product.index}</span>
                  <strong>{product.name[locale]}</strong>
                  <small>{product.eyebrow}</small>
                  <i className="arrow-up-right" aria-hidden="true" />
                </button>
              ))}
            </div>
            <div className="product-stage" aria-live="polite">
              <div className="stage-copy" key={`${active.key}-${locale}-copy`}>
                <span className="stage-eyebrow">{active.eyebrow}</span>
                <h3>{active.title[locale]}</h3>
                <p>{active.description[locale]}</p>
                <div className="stage-note"><span />{active.note[locale]}</div>
              </div>
              <div className="phone-wrap" key={`${active.key}-${locale}-screen`}>
                <div className="phone-glow" aria-hidden="true" />
                <div className="phone-shell">
                  <div className="phone-sensor" />
                  <ProductScreen type={active.screen} locale={locale} />
                  <div className="phone-homebar" />
                </div>
                <span className="phone-index">{active.index}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="vision" className="vision section-shell">
        <div className="section-label"><span>04 / WHY LINKX</span><span className="label-line" /><span>COMMUNITY OS</span></div>
        <div className="vision-heading"><p>{t.visionIntro}</p><h2>{t.visionHeadingOne}<span>{t.visionHeadingTwo}</span></h2></div>
        <div className="vision-grid">
          <article className="vision-card vision-card-dark">
            <span className="vision-index">A / 01</span>
            <div className="node-visual" aria-hidden="true">
              <span className="node node-a" /><span className="node node-b" /><span className="node node-c" />
              <i className="node-line line-one" /><i className="node-line line-two" /><i className="node-line line-three" />
            </div>
            <h3>{t.visionPeopleTitle}</h3><p>{t.visionPeopleDescription}</p>
          </article>
          <article className="vision-card vision-card-mint">
            <span className="vision-index">B / 02</span>
            <div className="radar-visual" aria-hidden="true"><i /><i /><i /><span /></div>
            <h3>{t.visionDistanceTitle}</h3><p>{t.visionDistanceDescription}</p>
          </article>
          <article className="vision-card vision-card-light">
            <span className="vision-index">C / 03</span>
            <div className="flow-visual" aria-hidden="true"><span>RIDE</span><i>→</i><span>LIVE</span><i>→</i><span>REUSE</span></div>
            <h3>{t.visionLoopTitle}</h3><p>{t.visionLoopDescription}</p>
          </article>
        </div>
      </section>

      <section className="final-cta">
        <div className="cta-grid" aria-hidden="true" /><div className="cta-orb" aria-hidden="true" />
        <span className="cta-eyebrow">THE NEXT CONNECTION STARTS HERE</span>
        <h2>{t.finalHeadingOne}<br />{t.finalHeadingTwo}<span>{t.finalHeadingAccent}</span></h2>
        <a href="#top" className="cta-button"><span>{t.finalCta}</span><i className="arrow-up-right" aria-hidden="true" /></a>
      </section>

      <footer>
        <a className="brand footer-brand" href="#top"><span className="brand-mark" aria-hidden="true"><i /><i /></span><span>LinkX</span></a>
        <p>{t.footer}</p>
        <div className="footer-meta"><span>NEW YORK / NEW JERSEY</span><span>© 2026 LINKX</span></div>
      </footer>
    </main>
  );
}
