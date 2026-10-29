import { test } from "node:test";
import assert from "node:assert/strict";
import { createAgentPayServer } from "../src/server.js";

test("Server Suite: AgentPay HUD server starts, responds to /api/status, and serves dashboard", async () => {
  const port = 3388;
  const server = createAgentPayServer(port);

  await new Promise<void>((resolve) => server.listen(port, resolve));

  try {
    // 1. Test HTML Dashboard
    const resHtml = await fetch(`http://localhost:${port}/`);
    assert.equal(resHtml.status, 200);
    const htmlText = await resHtml.text();
    assert.ok(htmlText.includes("AgentPay HSK"));
    assert.ok(htmlText.includes("HSK Chain ID: 133"));

    // 2. Test /api/status
    const resApi = await fetch(`http://localhost:${port}/api/status`);
    assert.equal(resApi.status, 200);
    const apiJson = await resApi.json();
    assert.equal(apiJson.protocol, "AgentPay HSK");
    assert.equal(apiJson.chainId, 133);
    assert.equal(apiJson.testsPassing, 10);
    assert.equal(apiJson.status, "healthy");

    // 3. Test /api/generate-mandate
    const resMandate = await fetch(`http://localhost:${port}/api/generate-mandate`, {
      method: "POST",
    });
    assert.equal(resMandate.status, 200);
    const mandateJson = await resMandate.json();
    assert.equal(mandateJson.success, true);
    assert.ok(mandateJson.mandate.cart_mandate.contents.id.includes("ORDER-A2A"));
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
