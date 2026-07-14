import pool, { initDatabase } from "./db";

async function main() {
  try {
    await initDatabase();
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error("Database initialization failed:", error instanceof Error ? error.message : "Unknown error");
  process.exitCode = 1;
});
