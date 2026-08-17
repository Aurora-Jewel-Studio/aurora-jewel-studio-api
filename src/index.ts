import express, { NextFunction, Request, Response } from "express";
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
import chatRoutes from "./routes/chat";
import { logError } from "./validation";
import path from "path";

dotenv.config();
dotenv.config({ path: ".env.local", override: true });

const app = express();
app.disable("x-powered-by");
app.set("trust proxy", 1);

// --- Middleware ---
app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));

const productionOrigins = [
  "https://aurorajewelstudio.com",
  "https://www.aurorajewelstudio.com",
  "https://aurora-jewel-frontend.vercel.app",
];
const configuredOrigins = (process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
const allowedOrigins = new Set(
  [...productionOrigins, "http://localhost:3000", "http://127.0.0.1:3000", ...configuredOrigins]
);

function isOriginAllowed(origin: string): boolean {
  if (allowedOrigins.has(origin)) return true;
  try {
    const url = new URL(origin);
    if (
      url.protocol === "https:" &&
      (url.hostname === "aurorajewelstudio.com" ||
        url.hostname.endsWith(".aurorajewelstudio.com") ||
        url.hostname === "aurora-jewel-frontend.vercel.app" ||
        url.hostname.endsWith(".vercel.app"))
    ) {
      return true;
    }
  } catch {
    return false;
  }
  return false;
}

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || isOriginAllowed(origin)) return callback(null, true);
      const error = new Error("Origin is not allowed.");
      error.name = "CorsError";
      callback(error);
    },
    credentials: true,
  })
);

const limiter = (windowMs: number, limit: number) =>
  rateLimit({
    windowMs,
    limit,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (_req, res) => {
      res.status(429).json({
        success: false,
        error: "Too many requests.",
        message: "Please try again later.",
      });
    },
  });

const authLimiter = limiter(15 * 60 * 1000, 5);
const formLimiter = limiter(15 * 60 * 1000, 10);
const orderLimiter = limiter(15 * 60 * 1000, 20);
const paymentLimiter = limiter(15 * 60 * 1000, 30);
const chatLimiter = limiter(60 * 1000, 12);
const searchLimiter = limiter(60 * 1000, 60);

app.post(
  "/api/payments/stripe/webhook",
  express.raw({ type: "application/json" }),
  handleStripeWebhook
);
app.use("/api/chat", chatLimiter, express.json({ limit: "32kb", strict: true }));
app.use(express.json({ limit: "2mb", strict: true }));

if (process.env.NODE_ENV !== "production") {
  app.use((req, res, next) => {
    const startedAt = performance.now();
    res.on("finish", () => {
      console.log(`${req.method} ${req.path} ${res.statusCode} ${Math.round(performance.now() - startedAt)}ms`);
    });
    next();
  });
}

// --- Routes ---
app.use("/api/admin/login", authLimiter);
app.post(["/api/bespoke", "/api/contact"], formLimiter);
app.post("/api/orders", orderLimiter);
app.use("/api/payments", paymentLimiter);
app.get(["/api/products", "/api/products/:handle", "/api/exchange-rates"], searchLimiter);
app.use("/api/bespoke", bespokeRoutes);
app.use("/api/contact", contactRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/admin", adminAuthRoutes);
app.use("/api/products", productRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/uploads", uploadRoutes);
app.use("/api/exchange-rates", exchangeRatesRoutes);
app.use("/api/chat", chatRoutes);

// Serve static files from the public directory
app.use("/uploads", express.static(path.join(__dirname, "../public/uploads")));

// Health check
app.get("/api/health", (_req, res) => {
  res.set("Cache-Control", "no-store").json({ status: "ok" });
});

app.use("/api", (_req, res) => {
  res.status(404).json({ success: false, error: "Endpoint not found." });
});

app.use((error: Error & { code?: string; type?: string }, _req: Request, res: Response, next: NextFunction) => {
  if (res.headersSent) return next(error);

  if (error.name === "CorsError") {
    res.status(403).json({ success: false, error: "Origin is not allowed." });
    return;
  }
  if (error.type === "entity.too.large" || error.code === "LIMIT_FILE_SIZE") {
    res.status(413).json({ success: false, error: "Request payload is too large." });
    return;
  }
  if (error instanceof SyntaxError || error.code?.startsWith("LIMIT_")) {
    res.status(400).json({ success: false, error: "Invalid request." });
    return;
  }

  logError("Unhandled API error", error);
  res.status(500).json({ success: false, error: "Internal server error." });
});

// --- Local dev server ---
if (process.env.NODE_ENV !== "production") {
  const PORT = process.env.PORT || 4000;
  app.listen(PORT, () => {
    console.log(`🚀 Aurora API running on http://localhost:${PORT}`);
  });
}

export default app;
