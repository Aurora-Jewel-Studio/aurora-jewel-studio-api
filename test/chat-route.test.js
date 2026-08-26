process.env.NODE_ENV = "production";

const test = require("node:test");
const assert = require("node:assert/strict");
const db = require("../dist/db");
const model = require("../dist/chat/model");

const rows = [
  {
    id: 1,
    title: "Ruby Envy",
    handle: "ruby-envy",
    description: "A red ruby necklace.",
    price: 75,
    currency: "usd",
    thumbnail: "/images/products/drops/ruby-envy/main.webp",
    images: [],
    variants: [{ title: "Silver", options: { Material: "Silver" }, prices: { usd: 75 } }],
    category_handle: "drops",
    features: { Stone: "Ruby", Color: "Red" },
  },
  {
    id: 2,
    title: "Blue Horizon",
    handle: "blue-horizon",
    description: "A blue topaz necklace.",
    price: 65,
    currency: "usd",
    thumbnail: "/images/products/drops/blue-horizon/main.webp",
    images: [],
    variants: [{ title: "Silver", options: { Material: "Silver" }, prices: { usd: 65 } }],
    category_handle: "drops",
    features: { Stone: "Blue Topaz", Color: "Blue" },
  },
];

db.query = async () => ({ rows });
model.callChatModel = async () => "Ruby Envy is the verified red necklace within your budget.";
const app = require("../dist/index").default;

test("chat route returns only server-verified exact product cards", async (t) => {
  const server = app.listen(0, "127.0.0.1");
  t.after(() => server.close());
  await new Promise((resolve) => server.once("listening", resolve));
  const { port } = server.address();
  const response = await fetch(`http://127.0.0.1:${port}/api/chat`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: "http://localhost:3000" },
    body: JSON.stringify({
      message: "Show me a red necklace under $100",
      history: [],
      channel: "website",
      currency: "USD",
      locale: "en-US",
      pageUrl: "http://localhost:3000/",
      cart: [],
    }),
  });
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.success, true);
  assert.deepEqual(body.products.map(({ handle, match }) => [handle, match]), [["ruby-envy", "exact"]]);
});

test("support answers never attach unrelated product cards", async (t) => {
  const server = app.listen(0, "127.0.0.1");
  t.after(() => server.close());
  await new Promise((resolve) => server.once("listening", resolve));
  const { port } = server.address();
  const response = await fetch(`http://127.0.0.1:${port}/api/chat`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: "http://localhost:3000" },
    body: JSON.stringify({
      message: "What is your return policy?",
      history: [],
      channel: "website",
      currency: "USD",
      locale: "en-US",
      pageUrl: "http://localhost:3000/",
      cart: [],
    }),
  });
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.success, true);
  assert.deepEqual(body.products, []);
  assert.match(body.reply, /made to order/i);
});

test("chat route replaces model claims that contradict verified product cards", async (t) => {
  model.callChatModel = async () => "We do not have red necklaces, but Ruby Envy is a lovely pair of earrings.";
  const server = app.listen(0, "127.0.0.1");
  t.after(() => server.close());
  await new Promise((resolve) => server.once("listening", resolve));
  const { port } = server.address();
  const response = await fetch(`http://127.0.0.1:${port}/api/chat`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: "http://localhost:3000" },
    body: JSON.stringify({
      message: "Show me a red necklace under $100",
      history: [],
      channel: "website",
      currency: "USD",
      locale: "en-US",
      pageUrl: "http://localhost:3000/",
      cart: [],
    }),
  });
  const body = await response.json();

  assert.match(body.reply, /verified Aurora match(?:es)?/i);
  assert.doesNotMatch(body.reply, /do not have|earrings/i);
  assert.deepEqual(body.products.map(({ handle }) => handle), ["ruby-envy"]);
});
