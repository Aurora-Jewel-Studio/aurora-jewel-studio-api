# Backend Security

## Implemented controls

- Secrets are read only from server environment variables. `.env` and `.env.local` remain ignored; `.env.example` contains placeholders only.
- Production CORS accepts only the apex and `www` Aurora Jewel Studio HTTPS origins. Non-browser/server-to-server requests remain possible because CORS is not authentication.
- Zod validates and normalizes every processed body, query, and path field, including lengths, formats, enum states, pagination, slugs, money, quantities, phones, emails, and image data URLs.
- PostgreSQL values use `$1` parameters. Product search uses `websearch_to_tsquery` with a parameter and a matching GIN index.
- User content is stored as plain text and rendered by the frontend's normal escaping. SMTP notifications are plain text, use a fixed subject, and never interpolate user data into HTML or headers.
- JSON is capped at 2 MB; reference images are limited to 1 MB decoded and JPEG, PNG, or WebP. Multipart uploads are capped at 5 MB and disabled in production.
- Helmet security headers, strict production CORS, route-specific rate limits, safe 404/error handling, and development-only metadata timing logs are enabled.
- Admin JWTs require a 32-character secret and pin HS256, issuer, audience, account email, and eight-hour expiry.
- Payment providers are called with timeouts. Provider responses must match the stored order amount, currency, id, and status. Mark-paid updates are idempotent.
- eSewa uses its current HMAC-SHA256 ePay v2 form and verifies through the official status endpoint.
- `xlsx` was removed. The current npm audit reports zero known vulnerabilities.
- The seed script refuses placeholder product data, does not print credentials, and replaces products inside one transaction.

## Rate limiting on Vercel

`express-rate-limit` is useful per warm instance but its memory store is not a global serverless limit. Keep it as defense in depth and add Vercel WAF rules for production-wide enforcement:

| Path/method | Suggested distributed ceiling |
| --- | --- |
| `POST /api/admin/login` | 5 per 15 minutes per IP |
| `POST /api/contact`, `POST /api/bespoke` | 10 per 15 minutes per IP |
| `POST /api/orders` | 20 per 15 minutes per IP |
| `POST /api/payments/*` | 30 per 15 minutes per IP; exclude the signed Stripe webhook if necessary |
| `GET /api/products*`, `GET /api/exchange-rates` | 60 per minute per IP |

Use log mode first, confirm legitimate traffic, then deny or challenge. Vercel provides platform DDoS protection on all plans; rate-limiting availability/cost depends on plan.

## Required manual checks

- [ ] Replace the current weak admin JWT secret and admin password locally and in every Vercel environment. Redeploy after changing Vercel variables.
- [ ] Confirm `POSTGRES_URL` uses TLS with `sslmode=verify-full`; never log or paste the URL.
- [ ] Back up the database, run `npm run db:init`, and confirm all new indexes and B2B columns exist.
- [ ] Verify the Stripe webhook secret using a real signed sandbox event.
- [ ] Exercise PayPal, Khalti, and eSewa sandbox success, cancel, duplicate, amount-mismatch, and timeout paths before enabling live mode.
- [ ] Confirm the SMTP sender is authorized and `ENQUIRY_NOTIFICATION_EMAIL` is the intended business mailbox.
- [ ] Choose persistent object storage before enabling production uploads. Do not rely on the Vercel function filesystem.
- [ ] Add an opaque, random checkout token before exposing payment initiation to higher traffic; numeric order ids alone are enumerable.
- [ ] Review the frontend's `localStorage` admin token design as part of a separate storefront/XSS audit.
- [ ] Configure alerts for repeated 401, 403, 413, 429, payment verification failures, and database pool errors without logging request bodies.

## PII, retention, and backups

The database stores customer names, emails, phones, addresses, enquiry text, and sometimes a reference image. It should not collect more fields until there is a defined purpose and consent text.

Set a written retention schedule with the business's legal/accounting adviser. At minimum, distinguish statutory order records from leads and contact messages; delete or anonymize expired lead/message data and old reference images. No automatic deletion was added because the applicable legal retention period has not been supplied.

Identify the actual Postgres Marketplace provider in Vercel Storage. Enable its automated backups or point-in-time recovery, keep periodic encrypted `pg_dump --format=custom --no-owner` exports in a separate access-controlled location, and test a restore at least periodically. Never place dumps in this repository.

## Source guidance

- [OWASP Node.js security](https://cheatsheetseries.owasp.org/cheatsheets/Nodejs_Security_Cheat_Sheet.html)
- [OWASP input validation](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html)
- [Express security best practices](https://expressjs.com/en/advanced/best-practice-security.html)
- [Vercel Firewall](https://vercel.com/docs/vercel-firewall)
- [Vercel rate-limiting SDK](https://vercel.com/docs/vercel-firewall/vercel-waf/rate-limiting-sdk)
- [Vercel Marketplace storage](https://vercel.com/docs/marketplace-storage)
