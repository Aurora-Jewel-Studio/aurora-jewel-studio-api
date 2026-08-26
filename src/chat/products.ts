import { query } from "../db";
import { getExchangeRates } from "../routes/exchange-rates";
import { lexicalScore, productKnowledge } from "./retrieval";

export type ProductRow = {
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
  match: "exact" | "closest" | "curated";
  facts: {
    description: string;
    features: Record<string, unknown>;
    materials: string[];
  };
};

export type ColorDefinition = {
  name: string;
  pattern: RegExp;
  gemstones: string[];
  gemstonePatterns: RegExp[];
  colorPatterns: RegExp[];
};

export const COLOR_GEMSTONES: ColorDefinition[] = [
  {
    name: "red",
    pattern: /\b(?:red|crimson|scarlet|ruby|rubies|garnet|spinel)\b/i,
    gemstones: ["ruby", "garnet", "spinel"],
    gemstonePatterns: [/\bruby\b/i, /\brubies\b/i, /\bgarnet\b/i, /\bspinel\b/i],
    colorPatterns: [/\bred\b/i, /\bcrimson\b/i, /\bscarlet\b/i],
  },
  {
    name: "yellow",
    pattern: /\b(?:yellow|amber|citrine|sunshine|sunset)\b|\bgold(?:en)?\s+(?:stone|gem|gemstone|jewel)\b/i,
    gemstones: ["citrine", "topaz", "amber"],
    gemstonePatterns: [/\bcitrine\b/i, /\btopaz\b/i, /\bamber\b/i],
    colorPatterns: [/\byellow\b/i, /\bgold(?:en)?\b/i, /\bamber\b/i, /\bsunset\b/i],
  },
  {
    name: "green",
    pattern: /\b(?:green|olive|emerald|peridot|onyx|verde|verdant)\b/i,
    gemstones: ["emerald", "peridot", "onyx", "spinel"],
    gemstonePatterns: [/\bemerald\b/i, /\bperidot\b/i, /\bonyx\b/i, /\bspinel\b/i, /\bprasiolite\b/i],
    colorPatterns: [/\bgreen\b/i, /\bolive\b/i, /\bverde\b/i, /\bverdant\b/i],
  },
  {
    name: "blue",
    pattern: /\b(?:blue|sapphire|kyanite|topaz|tanzanite|navy|azure|sky\s*blue|oceanic)\b/i,
    gemstones: ["sapphire", "kyanite", "topaz", "tanzanite"],
    gemstonePatterns: [/\bsapphire\b/i, /\bkyanite\b/i, /\btopaz\b/i, /\btanzanite\b/i],
    colorPatterns: [/\bblue\b/i, /\bnavy\b/i, /\bazure\b/i, /\boceanic\b/i, /\bsky\s*blue\b/i],
  },
  {
    name: "purple",
    pattern: /\b(?:purple|violet|amethyst|tanzanite|lavender|lilac)\b/i,
    gemstones: ["amethyst", "tanzanite"],
    gemstonePatterns: [/\bamethyst\b/i, /\btanzanite\b/i],
    colorPatterns: [/\bpurple\b/i, /\bviolet\b/i, /\blavender\b/i, /\blilac\b/i],
  },
  {
    name: "pink",
    pattern: /\b(?:pink|blush|rose\s*quartz|tourmaline|rosette)\b/i,
    gemstones: ["rose quartz", "tourmaline", "quartz"],
    gemstonePatterns: [/\b(?:rose\s*quartz|tourmaline|quartz)\b/i],
    colorPatterns: [/\bpink\b/i, /\bblush\b/i, /\brose\b/i, /\brosette\b/i],
  },
  {
    name: "black",
    pattern: /\b(?:black|noir|onyx)\b/i,
    gemstones: ["onyx"],
    gemstonePatterns: [/\bonyx\b/i],
    colorPatterns: [/\bblack\b/i, /\bnoir\b/i],
  },
  {
    name: "white",
    pattern: /\b(?:white|clear|pearl|moissanite|diamond|crystal|sparkl(?:e|ing)|cz|cubic\s*zirconia)\b/i,
    gemstones: ["pearl", "moissanite", "cubic zirconia", "crystal"],
    gemstonePatterns: [/\bpearl\b/i, /\bmoissanite\b/i, /\b(?:cubic\s*zirconia|cz)\b/i, /\bcrystal\b/i],
    colorPatterns: [/\bwhite\b/i, /\bclear\b/i, /\bsparkl(?:e|ing)\b/i, /\bice\b/i],
  },
];

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

