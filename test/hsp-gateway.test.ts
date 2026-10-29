import { test } from "node:test";
import assert from "node:assert/strict";
import {
  canonicalizeJson,
  computeBodyHash,
  createHspHmacHeaders,
  verifyHspHmacSignature,
  buildHspCartMandateFromInvoice,
  HspAgentPaymentGateway,
} from "../src/hsp-gateway.js";
import { type AgentPaymentInvoice } from "../src/hsp-types.js";

test("HSP Gateway Suite: Canonical JSON formatting and deterministic SHA-256 body hash", () => {
  const unorderedPayload = {
    z_last: 1,
    a_first: "alpha",
    m_middle: { nested_b: true, nested_a: 100 },
  };

  const canonical = canonicalizeJson(unorderedPayload);
  assert.equal(
    canonical,
    '{"a_first":"alpha","m_middle":{"nested_a":100,"nested_b":true},"z_last":1}'
  );

  const hash1 = computeBodyHash(unorderedPayload);
  const hash2 = computeBodyHash(JSON.parse(canonical));
  assert.equal(hash1, hash2);
  assert.equal(hash1.length, 64);
});

test("HSP Gateway Suite: HMAC-SHA256 request signing and verification", () => {
  const appKey = "ak_test_key_123";
  const appSecret = "sec_super_secret_456";
  const body = { order_id: "ORD-999", amount: "50.00" };

  const headers = createHspHmacHeaders(
    appKey,
    appSecret,
    "POST",
    "/api/v1/merchant/orders",
    "",
    body
  );

  assert.equal(headers["X-App-Key"], appKey);
  assert.equal(headers["X-Signature"].length, 64);
  assert.ok(parseInt(headers["X-Timestamp"], 10) > 0);

  const bodyHash = computeBodyHash(body);
  const isValid = verifyHspHmacSignature(
    appSecret,
    "POST",
    "/api/v1/merchant/orders",
    "",
    bodyHash,
    headers["X-Timestamp"],
    headers["X-Nonce"],
    headers["X-Signature"]
  );

  assert.equal(isValid, true);
});

test("HSP Gateway Suite: A2A Invoice conversion into valid HSP Cart Mandate", () => {
  const invoice: AgentPaymentInvoice = {
    invoiceId: "inv_bench_001",
    payerAgent: "0x1111111111111111111111111111111111111111",
    payeeAgent: "0x2222222222222222222222222222222222222222",
    taskId: "task_bench_audit",
    taskSpecHash: "0xabcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789",
    items: [
      { label: "Vulnerability Scan", amountUsd: "50.00" },
      { label: "Proof of Fix Verification", amountUsd: "25.00" },
    ],
    totalUsd: "75.00",
    preferredCoin: "USDC",
    targetChainId: 133, // HSK Chain
    recipientAddress: "0x2222222222222222222222222222222222222222",
  };

  const mandate = buildHspCartMandateFromInvoice(invoice);
  const contents = mandate.cart_mandate.contents;

  assert.equal(contents.id, "ORDER-A2A-inv_bench_001");
  assert.equal(contents.user_cart_confirmation_required, false); // Autonomous agent execution
  assert.equal(contents.payment_request.method_data[0].data.chain_id, 133);
  assert.equal(contents.payment_request.method_data[0].data.coin, "USDC");
  assert.equal(contents.payment_request.method_data[0].data.pay_to, invoice.recipientAddress);
  assert.equal(contents.payment_request.details.total.amount.value, "75.00");
  assert.equal(contents.payment_request.details.display_items.length, 2);
});

test("HSP Gateway Suite: Agent wallet signs Cart Mandate and submits to Gateway", async () => {
  const gateway = new HspAgentPaymentGateway();
  const dummyPrivateKey = "0x4f3edf983ac636a65a842ce7c78d9aa706d3b113bce9c46f30d7d21715b23b1d";

  const invoice: AgentPaymentInvoice = {
    invoiceId: "inv_sign_test",
    payerAgent: "0x90F8bf6A479d320ead074411a4B0e7944Ea8c9C1",
    payeeAgent: "0xFFcf8FDEE72ac11b5c542428B35EEF5769C409f0",
    taskId: "task_sign_test",
    taskSpecHash: "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
    items: [{ label: "Automated Agent Task Execution", amountUsd: "10.00" }],
    totalUsd: "10.00",
    preferredCoin: "USDC",
    targetChainId: 133,
    recipientAddress: "0xFFcf8FDEE72ac11b5c542428B35EEF5769C409f0",
  };

  const mandate = buildHspCartMandateFromInvoice(invoice);
  const signedMandate = await gateway.signMandate(mandate, dummyPrivateKey);

  assert.ok(signedMandate.cart_mandate.merchant_authorization);
  assert.ok(signedMandate.cart_mandate.merchant_authorization.startsWith("0x"));

  const response = await gateway.submitOrder(signedMandate, true);
  assert.equal(response.status, "pending");
  assert.ok(response.checkout_url.includes("ORDER-A2A-inv_sign_test"));
});
