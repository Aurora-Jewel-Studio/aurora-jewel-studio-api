process.env.NODE_ENV = "production";

const test = require("node:test");
const assert = require("node:assert/strict");
const app = require("../dist/index").default;

test("production API accepts the local frontend preflight", async (t) => {
  const server = app.listen(0, "127.0.0.1");
  t.after(() => server.close());
  await new Promise((resolve) => server.once("listening", resolve));
  const { port } = server.address();

  const checkOrigin = async (origin) => {
    const response = await fetch(`http://127.0.0.1:${port}/api/chat`, {
      method: "OPTIONS",
      headers: {
        Origin: origin,
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "content-type",
      },
    });
    return { status: response.status, allowOrigin: response.headers.get("access-control-allow-origin") };
  };

  const localRes = await checkOrigin("http://localhost:3000");
  assert.equal(localRes.status, 204);
  assert.equal(localRes.allowOrigin, "http://localhost:3000");

  const vercelRes = await checkOrigin("https://aurora-jewel-frontend.vercel.app");
  assert.equal(vercelRes.status, 204);
  assert.equal(vercelRes.allowOrigin, "https://aurora-jewel-frontend.vercel.app");

  const previewRes = await checkOrigin("https://aurora-jewel-frontend-git-main-test.vercel.app");
  assert.equal(previewRes.status, 204);
  assert.equal(previewRes.allowOrigin, "https://aurora-jewel-frontend-git-main-test.vercel.app");

  const evilRes = await checkOrigin("https://evil.example.com");
  assert.equal(evilRes.status, 403);
});
