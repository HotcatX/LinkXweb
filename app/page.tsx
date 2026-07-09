"use client";

import { useMemo, useState, type CSSProperties, type PointerEvent } from "react";

type ProductKey = "rides" | "market" | "sublet";

type Product = {
  key: ProductKey;
  index: string;
  eyebrow: string;
  name: string;
  title: string;
  description: string;
  note: string;
  accent: string;
  soft: string;
  icon: string;
  screen: "route" | "goods" | "home";
};

const products: Product[] = [
  {
    key: "rides",
    index: "01",
    eyebrow: "RIDE NETWORK",
    name: "拼车",
    title: "同路的人，\n现在就能遇见。",
    description:
      "发布路线、寻找同伴、管理行程。连接纽约与新泽西的真实出行需求，让每一次出发都更简单。",
    note: "服务范围 · NEW YORK / NEW JERSEY",
    accent: "#7df4d5",
    soft: "rgba(125, 244, 213, .14)",
    icon: "/ride.png",
    screen: "route",
  },
  {
    key: "market",
    index: "02",
    eyebrow: "CIRCULAR MARKET",
    name: "二手",
    title: "好东西，\n继续被需要。",
    description:
      "按距离发现附近同学的闲置，从家具到数码、从教材到生活用品，让物品在社区里继续流动。",
    note: "更少浪费 · MORE CONNECTION",
    accent: "#ff7a5c",
    soft: "rgba(255, 122, 92, .14)",
    icon: "/market.png",
    screen: "goods",
  },
  {
    key: "sublet",
    index: "03",
    eyebrow: "LIVING, CONNECTED",
    name: "转租",
    title: "下一间房，\n来自真实社区。",
    description:
      "清楚查看区域、房型与入住日期，直接联系发布者。把找房从信息迷宫，变成一次可信的连接。",
    note: "区域筛选 · DIRECT CONTACT",
    accent: "#b8c8ff",
    soft: "rgba(184, 200, 255, .14)",
    icon: "/sublease.png",
    screen: "home",
  },
];

function RouteScreen() {
  return (
    <div className="demo-screen route-screen">
      <div className="screen-topline">
        <span>Campus rides</span>
        <span className="live-dot">LIVE</span>
      </div>
      <h3>一起出发</h3>
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
        <span className="seat-pill">2 seats</span>
      </div>
      <div className="screen-actions">
        <span>发起路线</span>
        <span>加入路线</span>
      </div>
    </div>
  );
}

function GoodsScreen() {
  return (
    <div className="demo-screen goods-screen">
      <div className="screen-topline">
        <span>Near you</span>
        <span className="distance-pill">2.4 mi</span>
      </div>
      <h3>发现好物</h3>
      <div className="goods-grid" aria-hidden="true">
        <div className="goods-item coral-item">
          <span className="object-shape chair-shape" />
          <small>家具</small>
        </div>
        <div className="goods-item cream-item">
          <span className="object-shape lamp-shape" />
          <small>生活</small>
        </div>
        <div className="goods-item mint-item">
          <span className="object-shape tech-shape" />
          <small>数码</small>
        </div>
        <div className="goods-item blue-item">
          <span className="object-shape book-shape" />
          <small>教材</small>
        </div>
      </div>
      <div className="market-ticker">
        <span>刚刚上新</span>
        <strong>让闲置继续流动</strong>
      </div>
    </div>
  );
}

function HomeScreen() {
  return (
    <div className="demo-screen home-screen">
      <div className="screen-topline">
        <span>Sublet</span>
        <span className="verified-pill">VERIFIED</span>
      </div>
      <h3>住进生活里</h3>
      <div className="apartment-visual" aria-hidden="true">
        <div className="window-grid">
          {Array.from({ length: 12 }, (_, index) => (
            <i key={index} className={index === 6 || index === 9 ? "lit" : ""} />
          ))}
        </div>
        <span>JERSEY CITY</span>
      </div>
      <div className="home-meta">
        <div>
          <small>AVAILABLE</small>
          <strong>AUG 01</strong>
        </div>
        <div>
          <small>TYPE</small>
          <strong>1B1B</strong>
        </div>
        <div>
          <small>TERM</small>
          <strong>4 MO</strong>
        </div>
      </div>
    </div>
  );
}

