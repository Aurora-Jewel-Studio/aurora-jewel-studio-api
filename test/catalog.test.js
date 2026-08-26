const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

test("storefront fallback catalog mirrors backend handles and contains no placeholders", () => {
  const seed = fs.readFileSync(path.resolve(__dirname, "../src/seed.ts"), "utf8");
  const storefront = JSON.parse(
    fs.readFileSync(path.resolve(__dirname, "../../storefront/src/data/products.json"), "utf8"),
  );
  const backendHandles = [...seed.matchAll(/^ {4}handle:\s*"([^"]+)"/gm)].map((match) => match[1]).sort();
  const storefrontHandles = storefront.map(({ handle }) => handle).sort();

  assert.deepEqual(storefrontHandles, backendHandles);
  assert.doesNotMatch(JSON.stringify(storefront), /ADD HERE|Moissannite/);
  assert.doesNotMatch(seed, /DELETE FROM products/);
  assert.match(seed, /ON CONFLICT \(handle\) DO UPDATE/);
  assert.equal(storefront.find(({ handle }) => handle === "verdant-horizon").category_handle, "essence");
  assert.equal("Stone" in storefront.find(({ handle }) => handle === "luna-drops").features, false);
});
