import { Router } from "express";
import { generateAdminToken } from "../middleware/auth";
import crypto from "crypto";

const router = Router();

/**
 * POST /api/admin/login
 * Body: { email, password }
 * Returns: { token }
 */
router.post("/login", (req, res) => {
  const { email, password } = req.body;

  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminEmail || !adminPassword) {
    res.status(500).json({ error: "Admin credentials are not configured." });
    return;
  }

  const emailMatches = email === adminEmail;
  const passwordMatches =
    typeof password === "string" &&
    crypto.timingSafeEqual(
      Buffer.from(password.padEnd(adminPassword.length)),
      Buffer.from(adminPassword.padEnd(password.length))
    );

  if (!emailMatches || !passwordMatches) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  const token = generateAdminToken(email);
  res.json({ token, email });
});

export default router;
