import { query } from "../db";
import { getExchangeRates } from "../routes/exchange-rates";
import { lexicalScore, productKnowledge } from "./retrieval";

type ProductRow = {
  id: number;
  handle: string;
  title: string;
  description: string;
  price: number | string;
  currency: string;
  thumbnail: string;
  images: Array<{ url?: string }>;
  variants: Array<{
    title?: string;
    options?: Record<string, unknown>;
    prices?: Record<string, unknown>;
  }>;
  category_handle: string;
  features: Record<string, unknown>;
};

export type VerifiedProduct = {
  id: number;
  handle: string;
  title: string;
  category: string;
  url: string;
  image: string;
  price?: { amount: number; currency: string; label: string };
  facts: {
    description: string;
    features: Record<string, unknown>;
    materials: string[];
  };
};

const HARD_PRODUCT_FACTS = [
  ["ruby", /\bruby\b/i],
  ["emerald", /\bemerald\b/i],
  ["sapphire", /\bsapphire\b/i],
  ["moissanite", /\bmoissanite\b/i],
  ["cubic zirconia", /\b(?:cubic zirconia|cz)\b/i],
  ["topaz", /\btopaz\b/i],
  ["pearl", /\bpearl\b/i],
  ["onyx", /\bonyx\b/i],
  ["garnet", /\bgarnet\b/i],
  ["peridot", /\bperidot\b/i],
  ["citrine", /\bcitrine\b/i],
  ["tanzanite", /\btanzanite\b/i],
  ["kyanite", /\bkyanite\b/i],
  ["amethyst", /\bamethyst\b/i],
  ["tourmaline", /\btourmaline\b/i],
  ["spinel", /\bspinel\b/i],
] as const;

export const COLOR_GEMSTONES = [
  {
    name: "yellow",
    pattern: /\b(?:yellow|gold(?:en)?|amber|citrine|sunset)\b/i,
    gemstones: ["citrine", "topaz", "amber"],
    colorTerms: ["yellow", "gold", "amber", "sunset", "citrine"],
  },
  {
    name: "red",
    pattern: /\b(?:red|crimson|scarlet|ruby|garnet)\b/i,
    gemstones: ["ruby", "garnet", "spinel"],
    colorTerms: ["red", "crimson", "scarlet", "ruby", "garnet"],
  },
  {
    name: "green",
    pattern: /\b(?:green|olive|emerald|peridot|verde|verdant)\b/i,
    gemstones: ["emerald", "peridot", "onyx", "spinel"],
    colorTerms: ["green", "olive", "emerald", "peridot", "verde", "verdant"],
  },
  {
    name: "blue",
    pattern: /\b(?:blue|sapphire|kyanite|navy|azure|sky\s*blue)\b/i,
    gemstones: ["sapphire", "kyanite", "topaz", "tanzanite"],
    colorTerms: ["blue", "sapphire", "kyanite", "azure", "oceanic"],
  },
  {
    name: "purple",
    pattern: /\b(?:purple|violet|amethyst|tanzanite|lavender|lilac)\b/i,
    gemstones: ["amethyst", "tanzanite"],
    colorTerms: ["purple", "violet", "amethyst", "lavender", "lilac"],
  },
  {
    name: "pink",
    pattern: /\b(?:pink|blush|rose\s*quartz|tourmaline)\b/i,
    gemstones: ["rose quartz", "tourmaline", "quartz"],
    colorTerms: ["pink", "blush", "rose", "rosette"],
  },
  {
    name: "black",
    pattern: /\b(?:black|dark|onyx)\b/i,
    gemstones: ["onyx"],
    colorTerms: ["black", "dark", "onyx"],
  },
  {
    name: "white",
    pattern: /\b(?:white|clear|pearl|moissanite|diamond|sparkl(?:e|ing)|crystal)\b/i,
    gemstones: ["pearl", "moissanite", "cubic zirconia", "cz", "crystal"],
    colorTerms: ["white", "clear", "pearl", "crystal", "sparkle"],
  },
] as const;

const PRODUCT_CATEGORIES = [
  ["sparkles", /\b(?:earrings?|studs?|hoops?|chandeliers?)\b/i],
  ["drops", /\b(?:necklaces?|pendants?|chains?|chokers?)\b/i],
  ["essence", /\b(?:rings?|bands?)\b/i],
  ["nexus", /\b(?:bracelets?|bangles?|cuffs?)\b/i],
  ["radiance", /\banklets?\b/i],
  ["emblem", /\b(?:brooch(?:es)?|pins?)\b/i],
] as const;

export function requestedProductCategory(message: string) {
  return PRODUCT_CATEGORIES.find(([, pattern]) => pattern.test(message))?.[0];
}