const PRODUCT_CATEGORIES = [
  ["sparkles", "earrings", /\b(?:earrings?|studs?|hoops?|chandeliers?)\b/i],
  ["drops", "necklaces", /\b(?:necklaces?|pendants?|chains?|chokers?)\b/i],
  ["essence", "rings", /\b(?:rings?|bands?)\b/i],
  ["nexus", "bracelets", /\b(?:bracelets?|bangles?|cuffs?)\b/i],
  ["radiance", "anklets", /\banklets?\b/i],
  ["emblem", "brooches", /\b(?:brooch(?:es)?|pins?)\b/i],
] as const;

const PRODUCT_MATERIALS = [
  ["silver", /\b(?:silver|sterling|925)\b/i],
  ["panchadhatu", /\bpanchadhatu\b/i],
  ["gold", /\b(?:yellow gold|rose gold|white gold)\b|\bgold\b(?!\s+(?:stone|gem|gemstone|jewel|colou?r(?:ed)?))/i],
] as const;

export function requestedProductCategory(message: string) {
  return PRODUCT_CATEGORIES.find(([, , pattern]) => pattern.test(message))?.[0];
}

export function productTypeForCategory(category: string) {
  return PRODUCT_CATEGORIES.find(([handle]) => handle === category)?.[1];
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

export type BudgetRange = { min?: number; max?: number; currency?: string };

function budgetCurrency(message: string) {
  if (/\bUSD\b|US\$/i.test(message)) return "USD";
  if (/\bAUD\b|A\$/i.test(message)) return "AUD";
  if (/\bCAD\b|C\$/i.test(message)) return "CAD";
  if (/\bGBP\b|£/i.test(message)) return "GBP";
  if (/\bEUR\b|€/i.test(message)) return "EUR";
  if (/\bINR\b|₹/i.test(message)) return "INR";
  if (/\bNPR\b/i.test(message)) return "NPR";
  if (/\bJPY\b/i.test(message)) return "JPY";
  if (/\bCNY\b/i.test(message)) return "CNY";
  if (/\bAED\b|د\.إ/i.test(message)) return "AED";
  if (/(^|[^AC])\$/i.test(message)) return "USD";
  return undefined;
}

export function parseBudgetRange(message: string): BudgetRange | null {
  const text = message.replace(/,/g, "");
  const currency = budgetCurrency(text);

  // 1. Between $X and/to/- $Y, or $X - $Y, or $X to $Y, or from $X to $Y
  const rangeMatch = text.match(
    /(?:between|from|range\s*(?:of|from)?\s*)?\s*(?:US\$|A\$|C\$|\$|£|€|₹|Rs|¥|د\.إ)?\s*(\d+(?:\.\d{1,2})?)\s*(?:-|–|—|to|and)\s*(?:US\$|A\$|C\$|\$|£|€|₹|Rs|¥|د\.إ)?\s*(\d+(?:\.\d{1,2})?)/i,
  );
  if (rangeMatch) {
    const num1 = Number(rangeMatch[1]);
    const num2 = Number(rangeMatch[2]);
    if (Number.isFinite(num1) && Number.isFinite(num2)) {
      return { min: Math.min(num1, num2), max: Math.max(num1, num2), ...(currency && { currency }) };
    }
  }

  // 2. Over / Above / More than / Min / Minimum / At least / From $X
  const minMatch = text.match(
    /(?:over|above|more than|at least|minimum|min(?: of)?|from)\s*(?:US\$|A\$|C\$|\$|£|€|₹|Rs|¥|د\.إ)?\s*(\d+(?:\.\d{1,2})?)/i,
  );
  if (minMatch) {
    const minVal = Number(minMatch[1]);
    if (Number.isFinite(minVal)) {
      return { min: minVal, ...(currency && { currency }) };
    }
  }

  // 3. Under / Below / Less than / Up to / Maximum / Max / Budget $Y
  const maxMatch = text.match(
    /(?:under|below|less than|up to|maximum|max|budget(?: is| of| around)?|spend(?:ing)?(?: up to)?)\s*(?:US\$|A\$|C\$|\$|£|€|₹|Rs|¥|د\.إ)?\s*(\d+(?:\.\d{1,2})?)/i,
  );
  if (maxMatch) {
    const maxVal = Number(maxMatch[1]);
    if (Number.isFinite(maxVal)) {
      return { max: maxVal, ...(currency && { currency }) };
    }
  }

  return null;
}

export function hasShoppingIntent(message: string) {
  const strongIntent =
    /\b(recommend|suggest|show|find|looking for|shop|buy|gift|options?|compare|pair|matching|similar|alternative|style|favorite|popular|surprise|choose|pick|lower budget|cheaper|more like|different gemstone)\b/i.test(
      message,
    ) ||
    /\b(?:need|want|after|seeking)\b.{0,40}\b(?:jewel(?:lery|ry)|rings?|earrings?|necklaces?|pendants?|bracelets?|brooch(?:es)?)\b/i.test(
      message,
    );
  const informational =
    /\b(care|clean|tarnish|polish|meaning|history|hardness|return|refund|shipping|delivery|warranty|size|sizing|measure)\b|\b(?:what|why|how)\s+(?:is|are|do|does|should|can)\b/i.test(
      message,
    );
  if (informational) return false;
  return Boolean(
    strongIntent ||
      requestedProductCategory(message) ||
      parseBudgetRange(message) ||
      PRODUCT_MATERIALS.some(([, pattern]) => pattern.test(message)) ||
      HARD_PRODUCT_FACTS.some(([, pattern]) => pattern.test(message)) ||
      COLOR_GEMSTONES.some(({ pattern }) => pattern.test(message)) ||
      /\b(?:wedding|bridal|engagement|anniversary|birthday|occasion|classic|elegant|modern|bold|delicate|minimal|statement|vintage|everyday)\b/i.test(
        message,
      ),
  );
}

function literalPattern(value: string) {
  return new RegExp(`\\b${value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:s|es)?\\b`, "i");
}

function productMatchesGemstone(product: ProductRow, gemstone: string): boolean {
  const stonePattern = literalPattern(gemstone);
  const stoneFeature = String(product.features?.Stone || "");
  const secondaryStoneFeature = String(product.features?.["Secondary Stone"] || "");
  return stonePattern.test(stoneFeature) || stonePattern.test(secondaryStoneFeature);
}

function productMatchesColor(product: ProductRow, colorDef: ColorDefinition): boolean {
  const colorFeature = String(product.features?.Color || "");
  const stoneFeature = String(product.features?.Stone || "");
  const secondaryStoneFeature = String(product.features?.["Secondary Stone"] || "");

  if (colorFeature.trim()) {
    return colorDef.colorPatterns.some((pattern) => pattern.test(colorFeature));
  }
  return colorDef.gemstonePatterns.some(
    (pattern) => pattern.test(stoneFeature) || pattern.test(secondaryStoneFeature),
  );
}

function productMatchesMaterial(product: ProductRow, material: string) {
  return (Array.isArray(product.variants) ? product.variants : []).some((variant) =>
    literalPattern(material).test(`${variant.title || ""} ${String(variant.options?.Material || "")}`),
  );
}

function isNegated(message: string, pattern: RegExp) {
  const match = new RegExp(pattern.source, pattern.flags.replace("g", "")).exec(message);
  if (!match?.index) return false;
  return /\b(?:not|no|without|avoid|except|anything\s+but)\s+(?:\w+\s+){0,2}$/i.test(
    message.slice(Math.max(0, match.index - 32), match.index),
  );
}

export type FindProductsOptions = {
  productId?: number | string;
  category?: string;
  preferLowerPrice?: boolean;
  seenProducts?: string[];
  rawMessage?: string;
};

type RelaxedConstraint = "budget" | "category" | "color or gemstone" | "material";

export type ProductSearchResult = {
  products: VerifiedProduct[];
  match: { kind: VerifiedProduct["match"]; relaxed: RelaxedConstraint[] };
};

function budgetInCurrency(
  budget: BudgetRange | null,
  targetCurrency: string,
  rates: Record<string, number>,
): BudgetRange | null {
  if (!budget) return null;
  const sourceCurrency = budget.currency || targetCurrency;
  const sourceRate = sourceCurrency === "USD" ? 1 : rates[sourceCurrency];
  const targetRate = targetCurrency === "USD" ? 1 : rates[targetCurrency];
  if (!Number.isFinite(sourceRate) || sourceRate <= 0 || !Number.isFinite(targetRate) || targetRate <= 0) {
    throw new Error(`No verified exchange rate for ${sourceCurrency} to ${targetCurrency}.`);
  }
  const convert = (amount: number | undefined) =>
    amount === undefined ? undefined : Math.round((amount / sourceRate) * targetRate * 100) / 100;
  return { min: convert(budget.min), max: convert(budget.max), currency: targetCurrency };
}

export function selectVerifiedProducts(
  rows: ProductRow[],
  message: string,
  currency: string,
  rates: Record<string, number>,
  options: FindProductsOptions = {},
): ProductSearchResult {
  const { productId, category: contextualCategory, seenProducts = [], rawMessage = "" } = options;
  const targetMessage = rawMessage || message;
  const category = contextualCategory || requestedProductCategory(targetMessage);
  const parsedBudget = parseBudgetRange(targetMessage) || parseBudgetRange(message);
  const budget = budgetInCurrency(parsedBudget, currency, rates);
  const isLowerBudgetQuery =
    options.preferLowerPrice ||
    /\b(?:lower budget|cheaper|lowest price|lower price|less expensive|more affordable|budget friendly|lowest budget)\b/i.test(
      targetMessage,
    ) ||
    /\b(?:lower budget|cheaper|lowest price|lower price)\b/i.test(message);

  const excludedGemstones = HARD_PRODUCT_FACTS.filter(([, pattern]) => isNegated(targetMessage, pattern)).map(
    ([name]) => name,
  );
  const currentGemstones = HARD_PRODUCT_FACTS.filter(
    ([name, pattern]) => pattern.test(targetMessage) && !excludedGemstones.includes(name),
  ).map(([name]) => name);
  const exactGemstones = currentGemstones.length
    ? currentGemstones
    : HARD_PRODUCT_FACTS.filter(
        ([name, pattern]) => pattern.test(message) && !excludedGemstones.includes(name),
      ).map(([name]) => name);
  const excludedColors = COLOR_GEMSTONES.filter(({ pattern }) => isNegated(targetMessage, pattern));
  const currentColors = COLOR_GEMSTONES.filter(
    ({ name, pattern }) => pattern.test(targetMessage) && !excludedColors.some((color) => color.name === name),
  );
  const matchedColors = currentColors.length
    ? currentColors
    : COLOR_GEMSTONES.filter(
        ({ name, pattern }) => pattern.test(message) && !excludedColors.some((color) => color.name === name),
      );
  const hasExplicitColorOrStone = exactGemstones.length > 0 || matchedColors.length > 0;
  const excludedMaterials = PRODUCT_MATERIALS.filter(([, pattern]) => isNegated(targetMessage, pattern)).map(
    ([name]) => name,
  );
  const requestedMaterials = PRODUCT_MATERIALS.filter(
    ([name, pattern]) => pattern.test(targetMessage) && !excludedMaterials.includes(name),
  ).map(([name]) => name);
  const hasExplicitMaterial = requestedMaterials.length > 0;
  const requireEveryGemstone = exactGemstones.length > 1 && !/\bor\b/i.test(targetMessage);
  const seenSet = new Set(seenProducts.map((product) => product.toLowerCase()));
  const asksAboutCurrent =
    productId !== undefined &&
    /\b(this|current|piece|pair|matching|details?|tell me about)\b/i.test(targetMessage) &&
    !category;
  const asksForDifferentProduct =
    productId !== undefined && /\b(?:pair|matching|similar|alternative|more like|instead|another)\b/i.test(targetMessage);

  const scoredRows = rows.map((product) => {
    const basePrice = usdPrice(product);
    const targetRate = currency === "USD" ? 1 : rates[currency];
    const converted =
      basePrice === null || !Number.isFinite(targetRate)
        ? null
        : Math.round(basePrice * targetRate * 100) / 100;
    const knowledge = productKnowledge(product.title);
    const productFacts = [
      product.title,
      product.description,
      product.category_handle,
      JSON.stringify(product.features || {}),
      knowledge?.content || "",
    ]
      .join(" ")
      .toLowerCase();
    const isCurrent = String(product.id) === String(productId) || product.handle === productId;
    const currentBoost = isCurrent && asksAboutCurrent ? 50 : 0;
    const rawScore = lexicalScore(message, productFacts, product.title) + currentBoost;
    const titleLower = product.title.toLowerCase();
    const isSeen = seenSet.has(product.handle.toLowerCase()) || seenSet.has(titleLower);
    const isExplicitlyRequested = targetMessage.toLowerCase().includes(titleLower);
    const score = !isLowerBudgetQuery && isSeen && !isExplicitlyRequested
      ? Math.max(0.1, rawScore * 0.2 - 2)
      : rawScore;
    const gemstoneMatches = exactGemstones.map((stone) => productMatchesGemstone(product, stone));
    const satisfiesExactGemstones =
      exactGemstones.length === 0 ||
      (requireEveryGemstone ? gemstoneMatches.every(Boolean) : gemstoneMatches.some(Boolean));
    const satisfiesColors =
      matchedColors.length === 0 || matchedColors.some((color) => productMatchesColor(product, color));
    const satisfiesMaterials =
      requestedMaterials.length === 0 || requestedMaterials.some((material) => productMatchesMaterial(product, material));
    const satisfiesExclusions =
      excludedGemstones.every((stone) => !productMatchesGemstone(product, stone)) &&
      excludedColors.every((color) => !productMatchesColor(product, color)) &&
      excludedMaterials.every((material) => !productMatchesMaterial(product, material)) &&
      !(asksForDifferentProduct && isCurrent);
    const satisfiesBudget =
      budget === null ||
      ((budget.min === undefined || (converted !== null && converted >= budget.min)) &&
        (budget.max === undefined || (converted !== null && converted <= budget.max)));
    const satisfiesCategory = !category || product.category_handle === category;
    const violations: RelaxedConstraint[] = [];
    if (hasExplicitColorOrStone && (!satisfiesExactGemstones || !satisfiesColors)) {
      violations.push("color or gemstone");
    }
    if (hasExplicitMaterial && !satisfiesMaterials) violations.push("material");
    if (!satisfiesCategory) violations.push("category");
    if (!satisfiesBudget) violations.push("budget");
    const penalty =
      (violations.includes("color or gemstone") ? 100 : 0) +
      (violations.includes("material") ? 100 : 0) +
      (violations.includes("category") ? 10 : 0) +
      (violations.includes("budget") ? 1 : 0);
    const budgetDistance =
      converted === null || budget === null
        ? Infinity
        : budget.min !== undefined && converted < budget.min
          ? budget.min - converted
          : budget.max !== undefined && converted > budget.max
            ? converted - budget.max
            : 0;

    return { product, converted, rawScore, score, isSeen, satisfiesExclusions, violations, penalty, budgetDistance };
  });

  const eligible = scoredRows.filter(({ satisfiesExclusions }) => satisfiesExclusions);
  const hasHardConstraints = Boolean(budget || category || hasExplicitColorOrStone || hasExplicitMaterial);
  let kind: VerifiedProduct["match"] = hasHardConstraints ? "exact" : "curated";
  let candidates = hasHardConstraints ? eligible.filter(({ penalty }) => penalty === 0) : eligible;
  let relaxed: RelaxedConstraint[] = [];

  if (!candidates.length && eligible.length) {
    kind = "closest";
    const minimumPenalty = Math.min(...eligible.map(({ penalty }) => penalty));
    candidates = eligible.filter(({ penalty }) => penalty === minimumPenalty);
    relaxed = [...new Set(candidates.flatMap(({ violations }) => violations))];
  }

  const relevanceSort = (a: (typeof candidates)[number], b: (typeof candidates)[number]) =>
    a.budgetDistance - b.budgetDistance || b.score - a.score || (a.converted ?? Infinity) - (b.converted ?? Infinity);
  if (isLowerBudgetQuery) {
    candidates.sort(
      (a, b) => (a.converted ?? Infinity) - (b.converted ?? Infinity) || relevanceSort(a, b),
    );
  } else {
    candidates = [
      ...candidates.filter(({ isSeen }) => !isSeen).sort(relevanceSort),
      ...candidates.filter(({ isSeen }) => isSeen).sort(relevanceSort),
    ];
  }

  const products = candidates.slice(0, 4).map(({ product, converted }) => ({
    id: product.id,
    handle: product.handle,
    title: product.title,
    category: product.category_handle,
    url: `/products/${product.handle}/`,
    image: safeImage(product.thumbnail),
    match: kind,
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
        .map((variant) => String(variant.title || ""))
        .filter(Boolean),
    },
  }));

  return { products, match: { kind, relaxed } };
}

export async function findVerifiedProducts(
  message: string,
  currency: string,
  options: FindProductsOptions | number | string = {},
  legacyCategory?: string,
  legacyPreferLowerPrice = false,
): Promise<ProductSearchResult> {
  const opts: FindProductsOptions =
    typeof options === "object" && options !== null
      ? options
      : {
          productId: options,
          category: legacyCategory,
          preferLowerPrice: legacyPreferLowerPrice,
        };

  const result = await query(
    `SELECT id, handle, title, description, price, currency, thumbnail, images,
            variants, category_handle, features
       FROM products`,
  );
  const rows = result.rows as ProductRow[];
  const targetMessage = opts.rawMessage || message;
  const parsedBudget = parseBudgetRange(targetMessage) || parseBudgetRange(message);
  const needsRates = currency !== "USD" || Boolean(parsedBudget?.currency && parsedBudget.currency !== "USD");
  const rates = needsRates ? await getExchangeRates() : { USD: 1 };
  return selectVerifiedProducts(rows, message, currency, rates, opts);
}
