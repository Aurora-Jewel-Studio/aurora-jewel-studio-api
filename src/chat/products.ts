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

const PRODUCT_CATEGORIES = [
  ["sparkles", /\b(?:earrings?|studs?|hoops?|chandeliers?)\b/i],
  ["drops", /\b(?:necklaces?|pendants?|chains?)\b/i],
  ["essence", /\brings?\b/i],
  ["nexus", /\b(?:bracelets?|bangles?|cuffs?)\b/i],
  ["radiance", /\banklets?\b/i],
  ["emblem", /\bbrooch(?:es)?\b/i],
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
  return /\b(recommend|suggest|show|find|looking for|shop|buy|gift|piece|something|options?|jewel(?:ry|lery)|rings?|necklaces?|pendants?|earrings?|bracelets?|bangles?|brooch(?:es)?|anklets?|collection|wedding|bridal|engagement|anniversary|birthday|occasion|ruby|emerald|sapphire|stone|product)\b/i.test(
    message,
  );
}

export async function findVerifiedProducts(
  message: string,
  currency: string,
  productId?: number | string,
  category?: string,
  preferLowerPrice = false,
): Promise<VerifiedProduct[]> {
  if (!hasShoppingIntent(message) && productId === undefined) return [];

  const result = await query(
    `SELECT id, handle, title, description, price, currency, thumbnail, images,
            variants, category_handle, features
       FROM products`,
  );
  const rows = result.rows as ProductRow[];
  const rate = currency === "USD" ? 1 : (await getExchangeRates())[currency];
  if (!Number.isFinite(rate) || rate <= 0) throw new Error(`No verified ${currency} exchange rate.`);
  const budget = budgetFrom(message);
  const requiredFacts = HARD_PRODUCT_FACTS.filter(([, pattern]) => pattern.test(message)).map(([name]) => name);

  return rows
    .map((product) => {
      const basePrice = usdPrice(product);
      const converted = basePrice === null ? null : Math.round(basePrice * rate * 100) / 100;
      const knowledge = productKnowledge(product.title);
      const productFacts = JSON.stringify(product.features || {}).toLowerCase();
      const searchText = [
        product.title,
        product.description,
        product.category_handle,
        JSON.stringify(product.features || {}),
        knowledge?.content || "",
      ].join(" ");
      const current = String(product.id) === String(productId) || product.handle === productId;
      const score = lexicalScore(message, searchText, product.title) + (current ? 100 : 0);
      return { product, converted, score, productFacts };
    })
    .filter(
      ({ product, converted, score, productFacts }) =>
        score > 0 &&
        (!category || product.category_handle === category) &&
        requiredFacts.every((fact) => productFacts.includes(fact)) &&
        (budget === null || (converted !== null && converted <= budget)),
    )
    .sort((a, b) =>
      preferLowerPrice
        ? (a.converted ?? Infinity) - (b.converted ?? Infinity) || b.score - a.score
        : b.score - a.score || (a.converted ?? Infinity) - (b.converted ?? Infinity),
    )
    .slice(0, 4)
    .map(({ product, converted }) => ({
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
