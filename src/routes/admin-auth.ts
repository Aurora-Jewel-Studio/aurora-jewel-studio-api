import { Router } from "express";
import { generateAdminToken } from "../middleware/auth";
import crypto from "crypto";
import { schemas, validate } from "../validation";

const router = Router();

/**
 * POST /api/admin/login
 * Body: { email, password }
 * Returns: { token }
 */
router.post("/login", validate("body", schemas.adminLogin), (req, res) => {
  const { email, password } = req.body;

  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminEmail || !adminPassword) {
    res.status(500).json({ error: "Admin credentials are not configured." });
    return;
  }

  const emailMatches = email === adminEmail.toLowerCase();
  const passwordMatches = crypto.timingSafeEqual(
    crypto.createHash("sha256").update(password).digest(),
    crypto.createHash("sha256").update(adminPassword).digest()
  );

  if (!emailMatches || !passwordMatches) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  const token = generateAdminToken(email);
  res.json({ token, email });
});

export default router;
