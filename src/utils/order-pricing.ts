import { query } from "../db";

type VariantPriceMap = Record<string, number | string>;

interface ProductRow {
  handle: string;
  title: string;
  price: number | string;
  currency: string;
  thumbnail: string;
  variants: Array<{
    id?: string;
    title?: string;
    sku?: string;
    options?: Record<string, string>;
    prices?: VariantPriceMap;
  }>;
}

export interface PricedCartItem {
  variantId: string;
  productHandle: string;
  title: string;
  variantTitle: string;
  sku?: string;
  price: number;
  currencyCode: string;
  quantity: number;
  thumbnail: string;
  subtotal: number;
}

export interface PricedCart {
  items: PricedCartItem[];
  totalAmount: number;
  currency: string;
}

export class CartPricingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CartPricingError";
  }
}

function asMoney(value: unknown): number | null {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0) return null;
  return Math.round(amount * 100) / 100;
}

function getVariantKey(productHandle: string, variant: { id?: string; sku?: string; title?: string }) {
  return variant.id || variant.sku || `${productHandle}:${variant.title || "default"}`;
}

function getVariantPrice(product: ProductRow, variant: ProductRow["variants"][number], requestedCurrency: string) {
  const prices = variant.prices || {};
  const requestedPrice = asMoney(prices[requestedCurrency]);
  if (requestedPrice !== null) {
    return { price: requestedPrice, currency: requestedCurrency };
  }

  const usdPrice = asMoney(prices.usd);
  if (usdPrice !== null) {
    return { price: usdPrice, currency: "usd" };
  }

  const productPrice = asMoney(product.price);
  if (productPrice !== null) {
    return { price: productPrice, currency: (product.currency || "usd").toLowerCase() };
  }

  return null;
}

function normalizeQuantity(value: unknown): number | null {
  const quantity = Number(value);
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 20) return null;
  return quantity;
}

export async function priceCartItems(rawItems: unknown, requestedCurrency = "usd"): Promise<PricedCart> {
  if (!Array.isArray(rawItems) || rawItems.length === 0 || rawItems.length > 50) {
    throw new CartPricingError("Cart must contain between 1 and 50 items.");
  }

  const result = await query(
    "SELECT handle, title, price, currency, thumbnail, variants FROM products"
  );
  const products = result.rows as ProductRow[];
  const productsByHandle = new Map(products.map((product) => [product.handle, product]));

  const currency = requestedCurrency.toLowerCase();
  let cartCurrency: string | null = null;

  const pricedItems = rawItems.map((rawItem, index) => {
    const item = rawItem as Record<string, unknown>;
    const quantity = normalizeQuantity(item.quantity);
    if (!quantity) {
      throw new CartPricingError(`Invalid quantity for cart item ${index + 1}.`);
    }

    const productHandle = typeof item.productHandle === "string" ? item.productHandle : "";
    const variantId = typeof item.variantId === "string" ? item.variantId : "";
    const variantTitle = typeof item.variantTitle === "string" ? item.variantTitle : "";

    const product =
      productsByHandle.get(productHandle) ||
      products.find((candidate) =>
        candidate.variants?.some(
          (variant) => variant.id === variantId || variant.sku === variantId
        )
      );

    if (!product) {
      throw new CartPricingError(`Unknown product in cart item ${index + 1}.`);
    }

    const variants = Array.isArray(product.variants) ? product.variants : [];
    const variant =
      variants.find((candidate) => {
        const key = getVariantKey(product.handle, candidate);
        return (
          (variantId && (candidate.id === variantId || candidate.sku === variantId || key === variantId)) ||
          (variantTitle && candidate.title === variantTitle)
        );
      }) || variants[0];

    if (!variant) {
      throw new CartPricingError(`No purchasable variant found for ${product.title}.`);
    }

    const priced = getVariantPrice(product, variant, currency);
    if (!priced) {
      throw new CartPricingError(`No valid price found for ${product.title}.`);
    }

    if (cartCurrency && cartCurrency !== priced.currency) {
      throw new CartPricingError("Cart contains mixed currencies.");
    }
    cartCurrency = priced.currency;

    const canonicalVariantId = getVariantKey(product.handle, variant);
    const subtotal = Math.round(priced.price * quantity * 100) / 100;

    return {
      variantId: canonicalVariantId,
      productHandle: product.handle,
      title: product.title,
      variantTitle: variant.title || "Default",
      sku: variant.sku,
      price: priced.price,
      currencyCode: priced.currency,
      quantity,
      thumbnail: product.thumbnail,
      subtotal,
    };
  });

  const totalAmount = Math.round(
    pricedItems.reduce((sum, item) => sum + item.subtotal, 0) * 100
  ) / 100;

  return {
    items: pricedItems,
    totalAmount,
    currency: cartCurrency || currency,
  };
}
