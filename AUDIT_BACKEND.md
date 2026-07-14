# Backend Audit

Audited 2026-07-14. Scope was limited to `backend-api`; storefront code was read only to preserve existing API contracts.

## Architecture

- One Express 5 application is deployed as a Vercel Node.js function through `src/index.ts` and `vercel.json`.
- PostgreSQL access uses one module-scoped `pg.Pool`, capped at five connections per warm function instance.
- Routes contain request handling and SQL directly; there are no separate controller/model layers.
- Admin authentication is a single environment-configured account with an eight-hour HS256 bearer JWT.
- External systems are SMTP, Stripe, PayPal, Khalti, eSewa, and `open.er-api.com` for exchange rates.
- Product images are normally frontend assets. The local admin upload endpoint uses disk and is intentionally unavailable in production because Vercel function storage is ephemeral.
- Full endpoint details and examples are in [API_ENDPOINTS.md](API_ENDPOINTS.md).

## Database

The connected database was inspected read-only. It contains four tables and no newsletter, user, session, collection, or migration-history table.

| Table | Data | Main access paths |
| --- | --- | --- |
| `products` | Catalog, prices, JSON images/options/variants/features | handle, category, full-text search, newest first |
| `orders` | Cart snapshot, customer/shipping PII, totals, payment/order state | id, payment state, newest first |
| `bespoke_requests` | Enquiry contact details, message, optional base64 reference image | id, status, newest first |
| `contact_messages` | Contact form PII and message | id, unread state, newest first |

The live schema currently has only primary keys plus the unique product-handle index. `npm run db:init` adds the optional B2B enquiry columns and the audited category, created-at, payment-status, and full-text search indexes. It must be run before deploying code that accepts the new B2B fields.

## Findings

| Priority | Finding | Status |
| --- | --- | --- |
| Critical | Current local `ADMIN_JWT_SECRET` is shorter than 32 characters. | Manual rotation required locally and in Vercel. The application now refuses to issue/verify admin tokens with a weak secret. |
| High | Current local admin password is shorter than 12 characters. | Manual rotation required; login is rate-limited and compared in constant time. |
| High | eSewa mixed an old production form with a UAT verifier and lacked ePay v2 HMAC signing. | Replaced with signed ePay v2 initiation and server-to-server status verification. |
| High | `xlsx` had two high-severity advisories and no npm registry fix. | Dependency and spreadsheet attachment removed; `npm audit` is clean. |
| High | Runtime DDL executed during every cold start and initialization errors were swallowed. | Removed from request startup; schema initialization is explicit and fails closed. |
| High | Form, admin, product, order, and payment inputs were only partially validated. | Central Zod schemas now constrain body, query, and path inputs. |
| High | Numeric order IDs can be enumerated by public payment-initiation routes. | Remaining. Fix requires an opaque checkout token and coordinated storefront contract change. |
| Medium | In-process rate limits reset per Vercel instance and do not provide a global quota. | Per-instance limits retained as free defense in depth. Configure Vercel WAF rate limits for distributed enforcement. |
| Medium | Production uploads wrote to ephemeral/read-only function storage. | Production endpoint now returns 503. Persistent object storage remains a deployment decision. |
| Medium | Public product lists and admin lists were unbounded. | Product search supports opt-in pagination capped at 100. Unpaginated default is retained for static-export compatibility; admin list pagination needs a storefront change. |
| Medium | Order pricing loaded the entire product table. | Query now fetches only cart product handles and rejects duplicate variants. |
| Medium | Exchange rates could silently fall back to fabricated, stale constants. | Removed. A real stale cache is allowed; otherwise the endpoint returns 503. |
| Medium | SMTP email embedded user input in HTML and attached generated spreadsheets. | Notification is plain text with a fixed subject and no attachment. Recipient is environment-configured. |
| Medium | Upstream payment errors and raw error objects could reach responses/logs. | Public errors are generic; logs record only a context and error message. |
| Medium | Public write body limit conflicted with the documented one-megabyte image allowance. | JSON is capped at 2 MB and reference images are independently restricted to JPEG/PNG/WebP and 1 MB decoded. |
| Low | Product APIs lacked explicit slug/category aliases and image-alt fallbacks. | Additive `slug`, `category`, and image `alt` fields added without removing legacy fields. |
| Low | Newsletter is mentioned as a business flow but has no route, table, or storefront caller. | Not invented. Add only with a consent text, retention policy, and frontend integration. |

## Security and validation coverage

- All SQL values remain parameterized. The only dynamic SQL fragments are fixed, server-owned column/filter names.
- CORS production origins are exactly `https://aurorajewelstudio.com` and `https://www.aurorajewelstudio.com`; localhost is development-only.
- Helmet, request-size limits, clean 400/403/413/429/500 handlers, no-store private responses, and a safe health endpoint are active.
- Public forms include a free honeypot field named `website`.
- Admin routes remain protected; JWT algorithm, issuer, audience, account, and expiry are pinned.
- Client-supplied cart prices/totals are discarded and recalculated from database product data.
- Payment capture verifies order id, amount, currency, provider status, and provider reference before marking paid.

## Performance and reliability

- Public catalog responses cache for five minutes with stale revalidation; exchange rates use CDN and warm-instance caching.
- Payment and exchange-rate network calls abort after 10 seconds and 5 seconds respectively.
- Development-only request timing records method, path, status, and duration without bodies or query values.
- Compression was not added: Vercel handles response compression at the platform layer.
- Database and function regions should be colocated; verify this in the Vercel and database-provider dashboards.

## Deployment risks and order

1. Take a provider snapshot or `pg_dump` before schema changes.
2. Rotate admin credentials in Development, Preview, and Production environments.
3. Run `npm run db:init` against the intended database and verify the new columns/indexes.
4. Deploy the backend, then test production CORS and payment sandboxes.
5. Configure a Vercel WAF distributed rate limit if the plan supports it.
6. Keep production admin uploads disabled until persistent object storage is selected.

Vercel Postgres itself was retired and existing databases were moved to external Marketplace providers, so backups/PITR must be configured in the actual provider dashboard. Also keep encrypted, access-controlled `pg_dump --format=custom --no-owner` exports and test restoration periodically.

## References

- [OWASP Node.js Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Nodejs_Security_Cheat_Sheet.html)
- [OWASP REST Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/REST_Security_Cheat_Sheet.html)
- [Express production security guidance](https://expressjs.com/en/advanced/best-practice-security.html)
- [node-postgres parameterized queries](https://node-postgres.com/features/queries)
- [Vercel environment variables](https://vercel.com/docs/environment-variables)
- [Vercel Postgres and Marketplace storage](https://vercel.com/docs/postgres)
- [eSewa ePay v2 documentation](https://developer.esewa.com.np/pages/Epay)
