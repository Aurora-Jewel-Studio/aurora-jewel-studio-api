import { Router } from "express";
import { query } from "../db";
import { requireAdmin, AuthRequest } from "../middleware/auth";

const router = Router();

/**
 * POST /api/contact
 * Public — submit a contact form message.
 */
router.post("/", async (req, res) => {
  try {
    const { name, email, subject, message } = req.body;

    if (!name || !email || !subject || !message) {
      res.status(400).json({
        error: "Name, email, subject, and message are required.",
      });
      return;
    }

    const result = await query(
      "INSERT INTO contact_messages (name, email, subject, message) VALUES ($1, $2, $3, $4) RETURNING *",
      [name, email, subject, message]
    );

    res.status(201).json({ contact_message: result.rows[0] });
  } catch (error) {
    console.error("Contact submit error:", error);
    res.status(500).json({ error: "Failed to submit contact message." });
  }
});

/**
 * GET /api/contact
 * Admin-only — list all contact messages.
 */
router.get("/", requireAdmin as any, async (_req: AuthRequest, res) => {
  try {
    const result = await query(
      "SELECT * FROM contact_messages ORDER BY created_at DESC"
    );
    res.json({ contact_messages: result.rows });
  } catch (error) {
    console.error("Contact list error:", error);
    res.status(500).json({ error: "Failed to fetch contact messages." });
  }
});

/**
 * PATCH /api/contact/:id/read
 * Admin-only — mark a message as read.
 */
router.patch("/:id/read", requireAdmin as any, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    const result = await query(
      "UPDATE contact_messages SET is_read = TRUE WHERE id = $1 RETURNING *",
      [parseInt(id)]
    );

    if (result.rowCount === 0) {
      res.status(404).json({ error: "Contact message not found." });
      return;
    }

    res.json({ contact_message: result.rows[0] });
  } catch (error) {
    console.error("Contact read error:", error);
    res.status(500).json({ error: "Failed to update contact message." });
  }
});

export default router;
