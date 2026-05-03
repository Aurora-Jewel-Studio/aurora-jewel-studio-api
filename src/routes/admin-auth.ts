import { Router } from "express";
import { generateAdminToken } from "../middleware/auth";

const router = Router();

/**
 * POST /api/admin/login
 * Body: { email, password }
 * Returns: { token }
 */
router.post("/login", (req, res) => {
  const { email, password } = req.body;

  const adminEmail = process.env.ADMIN_EMAIL || "admin@aurorajewelstudio.com";
  const adminPassword = process.env.ADMIN_PASSWORD || "aurora123";

  if (email !== adminEmail || password !== adminPassword) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  const token = generateAdminToken(email);
  res.json({ token, email });
});

export default router;
