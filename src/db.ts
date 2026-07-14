import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();
dotenv.config({ path: ".env.local", override: true });

const connectionString = process.env.POSTGRES_URL?.replace(
  /([?&])sslmode=require(?=&|$)/,
  "$1sslmode=verify-full"
);

const pool = new Pool({
  connectionString,
  // ponytail: five connections per warm instance; raise only with DB capacity metrics.
  max: 5,
  idleTimeoutMillis: 10_000,
  connectionTimeoutMillis: 5_000,
});

export const query = (text: string, params?: any[]) => pool.query(text, params);

pool.on("error", (error) => {
  console.error("Unexpected database pool error:", error.message);
});

/**
 * Initialize the database tables.
 * Safe to call multiple times — uses IF NOT EXISTS.
 */
export async function initDatabase() {
  if (!process.env.POSTGRES_URL) {
    throw new Error("POSTGRES_URL is required.");
  }

  const client = await pool.connect();
  try {
      await client.query(`
      CREATE TABLE IF NOT EXISTS bespoke_requests (
        id SERIAL PRIMARY KEY,
        first_name VARCHAR(100) NOT NULL,
        last_name VARCHAR(100) NOT NULL,
        email VARCHAR(255) NOT NULL,
        phone VARCHAR(50),
        budget VARCHAR(50),
        description TEXT NOT NULL,
        inquiry_type VARCHAR(50) DEFAULT 'Custom',
        reference_image TEXT,
        company_name VARCHAR(200),
        country VARCHAR(100),
        buyer_type VARCHAR(100),
        order_quantity_range VARCHAR(100),
        status VARCHAR(30) DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS contact_messages (
        id SERIAL PRIMARY KEY,
        name VARCHAR(200) NOT NULL,
        email VARCHAR(255) NOT NULL,
        subject VARCHAR(300) NOT NULL,
        message TEXT NOT NULL,
        is_read BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS orders (
        id SERIAL PRIMARY KEY,
        items JSONB NOT NULL,
        customer_name VARCHAR(200) NOT NULL,
        customer_email VARCHAR(255) NOT NULL,
        customer_phone VARCHAR(50),
        shipping_address TEXT,
        total_amount NUMERIC(10,2) NOT NULL,
        currency VARCHAR(10) DEFAULT 'npr',
        payment_method VARCHAR(50),
        payment_status VARCHAR(30) DEFAULT 'pending',
        payment_reference VARCHAR(255),
        order_status VARCHAR(30) DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS products (
        id SERIAL PRIMARY KEY,
        handle VARCHAR(255) UNIQUE NOT NULL,
        title VARCHAR(255) NOT NULL,
        description TEXT NOT NULL,
        price NUMERIC(10,2) NOT NULL,
        currency VARCHAR(10) DEFAULT 'usd',
        thumbnail VARCHAR(500) NOT NULL,
        images JSONB NOT NULL DEFAULT '[]',
        options JSONB NOT NULL DEFAULT '[]',
        variants JSONB NOT NULL DEFAULT '[]',
        category_handle VARCHAR(255) NOT NULL,
        weight NUMERIC,
        features JSONB DEFAULT '{}',
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Add columns if they don't exist (for existing databases)
    await client.query(`
      ALTER TABLE products 
      ADD COLUMN IF NOT EXISTS weight NUMERIC,
      ADD COLUMN IF NOT EXISTS features JSONB DEFAULT '{}';
    `);

    await client.query(`
      ALTER TABLE bespoke_requests
      ADD COLUMN IF NOT EXISTS inquiry_type VARCHAR(50) DEFAULT 'Custom',
      ADD COLUMN IF NOT EXISTS reference_image TEXT,
      ADD COLUMN IF NOT EXISTS company_name VARCHAR(200),
      ADD COLUMN IF NOT EXISTS country VARCHAR(100),
      ADD COLUMN IF NOT EXISTS buyer_type VARCHAR(100),
      ADD COLUMN IF NOT EXISTS order_quantity_range VARCHAR(100);
    `);

    await client.query(`
      ALTER TABLE orders
      ALTER COLUMN total_amount TYPE NUMERIC(10,2);
    `);

    // Migrate price column from INTEGER to NUMERIC if needed
    await client.query(`
      ALTER TABLE products
      ALTER COLUMN price TYPE NUMERIC(10,2);
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS products_category_handle_idx ON products (category_handle);
      CREATE INDEX IF NOT EXISTS products_created_at_idx ON products (created_at DESC);
      CREATE INDEX IF NOT EXISTS products_search_idx ON products USING GIN (
        to_tsvector('simple', coalesce(title, '') || ' ' || coalesce(description, ''))
      );
      CREATE INDEX IF NOT EXISTS bespoke_requests_created_at_idx ON bespoke_requests (created_at DESC);
      CREATE INDEX IF NOT EXISTS contact_messages_created_at_idx ON contact_messages (created_at DESC);
      CREATE INDEX IF NOT EXISTS orders_created_at_idx ON orders (created_at DESC);
      CREATE INDEX IF NOT EXISTS orders_payment_status_created_at_idx
        ON orders (payment_status, created_at DESC);
    `);

    console.log("✅ Database tables initialized");
  } finally {
    client.release();
  }
}

export default pool;
