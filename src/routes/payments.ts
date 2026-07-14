import { Router } from "express";
import { Request, Response } from "express";
import Stripe from "stripe";
import { query } from "../db";
import crypto from "crypto";
import { logError, schemas, validate } from "../validation";

const router = Router();
router.use((_req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
});

const PAYPAL_SANDBOX_API = "https://api-m.sandbox.paypal.com";
const PAYPAL_LIVE_API = "https://api-m.paypal.com";
const ESEWA_TEST_PAYMENT_URL = "https://rc-epay.esewa.com.np/api/epay/main/v2/form";
const ESEWA_LIVE_PAYMENT_URL = "https://epay.esewa.com.np/api/epay/main/v2/form";
const ESEWA_TEST_STATUS_URL = "https://rc.esewa.com.np/api/epay/transaction/status/";
const ESEWA_LIVE_STATUS_URL = "https://esewa.com.np/api/epay/transaction/status/";

function getFrontendUrl() {
  const value = process.env.FRONTEND_URL || "http://localhost:3000";
  const url = new URL(value);
  if (process.env.NODE_ENV === "production" && url.protocol !== "https:") {
    throw new Error("FRONTEND_URL must use HTTPS in production.");
  }
  return url.origin;
}

async function getOrderForPayment(orderId: unknown) {
  const id = Number(orderId);
  if (!Number.isInteger(id) || id < 1) return null;

  const result = await query("SELECT * FROM orders WHERE id = $1", [id]);
  return result.rows[0] || null;
}

function moneyToMinorUnits(amount: unknown) {
  const numericAmount = Number(amount);
  if (!Number.isFinite(numericAmount) || numericAmount <= 0) return null;
  return Math.round(numericAmount * 100);
}

function requireNprOrder(order: any) {
  return String(order.currency || "").toLowerCase() === "npr";
}

function getStripeClient() {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) return null;
  return new Stripe(secretKey);
}

function formatAmount(amount: unknown) {
  const numericAmount = Number(amount);
  if (!Number.isFinite(numericAmount) || numericAmount <= 0) return null;
  return numericAmount.toFixed(2);
}

function assertStripeOrderMatch(session: Stripe.Checkout.Session, order: any) {
  const expectedAmount = moneyToMinorUnits(order.total_amount);
  const expectedCurrency = String(order.currency || "").toLowerCase();
  return (
    session.payment_status === "paid" &&
    session.metadata?.order_id === String(order.id) &&
    session.amount_total === expectedAmount &&
    session.currency === expectedCurrency
  );
}

async function markOrderPaid(orderId: number, paymentMethod: string, paymentReference: string) {
  await query(
    `UPDATE orders
     SET payment_status = 'paid', payment_method = $1, payment_reference = $2
     WHERE id = $3 AND payment_status <> 'paid'`,
    [paymentMethod, paymentReference, orderId]
  );
}

function getPayPalConfig() {
  const isLive = process.env.PAYPAL_ENV === "live";
  const clientId =
    process.env.PAYPAL_CLIENT_ID ||
    process.env.PAYPAL_SANDBOX_CLIENT_ID;
  const clientSecret =
    process.env.PAYPAL_CLIENT_SECRET ||
    process.env.PAYPAL_SANDBOX_CLIENT_SECRET;

  return {
    clientId,
    clientSecret,
    baseUrl: isLive ? PAYPAL_LIVE_API : PAYPAL_SANDBOX_API,
    env: isLive ? "live" : "sandbox",
  };
}

