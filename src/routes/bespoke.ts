import { Router } from "express";
import { query } from "../db";
import { requireAdmin, AuthRequest } from "../middleware/auth";

const router = Router();

/**
 * POST /api/bespoke
 * Public — submit a bespoke jewelry request.
 */
router.post("/", async (req, res) => {
  try {
    const { first_name, last_name, email, phone, budget, description, inquiry_type, reference_image } =
      req.body;

    if (!first_name || !last_name || !email || !description) {
      res.status(400).json({
        error: "First name, last name, email, and description are required.",
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
      [first_name, last_name, email, phone || null, budget || null, description, inquiry_type || "Custom", reference_image || null]
    );

    res.status(201).json({ bespoke_request: result.rows[0] });
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
