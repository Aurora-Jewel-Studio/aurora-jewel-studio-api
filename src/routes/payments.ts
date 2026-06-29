import { Router } from "express";
import { Request, Response } from "express";
import Stripe from "stripe";
import { query } from "../db";

const router = Router();

const PAYPAL_SANDBOX_API = "https://api-m.sandbox.paypal.com";
const PAYPAL_LIVE_API = "https://api-m.paypal.com";

function getFrontendUrl() {
  return process.env.FRONTEND_URL || "http://localhost:3000";
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
    "UPDATE orders SET payment_status = 'paid', payment_method = $1, payment_reference = $2 WHERE id = $3",
    [paymentMethod, paymentReference, orderId]
  );
}

async function getPayPalAccessToken() {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;

  const baseUrl = process.env.PAYPAL_ENV === "live" ? PAYPAL_LIVE_API : PAYPAL_SANDBOX_API;
  const response = await fetch(`${baseUrl}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`PayPal token request failed: ${text}`);
  }

  const data = (await response.json()) as { access_token: string };
  return { accessToken: data.access_token, baseUrl };
}

function getPayPalApprovalUrl(data: any) {
  const links = Array.isArray(data.links) ? data.links : [];
  return links.find((link: any) => link.rel === "approve")?.href || null;
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
    console.error("Stripe webhook error:", error.message);
    res.status(400).json({ error: "Invalid Stripe webhook." });
  }
}

// =============================================================================
// STRIPE CHECKOUT INTEGRATION
// Sandbox: use STRIPE_SECRET_KEY=sk_test_... and Stripe CLI webhook forwarding.
// =============================================================================

router.post("/stripe/create-checkout-session", async (req, res) => {
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
    console.error("Stripe checkout error:", error);
    res.status(500).json({ error: "Failed to create Stripe checkout session." });
  }
});

router.post("/stripe/verify-session", async (req, res) => {
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
    console.error("Stripe verify error:", error);
    res.status(500).json({ error: "Failed to verify Stripe session." });
  }
});

// =============================================================================
// PAYPAL CHECKOUT INTEGRATION
// Sandbox: PAYPAL_ENV=sandbox with sandbox client credentials.
// =============================================================================

router.post("/paypal/create-order", async (req, res) => {
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
    });

    const data = (await response.json()) as any;
    if (!response.ok) {
      console.error("PayPal create order error:", data);
      res.status(response.status).json({ error: "PayPal order creation failed.", details: data });
      return;
    }

    const approveUrl = getPayPalApprovalUrl(data);
    if (!approveUrl) {
      res.status(502).json({ error: "PayPal did not return an approval URL." });
      return;
    }

    res.json({ paypal_order_id: data.id, approve_url: approveUrl });
  } catch (error) {
    console.error("PayPal create order error:", error);
    res.status(500).json({ error: "Failed to create PayPal order." });
  }
});

router.post("/paypal/capture-order", async (req, res) => {
  try {
    const { order_id, paypal_order_id } = req.body;
    const paypal = await getPayPalAccessToken();

    if (!paypal) {
      res.status(503).json({ error: "PayPal payment is not configured." });
      return;
    }

    if (!paypal_order_id) {
      res.status(400).json({ error: "paypal_order_id is required." });
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
      }
    );

    const data = (await response.json()) as any;
    if (!response.ok) {
      console.error("PayPal capture error:", data);
      res.status(response.status).json({ error: "PayPal capture failed.", details: data });
      return;
    }

    if (!assertPayPalOrderMatch(data, order)) {
      res.status(400).json({ error: "PayPal capture does not match the order." });
      return;
    }

    await markOrderPaid(order.id, "paypal", data.id);
    res.json({ status: "verified", order_id: order.id });
  } catch (error) {
    console.error("PayPal capture error:", error);
    res.status(500).json({ error: "Failed to capture PayPal order." });
  }
});

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
router.post("/khalti/initiate", async (req, res) => {
  try {
    const { order_id, customer_name, customer_email, customer_phone } =
      req.body;

    if (!order_id) {
      res.status(400).json({ error: "order_id is required." });
      return;
    }

    const order = await getOrderForPayment(order_id);
    if (!order) {
      res.status(404).json({ error: "Order not found." });
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
          return_url: `${process.env.FRONTEND_URL || "http://localhost:3000"}/checkout/success`,
          website_url: process.env.FRONTEND_URL || "http://localhost:3000",
          amount, // Khalti expects paisa
          purchase_order_id: String(order_id),
          purchase_order_name: `Aurora Jewel Order #${order_id}`,
          customer_info: {
            name: customer_name || "Customer",
            email: customer_email || "",
            phone: customer_phone || "",
          },
        }),
      }
    );

    const data = (await response.json()) as KhaltiInitiateResponse;

    if (!response.ok) {
      console.error("Khalti initiate error:", data);
      res
        .status(response.status)
        .json({ error: "Khalti payment initiation failed.", details: data });
      return;
    }

    // data contains: { pidx, payment_url, expires_at, expires_in }
    res.json({
      payment_url: data.payment_url,
      pidx: data.pidx,
    });
  } catch (error) {
    console.error("Khalti initiate error:", error);
    res.status(500).json({ error: "Failed to initiate Khalti payment." });
  }
});

