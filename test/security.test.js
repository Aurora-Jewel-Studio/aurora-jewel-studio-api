const test = require("node:test");
const assert = require("node:assert/strict");
const { schemas } = require("../dist/validation");
const { createEsewaSignature } = require("../dist/routes/payments");

test("public form schemas normalize valid input and reject unsafe images", () => {
  const contact = schemas.contact.parse({
    name: "  Ada Lovelace  ",
    email: "ADA@EXAMPLE.COM",
    subject: "Question",
    message: "Hello",
  });
  assert.equal(contact.name, "Ada Lovelace");
  assert.equal(contact.email, "ada@example.com");

  const unsafeImage = schemas.bespoke.safeParse({
    first_name: "Ada",
    last_name: "Lovelace",
    email: "ada@example.com",
    message: "A design",
    reference_image: "data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=",
  });
  assert.equal(unsafeImage.success, false);

  const oversizedImage = schemas.bespoke.safeParse({
    first_name: "Ada",
    last_name: "Lovelace",
    email: "ada@example.com",
    message: "A design",
    reference_image: `data:image/png;base64,${Buffer.alloc(1024 * 1024 + 1).toString("base64")}`,
  });
  assert.equal(oversizedImage.success, false);
});

test("order schema ignores client pricing and bounds quantities", () => {
  const order = schemas.order.parse({
    items: [{ variantId: "SKU-1", productHandle: "ring-one", quantity: 2, price: 1 }],
    customer_name: "Ada Lovelace",
    customer_email: "ada@example.com",
    currency: "USD",
    total_amount: 1,
  });
  assert.equal(order.currency, "usd");
  assert.equal("total_amount" in order, false);
  assert.equal("price" in order.items[0], false);
  assert.equal(schemas.order.safeParse({ ...order, items: [{ ...order.items[0], quantity: 21 }] }).success, false);
});

test("eSewa signature covers the required fields in order", () => {
  assert.equal(
    createEsewaSignature("100", "11-201-13", "EPAYTEST", "8gBm/:&EnhH.1/q"),
    "5DZywcrTKD0gia/rsSMcrRHmJl+4Tbol6S+lWgdJ94E="
  );
});