function usdPrice(product: ProductRow) {
  const variants = Array.isArray(product.variants) ? product.variants : [];
  const silver = variants.find(
    (variant) =>
      variant.title?.toLowerCase() === "silver" ||
      String(variant.options?.Material || "").toLowerCase() === "silver",
  );
  const silverPrice = Number(silver?.prices?.usd);
  if (Number.isFinite(silverPrice) && silverPrice >= 0) return silverPrice;

  const variantPrices = variants
    .map((variant) => Number(variant.prices?.usd))
    .filter((price) => Number.isFinite(price) && price >= 0);
  if (variantPrices.length) return Math.min(...variantPrices);
  const fallback = Number(product.price);
  return product.currency.toLowerCase() === "usd" && Number.isFinite(fallback) ? fallback : null;
}

function safeImage(value: unknown) {
  return typeof value === "string" && value.startsWith("/images/") && !value.includes("..")
    ? value
    : "/images/hero-jewelry.webp";
}

function budgetFrom(message: string) {
  const match = message.match(
    /(?:under|below|up to|maximum|max|budget(?: is| of| around)?|spend(?:ing)?(?: up to)?)\s*(?:US\$|A\$|C\$|\$|£|€|₹|Rs|¥|د\.إ)?\s*([\d,]+(?:\.\d{1,2})?)/i,
  );
  return match ? Number(match[1].replace(/,/g, "")) : null;
}

export function hasShoppingIntent(message: string) {
  return /\b(recommend|suggest|show|find|looking for|shop|buy|gift|piece|something|options?|jewel(?:ry|lery)|rings?|necklaces?|pendants?|earrings?|bracelets?|bangles?|brooch(?:es)?|anklets?|collection|wedding|bridal|engagement|anniversary|birthday|occasion|ruby|emerald|sapphire|stone|gem|gemstone|product|vintage|classic|statement|popular|yellow|red|green|blue|purple|pink|black|white|citrine|amethyst|garnet|peridot|topaz|pearl|onyx|moissanite|budget|cheaper|lower)\b/i.test(
    message,
  );
}

export type FindProductsOptions = {
  productId?: number | string;
  category?: string;
  preferLowerPrice?: boolean;
  seenProducts?: string[];
  rawMessage?: string;
};

