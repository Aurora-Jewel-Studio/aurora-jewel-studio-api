import { Router } from "express";
import { query } from "../db";
import { requireAdmin, AuthRequest } from "../middleware/auth";
import { CartPricingError, priceCartItems } from "../utils/order-pricing";
import { logError, schemas, validate } from "../validation";

const router = Router();

/**
 * POST /api/orders
 * Public — create a new order from cart checkout.
 */
router.post("/", validate("body", schemas.order), async (req, res) => {
  try {
    const {
      items,
      customer_name,
      customer_email,
      customer_phone,
      shipping_address,
      currency,
      payment_method,
    } = req.body;

    const pricedCart = await priceCartItems(items, currency);

    const result = await query(
      `INSERT INTO orders (
        items, customer_name, customer_email, customer_phone,
        shipping_address, total_amount, currency, payment_method,
        payment_status, order_status
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending', 'pending')
      RETURNING *`,
      [
        JSON.stringify(pricedCart.items),
        customer_name,
        customer_email,
        customer_phone || null,
        shipping_address || null,
        pricedCart.totalAmount,
        pricedCart.currency,
        payment_method || "cod",
      ]
    );

    res.status(201).json({ success: true, order: result.rows[0] });
  } catch (error) {
    logError("Order create error", error);
    if (error instanceof CartPricingError) {
      res.status(400).json({ error: error.message });
      return;
    }
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
    logError("Order list error", error);
    res.status(500).json({ error: "Failed to fetch orders." });
  }
});

/**
 * GET /api/orders/:id
 * Admin-only — get a single order.
 */
router.get(
  "/:id",
  requireAdmin as any,
  validate("params", schemas.idParams),
  async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const result = await query("SELECT * FROM orders WHERE id = $1", [
      id,
    ]);

    if (result.rowCount === 0) {
      res.status(404).json({ error: "Order not found." });
      return;
    }

    res.json({ order: result.rows[0] });
  } catch (error) {
    logError("Order get error", error);
    res.status(500).json({ error: "Failed to fetch order." });
  }
  }
);

/**
 * PATCH /api/orders/:id
 * Admin-only — update order status or payment status.
 */
router.patch(
  "/:id",
  requireAdmin as any,
  validate("params", schemas.idParams),
  validate("body", schemas.orderStatus),
  async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { order_status, payment_status, payment_reference } = req.body;

    const result = await query(
      `UPDATE orders
       SET order_status = COALESCE($1, order_status),
           payment_status = COALESCE($2, payment_status),
           payment_reference = COALESCE($3, payment_reference)
       WHERE id = $4
       RETURNING *`,
      [order_status || null, payment_status || null, payment_reference || null, id]
    );

    if (result.rowCount === 0) {
      res.status(404).json({ error: "Order not found." });
      return;
    }

    res.json({ order: result.rows[0] });
  } catch (error) {
    logError("Order update error", error);
    res.status(500).json({ error: "Failed to update order." });
  }
  }
);

export default router;
