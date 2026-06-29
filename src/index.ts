import express from "express";
import cors from "cors";
import helmet from "helmet";
import dotenv from "dotenv";
import rateLimit from "express-rate-limit";

import bespokeRoutes from "./routes/bespoke";
import contactRoutes from "./routes/contact";
import orderRoutes from "./routes/orders";
import paymentRoutes, { handleStripeWebhook } from "./routes/payments";
import adminAuthRoutes from "./routes/admin-auth";
import productRoutes from "./routes/products";
import analyticsRoutes from "./routes/analytics";
import uploadRoutes from "./routes/uploads";
import exchangeRatesRoutes from "./routes/exchange-rates";
import { initDatabase } from "./db";
import path from "path";

dotenv.config();
dotenv.config({ path: ".env.local", override: true });

const app = express();
app.set("trust proxy", 1);
const databaseReady = initDatabase().catch((error) => {
  console.error("Database initialization failed:", error);
  throw error;
});

// --- Middleware ---
app.use(helmet());
app.post(
  "/api/payments/stripe/webhook",
  express.raw({ type: "application/json" }),
  handleStripeWebhook
);
app.use(express.json({ limit: "1mb" }));

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
});

const publicWriteLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
});

const allowedOrigins = (process.env.ALLOWED_ORIGINS || "http://localhost:3000")
  .split(",")
  .map((o) => o.trim());

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (Postman, server-to-server)
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
  })
);

app.use("/api", async (_req, res, next) => {
  try {
    await databaseReady;
    next();
  } catch (error) {
    console.error("Database initialization failed:", error);
    res.status(500).json({ error: "Database is not ready." });
  }
});

// --- Routes ---
app.use("/api/admin/login", authLimiter);
app.use(["/api/bespoke", "/api/contact", "/api/orders", "/api/payments"], publicWriteLimiter);
app.use("/api/bespoke", bespokeRoutes);
app.use("/api/contact", contactRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/admin", adminAuthRoutes);
app.use("/api/products", productRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/uploads", uploadRoutes);
app.use("/api/exchange-rates", exchangeRatesRoutes);

// Serve static files from the public directory
app.use("/uploads", express.static(path.join(__dirname, "../public/uploads")));

// Health check
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// --- Local dev server ---
if (process.env.NODE_ENV !== "production") {
  const PORT = process.env.PORT || 4000;
  app.listen(PORT, () => {
    console.log(`🚀 Aurora API running on http://localhost:${PORT}`);
  });
}

export default app;
