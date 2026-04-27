import { initDatabase, query } from "./db";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";

dotenv.config();

async function seed() {
  console.log("🌱 Initializing Aurora Jewel API database...");
  await initDatabase();

  console.log("📦 Seeding products from JSON...");
  const productsPath = path.join(__dirname, "../../storefront/src/data/products.json");
  
  if (fs.existsSync(productsPath)) {
    const rawData = fs.readFileSync(productsPath, "utf-8");
    const products = JSON.parse(rawData);

    for (const p of products) {
      // Check if product already exists
      const existing = await query("SELECT id FROM products WHERE handle = $1", [p.handle]);
      
      if (existing.rowCount === 0) {
        await query(
          `INSERT INTO products (handle, title, description, price, currency, thumbnail, images, options, variants, category_handle)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
          [
            p.handle,
            p.title,
            p.description,
            p.variants?.[0]?.prices?.npr || 0,
            'npr',
            p.thumbnail,
            JSON.stringify(p.images || []),
            JSON.stringify(p.options || []),
            JSON.stringify(p.variants || []),
            p.category ? p.category.toLowerCase() : 'uncategorized'
          ]
        );
        console.log(`   - Inserted: ${p.title}`);
      }
    }
  } else {
    console.warn("⚠️  No products.json found to seed.");
  }

  console.log("✅ Database seeded successfully!");
  process.exit(0);
}

seed().catch((err) => {
  console.error("❌ Seed failed:", err);
  process.exit(1);
});
