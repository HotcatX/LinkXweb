import test from "node:test";
import assert from "node:assert/strict";
import {
  MINI_PROGRAM_SHARE,
  PRICE_AS_OF,
  ROUTE_PRICES,
  filterRoutes,
  referencePrice,
  render,
} from "../.static-ssr/render.js";

test("direction filters do not mix reverse routes or invent unavailable combinations", () => {
  assert.equal(filterRoutes("", "").length, 3);
  assert.deepEqual(
    filterRoutes("fortLee", "").map((r) => r.to),
    ["columbia", "flushing"],
  );
  assert.deepEqual(
    filterRoutes("columbia", "fortLee").map((r) => r.id),
    ["columbia-fortlee"],
  );
  assert.equal(filterRoutes("flushing", "columbia").length, 0);
});
test("reference prices require a known client time and stop at expiry", () => {
  assert.deepEqual(
    ROUTE_PRICES.map((r) => referencePrice(r, Date.parse(PRICE_AS_OF))),
    [8, 8, 10],
  );
  for (const route of ROUTE_PRICES) {
    assert.equal(referencePrice(route, null), null);
    assert.equal(
      referencePrice(route, Date.parse(route.validUntil) - 1),
      route.min,
    );
    assert.equal(referencePrice(route, Date.parse(route.validUntil)), null);
    assert.equal(
      referencePrice(route, Date.parse(route.validUntil) + 86400000),
      null,
    );
  }
  assert.doesNotMatch(render(), /class="fare"/);
});
test("the WeChat share string is preserved exactly, and is never a browser navigation target", () => {
  assert.equal(MINI_PROGRAM_SHARE, "#小程序://极链行服务/VGD7QITnczTep0F");
  assert.doesNotMatch(render(), /href="#小程序:/);
});
