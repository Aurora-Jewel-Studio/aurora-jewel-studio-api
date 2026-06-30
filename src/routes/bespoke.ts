import { Router } from "express";
import { query } from "../db";
import { requireAdmin, AuthRequest } from "../middleware/auth";
import nodemailer from "nodemailer";
import * as xlsx from "xlsx";

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
router.post("/", async (req, res) => {
  try {
    const { first_name, last_name, email, phone, budget, description, message, inquiry_type, reference_image } =
      req.body;

    const actualDescription = message || description;

    if (!first_name || !last_name || !email || !actualDescription) {
      res.status(400).json({
        error: "First name, last name, email, and message are required.",
      });
      return;
    }

    if (
      reference_image &&
      (typeof reference_image !== "string" ||
        !reference_image.startsWith("data:image/") ||
        reference_image.length > 1_400_000)
    ) {
      res.status(400).json({ error: "Reference image must be a valid image under 1MB." });
      return;
    }

    const result = await query(
      "INSERT INTO bespoke_requests (first_name, last_name, email, phone, budget, description, inquiry_type, reference_image, status) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending') RETURNING *",
      [first_name, last_name, email, phone || null, budget || null, actualDescription, inquiry_type || "Custom", reference_image || null]
    );

    const bespokeRequest = result.rows[0];

    // --- GENERATE EXCEL AND SEND EMAIL ---
    try {
      if (process.env.SMTP_USER && process.env.SMTP_PASS) {
        // 1. Create a new workbook and worksheet
        const wb = xlsx.utils.book_new();
        const wsData = [
          ["Field", "Value"],
          ["ID", bespokeRequest.id],
          ["First Name", bespokeRequest.first_name],
          ["Last Name", bespokeRequest.last_name],
          ["Email", bespokeRequest.email],
          ["Phone", bespokeRequest.phone || "N/A"],
          ["Inquiry Type", bespokeRequest.inquiry_type],
          ["Budget", bespokeRequest.budget || "N/A"],
          ["Message / Description", bespokeRequest.description],
          ["Created At", new Date(bespokeRequest.created_at).toLocaleString()],
        ];
        const ws = xlsx.utils.aoa_to_sheet(wsData);
        
        // Auto-size columns slightly
        ws["!cols"] = [{ wch: 25 }, { wch: 80 }];
        
        xlsx.utils.book_append_sheet(wb, ws, "Bespoke Request");

        // Write to a buffer
        const excelBuffer = xlsx.write(wb, { type: "buffer", bookType: "xlsx" });

        // 2. Send the email
        await transporter.sendMail({
          from: `"Aurora Jewel Studio" <${process.env.SMTP_USER}>`,
          to: "shresthaswapnil03@gmail.com",
          subject: `New Bespoke Request: ${bespokeRequest.first_name} ${bespokeRequest.last_name}`,
          text: `You have received a new bespoke/custom request from ${bespokeRequest.first_name} ${bespokeRequest.last_name} (${bespokeRequest.email}).\n\nInquiry Type: ${bespokeRequest.inquiry_type}\n\nPlease find the detailed information attached in the Excel file.`,
          html: `<div style="font-family: sans-serif; color: #333;">
            <h2 style="color: #011B12;">New Bespoke Request</h2>
            <p>You have received a new bespoke/custom request from <strong>${bespokeRequest.first_name} ${bespokeRequest.last_name}</strong>.</p>
            <ul>
              <li><strong>Email:</strong> ${bespokeRequest.email}</li>
              <li><strong>Phone:</strong> ${bespokeRequest.phone || "N/A"}</li>
              <li><strong>Type:</strong> ${bespokeRequest.inquiry_type}</li>
            </ul>
            <p>Please find the detailed information attached in the Excel file.</p>
          </div>`,
          attachments: [
            {
              filename: `Bespoke_Request_${bespokeRequest.id}.xlsx`,
              content: excelBuffer,
              contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            }
          ]
        });
        console.log(`Email sent successfully for bespoke request ID ${bespokeRequest.id}`);
      } else {
        console.warn("SMTP_USER or SMTP_PASS is missing. Email was not sent.");
      }
    } catch (emailError) {
      console.error("Failed to generate excel or send email:", emailError);
    }

    res.status(201).json({ bespoke_request: bespokeRequest });
  } catch (error) {
    console.error("Bespoke submit error:", error);
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
    console.error("Bespoke list error:", error);
    res.status(500).json({ error: "Failed to fetch bespoke requests." });
  }
});

/**
 * PATCH /api/bespoke/:id
 * Admin-only — update bespoke request status.
 */
router.patch("/:id", requireAdmin as any, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status) {
      res.status(400).json({ error: "Status is required." });
      return;
    }

    const result = await query(
      "UPDATE bespoke_requests SET status = $1 WHERE id = $2 RETURNING *",
      [status, parseInt(id as string)]
    );

    if (result.rowCount === 0) {
      res.status(404).json({ error: "Bespoke request not found." });
      return;
    }

    res.json({ bespoke_request: result.rows[0] });
  } catch (error) {
    console.error("Bespoke update error:", error);
    res.status(500).json({ error: "Failed to update bespoke request." });
  }
});

export default router;
