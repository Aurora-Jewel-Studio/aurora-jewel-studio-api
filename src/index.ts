import express from "express";
import cors from "cors";
import helmet from "helmet";
import dotenv from "dotenv";

import bespokeRoutes from "./routes/bespoke";
import contactRoutes from "./routes/contact";
import orderRoutes from "./routes/orders";
import paymentRoutes from "./routes/payments";
import adminAuthRoutes from "./routes/admin-auth";
import productRoutes from "./routes/products";
import analyticsRoutes from "./routes/analytics";
import uploadRoutes from "./routes/uploads";
import path from "path";

dotenv.config();

const app = express();

// --- Middleware ---
app.use(helmet());
app.use(express.json());

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

// --- Routes ---
app.use("/api/bespoke", bespokeRoutes);
app.use("/api/contact", contactRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/admin", adminAuthRoutes);
app.use("/api/products", productRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/uploads", uploadRoutes);

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
