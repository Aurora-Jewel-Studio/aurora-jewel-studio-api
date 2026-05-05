import { Router, Request, Response } from "express";

const router = Router();

// ── Supported currencies ─────────────────────────────────────────────────────
const SUPPORTED_CURRENCIES = [
  "USD", "GBP", "AUD", "CAD", "EUR", "NPR", "INR", "JPY", "CNY", "AED",
];

// ── In-memory cache ──────────────────────────────────────────────────────────
interface CachedRates {
  rates: Record<string, number>;
  fetchedAt: number; // Unix timestamp (ms)
}

let cache: CachedRates | null = null;
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours in ms

// ── Fetch rates from free API ────────────────────────────────────────────────
async function fetchRates(): Promise<Record<string, number>> {
  // open.er-api.com — completely free, no API key required, ~1500 req/month
  const res = await fetch("https://open.er-api.com/v6/latest/USD");
  if (!res.ok) {
    throw new Error(`Exchange rate API returned ${res.status}`);
  }

  const data = await res.json();
  if (data.result !== "success") {
    throw new Error("Exchange rate API did not return success");
  }

  // Filter to only our supported currencies
  const filtered: Record<string, number> = {};
  for (const code of SUPPORTED_CURRENCIES) {
    if (data.rates[code] !== undefined) {
      filtered[code] = data.rates[code];
    }
  }

  return filtered;
}

// ── GET /api/exchange-rates ──────────────────────────────────────────────────
router.get("/", async (_req: Request, res: Response) => {
  try {
    const now = Date.now();

    // Return cached rates if still fresh
    if (cache && now - cache.fetchedAt < CACHE_TTL) {
      return res.json({
        base: "USD",
        rates: cache.rates,
        cached: true,
        fetchedAt: new Date(cache.fetchedAt).toISOString(),
      });
    }

    // Fetch fresh rates
    const rates = await fetchRates();
    cache = { rates, fetchedAt: now };

    return res.json({
      base: "USD",
      rates,
      cached: false,
      fetchedAt: new Date(now).toISOString(),
    });
  } catch (error: any) {
    console.error("Exchange rate fetch failed:", error.message);

    // If we have stale cache, return it with a warning
    if (cache) {
      return res.json({
        base: "USD",
        rates: cache.rates,
        cached: true,
        stale: true,
        fetchedAt: new Date(cache.fetchedAt).toISOString(),
        error: "Failed to refresh rates, serving cached data",
      });
    }

    // No cache at all — return hardcoded fallback rates (approximate)
    return res.status(200).json({
      base: "USD",
      rates: {
        USD: 1,
        GBP: 0.79,
        AUD: 1.53,
        CAD: 1.36,
        EUR: 0.92,
        NPR: 133.5,
        INR: 83.5,
        JPY: 154.0,
        CNY: 7.25,
        AED: 3.67,
      },
      cached: false,
      fallback: true,
      error: "Using fallback rates",
    });
  }
});

export default router;
