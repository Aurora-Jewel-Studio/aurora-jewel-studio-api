import { Router } from "express";
import { query } from "../db";
import { requireAdmin, AuthRequest } from "../middleware/auth";

const router = Router();

/**
 * GET /api/analytics
 * Admin-only - fetch dashboard analytics (revenue over time, order stats, etc.)
 */
router.get("/", requireAdmin as any, async (req: AuthRequest, res) => {
  try {
    // 1. Get total revenue (completed orders)
    const revenueResult = await query(
      "SELECT SUM(total_amount) as total FROM orders WHERE payment_status = 'paid'"
    );
    const totalRevenue = revenueResult.rows[0].total || 0;

    // 2. Get order status counts
    const statusCountsResult = await query(
      "SELECT order_status, COUNT(*) as count FROM orders GROUP BY order_status"
    );
    const orderStatuses = statusCountsResult.rows.map(row => ({
      name: row.order_status,
      value: parseInt(row.count)
    }));

    // 3. Get revenue over last 7 days
    const recentRevenueResult = await query(`
      SELECT 
        DATE(created_at) as date,
        SUM(total_amount) as revenue
      FROM orders
      WHERE created_at >= NOW() - INTERVAL '7 days'
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `);

    // 4. Get total products and bespoke requests
    const productsResult = await query("SELECT COUNT(*) as count FROM products");
    const bespokeResult = await query("SELECT COUNT(*) as count FROM bespoke_requests WHERE status = 'pending'");

    res.json({
      totalRevenue,
      orderStatuses,
      revenueByDate: recentRevenueResult.rows,
      totalProducts: parseInt(productsResult.rows[0].count),
      pendingBespoke: parseInt(bespokeResult.rows[0].count)
    });
  } catch (error) {
    console.error("Analytics fetch error:", error);
    res.status(500).json({ error: "Failed to fetch analytics." });
  }
});

export default router;
