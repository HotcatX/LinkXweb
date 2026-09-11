import test from "node:test";
import assert from "node:assert/strict";
import { readFile, access, stat } from "node:fs/promises";
import { resolve, join } from "node:path";
const root = resolve(import.meta.dirname, "../dist-cloudbase");
const html = await readFile(join(root, "index.html"), "utf8");
test("public static page is prerendered with real app handoff and no public admin navigation", () => {
  assert.match(html, /<main id="main"/);
  assert.match(html, /极链行服务/);
  assert.match(html, /寻找拼车/);
  assert.match(html, /<details>/);
  assert.doesNotMatch(html, /<!--app-html-->|10,000|VERIFIED|10K/);
  assert.doesNotMatch(
    html,
    /(?:href|action)="[^\"]*(?:admin|signin-with-chatgpt)/,
  );
});
test("all public entry assets and independent admin assets exist at deployable paths", async () => {
  for (const match of html.matchAll(/(?:src|href)="(\/[^"#]+)"/g))
    await access(join(root, match[1]));
  const admin = await readFile(join(root, "admin/index.html"), "utf8");
  assert.match(admin, /noindex,nofollow/);
  for (const match of admin.matchAll(/(?:src|href)="(\.\/[^"#]+)"/g))
    await access(join(root, "admin", match[1]));
  const config = await readFile(join(root, "admin/admin-config.js"), "utf8");
  assert.match(config, /https:\/\/.+\/admin-api/);
  assert.ok((await stat(join(root, "bridge.jpg"))).size > 100000);
});
test("day and night theme entry is independent of authentication and uses remembered preference", async () => {
  const theme = await readFile(join(root, "theme.js"), "utf8");
  assert.match(theme, /linkx-theme/);
  const cssFile = [...html.matchAll(/href="(\/assets\/[^\"]+\.css)"/g)][0]?.[1];
  const css = await readFile(join(root, cssFile), "utf8");
  assert.match(css, /data-theme=dark/);
  assert.match(css, /prefers-reduced-motion/);
  const jsFile = [...html.matchAll(/src="(\/assets\/[^\"]+\.js)"/g)][0]?.[1];
  const js = await readFile(join(root, jsFile), "utf8");
  assert.match(js, /clipboard.writeText/);
  assert.match(js, /showModal/);
  assert.doesNotMatch(
    html,
    /HC5X|passwordDigest|passwordVersion|Bearer [a-f0-9]{64}/,
  );
});