export async function findVerifiedProducts(
  message: string,
  currency: string,
  options: FindProductsOptions | number | string = {},
  legacyCategory?: string,
  legacyPreferLowerPrice = false,
): Promise<VerifiedProduct[]> {
  const opts: FindProductsOptions =
    typeof options === "object" && options !== null
      ? options
      : {
          productId: options,
          category: legacyCategory,
          preferLowerPrice: legacyPreferLowerPrice,
        };

  const { productId, category, seenProducts = [], rawMessage = "" } = opts;
  const targetMessage = rawMessage || message;

  // Detect explicit budget-lowering intention
  const isLowerBudgetQuery =
    opts.preferLowerPrice ||
    /\b(?:lower budget|cheaper|lowest price|lower price|less expensive|more affordable|budget friendly|lowest budget)\b/i.test(
      targetMessage,
    ) ||
    /\b(?:lower budget|cheaper|lowest price|lower price)\b/i.test(message);

  const result = await query(
    `SELECT id, handle, title, description, price, currency, thumbnail, images,
            variants, category_handle, features
       FROM products`,
  );
  const rows = result.rows as ProductRow[];
  const rate = currency === "USD" ? 1 : (await getExchangeRates())[currency];
  if (!Number.isFinite(rate) || rate <= 0) throw new Error(`No verified ${currency} exchange rate.`);

  const budget = budgetFrom(targetMessage) ?? budgetFrom(message);

  // 1. Identify specific gemstones mentioned
  const rawExactGemstones = HARD_PRODUCT_FACTS.filter(([, pattern]) => pattern.test(targetMessage)).map(([name]) => name);
  const exactGemstones = rawExactGemstones.length
    ? rawExactGemstones
    : HARD_PRODUCT_FACTS.filter(([, pattern]) => pattern.test(message)).map(([name]) => name);

  // 2. Identify stone colors mentioned (e.g. "yellow stone", "red stone", "purple gem")
  const rawColors = COLOR_GEMSTONES.filter((c) => c.pattern.test(targetMessage));
  const matchedColors = rawColors.length
    ? rawColors
    : COLOR_GEMSTONES.filter((c) => c.pattern.test(message));

  const seenSet = new Set(seenProducts.map((p) => p.toLowerCase()));
  const asksAboutCurrent =
    productId !== undefined &&
    /\b(this|current|piece|pair|matching|details?|tell me about)\b/i.test(targetMessage) &&
    !category;

  // Helper to map and score rows
  const scoredRows = rows.map((product) => {
    const basePrice = usdPrice(product);
    const converted = basePrice === null ? null : Math.round(basePrice * rate * 100) / 100;
    const knowledge = productKnowledge(product.title);
    const productFacts = [
      product.title,
      product.description,
      product.category_handle,
      JSON.stringify(product.features || {}),
      knowledge?.content || "",
    ].join(" ").toLowerCase();

    const isCurrent = String(product.id) === String(productId) || product.handle === productId;
    const currentBoost = isCurrent && asksAboutCurrent ? 50 : 0;
    const rawScore = lexicalScore(message, productFacts, product.title) + currentBoost;

    const handleLower = product.handle.toLowerCase();
    const titleLower = product.title.toLowerCase();
    const isSeen = seenSet.has(handleLower) || seenSet.has(titleLower);
    const isExplicitlyRequested = targetMessage.toLowerCase().includes(titleLower);

    // If looking for lower budget, do not penalize seen items so the lowest price items can be shown
    const adjustedScore = !isLowerBudgetQuery && isSeen && !isExplicitlyRequested
      ? Math.max(0.1, rawScore * 0.2 - 2)
      : rawScore;

    // Check if product satisfies gemstone or color constraints
    const satisfiesExactGemstones =
      exactGemstones.length === 0 || exactGemstones.some((stone) => productFacts.includes(stone));

    const satisfiesColors =
      matchedColors.length === 0 ||
      matchedColors.some((c) =>
        c.gemstones.some((g) => productFacts.includes(g)) || c.colorTerms.some((t) => productFacts.includes(t))
      );

    return {
      product,
      converted,
      rawScore,
      score: adjustedScore,
      isSeen,
      productFacts,
      satisfiesExactGemstones,
      satisfiesColors,
    };
  });

  // Filter with constraints
  function filterCandidates(enforceBudget: boolean, enforceGemstone: boolean, enforceCategory: boolean) {
    return scoredRows.filter(({ product, converted, rawScore, satisfiesExactGemstones, satisfiesColors }) => {
      if (rawScore <= 0 && enforceGemstone) return false;
      if (enforceCategory && category && product.category_handle !== category) return false;
      if (enforceGemstone && (!satisfiesExactGemstones || !satisfiesColors)) return false;
      if (enforceBudget && budget !== null && (converted === null || converted > budget)) return false;
      return true;
    });
  }

  // Tier 1: Exact Match (Category + Gemstone/Color + Budget)
  let candidates = filterCandidates(true, true, true);

  // Tier 2: Relax Budget
  if (candidates.length === 0 && budget !== null) {
    candidates = filterCandidates(false, true, true);
  }

  // Tier 3: Relax Gemstone/Color if category specified, or relax Category if gemstone specified
  if (candidates.length === 0) {
    if (category) {
      candidates = filterCandidates(false, false, true);
    } else if (exactGemstones.length > 0 || matchedColors.length > 0) {
      candidates = filterCandidates(false, true, false);
    }
  }

  // Tier 4: General Lexical Match
  if (candidates.length === 0) {
    candidates = scoredRows.filter(({ rawScore }) => rawScore > 0);
  }

  // Tier 5: Signature pieces fallback (guarantees at least 1-4 products in every conversation)
  if (candidates.length === 0) {
    const signatureHandles = ["victorian-reverie", "velvet-ruby", "sapphire-whisper", "soft-serenity"];
    candidates = scoredRows.filter(({ product }) => signatureHandles.includes(product.handle));
    if (candidates.length === 0) {
      candidates = scoredRows.slice(0, 4);
    }
  }

  // Sorting logic:
  // When looking for lower budget: sort strictly by price ascending across ALL candidates
  if (isLowerBudgetQuery) {
    candidates.sort(
      (a, b) => (a.converted ?? Infinity) - (b.converted ?? Infinity) || b.rawScore - a.rawScore,
    );
  } else {
    // Normal query: prioritize unseen pieces, tie-break by relevance score
    const unseen = candidates.filter((item) => !item.isSeen);
    const seen = candidates.filter((item) => item.isSeen);

    const scoreSort = (a: (typeof candidates)[0], b: (typeof candidates)[0]) =>
      b.score - a.score || (a.converted ?? Infinity) - (b.converted ?? Infinity);

    unseen.sort(scoreSort);
    seen.sort(scoreSort);
    candidates = [...unseen, ...seen];
  }

  const selected = candidates.slice(0, 4);

  return selected.map(({ product, converted }) => ({
    id: product.id,
    handle: product.handle,
    title: product.title,
    category: product.category_handle,
    url: `/products/${product.handle}/`,
    image: safeImage(product.thumbnail),
    ...(converted !== null && {
      price: {
        amount: converted,
        currency,
        label: new Intl.NumberFormat("en", {
          style: "currency",
          currency,
          maximumFractionDigits: ["NPR", "INR", "JPY"].includes(currency) ? 0 : 2,
        }).format(converted),
      },
    }),
    facts: {
      description: product.description,
      features: product.features || {},
      materials: (Array.isArray(product.variants) ? product.variants : [])
        .map((variant) => String((variant as { title?: unknown }).title || ""))
        .filter(Boolean),
    },
  }));
}