function ProductScreen({ type }: { type: Product["screen"] }) {
  if (type === "goods") return <GoodsScreen />;
  if (type === "home") return <HomeScreen />;
  return <RouteScreen />;
}

export default function Home() {
  const [activeKey, setActiveKey] = useState<ProductKey>("rides");
  const [menuOpen, setMenuOpen] = useState(false);
  const active = useMemo(
    () => products.find((product) => product.key === activeKey) ?? products[0],
    [activeKey],
  );

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
    <main>
      <nav className="site-nav" aria-label="主导航">
        <a className="brand" href="#top" aria-label="LinkX 首页">
          <span className="brand-mark" aria-hidden="true">
            <i />
            <i />
          </span>
          <span>LinkX</span>
        </a>
        <div className={`nav-links ${menuOpen ? "is-open" : ""}`}>
          <a href="#experience" onClick={() => setMenuOpen(false)}>
            产品体验
          </a>
          <a href="#network" onClick={() => setMenuOpen(false)}>
            社区网络
          </a>
          <a href="#vision" onClick={() => setMenuOpen(false)}>
            关于 LinkX
          </a>
        </div>
        <a className="nav-cta" href="#experience">
          <span>进入体验</span>
          <span aria-hidden="true">↗</span>
        </a>
        <button
          className="menu-toggle"
          type="button"
          aria-label={menuOpen ? "关闭菜单" : "打开菜单"}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((value) => !value)}
        >
          <span />
          <span />
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
            <span>把生活</span>
            <span className="outline-line">连成网络<span className="accent-dot">。</span></span>
          </h1>
          <div className="hero-bottom reveal reveal-three">
            <p>
              LinkX 连接真实的同路人、闲置好物和下一间房。
              <br />
              一个平台，承接留学生活里每一个重要坐标。
            </p>
            <a className="primary-button" href="#experience">
              <span>探索 LinkX</span>
              <span className="button-arrow" aria-hidden="true">↓</span>
            </a>
          </div>
        </div>

        <div className="hero-orbit reveal reveal-four" aria-label="LinkX 服务概览">
          <div className="orbit-ring orbit-ring-a" />
          <div className="orbit-ring orbit-ring-b" />
          <div className="hero-device">
            <div className="device-head">
              <span className="device-logo">LX</span>
              <span className="device-status">ONLINE</span>
            </div>
            <div className="device-statement">
              <span>YOUR CAMPUS</span>
              <strong>CONNECTED.</strong>
            </div>
            <div className="mini-services">
              {products.map((product) => (
                <div className="mini-service" key={product.key}>
                  <img src={product.icon} alt="" />
                  <span>{product.name}</span>
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

        <div className="scroll-cue" aria-hidden="true">
          <span>SCROLL TO CONNECT</span>
          <i />
        </div>
      </section>

      <div className="signal-strip" aria-hidden="true">
        <div className="signal-track">
          <span>RIDE TOGETHER</span><i>✦</i>
          <span>REUSE BETTER</span><i>✦</i>
          <span>LIVE CLOSER</span><i>✦</i>
          <span>RIDE TOGETHER</span><i>✦</i>
          <span>REUSE BETTER</span><i>✦</i>
          <span>LIVE CLOSER</span><i>✦</i>
        </div>
      </div>

      <section id="network" className="metrics section-shell">
        <div className="section-label">
          <span>00 / NETWORK STATUS</span>
          <span className="label-line" />
          <span>ACTIVE</span>
        </div>
        <div className="metric-grid">
          <article className="metric-card metric-main">
            <div className="metric-top">
              <span>拼车累计服务</span>
              <span className="metric-status"><i /> VERIFIED</span>
            </div>
            <strong className="metric-number">10K<span>−</span></strong>
            <p>近 10,000 人次，真实社区持续连接中。</p>
          </article>
          <article className="metric-card metric-location">
            <div className="location-crosshair" aria-hidden="true"><i /><i /></div>
            <span className="metric-eyebrow">RIDE COVERAGE</span>
            <strong>NY ↔ NJ</strong>
            <p>专注纽约与新泽西的学生出行。</p>
          </article>
          <article className="metric-card metric-loop">
            <div className="loop-symbol" aria-hidden="true">∞</div>
            <span className="metric-eyebrow">MARKETPLACE</span>
            <strong>全国社区</strong>
            <p>二手与转租信息，跨区域持续流动。</p>
          </article>
        </div>
      </section>

      <section id="experience" className="product-section" style={activeStyle}>
        <div className="section-shell">
          <div className="section-label light-label">
            <span>01—03 / PRODUCT SYSTEM</span>
            <span className="label-line" />
            <span>INTERACTIVE DEMO</span>
          </div>
          <div className="product-intro">
            <h2>
              一个入口，
              <br />
              <span>三种连接。</span>
            </h2>
            <p>点选功能，查看 LinkX 如何让城市里的留学生活彼此相连。</p>
          </div>

          <div className="product-console">
            <div className="product-tabs" role="tablist" aria-label="LinkX 功能">
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
                  <strong>{product.name}</strong>
                  <small>{product.eyebrow}</small>
                  <i aria-hidden="true">↗</i>
                </button>
              ))}
            </div>

            <div className="product-stage" aria-live="polite">
              <div className="stage-copy" key={`${active.key}-copy`}>
                <span className="stage-eyebrow">{active.eyebrow}</span>
                <h3>{active.title}</h3>
                <p>{active.description}</p>
                <div className="stage-note"><span />{active.note}</div>
              </div>
              <div className="phone-wrap" key={`${active.key}-screen`}>
                <div className="phone-glow" aria-hidden="true" />
                <div className="phone-shell">
                  <div className="phone-sensor" />
                  <ProductScreen type={active.screen} />
                  <div className="phone-homebar" />
                </div>
                <span className="phone-index">{active.index}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="vision" className="vision section-shell">
        <div className="section-label">
          <span>04 / WHY LINKX</span>
          <span className="label-line" />
          <span>COMMUNITY OS</span>
        </div>
        <div className="vision-heading">
          <p>不只是信息列表。</p>
          <h2>我们在做一张<span>生活关系网。</span></h2>
        </div>
        <div className="vision-grid">
          <article className="vision-card vision-card-dark">
            <span className="vision-index">A / 01</span>
            <div className="node-visual" aria-hidden="true">
              <span className="node node-a" />
              <span className="node node-b" />
              <span className="node node-c" />
              <i className="node-line line-one" />
              <i className="node-line line-two" />
              <i className="node-line line-three" />
            </div>
            <h3>真实的人</h3>
            <p>从同学之间出发，让每条信息都更接近真实需求。</p>
          </article>
          <article className="vision-card vision-card-mint">
            <span className="vision-index">B / 02</span>
            <div className="radar-visual" aria-hidden="true">
              <i /><i /><i />
              <span />
            </div>
            <h3>真实的距离</h3>
            <p>位置和区域不是标签，而是连接与行动的起点。</p>
          </article>
          <article className="vision-card vision-card-light">
            <span className="vision-index">C / 03</span>
            <div className="flow-visual" aria-hidden="true">
              <span>RIDE</span><i>→</i><span>LIVE</span><i>→</i><span>REUSE</span>
            </div>
            <h3>持续的循环</h3>
            <p>一次拼车、一件闲置、一间转租，都能成为下一次连接。</p>
          </article>
        </div>
      </section>

      <section className="final-cta">
        <div className="cta-grid" aria-hidden="true" />
        <div className="cta-orb" aria-hidden="true" />
        <span className="cta-eyebrow">THE NEXT CONNECTION STARTS HERE</span>
        <h2>城市很大，<br />但我们可以<span>更近。</span></h2>
        <a href="#top" className="cta-button">
          <span>体验 LinkX</span>
          <i aria-hidden="true">↗</i>
        </a>
      </section>

      <footer>
        <a className="brand footer-brand" href="#top">
          <span className="brand-mark" aria-hidden="true"><i /><i /></span>
          <span>LinkX</span>
        </a>
        <p>连接纽约留学生活的每一个坐标。</p>
        <div className="footer-meta">
          <span>NEW YORK / NEW JERSEY</span>
          <span>© 2026 LINKX</span>
        </div>
      </footer>
    </main>
  );
}