async function getPayPalAccessToken() {
  const config = getPayPalConfig();
  const { clientId, clientSecret, baseUrl } = config;
  if (!clientId || !clientSecret) return null;

  const response = await fetch(`${baseUrl}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
    signal: AbortSignal.timeout(10_000),
  });

  if (!response.ok) {
    throw new Error(`PayPal token request failed with status ${response.status}`);
  }

  const data = (await response.json()) as { access_token: string };
  return { accessToken: data.access_token, baseUrl, env: config.env };
}

function getPayPalApprovalUrl(data: any) {
  const links = Array.isArray(data.links) ? data.links : [];
  const href = links.find((link: any) => link.rel === "approve")?.href;
  if (!href) return null;
  const url = new URL(href);
  const isPayPal = url.hostname === "paypal.com" || url.hostname.endsWith(".paypal.com");
  return url.protocol === "https:" && isPayPal ? href : null;
}

function getEsewaConfig() {
  const live = process.env.ESEWA_ENV === "live";
  return {
    merchantCode: process.env.ESEWA_MERCHANT_CODE,
    secretKey: process.env.ESEWA_SECRET_KEY,
    paymentUrl: live ? ESEWA_LIVE_PAYMENT_URL : ESEWA_TEST_PAYMENT_URL,
    statusUrl: live ? ESEWA_LIVE_STATUS_URL : ESEWA_TEST_STATUS_URL,
  };
}

export function createEsewaSignature(totalAmount: string, transactionUuid: string, productCode: string, secret: string) {
  const message = `total_amount=${totalAmount},transaction_uuid=${transactionUuid},product_code=${productCode}`;
  return crypto.createHmac("sha256", secret).update(message).digest("base64");
}

function assertPayPalOrderMatch(data: any, order: any) {
  const purchaseUnit = data.purchase_units?.[0];
  const capture = purchaseUnit?.payments?.captures?.[0];
  const amount = capture?.amount || purchaseUnit?.amount;
  const expectedAmount = formatAmount(order.total_amount);
  const expectedCurrency = String(order.currency || "").toUpperCase();

  return (
    data.status === "COMPLETED" &&
    String(purchaseUnit?.reference_id) === String(order.id) &&
    amount?.value === expectedAmount &&
    amount?.currency_code === expectedCurrency
  );
}

export async function handleStripeWebhook(req: Request, res: Response) {
  const stripe = getStripeClient();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!stripe || !webhookSecret) {
    res.status(503).json({ error: "Stripe webhook is not configured." });
    return;
  }

  const signature = req.headers["stripe-signature"];
  if (!signature) {
    res.status(400).json({ error: "Missing Stripe signature." });
    return;
  }

  try {
    const event = stripe.webhooks.constructEvent(
      req.body,
      signature,
      webhookSecret
    );

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const order = await getOrderForPayment(session.metadata?.order_id);

      if (order && assertStripeOrderMatch(session, order)) {
        await markOrderPaid(order.id, "stripe", session.id);
      }
    }

    res.json({ received: true });
  } catch (error: any) {
    logError("Stripe webhook error", error);
    res.status(400).json({ error: "Invalid Stripe webhook." });
  }
}

// =============================================================================
// STRIPE CHECKOUT INTEGRATION
// Sandbox: use STRIPE_SECRET_KEY=sk_test_... and Stripe CLI webhook forwarding.
// =============================================================================

router.post(
  "/stripe/create-checkout-session",
  validate("body", schemas.stripeCheckout),
  async (req, res) => {
  try {
    const { order_id } = req.body;
    const stripe = getStripeClient();

    if (!stripe) {
      res.status(503).json({ error: "Stripe payment is not configured." });
      return;
    }

    const order = await getOrderForPayment(order_id);
    if (!order) {
      res.status(404).json({ error: "Order not found." });
      return;
    }
    if (order.payment_status === "paid") {
      res.status(409).json({ error: "Order is already paid." });
      return;
    }

    const currency = String(order.currency || "usd").toLowerCase();
    const items = Array.isArray(order.items) ? order.items : [];
    const lineItems = items.map((item: any) => {
      const unitAmount = moneyToMinorUnits(item.price);
      if (!unitAmount) {
        throw new Error(`Invalid price for ${item.title || "cart item"}.`);
      }

      return {
        quantity: item.quantity,
        price_data: {
          currency,
          unit_amount: unitAmount,
          product_data: {
            name: item.title,
            description: item.variantTitle,
            images:
              typeof item.thumbnail === "string" && item.thumbnail.startsWith("http")
                ? [item.thumbnail]
                : undefined,
          },
        },
      };
    });

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      success_url: `${getFrontendUrl()}/checkout/success?method=stripe&order_id=${order.id}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${getFrontendUrl()}/checkout?cancelled=stripe`,
      client_reference_id: String(order.id),
      customer_email: order.customer_email,
      metadata: {
        order_id: String(order.id),
      },
      payment_intent_data: {
        metadata: {
          order_id: String(order.id),
        },
      },
      line_items: lineItems,
    });

    res.json({ checkout_url: session.url, session_id: session.id });
  } catch (error) {
    logError("Stripe checkout error", error);
    res.status(500).json({ error: "Failed to create Stripe checkout session." });
  }
  }
);

router.post(
  "/stripe/verify-session",
  validate("body", schemas.stripeVerify),
  async (req, res) => {
  try {
    const { session_id, order_id } = req.body;
    const stripe = getStripeClient();

    if (!stripe) {
      res.status(503).json({ error: "Stripe payment is not configured." });
      return;
    }

    if (!session_id) {
      res.status(400).json({ error: "session_id is required." });
      return;
    }

    const session = await stripe.checkout.sessions.retrieve(session_id);
    const order = await getOrderForPayment(order_id || session.metadata?.order_id);

    if (!order) {
      res.status(404).json({ error: "Order not found." });
      return;
    }

    if (!assertStripeOrderMatch(session, order)) {
      res.status(400).json({ error: "Stripe session does not match the order." });
      return;
    }

    await markOrderPaid(order.id, "stripe", session.id);
    res.json({ status: "verified", order_id: order.id });
  } catch (error) {
    logError("Stripe verify error", error);
    res.status(500).json({ error: "Failed to verify Stripe session." });
  }
  }
);

// =============================================================================
// PAYPAL CHECKOUT INTEGRATION
// Sandbox: PAYPAL_ENV=sandbox with sandbox client credentials.
// =============================================================================

router.post(
  "/paypal/create-order",
  validate("body", schemas.paypalCreate),
  async (req, res) => {
  try {
    const { order_id } = req.body;
    const paypal = await getPayPalAccessToken();

    if (!paypal) {
      res.status(503).json({ error: "PayPal payment is not configured." });
      return;
    }

    const order = await getOrderForPayment(order_id);
    if (!order) {
      res.status(404).json({ error: "Order not found." });
      return;
    }
    if (order.payment_status === "paid") {
      res.status(409).json({ error: "Order is already paid." });
      return;
    }

    const amount = formatAmount(order.total_amount);
    if (!amount) {
      res.status(400).json({ error: "Order total is invalid." });
      return;
    }

    const currency = String(order.currency || "usd").toUpperCase();
    const response = await fetch(`${paypal.baseUrl}/v2/checkout/orders`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${paypal.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        intent: "CAPTURE",
        purchase_units: [
          {
            reference_id: String(order.id),
            invoice_id: `AURORA-${order.id}`,
            amount: {
              currency_code: currency,
              value: amount,
            },
          },
        ],
        application_context: {
          brand_name: "Aurora Jewel Studio",
          landing_page: "BILLING",
          user_action: "PAY_NOW",
          return_url: `${getFrontendUrl()}/checkout/success?method=paypal&order_id=${order.id}`,
          cancel_url: `${getFrontendUrl()}/checkout?cancelled=paypal`,
        },
      }),
      signal: AbortSignal.timeout(10_000),
    });

    const data = (await response.json()) as any;
    if (!response.ok) {
      logError("PayPal create order error", new Error(`Upstream status ${response.status}`));
      res.status(502).json({ error: "PayPal order creation failed." });
      return;
    }

    const approveUrl = getPayPalApprovalUrl(data);
    if (!approveUrl) {
      res.status(502).json({ error: "PayPal did not return an approval URL." });
      return;
    }

    res.json({ paypal_order_id: data.id, approve_url: approveUrl });
  } catch (error) {
    logError("PayPal create order error", error);
    res.status(500).json({ error: "Failed to create PayPal order." });
  }
  }
);

router.post(
  "/paypal/capture-order",
  validate("body", schemas.paypalCapture),
  async (req, res) => {
  try {
    const { order_id, paypal_order_id } = req.body;
    const paypal = await getPayPalAccessToken();

    if (!paypal) {
      res.status(503).json({ error: "PayPal payment is not configured." });
      return;
    }

    const order = await getOrderForPayment(order_id);
    if (!order) {
      res.status(404).json({ error: "Order not found." });
      return;
    }

    const response = await fetch(
      `${paypal.baseUrl}/v2/checkout/orders/${encodeURIComponent(paypal_order_id)}/capture`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${paypal.accessToken}`,
          "Content-Type": "application/json",
        },
        signal: AbortSignal.timeout(10_000),
      }
    );

    const data = (await response.json()) as any;
    if (!response.ok) {
      logError("PayPal capture error", new Error(`Upstream status ${response.status}`));
      res.status(502).json({ error: "PayPal capture failed." });
      return;
    }

    if (!assertPayPalOrderMatch(data, order)) {
      res.status(400).json({ error: "PayPal capture does not match the order." });
      return;
    }

    await markOrderPaid(order.id, "paypal", data.id);
    res.json({ status: "verified", order_id: order.id });
  } catch (error) {
    logError("PayPal capture error", error);
    res.status(500).json({ error: "Failed to capture PayPal order." });
  }
  }
);

