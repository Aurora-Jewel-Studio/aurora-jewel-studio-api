import { Router } from "express";
import { query } from "../db";

const router = Router();

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
    const { order_id, amount, customer_name, customer_email, customer_phone } =
      req.body;

    if (!order_id || !amount) {
      res.status(400).json({ error: "order_id and amount are required." });
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
          amount: amount * 100, // Khalti expects paisa
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

    // Update order payment status
    if (order_id) {
      await query(
        "UPDATE orders SET payment_status = 'paid', payment_method = 'khalti', payment_reference = $1 WHERE id = $2",
        [pidx, parseInt(order_id)]
      );
    }

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
    const { order_id, amount, tax_amount = 0, delivery_charge = 0 } = req.body;

    if (!order_id || !amount) {
      res.status(400).json({ error: "order_id and amount are required." });
      return;
    }

    const ESEWA_MERCHANT = process.env.ESEWA_MERCHANT_CODE;
    if (!ESEWA_MERCHANT) {
      res.status(503).json({ error: "eSewa payment is not configured." });
      return;
    }

    const total = amount + tax_amount + delivery_charge;

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

    // Update order payment status
    if (order_id) {
      await query(
        "UPDATE orders SET payment_status = 'paid', payment_method = 'esewa', payment_reference = $1 WHERE id = $2",
        [refId, parseInt(order_id)]
      );
    }

    res.json({ status: "verified", refId });
  } catch (error) {
    console.error("eSewa verify error:", error);
    res.status(500).json({ error: "Failed to verify eSewa payment." });
  }
});

export default router;
