import crypto from "node:crypto";
import {
  type Hex,
  keccak256,
  toHex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import {
  type HspCartMandate,
  type HspCartContents,
  type HspHmacHeaders,
  type HspCreateOrderResponse,
  type AgentPaymentInvoice,
} from "./hsp-types.js";

/**
 * Standard Canonical JSON serializer (keys recursively sorted).
 */
export function canonicalizeJson(obj: unknown): string {
  if (obj === null || typeof obj !== "object") {
    return JSON.stringify(obj);
  }
  if (Array.isArray(obj)) {
    return "[" + obj.map(canonicalizeJson).join(",") + "]";
  }
  const keys = Object.keys(obj as Record<string, unknown>).sort();
  const pairs = keys.map((key) => {
    const val = (obj as Record<string, unknown>)[key];
    return JSON.stringify(key) + ":" + canonicalizeJson(val);
  });
  return "{" + pairs.join(",") + "}";
}

/**
 * Computes SHA-256 body hash for HMAC request signing.
 */
export function computeBodyHash(body: unknown): string {
  if (!body) return "";
  const canonical = typeof body === "string" ? body : canonicalizeJson(body);
  return crypto.createHash("sha256").update(canonical, "utf-8").digest("hex").toLowerCase();
}

/**
 * Signs an HTTP request according to HashKey Merchant HMAC-SHA256 specification.
 * message = "{METHOD}\n{PATH}\n{QUERY}\n{bodyHash}\n{timestamp}\n{nonce}"
 */
export function createHspHmacHeaders(
  appKey: string,
  appSecret: string,
  method: "GET" | "POST",
  path: string,
  query: string = "",
  body?: unknown
): HspHmacHeaders {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const nonce = crypto.randomBytes(16).toString("hex");
  const bodyHash = body ? computeBodyHash(body) : "";

  const message = `${method}\n${path}\n${query}\n${bodyHash}\n${timestamp}\n${nonce}`;
  const signature = crypto
    .createHmac("sha256", appSecret)
    .update(message, "utf-8")
    .digest("hex")
    .toLowerCase();

  return {
    "X-App-Key": appKey,
    "X-Signature": signature,
    "X-Timestamp": timestamp,
    "X-Nonce": nonce,
    "Content-Type": "application/json",
  };
}

/**
 * Verifies an incoming webhook or request HMAC signature.
 */
export function verifyHspHmacSignature(
  appSecret: string,
  method: string,
  path: string,
  query: string,
  bodyHash: string,
  timestamp: string,
  nonce: string,
  receivedSignature: string
): boolean {
  const message = `${method}\n${path}\n${query}\n${bodyHash}\n${timestamp}\n${nonce}`;
  const expectedSignature = crypto
    .createHmac("sha256", appSecret)
    .update(message, "utf-8")
    .digest("hex")
    .toLowerCase();
  return crypto.timingSafeEqual(
    Buffer.from(expectedSignature, "hex"),
    Buffer.from(receivedSignature.toLowerCase(), "hex")
  );
}

/**
 * A2A Mandate Builder:
 * Constructs an official HSP Cart Mandate based on payment conditions received from Payee Agent.
 */
export function buildHspCartMandateFromInvoice(
  invoice: AgentPaymentInvoice,
  hskTokenContract: `0x${string}` = "0x89c62341109a1D91062341109a1D91062341109a"
): HspCartMandate {
  const contents: HspCartContents = {
    id: `ORDER-A2A-${invoice.invoiceId}`,
    user_cart_confirmation_required: false, // Autonomous agent workflow (no interactive human prompt required)
    payment_request: {
      method_data: [
        {
          supported_methods: "https://www.x402.org/",
          data: {
            x402Version: 2,
            network: invoice.targetChainId === 133 ? "hsk-mainnet" : "hsk-testnet",
            chain_id: invoice.targetChainId,
            contract_address: hskTokenContract,
            pay_to: invoice.recipientAddress,
            coin: invoice.preferredCoin,
          },
        },
      ],
      details: {
        id: `REQ-${invoice.taskId}`,
        display_items: invoice.items.map((it) => ({
          label: it.label,
          amount: {
            currency: "USD",
            value: it.amountUsd,
          },
        })),
        total: {
          label: "Autonomous Agent Settlement Total",
          amount: {
            currency: "USD",
            value: invoice.totalUsd,
          },
        },
      },
    },
    metadata: {
      payerAgent: invoice.payerAgent,
      payeeAgent: invoice.payeeAgent,
      taskId: invoice.taskId,
      taskSpecHash: invoice.taskSpecHash,
      protocol: "AgentPay-HSK-v1",
    },
  };

  return {
    cart_mandate: {
      contents,
    },
  };
}

/**
 * Payment Agent Client:
 * Coordinates autonomous A2A payment creation, signature, and submission to HashKey Merchant Gateway.
 */
export class HspAgentPaymentGateway {
  public appKey: string;
  public appSecret: string;
  public baseUrl: string;

  constructor(
    appKey: string = "ak_agentpay_mock_key",
    appSecret: string = "sec_agentpay_mock_secret_89c623411",
    baseUrl: string = "https://merchant-qa.hashkeymerchant.com"
  ) {
    this.appKey = appKey;
    this.appSecret = appSecret;
    this.baseUrl = baseUrl;
  }

  /**
   * Signs the Cart Mandate using the Payer Agent's private key.
   */
  async signMandate(
    mandate: HspCartMandate,
    payerPrivateKey: Hex
  ): Promise<HspCartMandate> {
    const account = privateKeyToAccount(payerPrivateKey);
    const canonicalPayload = canonicalizeJson(mandate.cart_mandate.contents);
    const digest = keccak256(Buffer.from(canonicalPayload, "utf-8"));

    const signature = await account.signMessage({
      message: { raw: Buffer.from(digest.slice(2), "hex") },
    });

    mandate.cart_mandate.merchant_authorization = signature;
    return mandate;
  }

  /**
   * Creates a one-time payment order via HSP Gateway.
   * If running in offline / test mode without active merchant keys, returns deterministic mocked checkout.
   */
  async submitOrder(
    signedMandate: HspCartMandate,
    mockLocal: boolean = true
  ): Promise<HspCreateOrderResponse> {
    const path = "/api/v1/merchant/orders";

    if (mockLocal) {
      const orderId = signedMandate.cart_mandate.contents.id;
      return {
        order_id: orderId,
        checkout_url: `${this.baseUrl}/checkout/${orderId}`,
        status: "pending",
        created_at: Math.floor(Date.now() / 1000),
        expires_at: Math.floor(Date.now() / 1000) + 1800,
      };
    }

    const headers = createHspHmacHeaders(
      this.appKey,
      this.appSecret,
      "POST",
      path,
      "",
      signedMandate
    );

    const res = await fetch(`${this.baseUrl}${path}`, {
      method: "POST",
      headers: headers as unknown as Record<string, string>,
      body: JSON.stringify(signedMandate),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`HSP Gateway error (${res.status}): ${errText}`);
    }

    return (await res.json()) as HspCreateOrderResponse;
  }
}