// =============================================================================
// KHALTI PAYMENT INTEGRATION
// Docs: https://docs.khalti.com/khalti-epayment/
// =============================================================================

interface KhaltiInitiateResponse {
  pidx: string;
  payment_url: string;
  expires_at: string;
  expires_in: number;
}

interface KhaltiLookupResponse {
  pidx: string;
  status: string;
  total_amount: number;
  fee: number;
  transaction_id: string;
  purchase_order_id: string;
  purchase_order_name: string;
}

/**
 * POST /api/payments/khalti/initiate
 * Initiates a Khalti payment session for an order.
 * Body: { order_id, amount, customer_name, customer_email, customer_phone }
 */
router.post(
  "/khalti/initiate",
  validate("body", schemas.khaltiInitiate),
  async (req, res) => {
  try {
    const { order_id } = req.body;

    const order = await getOrderForPayment(order_id);
    if (!order) {
      res.status(404).json({ error: "Order not found." });
      return;
    }
    if (order.payment_status === "paid") {
      res.status(409).json({ error: "Order is already paid." });
      return;
    }

    if (!requireNprOrder(order)) {
      res.status(400).json({ error: "Khalti payments require an NPR order." });
      return;
    }

    const amount = moneyToMinorUnits(order.total_amount);
    if (!amount) {
      res.status(400).json({ error: "Order total is invalid." });
      return;
    }

    const KHALTI_SECRET = process.env.KHALTI_SECRET_KEY;
    if (!KHALTI_SECRET) {
      res.status(503).json({ error: "Khalti payment is not configured." });
      return;
    }

    // Call Khalti ePayment API
    const response = await fetch(
      "https://a.khalti.com/api/v2/epayment/initiate/",
      {
        method: "POST",
        headers: {
          Authorization: `Key ${KHALTI_SECRET}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          return_url: `${getFrontendUrl()}/checkout/success`,
          website_url: getFrontendUrl(),
          amount, // Khalti expects paisa
          purchase_order_id: String(order_id),
          purchase_order_name: `Aurora Jewel Order #${order_id}`,
          customer_info: {
            name: order.customer_name,
            email: order.customer_email,
            phone: order.customer_phone || "",
          },
        }),
        signal: AbortSignal.timeout(10_000),
      }
    );

    const data = (await response.json()) as KhaltiInitiateResponse;

    if (!response.ok) {
      logError("Khalti initiate error", new Error(`Upstream status ${response.status}`));
      res.status(502).json({ error: "Khalti payment initiation failed." });
      return;
    }

    // data contains: { pidx, payment_url, expires_at, expires_in }
    res.json({
      payment_url: data.payment_url,
      pidx: data.pidx,
    });
  } catch (error) {
    logError("Khalti initiate error", error);
    res.status(500).json({ error: "Failed to initiate Khalti payment." });
  }
  }
);

