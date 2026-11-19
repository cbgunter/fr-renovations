# CLAUDE.md

First Responder Renovations: a public single-page site plus an admin suite (Today, Leads, Estimator, Calendar, Settings) for a small general contractor in Downers Grove, IL. About 15 customers a month; the whole thing must stay under $5/month on AWS.

**Read `BRAND.md` before touching any UI.** `brand-reference.html` is the reference implementation; `web/src/styles/brand.css` is a verbatim copy of its tokens and components. The admin user is not technical: one obvious primary action per screen, plain labels, 44px+ targets, status always shown with a word.

## Commands

```bash
npm install                 # all workspaces
npm test                    # shared (pricing/format) + backend (API) tests, no AWS needed
npm run typecheck
npm run dev:api             # local API on :3001, in-memory store, emails printed to console
npm run dev:web             # Vite on :5173, proxies /api; admin runs with auth disabled
npm run build               # backend bundle (backend/dist) + web (web/dist)
cd infrastructure && npx cdk diff / deploy
scripts/create-admin.sh someone@example.com   # Cognito invite
```

Push to `main` deploys via GitHub Actions (OIDC role `fr-renovations-deploy`, repo variable `AWS_ROLE_ARN`).

## Layout

- `shared/` — types (single source of truth), `pricing.ts` (estimator job definitions + sample rates, pure functions used by web *and* API), `format.ts` (brand formats: money, `8:00 – 9:00a`, `Thu, Nov 19`). All times are America/Chicago wall-clock strings (`YYYY-MM-DDTHH:mm`, `YYYY-MM-DD` for all-day).
- `backend/` — one Lambda. `src/app.ts` is the whole router with injected deps (store, mailer, photos) so tests use in-memory fakes. `index.ts` is the API Gateway adapter, `local.ts` the dev server.
- `web/` — Vite multi-page: `index.html` is the **static, hand-written public page** (SEO; `{{TOKENS}}` filled from `site.config.ts` at build), `app.html` is the React admin + customer estimate page (`/admin/*`, `/e/:id`), `404.html`.
- `infrastructure/` — one CDK stack: S3 + CloudFront (+ rewrite function for `/admin`, `/e/`), HTTP API with Cognito JWT authorizer on `/api/admin/*`, Lambda, DynamoDB single table (`pk`, GSI `byType` on `type`+`sk`), Cognito (Lite), deploy role.

## Things that are easy to get wrong

- The server re-prices every estimate from `shared/pricing.ts` + saved rate overrides; never trust a client total.
- Lead status moves automatically: booking a visit (`new`→`visit`), sending an estimate (→`sent`), customer approval or a job event (→`won`). Deleting a visit moves it back to `new`.
- Website photos live at `photos/<slot>.webp` in the web bucket, uploaded from Settings via presigned PUT. The deploy's `s3 sync --delete` must keep `--exclude "photos/*"`.
- CloudFront maps S3's 403 (missing file) to `/404.html`; the API must never return 403 (use 401/404).
- `web/site.config.ts` holds `[placeholder]` business facts; placeholders are shown on the page but omitted from JSON-LD.
- SMS is deliberately not sent from AWS (10DLC registration + fees break the budget): "Send by text" opens the phone's Messages app via an `sms:` link.
- **Approved exception to BRAND.md "real jobs only":** the owner approved (2026-11-19) labeled CC0 example photos in `web/public/img/examples/` as stand-ins. The page tries `/photos/<slot>.webp` first and falls back to the example with an "Example photo" label; owner uploads always win. Business facts in `web/site.config.ts` stay `[placeholders]` until the owner supplies them.
