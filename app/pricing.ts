import type { Locale } from "./site-content";
export const MINI_PROGRAM_SHARE = "#小程序://极链行服务/VGD7QITnczTep0F";
export const PRICE_AS_OF = "2026-09-10T21:31:52-04:00";
export const PLACES = {
  fortLee: { zh: "Fort Lee", en: "Fort Lee" },
  columbia: { zh: "哥伦比亚大学", en: "Columbia University" },
  flushing: { zh: "法拉盛", en: "Flushing" },
} as const;
export type Place = keyof typeof PLACES;
export type RoutePrice = {
  id: string;
  from: Place;
  to: Place;
  min: number;
  max: number;
  validUntil: string;
  image: string;
  imageAlt: Record<Locale, string>;
  tag: Record<Locale, string>;
};
// Aggregate reference values checked against driver listings on 2026-09-10.
// They are per-seat USD prices, never a guarantee of availability or a booking.
export const ROUTE_PRICES: RoutePrice[] = [
  {
    id: "fortlee-columbia",
    from: "fortLee",
    to: "columbia",
    min: 8,
    max: 10,
    validUntil: "2026-09-19T00:00:00-04:00",
    image: "/columbia.jpg",
    imageAlt: { zh: "哥伦比亚大学校园", en: "Columbia University campus" },
    tag: { zh: "校园通勤", en: "Campus commute" },
  },
  {
    id: "columbia-fortlee",
    from: "columbia",
    to: "fortLee",
    min: 8,
    max: 10,
    validUntil: "2026-09-18T00:00:00-04:00",
    image: "/bridge.jpg",
    imageAlt: {
      zh: "连接Fort Lee与纽约的乔治·华盛顿大桥",
      en: "George Washington Bridge between Fort Lee and New York",
    },
    tag: { zh: "回家顺路", en: "Heading home" },
  },
  {
    id: "fortlee-flushing",
    from: "fortLee",
    to: "flushing",
    min: 10,
    max: 15,
    validUntil: "2026-09-18T00:00:00-04:00",
    image: "/flushing.jpg",
    imageAlt: { zh: "纽约法拉盛街景", en: "Flushing, New York" },
    tag: { zh: "城市出行", en: "Across the city" },
  },
];
export function filterRoutes(from: string, to: string) {
  return ROUTE_PRICES.filter(
    (route) => (!from || route.from === from) && (!to || route.to === to),
  );
}
export function referencePrice(route: RoutePrice, now: number | null) {
  return now !== null && now < Date.parse(route.validUntil) ? route.min : null;
}
export function routeLabel(route: RoutePrice, locale: Locale) {
  return `${PLACES[route.from][locale]} → ${PLACES[route.to][locale]}`;
}
