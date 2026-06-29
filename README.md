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
- `/src/db.ts`: Connection pooling and automatic database schema migration.
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

### Setup & Installation

1. Install dependencies:
   ```bash
   cd backend-api
   npm install
   ```

2. Configure environment variables in `.env` (refer to `credential.md` in the root workspace):
   ```env
   POSTGRES_URL=postgres://user:password@localhost:5432/aurora_jewel_db
   ADMIN_JWT_SECRET=your_secret_key
   ADMIN_EMAIL=admin@aurorajewelstudio.com
   ADMIN_PASSWORD=aurora123
   ALLOWED_ORIGINS=http://localhost:3000
   ```

3. Spin up PostgreSQL database container:
   ```bash
   docker-compose up -d
   ```

4. Seed the database with sample products and collections:
   ```bash
   npm run seed
   ```

5. Launch the local API server:
   ```bash
   npm run dev
   ```
   The API will be available at `http://localhost:4000`.

---

## 🌐 Serverless Deployment on Vercel

The backend compiles into serverless route blocks. Vercel maps files dynamically via [vercel.json](vercel.json):
*   **Database:** Provision a serverless Postgres DB in the Vercel dashboard.
*   **Environment:** Set variables in Project Settings.
*   **Allowed Origins:** Update `ALLOWED_ORIGINS` to include your production Hostinger domain.
