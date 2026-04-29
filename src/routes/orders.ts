import { Router } from "express";
import { query } from "../db";
import { requireAdmin, AuthRequest } from "../middleware/auth";

const router = Router();

/**
 * POST /api/orders
 * Public — create a new order from cart checkout.
 */
router.post("/", async (req, res) => {
  try {
    const {
      items,
      customer_name,
      customer_email,
      customer_phone,
      shipping_address,
      total_amount,
      currency,
      payment_method,
    } = req.body;

    if (!items || !customer_name || !customer_email || !total_amount) {
      res.status(400).json({
        error:
          "Items, customer name, customer email, and total amount are required.",
      });
      return;
    }

    const result = await query(
      `INSERT INTO orders (
        items, customer_name, customer_email, customer_phone,
        shipping_address, total_amount, currency, payment_method,
        payment_status, order_status
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending', 'pending')
      RETURNING *`,
      [
        JSON.stringify(items),
        customer_name,
        customer_email,
        customer_phone || null,
        shipping_address || null,
        total_amount,
        currency || "npr",
        payment_method || "cod",
      ]
    );

    res.status(201).json({ order: result.rows[0] });
  } catch (error) {
    console.error("Order create error:", error);
    res.status(500).json({ error: "Failed to create order." });
  }
});

/**
 * GET /api/orders
 * Admin-only — list all orders.
 */
router.get("/", requireAdmin as any, async (_req: AuthRequest, res) => {
  try {
    const result = await query("SELECT * FROM orders ORDER BY created_at DESC");
    res.json({ orders: result.rows });
  } catch (error) {
    console.error("Order list error:", error);
    res.status(500).json({ error: "Failed to fetch orders." });
  }
});

/**
 * GET /api/orders/:id
 * Admin-only — get a single order.
 */
router.get("/:id", requireAdmin as any, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const result = await query("SELECT * FROM orders WHERE id = $1", [
      parseInt(id as string),
    ]);

    if (result.rowCount === 0) {
      res.status(404).json({ error: "Order not found." });
      return;
    }

    res.json({ order: result.rows[0] });
  } catch (error) {
    console.error("Order get error:", error);
    res.status(500).json({ error: "Failed to fetch order." });
  }
});

/**
 * PATCH /api/orders/:id
 * Admin-only — update order status or payment status.
 */
router.patch("/:id", requireAdmin as any, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { order_status, payment_status, payment_reference } = req.body;

    if (order_status) {
      await query("UPDATE orders SET order_status = $1 WHERE id = $2", [
        order_status,
        parseInt(id as string),
      ]);
    }
    if (payment_status) {
      await query("UPDATE orders SET payment_status = $1 WHERE id = $2", [
        payment_status,
        parseInt(id as string),
      ]);
    }
    if (payment_reference) {
      await query("UPDATE orders SET payment_reference = $1 WHERE id = $2", [
        payment_reference,
        parseInt(id as string),
      ]);
    }

    const result = await query("SELECT * FROM orders WHERE id = $1", [
      parseInt(id as string),
    ]);

    if (result.rowCount === 0) {
      res.status(404).json({ error: "Order not found." });
      return;
    }

    res.json({ order: result.rows[0] });
  } catch (error) {
    console.error("Order update error:", error);
    res.status(500).json({ error: "Failed to update order." });
  }
});

export default router;
