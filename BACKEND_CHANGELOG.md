# Backend Changelog

## 2026-07-14 audit and hardening

### Security

- Added centralized Zod validation for public, admin, product, order, and payment inputs.
- Restricted production CORS to the Aurora Jewel Studio apex and `www` HTTPS origins.
- Added clean CORS, malformed JSON, payload-too-large, rate-limit, not-found, and internal-error responses.
- Pinned admin JWT algorithm/issuer/audience/account and reduced expiry to eight hours.
- Added form honeypots and tightened body, image, phone, email, slug, pagination, money, and state limits.
- Removed raw upstream error bodies and PII-heavy logs.
- Replaced HTML/spreadsheet enquiry email with plain text and an environment-configured recipient.
- Removed vulnerable `xlsx`; added Zod. `npm audit` now reports zero vulnerabilities.
- Disabled ephemeral production uploads until persistent object storage is configured.
- Removed hardcoded exchange-rate fallbacks.

### Payments

- Added network timeouts and idempotent mark-paid updates.
- Payment initiation now uses stored order/customer data and rejects already-paid orders.
- Kept Stripe, PayPal, and Khalti amount/currency/id verification while removing provider error leakage.
- Replaced legacy eSewa logic with HMAC-SHA256 ePay v2 initiation and server-to-server status verification.

### Database

- Reused one module-scoped pool with a five-connection cap and TLS `verify-full` normalization.
- Removed schema DDL from Vercel cold starts; added explicit `npm run db:init`.
- Added optional company/country/buyer/quantity fields for global B2B enquiries.
- Added category, created-at, payment-status, and product full-text indexes.
- Made seed replacement transactional, blocked placeholder data, and removed credential output.

### Performance and SEO/API support

- Cart pricing now queries only referenced products and rejects duplicate variants.
- Added product full-text search, category filtering, opt-in pagination, stable slug/category aliases, and image-alt fallback.
- Added cache headers for catalog and exchange-rate reads, no-store private responses, and development-only request timing.
- Added upstream timeouts and a safe database-independent health response.

### Compatibility notes

- Storefront files were not changed. Legacy response keys remain available.
- The default product list remains unpaginated because static export currently requests all handles/products; pagination is opt-in.
- eSewa form fields now follow ePay v2. No current storefront caller was found.
- Exchange rates return 503 instead of invented fallback values when no real or stale data exists.
- Production uploads return 503 rather than returning an ephemeral URL that will disappear.
- Run `npm run db:init` before deploying the new B2B request fields.

### Verification completed

- `npm test`: passed (TypeScript build plus 3 Node security/payment tests).
- `npm audit --json`: zero vulnerabilities.
- Read-only database metadata check: connected; four expected tables; hardening indexes/columns still pending rollout.
- Local production-mode HTTP checks: health 200, allowed CORS preflight 204, blocked origins 403, invalid form/duplicate query 400, oversized JSON 413, and live-database paginated product search 200.

### Remaining manual work

- Rotate the weak local and Vercel admin JWT secret/password.
- Back up the database and run `npm run db:init` against each intended environment.
- Configure distributed Vercel WAF limits and persistent object storage if uploads are required.
- Add opaque checkout tokens with a coordinated storefront update.
- Define legal PII retention/deletion and database backup/PITR policy.
- Complete sandbox/live provider acceptance tests and Stripe webhook verification.
- Add newsletter storage/API only when consent language, retention, and a real storefront flow exist.
