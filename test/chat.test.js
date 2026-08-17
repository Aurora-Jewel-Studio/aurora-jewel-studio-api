const test = require("node:test");
const assert = require("node:assert/strict");
const { schemas } = require("../dist/validation");
const { lexicalScore, retrieveKnowledge } = require("../dist/chat/retrieval");
const { compactModelReply, deterministicResponse, guardModelReply, hasBasketReference } = require("../dist/chat/safeguards");
const { callChatModel } = require("../dist/chat/model");
const { conversationCategory, conversationQuery } = require("../dist/routes/chat");
const { hasShoppingIntent, requestedProductCategory } = require("../dist/chat/products");

const validRequest = {
  message: "How should I care for a pearl?",
  history: [],
  channel: "website",
  currency: "USD",
  locale: "en-US",
  pageUrl: "http://localhost:3000/care/",
};

test("chat request schema accepts the bounded website payload and rejects invalid input", () => {
  assert.equal(schemas.chat.safeParse(validRequest).success, true);
  assert.equal(schemas.chat.safeParse({ ...validRequest, message: "x".repeat(1_001) }).success, false);
  assert.equal(
    schemas.chat.safeParse({
      ...validRequest,
      history: Array.from({ length: 9 }, () => ({ role: "user", content: "hello" })),
    }).success,
    false,
  );
  assert.equal(schemas.chat.safeParse({ ...validRequest, currency: "BTC" }).success, false);
  assert.equal(
    schemas.chat.safeParse({
      ...validRequest,
      cart: [{
        variantId: "42-silver",
        productHandle: "sapphire-royale",
        title: "Sapphire Royale",
        variantTitle: "Silver",
        quantity: 1,
      }],
    }).success,
    true,
  );
  assert.equal(
    schemas.chat.safeParse({ ...validRequest, cart: [{ productHandle: "missing-fields" }] }).success,
    false,
  );
});

test("the latest explicit jewellery type is a required category", () => {
  assert.equal(requestedProductCategory("I want an earring"), "sparkles");
  assert.equal(requestedProductCategory("Show me necklaces"), "drops");
  assert.equal(
    conversationCategory("I want an earring", [
      { role: "user", content: "Show me green necklaces" },
      { role: "assistant", content: "Here are some options" },
    ]),
    "sparkles",
  );
  assert.equal(
    conversationCategory("Under $100", [{ role: "user", content: "Show me earrings" }]),
    "sparkles",
  );
});

test("lexical retrieval selects the gemstone guide for pearl care", () => {
  const results = retrieveKnowledge("How should I clean and care for a pearl?", 3);
  assert.ok(results.length > 0);
  assert.equal(results[0].source, "aurora-gemstone-education.md");
  assert.match(results[0].content, /pearls go on last/i);
});

test("product retrieval keeps recent customer context", () => {
  const query = conversationQuery("Something elegant under $100", [
    { role: "user", content: "I need jewellery for a wedding" },
    { role: "assistant", content: "What style would you like?" },
  ]);
  assert.equal(query, "I need jewellery for a wedding Something elegant under $100");
  assert.equal(hasShoppingIntent("I need jewellery for a wedding"), true);
  assert.ok(lexicalScore("wedding", "engagement and bridal jewellery") > 0);
});

test("one-tap refinements keep shopping intent and can prefer cheaper products", () => {
  const query = conversationQuery("Lower budget", [
    { role: "user", content: "Wedding gift under $150" },
    { role: "assistant", content: "Choose one below." },
  ]);
  assert.equal(hasShoppingIntent(query), true);
  assert.equal(schemas.chat.safeParse({ ...validRequest, refinement: "lower_price" }).success, true);
  assert.equal(schemas.chat.safeParse({ ...validRequest, refinement: "hard-coded-price" }).success, false);
});

