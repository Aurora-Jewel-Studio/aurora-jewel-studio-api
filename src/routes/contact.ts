import { Router } from "express";
import nodemailer from "nodemailer";
import { query } from "../db";
import { requireAdmin, AuthRequest } from "../middleware/auth";
import { logError, schemas, validate } from "../validation";

const router = Router();
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.hostinger.com",
  port: parseInt(process.env.SMTP_PORT || "465", 10),
  secure: parseInt(process.env.SMTP_PORT || "465", 10) === 465,
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
});

/**
 * POST /api/contact
 * Public — submit a contact form message.
 */
router.post("/", validate("body", schemas.contact), async (req, res) => {
  try {
    const { name, email, subject, message, website } = req.body;

    if (website) {
      res.status(201).json({ success: true, message: "Message received." });
      return;
    }

    const result = await query(
      "INSERT INTO contact_messages (name, email, subject, message) VALUES ($1, $2, $3, $4) RETURNING *",
      [name, email, subject, message]
    );
    const contactMessage = result.rows[0];

    try {
      if (process.env.SMTP_USER && process.env.SMTP_PASS) {
        await transporter.sendMail({
          from: `"Aurora Jewel Studio" <${process.env.SMTP_USER}>`,
          to: "contact@aurorajewelstudio.com",
          replyTo: contactMessage.email,
          subject: `New website submission #${contactMessage.id}`,
          text: [
            `Name: ${contactMessage.name}`,
            `Email: ${contactMessage.email}`,
            `Subject: ${contactMessage.subject}`,
            "",
            contactMessage.message,
          ].join("\n"),
        });
      } else {
        console.warn("Contact notification email is not configured.");
      }
    } catch (emailError) {
      logError("Contact notification email failed", emailError);
    }

    res.status(201).json({
      success: true,
      message: "Message received.",
      contact_message: contactMessage,
    });
  } catch (error) {
    logError("Contact submit error", error);
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
    logError("Contact list error", error);
    res.status(500).json({ error: "Failed to fetch contact messages." });
  }
});

/**
 * PATCH /api/contact/:id/read
 * Admin-only — mark a message as read.
 */
router.patch(
  "/:id/read",
  requireAdmin as any,
  validate("params", schemas.idParams),
  async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    const result = await query(
      "UPDATE contact_messages SET is_read = TRUE WHERE id = $1 RETURNING *",
      [id]
    );

    if (result.rowCount === 0) {
      res.status(404).json({ error: "Contact message not found." });
      return;
    }

    res.json({ contact_message: result.rows[0] });
  } catch (error) {
    logError("Contact read error", error);
    res.status(500).json({ error: "Failed to update contact message." });
  }
  }
);

export default router;
