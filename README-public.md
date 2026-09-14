# LinkX public website

This is the independent English website for `catx.eu.org`. The existing Tencent-hosted homepage and authenticated admin remain in `app/`, `static/` and `admin/`. Their build and deployment commands are unchanged.

## Current deployment — September 14, 2026

The public Worker is deployed at [linkx-public.hotcat.workers.dev](https://linkx-public.hotcat.workers.dev). `wrangler.public.jsonc` also deploys two zone Worker routes: `catx.eu.org/*` and `www.catx.eu.org/*`. They use the domain's existing proxied DNS records and Cloudflare certificate; this setup does not require deleting those records or creating a Worker Custom Domain binding.

Both domain names still return the previous HTTP 302 redirect to Tencent's test website because that redirect rule runs before the Worker route. The remaining domain step is to disable only that old redirect in Cloudflare. The Worker routes are already installed. After disabling it, verify the homepage and `/api/public` on both names; keep unrelated DNS records and rules unchanged. The `workers.dev` address is available for testing while the redirect remains enabled.

## Build and run

```sh
npm run build:public
npm run check:public
npm run test:public
npm run preview:public
```

The public build includes only `public-site/` and outputs `dist-public/`. It contains no admin application, CloudBase SDK, database credentials, login session or write API. Deploy with `npm run deploy:public`; this uses `wrangler.public.jsonc`, independently of Tencent hosting and the older starter configuration.

Cloudflare Workers Static Assets serves the page and local assets. Only `/api/*` and `/admin*` use Worker-first routing; ordinary static assets avoid an extra Worker invocation. `GET /api/public` is the sole content gateway. A Worker is used with static hosting so a server credential never needs to be shipped to the browser. No Cloudflare database or separate rented server is needed.

`wrangler.public.jsonc` pins `compatibility_date` to `2026-05-22`, supported by the installed runtime. This is a runtime compatibility setting, not the website's publication date. Security headers also live in `public-site/public/_headers` so asset-first responses receive the same protections as Worker responses.

## Public services

- Browse offered rides and ride requests, including public route areas, departure times, prices and seat availability.
- Browse available secondhand items and sublets, with public descriptions and listing photos.
- Open individual listing details and load additional pages.
- Joining, buying, messaging and publishing open a WeChat registration guide. They never modify a record from this website.

Fixed labels and navigation are English. Listing titles and descriptions preserve their author's language. Route and date filters apply to loaded previews; more pages can be loaded when available. The bounded public reader makes at most 100 results available per query. Cached availability is informational; the mini-program performs the real availability and account checks.

The supplied `#小程序://极链行服务/VGD7QITnczTep0F` is a WeChat sharing string, not an HTTPS URL that ordinary browsers can navigate to. The guide lets visitors copy it into WeChat or search for `极链行服务`, then register there.

## Security and request cost

- The browser uses a same-origin GET endpoint. The Worker admits four explicit list/detail operations and bounded parameters; it cannot proxy arbitrary actions, URLs, collections or queries.
- The Worker authenticates to the existing CloudBase `marketApi` function using the `PUBLIC_WEB_API_SECRET` secret. Its fixed upstream URL is `https://cloud1-7gmtcu4s3aebce27-1383643768.ap-shanghai.app.tcloudbase.com/admin-api/public-api`. The existing Tencent gateway strips the `/admin-api` mapping prefix and supplies the internal event path `/public-api`; that exact path is routed to the separate read-only handler. No new Tencent HTTP mapping is required.
- Prefer the function's `PUBLIC_WEB_API_SECRET` environment variable. When the available deployment permission cannot change environment variables, the handler can load a private, server-only `publicWeb.secret.json` containing exactly one `PUBLIC_WEB_API_SECRET` key. Both sides require the same 32–128-character secret using only letters, digits, `_` and `-`. An explicitly configured environment value takes precedence even when invalid, so a stale fallback cannot silently undo revocation. Never put this secret in a `VITE_` variable, Git, public assets, a URL, or client storage.
- The cloud function independently checks the credential, HTTP path, method and strict request fields, then invokes only the existing public projection. It never delegates to normal mini-program or admin actions.
- Public records exclude structured identities, contacts, precise pickup addresses and payment fields. Text is redacted, images are resolved only from approved paths referenced by visible listings, and the Worker validates the response projection again. Photos may contain information voluntarily included by the publisher; this implementation does not perform image-content redaction.
- Existing Tencent `/admin-api` sessions, CSRF/origin checks and database permissions remain intact. The Cloudflare website includes no admin assets; `/admin*` and unknown API paths return 404.
- Successful lists are shared in the edge cache for 120 seconds; details for 60 seconds. Identical concurrent requests in one Worker isolate share an upstream request. Client requests also share a short in-memory cache.
- API requests have a 60-per-minute limit per Cloudflare-observed IP; cache misses share a 30-per-minute upstream budget at each Cloudflare location. These limits are approximate and local to Cloudflare locations, not a guaranteed global billing cap. Shared-network users may share an IP limit. Missing rate-limit bindings or credentials fail closed.
- No visitor account, cookie-based login, analytics tracker, payment, form submission or arbitrary file upload is included. HTTPS, content restrictions, anti-framing and MIME protections are set on responses.

## Deployment order

1. Test the public build and backend tests in the `wx` repository.
2. Deploy `marketApi/index.js`, `publicPreview.js` and `publicWeb.js` together. Preserve all other function files and environment variables. Reuse the existing nested gateway URL above; do not replace or remap `/admin-api`.
3. Set the same `PUBLIC_WEB_API_SECRET` on the function and the Worker. If the cloud function needs the file fallback, stage its deployment copy under the ignored `wx.web/work/linkx-public-deploy/` directory, outside the `wx` mini-program project. Include `publicWeb.secret.json` only in the cloud-function upload, never either website build. Keep the private file accessible only to the local owner, and do not print it in command output.
4. For the Worker, use `wrangler deploy --config wrangler.public.jsonc --secrets-file /absolute/path/to/private-secrets.json`. The file is a JSON mapping containing `PUBLIC_WEB_API_SECRET`; only its path belongs in the command, never the value. This installs a Worker secret with the version rather than publishing a normal configuration variable. Later `npm run deploy:public` runs preserve existing Worker secrets. Local `wrangler dev` needs an ignored `.dev.vars` or private environment setup; it fails closed when the secret is absent.
5. Deploy and verify the Worker on its `workers.dev` address. Confirm real list/detail reads, 401 on direct unauthenticated CloudBase reads, denied write attempts, and unchanged Tencent homepage/admin responses.
6. Keep the existing `catx.eu.org/*` and `www.catx.eu.org/*` zone routes in `wrangler.public.jsonc`. Once the old Tencent redirect is disabled, verify both domain names reach this Worker and return real public previews. Existing proxied DNS records and certificates remain in use; no DNS deletion or separate Custom Domain setup is needed.

To roll back the public site, use the Cloudflare deployment history. Tencent hosting is independent and remains available. To revoke website reads, disable the dedicated `/public-api` dispatch or explicitly set the function's environment secret to an invalid value. If a file fallback was deployed, deleting only the environment variable would reactivate that fallback; remove or replace the fallback too when retiring the credential. Do not disable the parent `/admin-api` mapping, which also serves the retained administrator website.

Cloudflare references: [static assets](https://developers.cloudflare.com/workers/static-assets/), [Worker routes](https://developers.cloudflare.com/workers/configuration/routing/routes/), [rate limit binding](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/).