test("unsupported currency, allergy, and policy claims are rejected", () => {
  assert.doesNotMatch(guardModelReply("It converts exactly to £50."), /£50/);
  assert.doesNotMatch(guardModelReply("Every Aurora piece is nickel-free and hypoallergenic."), /nickel-free/i);
  assert.doesNotMatch(guardModelReply("You have a 30-day return policy."), /30-day/i);
  assert.equal(guardModelReply("This verified price is $62.58.", { allowedPriceLabels: ["From $62.58"] }), "This verified price is $62.58.");
  assert.doesNotMatch(guardModelReply("x".repeat(1_001)), /^x+$/);
});

test("verbose model replies keep one useful statement and clarification", () => {
  const reply = compactModelReply(
    "Congratulations on your wedding! I found several verified pieces within your budget. To narrow them down, do they prefer classic and elegant jewellery or something modern and bold? I can help compare every option.",
  );
  assert.equal(
    reply,
    "I found several verified pieces within your budget. To narrow them down, do they prefer classic and elegant jewellery or something modern and bold?",
  );
  assert.ok(reply.split(" ").length <= 28);
});

test("Gemini is attempted first and rate limits fall back to local Gemma", async () => {
  const originalFetch = global.fetch;
  const originalWarn = console.warn;
  const originalEnv = {
    GEMINI_API_KEY: process.env.GEMINI_API_KEY,
    GEMINI_MODEL: process.env.GEMINI_MODEL,
    CHAT_MODEL: process.env.CHAT_MODEL,
    OLLAMA_BASE_URL: process.env.OLLAMA_BASE_URL,
  };
  const calls = [];
  let geminiBody;

  process.env.GEMINI_API_KEY = "test-key";
  process.env.GEMINI_MODEL = "gemini-3.5-flash";
  process.env.CHAT_MODEL = "gemma3:4b";
  process.env.OLLAMA_BASE_URL = "http://ollama.test";
  console.warn = () => {};
  global.fetch = async (input, init) => {
    const url = String(input);
    calls.push(url);
    if (url.includes("generativelanguage.googleapis.com")) {
      geminiBody = JSON.parse(init.body);
      return new Response(null, { status: 429 });
    }
    return new Response(JSON.stringify({ message: { content: "Gemma fallback" } }), {
      headers: { "Content-Type": "application/json" },
    });
  };

  try {
    const reply = await callChatModel([
      { role: "system", content: "Be concise." },
      { role: "user", content: "Show me a ring." },
    ]);
    assert.equal(reply, "Gemma fallback");
    assert.match(calls[0], /gemini-3\.5-flash:generateContent$/);
    assert.equal(calls[1], "http://ollama.test/api/chat");
    assert.equal(geminiBody.system_instruction.parts[0].text, "Be concise.");
    assert.equal(geminiBody.contents[0].role, "user");
  } finally {
    global.fetch = originalFetch;
    console.warn = originalWarn;
    for (const [key, value] of Object.entries(originalEnv)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});

test("order complaints immediately escalate without selling", () => {
  const response = deterministicResponse("My order never arrived and nobody replied", "USD");
  assert.equal(response.handoff.reason, "support");
  assert.match(response.reply, /human/i);
  assert.doesNotMatch(response.reply, /buy|recommend|collection/i);
});

test("basket contents come from current cart state and never create product cards", () => {
  assert.equal(hasBasketReference("Is Sapphire Royale in my basket?"), true);
  const response = deterministicResponse("What is in my basket?", "USD", [
    {
      variantId: "42-silver",
      productHandle: "sapphire-royale",
      title: "Sapphire Royale",
      variantTitle: "Silver",
      quantity: 2,
    },
  ]);
  assert.match(response.reply, /2 × Sapphire Royale \(Silver\)/);
  assert.match(response.reply, /2 items in total/);
  assert.equal(deterministicResponse("What is in my cart?", "USD", []).reply, "Your basket is currently empty.");
});

test("sizing guidance is deterministic and never exposes the source HTML path", () => {
  const response = deterministicResponse("How do I measure my ring size?", "USD");
  assert.match(response.reply, /millimetres/i);
  assert.doesNotMatch(response.reply, /\.html/i);
  assert.match(deterministicResponse("What necklace length should I choose?", "USD").reply, /17–19 inches/);
});
