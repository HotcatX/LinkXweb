"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  COPY,
  SERVICES,
  type Locale,
  type Service,
  type Theme,
  miniProgramSteps,
} from "./site-content";
import {
  MINI_PROGRAM_SHARE,
  PLACES,
  filterRoutes,
  referencePrice,
  routeLabel,
  type RoutePrice,
} from "./pricing";
const PAGE = {
  zh: {
    top: "LinkX · 极链行服务",
    heroOne: "去同一个方向，",
    heroTwo: "就一起出发。",
    intro: "纽约与新泽西的拼车社区。找个同路人，轻松分享下一程。",
    from: "从哪里出发",
    to: "准备去哪里",
    allFrom: "全部出发地",
    allTo: "全部目的地",
    swap: "交换出发地和目的地",
    search: "查看参考价格",
    searchHint: "先看看常见路线的价格，再去小程序找合适的行程。",
    priceTitle: "你的下一程，好价出发。",
    priceSubtitle: "纽约 / 新泽西 · 常见拼车路线",
    all: "查看全部方向",
    price: "参考价",
    perPerson: "起 / 人",
    unavailable: "查看最新报价",
    asOf: "参考 2026 年 9 月 10 日发布数据，美元 / 人。价格与余座以小程序中的具体行程为准。",
    viewRoute: "查看行程",
    noMatch: "这个方向暂时没有参考价",
    noMatchNote: "可以进入小程序查看其他路线，或发布自己的出行需求。",
    driverLabel: "你开车，我们一起顺路",
    driverTitle: "本来就要出发？\n把空座分享出去。",
    driverBody: "发布你的路线和时间，找到同路人，一起分担出行费用。",
    driverAction: "发布我的行程",
    driverChecks: [
      "自己安排出发时间",
      "在路线详情中联系同行人",
      "共同分担出行费用",
    ],
    benefitTitle: "拼车，可以很简单。",
    lifeTitle: "同一个社区，更多日常。",
    lifeIntro: "拼车之外，闲置与下一间房也在这里。",
    howTitle: "下一程，在微信里开始。",
    howBody: "找到“极链行服务”小程序，登录后就能查看、发布和加入路线。",
    go: "寻找拼车",
    copyLink: "复制小程序链接",
    copied: "链接已复制",
    copySuccess: "打开微信，将链接粘贴到聊天中，发送后点击即可进入。",
    copyError: "无法自动复制，请选中下方分享链接，手动复制到微信。",
    linkHint: "复制分享链接 → 粘贴到微信聊天 → 点击进入小程序",
    showLink: "查看分享链接",
    dialogTitle: "在微信里，继续下一程。",
    selected: "你选择的路线",
    routeStep: "进入“加入路线”，选择上面对应的出发地和目的地。",
    theme: "主题",
    photo: "图片来源与授权",
  },
  en: {
    top: "LinkX · Rides for our community",
    heroOne: "Going the same way?",
    heroTwo: "Let’s ride together.",
    intro:
      "Share a ride between New York and New Jersey. Good company for wherever you’re going.",
    from: "Leaving from",
    to: "Going to",
    allFrom: "All departures",
    allTo: "All destinations",
    swap: "Swap departure and destination",
    search: "Explore fares",
    searchHint:
      "Compare reference fares, then find your ride in our WeChat mini program.",
    priceTitle: "Your next ride. A little less.",
    priceSubtitle: "New York / New Jersey · Popular directions",
    all: "All directions",
    price: "Reference fare",
    perPerson: "from / person",
    unavailable: "Check current fares",
    asOf: "Reference driver fares checked on 10 Sep 2026, in USD per person. Confirm the price and available seats in the mini program.",
    viewRoute: "Explore rides",
    noMatch: "No reference fare for this direction yet",
    noMatchNote:
      "Explore other rides in WeChat, or post a trip request of your own.",
    driverLabel: "YOUR CAR. A LITTLE MORE COMPANY.",
    driverTitle: "Already heading out?\nShare your spare seats.",
    driverBody:
      "Post your route and departure time. Find someone going your way and share the cost of the journey.",
    driverAction: "Offer a ride",
    driverChecks: [
      "Travel on your own schedule",
      "Connect through your ride details",
      "Share the cost of your journey",
    ],
    benefitTitle: "A simpler way to share a ride.",
    lifeTitle: "One community. More everyday connections.",
    lifeIntro:
      "Secondhand finds and your next place, all in the same community.",
    howTitle: "Your next ride starts in WeChat.",
    howBody:
      "Find 极链行服务 on WeChat. Sign in to browse, post and join rides.",
    go: "Find a ride",
    copyLink: "Copy mini program link",
    copied: "Link copied",
    copySuccess:
      "Open WeChat, paste the link into a chat, send it and tap to open.",
    copyError:
      "Automatic copy is unavailable. Select the share link below and copy it into WeChat.",
    linkHint: "Copy the link → Paste into a WeChat chat → Tap to open",
    showLink: "Show share link",
    dialogTitle: "Continue your journey in WeChat.",
    selected: "Your selected direction",
    routeStep:
      "Open 加入路线 (Join a ride) and select the departure and destination above.",
    theme: "Theme",
    photo: "Image credits and licences",
  },
} as const;
function Icon({ name, size = 22 }: { name: string; size?: number }) {
  const paths: Record<string, React.ReactNode> = {
    arrow: <path d="M4 12h16m-6-6 6 6-6 6" />,
    up: <path d="m6 18 12-12M6 6h12v12" />,
    search: (
      <>
        <circle cx="10.5" cy="10.5" r="6.5" />
        <path d="m16 16 5 5" />
      </>
    ),
    pin: (
      <>
        <path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z" />
        <circle cx="12" cy="10" r="2" />
      </>
    ),
    swap: <path d="M4 8h15m-4-4 4 4-4 4M20 16H5m4-4-4 4 4 4" />,
    sun: (
      <>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5" />
      </>
    ),
    moon: <path d="M21 12.8A9 9 0 0 1 11.2 3 9 9 0 1 0 21 12.8Z" />,
    plus: <path d="M12 5v14M5 12h14" />,
    check: <path d="m5 12 4 4L19 6" />,
    car: (
      <>
        <path d="m5 7 2-4h10l2 4 2 3v8H3v-8l2-3ZM5 7h14M3 14h18M6 18v3m12-3v3" />
        <path d="M6 11h2m8 0h2" />
      </>
    ),
    chat: <path d="M21 11a8 8 0 0 1-8 8H5l-4 3 2-7a8 8 0 1 1 18-4Z" />,
    leaf: (
      <>
        <path d="M20 3c-1 12-4 18-12 16C-1 15 4 3 20 3Z" />
        <path d="m4 21 11-12" />
      </>
    ),
    close: <path d="m6 6 12 12M18 6 6 18" />,
    bag: (
      <>
        <path d="M4 8h16l-1 12H5L4 8ZM8 8V6a4 4 0 0 1 8 0v2" />
        <path d="M9 12v1m6-1v1" />
      </>
    ),
    house: (
      <>
        <path d="m3 10 9-7 9 7v11H3V10Z" />
        <path d="M9 21v-8h6v8" />
      </>
    ),
    copy: (
      <>
        <rect x="8" y="8" width="13" height="13" rx="2" />
        <path d="M16 8V3H3v13h5" />
      </>
    ),
  };
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name] || paths.arrow}
    </svg>
  );
}
function Brand() {
  return (
    <>
      <svg
        className="brand-symbol"
        width="30"
        height="30"
        viewBox="0 0 30 30"
        fill="none"
        aria-hidden="true"
      >
        <path
          d="M6 5v14a5 5 0 0 0 5 5h13M13 5h11v11M12 18 24 6"
          stroke="currentColor"
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span className="brand-name">
        LinkX<span>极链行服务</span>
      </span>
    </>
  );
}
export default function Home() {
  const [locale, setLocale] = useState<Locale>("zh");
  const [theme, setTheme] = useState<Theme>("light");
  const [menu, setMenu] = useState(false);
  const [service, setService] = useState<Service | null>(null);
  const [selectedRoute, setSelectedRoute] = useState<RoutePrice | null>(null);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [filter, setFilter] = useState({ from: "", to: "" });
  const [now, setNow] = useState<number | null>(null);
  const t = COPY[locale],
    v = PAGE[locale];
  const routes = filterRoutes(filter.from, filter.to);
  useEffect(() => {
    try {
      const saved = localStorage.getItem("linkx-locale");
      setLocale(
        saved === "en" || saved === "zh"
          ? saved
          : navigator.languages.some((language) =>
                language.toLowerCase().startsWith("zh"),
              )
            ? "zh"
            : "en",
      );
      if (document.documentElement.dataset.theme === "dark") setTheme("dark");
    } catch (_) {}
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    document.documentElement.lang = locale === "zh" ? "zh-CN" : "en";
  }, [locale]);
  function switchLocale() {
    const next = locale === "zh" ? "en" : "zh";
    setLocale(next);
    try {
      localStorage.setItem("linkx-locale", next);
    } catch (_) {}
  }
  function switchTheme() {
    const next = theme === "light" ? "dark" : "light";
    setTheme(next);
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem("linkx-theme", next);
    } catch (_) {}
  }
  function open(next: Service, route: RoutePrice | null = null) {
    setSelectedRoute(route);
    setService(next);
    setMenu(false);
  }
  function search(event: FormEvent) {
    event.preventDefault();
    setFilter({ from, to });
    document
      .getElementById("rides")
      ?.scrollIntoView({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "instant"
          : "smooth",
        block: "start",
      });
  }
  function clearFilter() {
    setFrom("");
    setTo("");
    setFilter({ from: "", to: "" });
  }
  return (
    <>
      <a href="#main" className="skip-link">
        {t.skip}
      </a>
      <header className="site-header">
        <div className="header-inner">
          <a href="#top" className="wordmark" aria-label={t.home}>
            <Brand />
          </a>
          <nav
            aria-label={t.navigation}
            className={menu ? "site-nav is-open" : "site-nav"}
          >
            <a href="#rides" onClick={() => setMenu(false)}>
              {t.rides}
            </a>
            <a href="#life" onClick={() => setMenu(false)}>
              {t.life}
            </a>
            <a href="#how" onClick={() => setMenu(false)}>
              {t.how}
            </a>
          </nav>
          <div className="header-actions">
            <button className="header-publish" onClick={() => open("drive")}>
              <Icon name="plus" size={20} />
              {t.offerRide}
            </button>
            <span className="control-divider" />
            <button
              className="locale-toggle"
              onClick={switchLocale}
              aria-label={t.switchLocale}
            >
              {locale === "zh" ? "EN" : "中"}
            </button>
            <button
              className="theme-toggle"
              onClick={switchTheme}
              aria-label={theme === "light" ? t.dark : t.light}
            >
              <Icon name={theme === "light" ? "moon" : "sun"} size={19} />
            </button>
            <button
              className="menu-toggle"
              aria-label={menu ? t.closeMenu : t.openMenu}
              aria-expanded={menu}
              onClick={() => setMenu(!menu)}
            >
              <span />
              <span />
            </button>
          </div>
        </div>
      </header>
      <main id="main">
        <section className="hero-stage" id="top" aria-labelledby="hero-title">
          <img
            className="hero-photo"
            src="/carpool-hero.png"
            alt={
              locale === "zh"
                ? "朋友们在河岸边会合，准备一起乘车出发的场景示意"
                : "An illustrative scene of friends meeting by the river for a shared ride"
            }
            width="1967"
            height="800"
            fetchPriority="high"
          />
          <div className="hero-shade" />
          <div className="hero-content section-wrap">
            <p className="hero-kicker">{v.top}</p>
            <h1 id="hero-title">
              {v.heroOne}
              <br />
              {v.heroTwo}
            </h1>
            <p className="hero-description">{v.intro}</p>
          </div>
        </section>
        <div className="search-wrap section-wrap">
          <form className="route-search" onSubmit={search}>
            <label className="search-field">
              <Icon name="pin" />
              <span>
                <span className="search-label">{v.from}</span>
                <select
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                  aria-label={v.from}
                >
                  <option value="">{v.allFrom}</option>
                  {Object.entries(PLACES).map(([key, place]) => (
                    <option key={key} value={key}>
                      {place[locale]}
                    </option>
                  ))}
                </select>
              </span>
            </label>
            <button
              className="swap-button"
              type="button"
              onClick={() => {
                setFrom(to);
                setTo(from);
              }}
              aria-label={v.swap}
            >
              <Icon name="swap" size={20} />
            </button>
            <label className="search-field destination">
              <Icon name="pin" />
              <span>
                <span className="search-label">{v.to}</span>
                <select
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  aria-label={v.to}
                >
                  <option value="">{v.allTo}</option>
                  {Object.entries(PLACES).map(([key, place]) => (
                    <option key={key} value={key}>
                      {place[locale]}
                    </option>
                  ))}
                </select>
              </span>
            </label>
            <button className="search-button" type="submit">
              <Icon name="search" />
              {v.search}
            </button>
          </form>
          <p className="search-note">{v.searchHint}</p>
        </div>
        <section
          id="rides"
          className="price-section section-wrap"
          aria-labelledby="price-title"
        >
          <div className="section-heading">
            <div>
              <p className="section-kicker">{v.priceSubtitle}</p>
              <h2 id="price-title">{v.priceTitle}</h2>
            </div>
            {(filter.from || filter.to) && (
              <button className="text-link" onClick={clearFilter}>
                {v.all}
                <Icon name="arrow" size={18} />
              </button>
            )}
          </div>
          <div className="price-grid">
            {routes.map((route) => (
              <PriceCard
                key={route.id}
                route={route}
                locale={locale}
                now={now}
                onClick={() => open("rides", route)}
              />
            ))}
          </div>
          {routes.length === 0 && (
            <div className="no-routes">
              <Icon name="search" size={32} />
              <h3>{v.noMatch}</h3>
              <p>{v.noMatchNote}</p>
              <button className="button primary" onClick={() => open("rides")}>
                {v.go}
                <Icon name="up" size={18} />
              </button>
            </div>
          )}
          <p className="price-footnote">{v.asOf}</p>
        </section>
        <section
          className="driver-section section-wrap"
          aria-labelledby="driver-title"
        >
          <div className="driver-banner">
            <div className="driver-copy">
              <p className="section-kicker">{v.driverLabel}</p>
              <h2 id="driver-title">{v.driverTitle}</h2>
              <p>{v.driverBody}</p>
              <button className="button primary" onClick={() => open("drive")}>
                {v.driverAction}
                <Icon name="plus" size={20} />
              </button>
            </div>
            <div className="driver-details">
              <div className="driver-icon">
                <Icon name="car" size={62} />
              </div>
              <ul>
                {v.driverChecks.map((value) => (
                  <li key={value}>
                    <Icon name="check" size={18} />
                    {value}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>
        <section
          className="benefit-section section-wrap"
          aria-labelledby="benefit-title"
        >
          <h2 id="benefit-title">{v.benefitTitle}</h2>
          <div className="benefit-grid">
            {t.rideBenefits.map((item, index) => (
              <article key={item.title}>
                <Icon name={["search", "car", "chat"][index]} size={30} />
                <h3>{item.title}</h3>
                <p>{item.body}</p>
              </article>
            ))}
          </div>
        </section>
        <section
          className="life-section"
          id="life"
          aria-labelledby="life-title"
        >
          <div className="section-wrap">
            <div className="section-heading">
              <div>
                <h2 id="life-title">{v.lifeTitle}</h2>
                <p className="section-intro">{v.lifeIntro}</p>
              </div>
            </div>
            <div className="life-grid">
              {(["market", "sublet"] as Service[]).map((kind) => (
                <button
                  className="service-card"
                  key={kind}
                  onClick={() => open(kind)}
                >
                  <div className="service-card-icon">
                    <Icon
                      name={kind === "market" ? "bag" : "house"}
                      size={32}
                    />
                  </div>
                  <div>
                    <p className="service-tag">
                      {SERVICES[kind][locale].label}
                    </p>
                    <h3>{SERVICES[kind][locale].title}</h3>
                    <p>{SERVICES[kind][locale].body}</p>
                    <span className="service-link">
                      {SERVICES[kind][locale].cta}
                      <Icon name="arrow" size={18} />
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </section>
        <section
          className="how-section section-wrap"
          id="how"
          aria-labelledby="how-title"
        >
          <div className="how-copy">
            <p className="section-kicker">LINKX × WECHAT</p>
            <h2 id="how-title">{v.howTitle}</h2>
            <p>{v.howBody}</p>
            <button className="button primary" onClick={() => open("rides")}>
              {v.go}
              <Icon name="up" size={18} />
            </button>
          </div>
          <ol className="how-steps">
            {t.steps.map((step, index) => (
              <li key={step.title}>
                <span>0{index + 1}</span>
                <div>
                  <h3>{step.title}</h3>
                  <p>{step.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>
        <section
          className="faq-section section-wrap"
          aria-labelledby="faq-title"
        >
          <h2 id="faq-title">{t.faqTitle}</h2>
          <div className="faq-list">
            {t.faq.map((item) => (
              <details key={item.q}>
                <summary>
                  {item.q}
                  <Icon name="plus" size={20} />
                </summary>
                <p>{item.a}</p>
              </details>
            ))}
          </div>
        </section>
      </main>
      <footer className="site-footer">
        <div className="section-wrap">
          <div className="footer-top">
            <a href="#top" className="wordmark" aria-label={t.home}>
              <Brand />
            </a>
            <p>{t.footer}</p>
            <a className="back-top" href="#top">
              {t.backTop}
              <Icon name="up" size={17} />
            </a>
          </div>
          <div className="footer-bottom">
            <span>© 2026 LinkX · 极链行服务</span>
            <span>New York / New Jersey</span>
            <a href="/image-credits.html" target="_blank" rel="noreferrer">
              {v.photo}
            </a>
          </div>
        </div>
      </footer>
      {service && (
        <MiniProgramDialog
          service={service}
          route={selectedRoute}
          locale={locale}
          onClose={() => setService(null)}
        />
      )}
    </>
  );
}
function PriceCard({
  route,
  locale,
  now,
  onClick,
}: {
  route: RoutePrice;
  locale: Locale;
  now: number | null;
  onClick: () => void;
}) {
  const v = PAGE[locale];
  const price = referencePrice(route, now);
  return (
    <button className="price-card" onClick={onClick}>
      <div className="price-card-image">
        <img
          src={route.image}
          alt={route.imageAlt[locale]}
          width="600"
          height="300"
          loading="lazy"
        />
        <span>{route.tag[locale]}</span>
      </div>
      <div className="price-card-content">
        <div className="route-stops">
          <div className="stop-line">
            <i />
            <b />
          </div>
          <div>
            <span>{PLACES[route.from][locale]}</span>
            <h3>{PLACES[route.to][locale]}</h3>
          </div>
        </div>
        <div className="fare-row">
          <div>
            <span className="fare-label">{v.price}</span>
            {price !== null ? (
              <div className="fare">
                <span className="currency">$</span>
                <strong>{price}</strong>
                <span>{v.perPerson}</span>
              </div>
            ) : (
              <span className="fare-expired">{v.unavailable}</span>
            )}
          </div>
          <span className="fare-arrow">
            <Icon name="arrow" size={23} />
          </span>
        </div>
        <span className="card-action">{v.viewRoute}</span>
      </div>
    </button>
  );
}
function MiniProgramDialog({
  service,
  route,
  locale,
  onClose,
}: {
  service: Service;
  route: RoutePrice | null;
  locale: Locale;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);
  const t = COPY[locale],
    v = PAGE[locale];
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    dialog.current?.showModal();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, []);
  async function copy() {
    try {
      await navigator.clipboard.writeText(MINI_PROGRAM_SHARE);
      setCopied(true);
      setCopyError(false);
    } catch (_) {
      setCopyError(true);
    }
  }
  const steps = miniProgramSteps(service, locale);
  if (route) steps[2] = v.routeStep;
  return (
    <dialog
      ref={dialog}
      className="mini-dialog"
      aria-labelledby="mini-title"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === dialog.current) onClose();
      }}
    >
      <div className="mini-dialog-inner">
        <div className="dialog-top">
          <span>LINKX / WECHAT</span>
          <button
            className="close-dialog"
            autoFocus
            onClick={onClose}
            aria-label={t.close}
          >
            <Icon name="close" size={20} />
          </button>
        </div>
        <div className="dialog-app-icon">
          <Icon
            name={
              service === "market"
                ? "bag"
                : service === "sublet"
                  ? "house"
                  : "car"
            }
            size={30}
          />
        </div>
        <h2 id="mini-title">
          {route ? v.dialogTitle : SERVICES[service][locale].dialogTitle}
        </h2>
        <p className="dialog-intro">{t.dialogIntro}</p>
        {route && (
          <div className="selected-route">
            <span>{v.selected}</span>
            <strong>{routeLabel(route, locale)}</strong>
          </div>
        )}
        <div className="mini-name">
          <span>{t.miniNameLabel}</span>
          <strong>
            极链行服务 <small>LinkX</small>
          </strong>
        </div>
        <button className="button primary full" onClick={copy}>
          <Icon name="copy" size={18} />
          {copied ? v.copied : v.copyLink}
        </button>
        <p className="dialog-hint" role="status">
          {copyError ? v.copyError : copied ? v.copySuccess : v.linkHint}
        </p>
        <details className="share-link-details" open={copyError || undefined}>
          <summary>{v.showLink}</summary>
          <code>{MINI_PROGRAM_SHARE}</code>
        </details>
        <ol className="dialog-steps">
          {steps.map((step, index) => (
            <li key={step}>
              <span>{index + 1}</span>
              {step}
            </li>
          ))}
        </ol>
        <button className="dialog-done" onClick={onClose}>
          {t.gotIt}
        </button>
      </div>
    </dialog>
  );
}
