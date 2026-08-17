import { NextFunction, Request, Response } from "express";
import { z } from "zod";

const text = (max: number, min = 1) => z.string().trim().min(min).max(max);
const optionalText = (max: number) => z.string().trim().max(max).optional().nullable();
const email = z.string().trim().toLowerCase().email().max(254);
const id = z.coerce.number().int().positive();
const queryInteger = z.preprocess(
  (value) => (typeof value === "string" && /^\d+$/.test(value) ? Number(value) : value),
  z.number().int()
);
const phone = z
  .string()
  .trim()
  .max(30)
  .refine((value) => !value || /^[0-9+().\-\s]{5,30}$/.test(value), "Invalid phone number")
  .optional()
  .nullable();
const slug = z.string().trim().toLowerCase().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(255);
const currency = z.string().trim().toLowerCase().regex(/^[a-z]{3}$/);
const assetUrl = z.string().trim().max(500).refine((value) => {
  if (value.startsWith("/")) return !value.startsWith("//");
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}, "Image URL must be a relative path or HTTPS URL");

const referenceImage = z
  .string()
  .max(1_400_000)
  .regex(/^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/)
  .refine((value) => Buffer.byteLength(value.slice(value.indexOf(",") + 1), "base64") <= 1024 * 1024, {
    message: "Reference image must be 1MB or smaller",
  })
  .optional()
  .nullable();

const features = z
  .record(text(100), z.string().trim().max(1_000))
  .refine((value) => Object.keys(value).length <= 50, "Too many product features")
  .optional()
  .nullable();

const productFields = {
  handle: slug,
  title: text(255),
  description: text(20_000),
  price: z.number().finite().nonnegative().max(10_000_000),
  currency,
  thumbnail: assetUrl,
  images: z.array(z.object({ url: assetUrl, alt: optionalText(300) })).max(20).optional(),
  category_handle: slug,
  weight: z.number().finite().nonnegative().max(100_000).optional().nullable(),
  features,
};

const orderIdBody = z.object({ order_id: id });
const chatLocale = z.enum(["en", "en-US", "en-GB", "en-AU", "en-IN", "en-NP", "ne-NP"]);
const chatCurrency = z.enum(["USD", "GBP", "AUD", "CAD", "EUR", "NPR", "INR", "JPY", "CNY", "AED"]);
const chatTurn = z
  .object({
    role: z.enum(["user", "assistant"]),
    content: text(1_000),
  })
  .strict();
const chatCartItem = z
  .object({
    variantId: text(120),
    productHandle: slug,
    title: text(255),
    variantTitle: text(100),
    quantity: z.number().int().min(1).max(99),
  })
  .strict();

export const schemas = {
  adminLogin: z.object({ email, password: z.string().min(1).max(256) }),
  idParams: z.object({ id }),
  handleParams: z.object({ handle: slug }),
  contact: z.object({
    name: text(200),
    email,
    subject: text(300),
    message: text(5_000),
    website: z.string().max(200).optional(),
  }),
  bespoke: z
    .object({
      first_name: text(100),
      last_name: text(100),
      email,
      phone,
      budget: optionalText(50),
      description: optionalText(10_000),
      message: optionalText(10_000),
      inquiry_type: z.enum(["Custom", "B2B", "Retail", "Other"]).default("Custom"),
      reference_image: referenceImage,
      company_name: optionalText(200),
      country: optionalText(100),
      buyer_type: optionalText(100),
      order_quantity_range: optionalText(100),
      website: z.string().max(200).optional(),
    })
    .refine((value) => Boolean(value.message || value.description), {
      message: "Message is required",
      path: ["message"],
    }),
  bespokeStatus: z.object({
    status: z.enum(["pending", "contacted", "in_progress", "completed", "cancelled"]),
  }),
  order: z.object({
    items: z
      .array(
        z.object({
          variantId: text(255),
          productHandle: slug,
          quantity: z.number().int().min(1).max(20),
        })
      )
      .min(1)
      .max(50),
    customer_name: text(200),
    customer_email: email,
    customer_phone: phone,
    shipping_address: optionalText(1_000),
    currency: currency.default("usd"),
    payment_method: z.enum(["cod", "stripe", "paypal", "khalti", "esewa"]).default("cod"),
  }),
  orderStatus: z
    .object({
      order_status: z.enum(["pending", "processing", "shipped", "delivered", "cancelled"]).optional(),
      payment_status: z.enum(["pending", "paid", "failed", "refunded"]).optional(),
      payment_reference: text(255).optional().nullable(),
    })
    .refine((value) => Object.values(value).some((item) => item !== undefined && item !== null), {
      message: "At least one update field is required",
    }),
  productCreate: z.object({ ...productFields, currency: currency.default("npr") }),
  productUpdate: z
    .object(productFields)
    .partial()
    .refine((value) => Object.keys(value).length > 0, "At least one update field is required"),
  productList: z.object({
    q: z.string().trim().max(100).optional(),
    category: slug.optional(),
    page: queryInteger.pipe(z.number().min(1)).optional(),
    limit: queryInteger.pipe(z.number().min(1).max(100)).optional(),
  }),
  chat: z
    .object({
      message: text(1_000),
      history: z.array(chatTurn).max(8).default([]),
      channel: z.literal("website"),
      currency: chatCurrency,
      locale: chatLocale,
      cart: z.array(chatCartItem).max(50).default([]),
      pageUrl: z
        .url()
        .max(2_048)
        .refine((value) => ["http:", "https:"].includes(new URL(value).protocol), "Invalid page URL"),
      productId: z.union([z.number().int().positive(), slug]).optional(),
      refinement: z.literal("lower_price").optional(),
    })
    .strict(),
  stripeCheckout: orderIdBody,
  stripeVerify: z.object({ session_id: text(255), order_id: id.optional() }),
  paypalCreate: orderIdBody,
  paypalCapture: z.object({ order_id: id, paypal_order_id: text(255) }),
  khaltiInitiate: orderIdBody,
  khaltiVerify: z.object({ pidx: text(255), order_id: id.optional() }),
  esewaInitiate: orderIdBody,
  esewaVerify: z
    .object({ order_id: id.optional(), oid: text(255).optional() })
    .refine((value) => value.order_id || value.oid, "order_id or oid is required"),
};

type Source = "body" | "params" | "query";

export function validate(source: Source, schema: z.ZodType) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      const details = result.error.issues.map(({ path, message }) => ({
        field: path.join("."),
        message,
      }));
      res.status(400).json({
        success: false,
        error: "Invalid request.",
        message: details[0]?.message || "Validation failed.",
        details,
      });
      return;
    }

    if (source === "query") {
      res.locals.validatedQuery = result.data;
    } else {
      req[source] = result.data as never;
    }
    next();
  };
}

export function logError(context: string, error: unknown) {
  console.error(`${context}:`, error instanceof Error ? error.message : "Unknown error");
}
