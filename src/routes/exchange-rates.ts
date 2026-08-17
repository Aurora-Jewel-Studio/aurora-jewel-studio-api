import { Router, Request, Response } from "express";
import { logError } from "../validation";

const router = Router();

// ── Supported currencies ─────────────────────────────────────────────────────
const SUPPORTED_CURRENCIES = [
  "USD",
  "GBP",
  "AUD",
  "CAD",
  "EUR",
  "NPR",
  "INR",
  "JPY",
  "CNY",
  "AED",
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
  const res = await fetch("https://open.er-api.com/v6/latest/USD", {
    signal: AbortSignal.timeout(5_000),
  });
  if (!res.ok) {
    throw new Error(`Exchange rate API returned ${res.status}`);
  }

  const data = (await res.json()) as {
    result?: string;
    rates?: Record<string, unknown>;
  };
  if (data.result !== "success" || !data.rates) {
    throw new Error("Exchange rate API did not return success");
  }

  // Filter to only our supported currencies
  const filtered: Record<string, number> = {};
  for (const code of SUPPORTED_CURRENCIES) {
    const rate = Number(data.rates[code]);
    if (Number.isFinite(rate) && rate > 0) {
      filtered[code] = rate;
    }
  }

  if (Object.keys(filtered).length !== SUPPORTED_CURRENCIES.length) {
    throw new Error("Exchange rate API returned incomplete rates");
  }

  return filtered;
}

export async function getExchangeRates(): Promise<Record<string, number>> {
  const now = Date.now();
  if (cache && now - cache.fetchedAt < CACHE_TTL) return cache.rates;

  const rates = await fetchRates();
  cache = { rates, fetchedAt: now };
  return rates;
}

// ── GET /api/exchange-rates ──────────────────────────────────────────────────
router.get("/", async (_req: Request, res: Response) => {
  try {
    const now = Date.now();
    res.set("Cache-Control", "public, s-maxage=3600, stale-while-revalidate=86400");

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
    const rates = await getExchangeRates();

    return res.json({
      base: "USD",
      rates,
      cached: false,
      fetchedAt: new Date(now).toISOString(),
    });
  } catch (error) {
    logError("Exchange rate fetch failed", error);

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

    return res.status(503).json({ error: "Exchange rates are temporarily unavailable." });
  }
});

export default router;
