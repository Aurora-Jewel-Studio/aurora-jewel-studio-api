import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const isProduction = process.env.NODE_ENV === "production";

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: isProduction ? { rejectUnauthorized: false } : false,
});

export const query = (text: string, params?: any[]) => pool.query(text, params);

/**
 * Initialize the database tables.
 * Safe to call multiple times — uses IF NOT EXISTS.
 */
export async function initDatabase() {
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
        total_amount INTEGER NOT NULL,
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

    // Migrate price column from INTEGER to NUMERIC if needed
    await client.query(`
      ALTER TABLE products
      ALTER COLUMN price TYPE NUMERIC(10,2);
    `);

    console.log("✅ Database tables initialized");
  } finally {
    client.release();
  }
}

export default pool;
