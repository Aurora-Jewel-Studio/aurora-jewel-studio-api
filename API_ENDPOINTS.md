# Backend API Endpoints

- Production base URL: `https://aurora-jewel-studio-api.vercel.app`
- Local base URL: `http://localhost:4000`
- JSON requests require `Content-Type: application/json`.
- Admin routes require `Authorization: Bearer <token>`.
- Existing top-level response keys such as `products`, `order`, and `bespoke_request` are retained for storefront compatibility. Newer success responses may also include `success: true`. Errors use `{ "error": "..." }`; validation errors additionally include `success`, `message`, and field `details`.

## Endpoint map

| Method | Path | Access | Purpose |
| --- | --- | --- | --- |
| GET | `/api/health` | Public | Process health only; no database details |
| POST | `/api/admin/login` | Public/rate-limited | Issue admin JWT |
| GET | `/api/analytics` | Admin | Revenue/order/product/enquiry summary |
| GET | `/api/products` | Public | Catalog, filter, search, optional pagination |
| GET | `/api/products/:handle` | Public | Product by stable handle/slug |
| POST | `/api/products` | Admin | Create product |
| PATCH | `/api/products/:id` | Admin | Update product |
| DELETE | `/api/products/:id` | Admin | Delete product |
| POST | `/api/contact` | Public/rate-limited | Submit contact message |
| GET | `/api/contact` | Admin | List contact messages |
| PATCH | `/api/contact/:id/read` | Admin | Mark contact message read |
| POST | `/api/bespoke` | Public/rate-limited | Submit bespoke/B2B/retail enquiry |
| GET | `/api/bespoke` | Admin | List bespoke enquiries |
| PATCH | `/api/bespoke/:id` | Admin | Update enquiry status |
| POST | `/api/orders` | Public/rate-limited | Create server-priced order |
| GET | `/api/orders` | Admin | List orders |
| GET | `/api/orders/:id` | Admin | Fetch order |
| PATCH | `/api/orders/:id` | Admin | Update order/payment state |
| POST | `/api/payments/stripe/webhook` | Stripe signature | Stripe event receiver |
| POST | `/api/payments/stripe/create-checkout-session` | Public/rate-limited | Start Stripe Checkout |
| POST | `/api/payments/stripe/verify-session` | Public/rate-limited | Verify Stripe session |
| POST | `/api/payments/paypal/create-order` | Public/rate-limited | Start PayPal order |
| POST | `/api/payments/paypal/capture-order` | Public/rate-limited | Capture and verify PayPal order |
| POST | `/api/payments/khalti/initiate` | Public/rate-limited | Start NPR Khalti payment |
| POST | `/api/payments/khalti/verify` | Public/rate-limited | Verify Khalti payment |
| POST | `/api/payments/esewa/initiate` | Public/rate-limited | Build signed NPR ePay v2 form |
| POST | `/api/payments/esewa/verify` | Public/rate-limited | Server-to-server eSewa status check |
| GET | `/api/exchange-rates` | Public/rate-limited | Supported rates with cache metadata |
| POST | `/api/uploads` | Admin/local only | Local image upload; 503 in production |

There is no newsletter endpoint or newsletter table.

## Products and search

`GET /api/products` preserves the unpaginated default used by the static storefront. Query parameters are optional:

- `q`: normalized full-text search, maximum 100 characters.
- `category`: lowercase slug.
- `page`: positive integer.
- `limit`: 1–100. Supplying `page` or `limit` enables pagination metadata.

```http
GET /api/products?q=green%20onyx&category=radiance&page=1&limit=20
```

```json
{
  "success": true,
  "products": [
    {
      "handle": "example-ring",
      "slug": "example-ring",
      "title": "Example Ring",
      "description": "Stored product description",
      "category_handle": "radiance",
      "category": "radiance",
      "images": [{ "url": "/images/example.webp", "alt": "Example Ring" }]
    }
  ],
  "pagination": { "page": 1, "limit": 20, "total": 1 }
}
```

Product create/update accepts `handle`, `title`, `description`, non-negative `price`, three-letter `currency`, safe relative or HTTPS image paths, `category_handle`, optional `weight`, up to 20 images, and up to 50 feature keys. Public reads retain the internal `id` only because the current admin storefront uses the same list response to edit/delete products.

## Contact and enquiries

```http
POST /api/contact
Content-Type: application/json

{
  "name": "Buyer Name",
  "email": "buyer@example.com",
  "subject": "Export enquiry",
  "message": "Please share your wholesale process.",
  "website": ""
}
```

```http
POST /api/bespoke
Content-Type: application/json

{
  "first_name": "Buyer",
  "last_name": "Name",
  "email": "buyer@example.com",
  "phone": "+44 20 0000 0000",
  "message": "We are interested in a wholesale collection.",
  "inquiry_type": "B2B",
  "company_name": "Example Company",
  "country": "United Kingdom",
  "buyer_type": "Retailer",
  "order_quantity_range": "25-50 pieces",
  "website": ""
}
```

Allowed enquiry types are `Custom`, `B2B`, `Retail`, and `Other`. `reference_image` may be a JPEG, PNG, or WebP base64 data URL up to 1 MB decoded. `website` is a honeypot and must remain empty/omitted for real users.

Admin enquiry statuses: `pending`, `contacted`, `in_progress`, `completed`, `cancelled`.

## Orders

The backend ignores client price/title/total fields and prices each variant from PostgreSQL.

```http
POST /api/orders
Content-Type: application/json

{
  "items": [
    { "productHandle": "example-ring", "variantId": "EXAMPLE-SILVER", "quantity": 1 }
  ],
  "customer_name": "Customer Name",
  "customer_email": "customer@example.com",
  "customer_phone": "+977 9800000000",
  "shipping_address": "Customer-provided address",
  "currency": "usd",
  "payment_method": "stripe"
}
```

Quantities are 1–20 per unique variant; carts are 1–50 lines and cannot contain duplicate variants. Supported payment method values are `cod`, `stripe`, `paypal`, `khalti`, and `esewa`. Provider-specific currency support still applies.

Admin order statuses: `pending`, `processing`, `shipped`, `delivered`, `cancelled`. Payment statuses: `pending`, `paid`, `failed`, `refunded`.

## Payments

All initiation routes accept a stored order id; totals and customer details come from that order.

```json
{ "order_id": 123 }
```

- Stripe create returns `checkout_url` and `session_id`; verify accepts `session_id` plus optional `order_id`.
- PayPal create returns `paypal_order_id` and `approve_url`; capture accepts both `order_id` and `paypal_order_id`.
- Khalti initiate returns `payment_url` and `pidx`; verify accepts `pidx` plus optional `order_id`.
- eSewa initiate returns `payment_url` and signed ePay v2 `form_data`. Post that form to eSewa. Verify accepts `{ "order_id": 123 }` or `{ "oid": "<transaction_uuid>" }` and performs the status check server-to-server.

Never mark an order paid from a browser redirect alone. Only a successful provider verification updates payment state.
