import { Router } from "express";
import { query } from "../db";
import { requireAdmin, AuthRequest } from "../middleware/auth";
import { logError, schemas, validate } from "../validation";

const router = Router();

function withSeoFields(product: any) {
  const images = Array.isArray(product.images)
    ? product.images.map((image: any) =>
        typeof image === "string"
          ? { url: image, alt: product.title }
          : { ...image, alt: image.alt || product.title }
      )
    : [];
  return {
    ...product,
    slug: product.handle,
    category: product.category_handle,
    images,
  };
}

/**
 * GET /api/products
 * Public - get all products
 */
router.get("/", validate("query", schemas.productList), async (_req, res) => {
  try {
    const { q, category, page, limit } = res.locals.validatedQuery as {
      q?: string;
      category?: string;
      page?: number;
      limit?: number;
    };
    const filters: string[] = [];
    const values: unknown[] = [];
    const search = q?.replace(/\s+/g, " ");

    if (search) {
      values.push(search);
      filters.push(
        `to_tsvector('simple', coalesce(title, '') || ' ' || coalesce(description, ''))
         @@ websearch_to_tsquery('simple', $${values.length})`
      );
    }
    if (category) {
      values.push(category);
      filters.push(`category_handle = $${values.length}`);
    }

    const where = filters.length ? `WHERE ${filters.join(" AND ")}` : "";
    const paginate = page !== undefined || limit !== undefined;
    const resolvedPage = page || 1;
    const resolvedLimit = limit || 20;
    const countValues = [...values];
    let sql = `SELECT * FROM products ${where} ORDER BY created_at DESC`;

    if (paginate) {
      values.push(resolvedLimit, (resolvedPage - 1) * resolvedLimit);
      sql += ` LIMIT $${values.length - 1} OFFSET $${values.length}`;
    }

    const [result, countResult] = await Promise.all([
      query(sql, values),
      paginate ? query(`SELECT COUNT(*) AS count FROM products ${where}`, countValues) : null,
    ]);
    const products = result.rows.map(withSeoFields);

    res.set("Cache-Control", "public, max-age=60, s-maxage=300, stale-while-revalidate=3600").json({
      success: true,
      products,
      ...(countResult && {
        pagination: {
          page: resolvedPage,
          limit: resolvedLimit,
          total: Number(countResult.rows[0].count),
        },
      }),
    });
  } catch (error) {
    logError("Products fetch error", error);
    res.status(500).json({ error: "Failed to fetch products." });
  }
});

/**
 * GET /api/products/:handle
 * Public - get a product by handle
 */
router.get("/:handle", validate("params", schemas.handleParams), async (req, res) => {
  try {
    const { handle } = req.params;
    const result = await query("SELECT * FROM products WHERE handle = $1", [handle]);
    
    if (result.rowCount === 0) {
      res.status(404).json({ error: "Product not found." });
      return;
    }
    
    res
      .set("Cache-Control", "public, max-age=60, s-maxage=300, stale-while-revalidate=3600")
      .json({ success: true, product: withSeoFields(result.rows[0]) });
  } catch (error) {
    logError("Product fetch error", error);
    res.status(500).json({ error: "Failed to fetch product." });
  }
});

/**
 * POST /api/products
 * Admin-only - create a new product
 */
router.post(
  "/",
  requireAdmin as any,
  validate("body", schemas.productCreate),
  async (req: AuthRequest, res) => {
  try {
    const { handle, title, description, price, currency, thumbnail, images, category_handle, weight, features } = req.body;

    const result = await query(
      `INSERT INTO products (handle, title, description, price, currency, thumbnail, images, category_handle, weight, features)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
      [
        handle,
        title,
        description,
        price,
        currency,
        thumbnail,
        images ? JSON.stringify(images) : '[]',
        category_handle,
        weight ?? null,
        features ? JSON.stringify(features) : '{}'
      ]
    );

    res.status(201).json({ success: true, product: result.rows[0] });
  } catch (error: any) {
    logError("Product create error", error);
    if (error.code === '23505') {
      res.status(400).json({ error: "Product with this handle already exists." });
      return;
    }
    res.status(500).json({ error: "Failed to create product." });
  }
  }
);

/**
 * PATCH /api/products/:id
 * Admin-only - update a product
 */
router.patch(
  "/:id",
  requireAdmin as any,
  validate("params", schemas.idParams),
  validate("body", schemas.productUpdate),
  async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { handle, title, description, price, currency, thumbnail, images, category_handle, weight, features } = req.body;

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
    if (images !== undefined) { updates.push(`images = $${paramIndex++}`); values.push(JSON.stringify(images)); }
    if (category_handle) { updates.push(`category_handle = $${paramIndex++}`); values.push(category_handle); }
    if (weight !== undefined) { updates.push(`weight = $${paramIndex++}`); values.push(weight); }
    if (features !== undefined) { updates.push(`features = $${paramIndex++}`); values.push(JSON.stringify(features || {})); }

    values.push(id);
    const result = await query(
      `UPDATE products SET ${updates.join(", ")} WHERE id = $${paramIndex} RETURNING *`,
      values
    );

    if (result.rowCount === 0) {
      res.status(404).json({ error: "Product not found." });
      return;
    }

    res.json({ success: true, product: result.rows[0] });
  } catch (error) {
    logError("Product update error", error);
    res.status(500).json({ error: "Failed to update product." });
  }
  }
);

/**
 * DELETE /api/products/:id
 * Admin-only - delete a product
 */
router.delete(
  "/:id",
  requireAdmin as any,
  validate("params", schemas.idParams),
  async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const result = await query("DELETE FROM products WHERE id = $1 RETURNING id", [id]);

    if (result.rowCount === 0) {
      res.status(404).json({ error: "Product not found." });
      return;
    }

    res.json({ success: true, message: "Product deleted successfully." });
  } catch (error) {
    logError("Product delete error", error);
    res.status(500).json({ error: "Failed to delete product." });
  }
  }
);

export default router;
