/**
 * HashKey Merchant Payment Gateway (HSP) Types
 * Reference: https://hashkey-merchant.github.io/#/
 */

export interface HspPaymentMethodData {
  supported_methods: string; // e.g. "https://www.x402.org/"
  data: {
    x402Version: number;
    network: string; // e.g. "hsk-mainnet" | "hsk-testnet" | "sepolia"
    chain_id: number; // 133 for HSK Chain
    contract_address: `0x${string}`;
    pay_to: `0x${string}`;
    coin: string; // "USDC" | "USDT" | "HSK"
  };
}

export interface HspDisplayItem {
  label: string;
  amount: {
    currency: string; // "USD" | "USDC" | "USDT"
    value: string; // formatted decimal string, e.g. "25.00"
  };
}

export interface HspPaymentDetails {
  id: string; // payment request id
  display_items: HspDisplayItem[];
  total: {
    label: string;
    amount: {
      currency: string;
      value: string;
    };
  };
  modifiers?: Array<{
    supported_methods: string;
    data?: Record<string, unknown>;
    total?: {
      label: string;
      amount: {
        currency: string;
        value: string;
      };
    };
  }>;
}

export interface HspCartContents {
  id: string; // unique order id
  user_cart_confirmation_required: boolean;
  payment_request: {
    method_data: HspPaymentMethodData[];
    details: HspPaymentDetails;
  };
  metadata?: Record<string, unknown>;
}

export interface HspCartMandate {
  cart_mandate: {
    contents: HspCartContents;
    merchant_authorization?: string; // ES256K / EIP-191 signed token
  };
}

export interface HspHmacHeaders {
  "X-App-Key": string;
  "X-Signature": string;
  "X-Timestamp": string;
  "X-Nonce": string;
  "Content-Type": string;
}

export interface HspCreateOrderResponse {
  order_id: string;
  checkout_url: string;
  status: "pending" | "processing" | "succeeded" | "failed";
  created_at: number;
  expires_at: number;
}

export interface AgentPaymentInvoice {
  invoiceId: string;
  payerAgent: `0x${string}`;
  payeeAgent: `0x${string}`;
  taskId: string;
  taskSpecHash: `0x${string}`;
  items: Array<{ label: string; amountUsd: string }>;
  totalUsd: string;
  preferredCoin: "USDC" | "USDT" | "HSK";
  targetChainId: number;
  recipientAddress: `0x${string}`;
}
