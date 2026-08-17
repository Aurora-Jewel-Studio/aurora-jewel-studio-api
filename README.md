# Aurora Jewel Studio — Backend API

The custom backend API service for **Aurora Jewel Studio**, powering product management, orders, customer contact, bespoke requests, payment processing, and admin analytics. Built with Node.js, Express, TypeScript, and PostgreSQL, deployed as a serverless API on Vercel.

---

## ✨ Features

- **Inventory CRUD**: REST endpoints for managing luxury products, variants, features, options, and weights.
- **Order Engine**: Receives storefront cart payloads and persists order records.
- **Domestic Payments**: Khalti and eSewa payment initiation and lookup verification.
- **Bespoke Intake**: Logs custom requests (B2B, Retail, Custom, Other) with base64 drawing attachments.
- **Analytics Aggregator**: Generates summary statistics (total revenues, order counts, bespoke volume) for the admin dashboard.
- **Multi-Currency rates**: Integrated caching exchange-rate utility converting USD catalogs to NPR and other currencies.
- **JWT Authorization**: Protects sensitive catalog, analytics, and request tables from unauthorized access.
- **Aura Chat**: Retrieves small, relevant knowledge chunks and verified catalog records before calling local Gemma through Ollama.

---

## 🚀 Tech Stack

- **Runtime:** Node.js + Express
- **Language:** TypeScript
- **Database:** PostgreSQL (via `pg` node-postgres pool)
- **Authentication:** jsonwebtoken (JWT)
- **Deployment:** Vercel Serverless Functions (`@vercel/node`)
- **Utility Libraries:** `helmet` (HTTP headers), `cors` (origin matching), `multer` (local file uploads)

---

## 📁 Project Structure

- `/src/index.ts`: Application entry point setting up middleware, routes, and local server configurations.
- `/src/db.ts`: Serverless-safe connection pooling and idempotent schema initialization.
- `/src/seed.ts`: Catalog seeding script containing sample luxury product details.
- `/src/middleware/auth.ts`: JWT checks validating requests to admin-only API routes.
- `/src/routes/`:
  - `admin-auth.ts`: Signs and checks admin credentials.
  - `analytics.ts`: Counts stats and sums revenue totals.
  - `products.ts`: Core catalog endpoints.
  - `orders.ts`: Logs customer checkout orders.
  - `payments.ts`: Payment verification routines.
  - `bespoke.ts`: Logs custom jewelry specifications and references.
  - `contact.ts`: Logs customer support emails.
  - `exchange-rates.ts`: Converts currency valuations.

---

## 🛠️ Getting Started

### Prerequisites
- Node.js 20+
- PostgreSQL instance running (or Docker installed)
- [Ollama](https://ollama.com/) with `gemma3:4b` for local chat development

### Setup & Installation

1. Install dependencies:
   ```bash
   cd backend-api
   npm install
   ```

2. Copy `.env.example` to `.env` and replace every placeholder. Use a random
   `ADMIN_JWT_SECRET` of at least 32 characters and a unique admin password.

3. Spin up PostgreSQL database container:
   ```bash
   docker-compose up -d
   ```

4. Initialize or update the schema explicitly (this is not run during Vercel cold starts):
   ```bash
   npm run db:init
   ```

5. After removing every placeholder from the catalog, seed products if needed:
   ```bash
   npm run seed
   ```

6. Launch the local API server:
   ```bash
   npm run dev
   ```
   The API will be available at `http://localhost:4000`.

7. Add `GEMINI_API_KEY` for Aura's primary provider. For the local fallback, run:
   ```bash
   ollama pull gemma3:4b
   ollama serve
   ```
   `POST /api/chat` uses `GEMINI_MODEL` first, then falls back to `CHAT_MODEL` through
   `OLLAMA_BASE_URL` whenever Gemini is unavailable or limited. The knowledge snapshot in
   `knowledge/` is split and ranked locally; no knowledge files or model instructions
   are sent to the browser.

---

## 🌐 Serverless Deployment on Vercel

The backend compiles into serverless route blocks. Vercel maps files dynamically via [vercel.json](vercel.json):
*   **Database:** Provision a serverless Postgres DB in the Vercel dashboard.
*   **Environment:** Set variables in Project Settings.
*   **Allowed Origins:** Production includes `aurorajewelstudio.com` and its `www` host. Add the exact Vercel storefront URL to `ALLOWED_ORIGINS` for owner previews.
*   **Uploads:** Local disk uploads are disabled on Vercel; configure persistent object storage before enabling admin uploads in production.

### Chat production

Set `GEMINI_API_KEY` and `GEMINI_MODEL` in Vercel. Gemini is the primary provider. Local
Gemma remains the development fallback; Vercel cannot reach Ollama running on a developer
Mac, so a Gemini outage in production returns the existing chat-unavailable response.