/**
 * POST /api/payments/khalti/verify
 * Verifies a Khalti payment callback.
 * Body: { pidx, order_id }
 */
router.post("/khalti/verify", async (req, res) => {
  try {
    const { pidx, order_id } = req.body;

    if (!pidx) {
      res.status(400).json({ error: "pidx is required." });
      return;
    }

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
      }
    );

    const data = (await response.json()) as KhaltiLookupResponse;

    if (!response.ok || data.status !== "Completed") {
      console.error("Khalti verify failed:", data);
      res.status(400).json({
        error: "Payment verification failed.",
        status: data.status,
      });
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

    await query(
      "UPDATE orders SET payment_status = 'paid', payment_method = 'khalti', payment_reference = $1 WHERE id = $2",
      [pidx, order.id]
    );

    res.json({ status: "verified", transaction: data });
  } catch (error) {
    console.error("Khalti verify error:", error);
    res.status(500).json({ error: "Failed to verify Khalti payment." });
  }
});

// =============================================================================
// ESEWA PAYMENT INTEGRATION
// Docs: https://developer.esewa.com.np/
// =============================================================================

/**
 * POST /api/payments/esewa/initiate
 * Generates the eSewa payment form data.
 * Body: { order_id, amount, tax_amount, delivery_charge }
 */
router.post("/esewa/initiate", async (req, res) => {
  try {
    const { order_id, tax_amount = 0, delivery_charge = 0 } = req.body;

    if (!order_id) {
      res.status(400).json({ error: "order_id is required." });
      return;
    }

    const order = await getOrderForPayment(order_id);
    if (!order) {
      res.status(404).json({ error: "Order not found." });
      return;
    }

    if (!requireNprOrder(order)) {
      res.status(400).json({ error: "eSewa payments require an NPR order." });
      return;
    }

    const ESEWA_MERCHANT = process.env.ESEWA_MERCHANT_CODE;
    if (!ESEWA_MERCHANT) {
      res.status(503).json({ error: "eSewa payment is not configured." });
      return;
    }

    const amount = Number(order.total_amount);
    const total = amount + Number(tax_amount) + Number(delivery_charge);

    // Return form data for eSewa redirect
    res.json({
      payment_url: "https://esewa.com.np/epay/main",
      form_data: {
        amt: amount,
        txAmt: tax_amount,
        psc: 0,
        pdc: delivery_charge,
        tAmt: total,
        pid: `AURORA-${order_id}`,
        scd: ESEWA_MERCHANT,
        su: `${process.env.FRONTEND_URL || "http://localhost:3000"}/checkout/success?method=esewa`,
        fu: `${process.env.FRONTEND_URL || "http://localhost:3000"}/checkout/failure?method=esewa`,
      },
    });
  } catch (error) {
    console.error("eSewa initiate error:", error);
    res.status(500).json({ error: "Failed to initiate eSewa payment." });
  }
});

/**
 * POST /api/payments/esewa/verify
 * Verifies an eSewa payment callback.
 * Body: { oid, amt, refId, order_id }
 */
router.post("/esewa/verify", async (req, res) => {
  try {
    const { oid, amt, refId, order_id } = req.body;

    if (!oid || !amt || !refId) {
      res
        .status(400)
        .json({ error: "oid, amt, and refId are required." });
      return;
    }

    const ESEWA_MERCHANT = process.env.ESEWA_MERCHANT_CODE;
    if (!ESEWA_MERCHANT) {
      res.status(503).json({ error: "eSewa payment is not configured." });
      return;
    }

    // Verify with eSewa
    const verifyUrl = `https://uat.esewa.com.np/epay/transrec?amt=${amt}&scd=${ESEWA_MERCHANT}&pid=${oid}&rid=${refId}`;
    const response = await fetch(verifyUrl);
    const text = await response.text();

    const isSuccess =
      text.includes("<response_code>Success</response_code>") ||
      text.includes("Success");

    if (!isSuccess) {
      res.status(400).json({ error: "eSewa payment verification failed." });
      return;
    }

    const parsedOrderId = String(oid).replace(/^AURORA-/, "");
    const order = await getOrderForPayment(order_id || parsedOrderId);
    if (!order) {
      res.status(404).json({ error: "Order not found." });
      return;
    }

    if (
      String(oid) !== `AURORA-${order.id}` ||
      Math.round(Number(amt) * 100) !== moneyToMinorUnits(order.total_amount)
    ) {
      res.status(400).json({ error: "Payment details do not match the order." });
      return;
    }

    if (!requireNprOrder(order)) {
      res.status(400).json({ error: "eSewa payments require an NPR order." });
      return;
    }

    await query(
      "UPDATE orders SET payment_status = 'paid', payment_method = 'esewa', payment_reference = $1 WHERE id = $2",
      [refId, order.id]
    );

    res.json({ status: "verified", refId });
  } catch (error) {
    console.error("eSewa verify error:", error);
    res.status(500).json({ error: "Failed to verify eSewa payment." });
  }
});

export default router;
