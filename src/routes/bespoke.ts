import { Router } from "express";
import { query } from "../db";
import { requireAdmin, AuthRequest } from "../middleware/auth";
import nodemailer from "nodemailer";
import { logError, schemas, validate } from "../validation";

const router = Router();

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.hostinger.com",
  port: parseInt(process.env.SMTP_PORT || "465", 10),
  secure: parseInt(process.env.SMTP_PORT || "465", 10) === 465,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

/**
 * POST /api/bespoke
 * Public — submit a bespoke jewelry request.
 */
router.post("/", validate("body", schemas.bespoke), async (req, res) => {
  try {
    const {
      first_name,
      last_name,
      email,
      phone,
      budget,
      description,
      message,
      inquiry_type,
      reference_image,
      company_name,
      country,
      buyer_type,
      order_quantity_range,
      website,
    } = req.body;

    const actualDescription = message || description;

    if (website) {
      res.status(201).json({ success: true, message: "Enquiry received." });
      return;
    }

    const result = await query(
      `INSERT INTO bespoke_requests
        (first_name, last_name, email, phone, budget, description, inquiry_type,
         reference_image, company_name, country, buyer_type, order_quantity_range, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'pending')
       RETURNING *`,
      [
        first_name,
        last_name,
        email,
        phone || null,
        budget || null,
        actualDescription,
        inquiry_type,
        reference_image || null,
        company_name || null,
        country || null,
        buyer_type || null,
        order_quantity_range || null,
      ]
    );

    const bespokeRequest = result.rows[0];

    try {
      if (process.env.SMTP_USER && process.env.SMTP_PASS) {
        await transporter.sendMail({
          from: `"Aurora Jewel Studio" <${process.env.SMTP_USER}>`,
          to: process.env.ENQUIRY_NOTIFICATION_EMAIL || process.env.SMTP_USER,
          subject: `New bespoke enquiry #${bespokeRequest.id}`,
          text: [
            `Name: ${bespokeRequest.first_name} ${bespokeRequest.last_name}`,
            `Email: ${bespokeRequest.email}`,
            `Phone: ${bespokeRequest.phone || "N/A"}`,
            `Type: ${bespokeRequest.inquiry_type}`,
            `Company: ${bespokeRequest.company_name || "N/A"}`,
            `Country: ${bespokeRequest.country || "N/A"}`,
            `Buyer type: ${bespokeRequest.buyer_type || "N/A"}`,
            `Order quantity: ${bespokeRequest.order_quantity_range || "N/A"}`,
            `Budget: ${bespokeRequest.budget || "N/A"}`,
            "",
            bespokeRequest.description,
          ].join("\n"),
        });
      } else {
        console.warn("Bespoke notification email is not configured.");
      }
    } catch (emailError) {
      logError("Bespoke notification email failed", emailError);
    }

    res.status(201).json({
      success: true,
      message: "Enquiry received.",
      bespoke_request: bespokeRequest,
    });
  } catch (error) {
    logError("Bespoke submit error", error);
    res.status(500).json({ error: "Failed to submit bespoke request." });
  }
});

/**
 * GET /api/bespoke
 * Admin-only — list all bespoke requests.
 */
router.get("/", requireAdmin as any, async (_req: AuthRequest, res) => {
  try {
    const result = await query(
      "SELECT * FROM bespoke_requests ORDER BY created_at DESC"
    );
    res.json({ bespoke_requests: result.rows });
  } catch (error) {
    logError("Bespoke list error", error);
    res.status(500).json({ error: "Failed to fetch bespoke requests." });
  }
});

/**
 * PATCH /api/bespoke/:id
 * Admin-only — update bespoke request status.
 */
router.patch(
  "/:id",
  requireAdmin as any,
  validate("params", schemas.idParams),
  validate("body", schemas.bespokeStatus),
  async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const result = await query(
      "UPDATE bespoke_requests SET status = $1 WHERE id = $2 RETURNING *",
      [status, id]
    );

    if (result.rowCount === 0) {
      res.status(404).json({ error: "Bespoke request not found." });
      return;
    }

    res.json({ bespoke_request: result.rows[0] });
  } catch (error) {
    logError("Bespoke update error", error);
    res.status(500).json({ error: "Failed to update bespoke request." });
  }
  }
);

export default router;
