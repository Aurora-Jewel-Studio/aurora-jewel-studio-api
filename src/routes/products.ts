import { Router } from "express";
import { query } from "../db";
import { requireAdmin, AuthRequest } from "../middleware/auth";

const router = Router();

/**
 * GET /api/products
 * Public - get all products
 */
router.get("/", async (req, res) => {
  try {
    const result = await query("SELECT * FROM products ORDER BY created_at DESC");
    res.json({ products: result.rows });
  } catch (error) {
    console.error("Products fetch error:", error);
    res.status(500).json({ error: "Failed to fetch products." });
  }
});

/**
 * GET /api/products/:handle
 * Public - get a product by handle
 */
router.get("/:handle", async (req, res) => {
  try {
    const { handle } = req.params;
    const result = await query("SELECT * FROM products WHERE handle = $1", [handle]);
    
    if (result.rowCount === 0) {
      res.status(404).json({ error: "Product not found." });
      return;
    }
    
    res.json({ product: result.rows[0] });
  } catch (error) {
    console.error("Product fetch error:", error);
    res.status(500).json({ error: "Failed to fetch product." });
  }
});

/**
 * POST /api/products
 * Admin-only - create a new product
 */
router.post("/", requireAdmin as any, async (req: AuthRequest, res) => {
  try {
    const { handle, title, description, price, currency, thumbnail, images, category_handle } = req.body;

    if (!handle || !title || !description || price === undefined || !thumbnail || !category_handle) {
      res.status(400).json({ error: "Missing required fields." });
      return;
    }

    const result = await query(
      `INSERT INTO products (handle, title, description, price, currency, thumbnail, images, category_handle)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [
        handle,
        title,
        description,
        price,
        currency || 'npr',
        thumbnail,
        images ? JSON.stringify(images) : '[]',
        category_handle
      ]
    );

    res.status(201).json({ product: result.rows[0] });
  } catch (error: any) {
    console.error("Product create error:", error);
    if (error.code === '23505') {
      res.status(400).json({ error: "Product with this handle already exists." });
      return;
    }
    res.status(500).json({ error: "Failed to create product." });
  }
});

/**
 * PATCH /api/products/:id
 * Admin-only - update a product
 */
router.patch("/:id", requireAdmin as any, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { handle, title, description, price, currency, thumbnail, images, category_handle } = req.body;

    // Build dynamic update query
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (handle) { updates.push(`handle = $${paramIndex++}`); values.push(handle); }
    if (title) { updates.push(`title = $${paramIndex++}`); values.push(title); }
    if (description) { updates.push(`description = $${paramIndex++}`); values.push(description); }
    if (price !== undefined) { updates.push(`price = $${paramIndex++}`); values.push(price); }
    if (currency) { updates.push(`currency = $${paramIndex++}`); values.push(currency); }
    if (thumbnail) { updates.push(`thumbnail = $${paramIndex++}`); values.push(thumbnail); }
    if (images) { updates.push(`images = $${paramIndex++}`); values.push(JSON.stringify(images)); }
    if (category_handle) { updates.push(`category_handle = $${paramIndex++}`); values.push(category_handle); }

    if (updates.length === 0) {
      res.status(400).json({ error: "No fields to update." });
      return;
    }

    values.push(parseInt(id as string));
    const result = await query(
      `UPDATE products SET ${updates.join(", ")} WHERE id = $${paramIndex} RETURNING *`,
      values
    );

    if (result.rowCount === 0) {
      res.status(404).json({ error: "Product not found." });
      return;
    }

    res.json({ product: result.rows[0] });
  } catch (error) {
    console.error("Product update error:", error);
    res.status(500).json({ error: "Failed to update product." });
  }
});

/**
 * DELETE /api/products/:id
 * Admin-only - delete a product
 */
router.delete("/:id", requireAdmin as any, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const result = await query("DELETE FROM products WHERE id = $1 RETURNING *", [parseInt(id as string)]);

    if (result.rowCount === 0) {
      res.status(404).json({ error: "Product not found." });
      return;
    }

    res.json({ message: "Product deleted successfully." });
  } catch (error) {
    console.error("Product delete error:", error);
    res.status(500).json({ error: "Failed to delete product." });
  }
});

export default router;