/**
 * POST /api/payments/khalti/verify
 * Verifies a Khalti payment callback.
 * Body: { pidx, order_id }
 */
router.post(
  "/khalti/verify",
  validate("body", schemas.khaltiVerify),
  async (req, res) => {
  try {
    const { pidx, order_id } = req.body;

    const KHALTI_SECRET = process.env.KHALTI_SECRET_KEY;
    if (!KHALTI_SECRET) {
      res.status(503).json({ error: "Khalti payment is not configured." });
      return;
    }

    // Verify with Khalti
    const response = await fetch(
      "https://a.khalti.com/api/v2/epayment/lookup/",
      {
        method: "POST",
        headers: {
          Authorization: `Key ${KHALTI_SECRET}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ pidx }),
        signal: AbortSignal.timeout(10_000),
      }
    );

    const data = (await response.json()) as KhaltiLookupResponse;

    if (!response.ok || data.status !== "Completed") {
      logError("Khalti verify failed", new Error(`Upstream status ${response.status}`));
      res.status(400).json({ error: "Payment verification failed." });
      return;
    }

    const order = await getOrderForPayment(order_id || data.purchase_order_id);
    if (!order) {
      res.status(404).json({ error: "Order not found." });
      return;
    }

    const expectedAmount = moneyToMinorUnits(order.total_amount);
    if (
      !expectedAmount ||
      data.total_amount !== expectedAmount ||
      String(data.purchase_order_id) !== String(order.id)
    ) {
      res.status(400).json({ error: "Payment details do not match the order." });
      return;
    }

    if (!requireNprOrder(order)) {
      res.status(400).json({ error: "Khalti payments require an NPR order." });
      return;
    }

    await markOrderPaid(order.id, "khalti", pidx);

    res.json({ status: "verified", transaction: data });
  } catch (error) {
    logError("Khalti verify error", error);
    res.status(500).json({ error: "Failed to verify Khalti payment." });
  }
  }
);

// =============================================================================
// ESEWA PAYMENT INTEGRATION
// Docs: https://developer.esewa.com.np/
// =============================================================================

/**
 * POST /api/payments/esewa/initiate
 * Generates signed ePay v2 form data.
 * Body: { order_id }
 */
router.post(
  "/esewa/initiate",
  validate("body", schemas.esewaInitiate),
  async (req, res) => {
  try {
    const { order_id } = req.body;

    const order = await getOrderForPayment(order_id);
    if (!order) {
      res.status(404).json({ error: "Order not found." });
      return;
    }
    if (order.payment_status === "paid") {
      res.status(409).json({ error: "Order is already paid." });
      return;
    }

    if (!requireNprOrder(order)) {
      res.status(400).json({ error: "eSewa payments require an NPR order." });
      return;
    }

    const config = getEsewaConfig();
    if (!config.merchantCode || !config.secretKey) {
      res.status(503).json({ error: "eSewa payment is not configured." });
      return;
    }

    const amount = formatAmount(order.total_amount);
    if (!amount) {
      res.status(400).json({ error: "Order total is invalid." });
      return;
    }

    const transactionUuid = `AURORA-${order.id}-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;
    const signature = createEsewaSignature(
      amount,
      transactionUuid,
      config.merchantCode,
      config.secretKey
    );
    await query(
      `UPDATE orders SET payment_method = 'esewa', payment_reference = $1
       WHERE id = $2 AND payment_status <> 'paid'`,
      [transactionUuid, order.id]
    );

    res.json({
      payment_url: config.paymentUrl,
      form_data: {
        amount,
        tax_amount: "0",
        total_amount: amount,
        transaction_uuid: transactionUuid,
        product_code: config.merchantCode,
        product_service_charge: "0",
        product_delivery_charge: "0",
        success_url: `${getFrontendUrl()}/checkout/success?method=esewa&order_id=${order.id}`,
        failure_url: `${getFrontendUrl()}/checkout/failure?method=esewa&order_id=${order.id}`,
        signed_field_names: "total_amount,transaction_uuid,product_code",
        signature,
      },
    });
  } catch (error) {
    logError("eSewa initiate error", error);
    res.status(500).json({ error: "Failed to initiate eSewa payment." });
  }
  }
);

/**
 * POST /api/payments/esewa/verify
 * Verifies payment using eSewa's server-to-server status endpoint.
 * Body: { order_id } or { oid: transaction_uuid }
 */
router.post(
  "/esewa/verify",
  validate("body", schemas.esewaVerify),
  async (req, res) => {
  try {
    const { oid, order_id } = req.body;

    const config = getEsewaConfig();
    if (!config.merchantCode) {
      res.status(503).json({ error: "eSewa payment is not configured." });
      return;
    }

    let order = order_id ? await getOrderForPayment(order_id) : null;
    if (!order && oid) {
      const result = await query(
        "SELECT * FROM orders WHERE payment_method = 'esewa' AND payment_reference = $1",
        [oid]
      );
      order = result.rows[0] || null;
    }
    if (!order) {
      res.status(404).json({ error: "Order not found." });
      return;
    }
    if (order.payment_method !== "esewa" && order.payment_status === "paid") {
      res.status(400).json({ error: "Order was paid with a different method." });
      return;
    }
    if (order.payment_status === "paid") {
      res.json({ status: "verified", order_id: order.id });
      return;
    }
    if (!requireNprOrder(order)) {
      res.status(400).json({ error: "eSewa payments require an NPR order." });
      return;
    }

    const transactionUuid = String(order.payment_reference || "");
    const amount = formatAmount(order.total_amount);
    if (!transactionUuid || !amount) {
      res.status(400).json({ error: "Order has no active eSewa payment." });
      return;
    }

    const params = new URLSearchParams({
      product_code: config.merchantCode,
      total_amount: amount,
      transaction_uuid: transactionUuid,
    });
    const response = await fetch(`${config.statusUrl}?${params}`, {
      signal: AbortSignal.timeout(10_000),
    });
    const data = (await response.json()) as {
      product_code?: string;
      transaction_uuid?: string;
      total_amount?: number | string;
      status?: string;
      ref_id?: string;
    };

    if (
      !response.ok ||
      data.status !== "COMPLETE" ||
      data.product_code !== config.merchantCode ||
      data.transaction_uuid !== transactionUuid ||
      moneyToMinorUnits(data.total_amount) !== moneyToMinorUnits(order.total_amount) ||
      !data.ref_id
    ) {
      res.status(400).json({ error: "eSewa payment verification failed." });
      return;
    }

    await markOrderPaid(order.id, "esewa", data.ref_id);
    res.json({ status: "verified", refId: data.ref_id, order_id: order.id });
  } catch (error) {
    logError("eSewa verify error", error);
    res.status(500).json({ error: "Failed to verify eSewa payment." });
  }
  }
);

export default router;
