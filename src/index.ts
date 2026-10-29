export * from "./types.js";
export * from "./crypto.js";
export * from "./client.js";
export * from "./hsp-types.js";
export * from "./hsp-gateway.js";

import { AgentPayProtocol } from "./client.js";
import {
  buildHspCartMandateFromInvoice,
  HspAgentPaymentGateway,
  createHspHmacHeaders,
  computeBodyHash,
} from "./hsp-gateway.js";
import { type AgentPaymentInvoice } from "./hsp-types.js";
import { parseEther } from "viem";

// CLI execution simulation demo
if (process.argv[1]?.includes("index")) {
  console.log("=== AgentPay HSK: Autonomous A2A Settlement & HSP Gateway Simulation ===");
  const protocol = new AgentPayProtocol();

  // Phase 1: On-Chain Programmatic Escrow
  const escrow = protocol.createEscrow({
    taskId: "task_agent_audit_101",
    initiatorAddress: "0x1111111111111111111111111111111111111111",
    workerAddress: "0x2222222222222222222222222222222222222222",
    amountWei: parseEther("25.0"), // 25 HSK
    taskSpec: {
      title: "Solana Perpetual Position Margin Invariant Audit",
      description: "Perform checked arithmetic bug fix on LeverUp position program",
      requiredInvariants: ["i64_checked_abs", "u128_notional_math", "ceiling_division_margin"],
    },
    durationSeconds: 3600,
  });

  console.log("[Layer 1] Locked Task Escrow Created:", {
    taskId: escrow.taskId,
    amount: `${escrow.amountWei.toString()} wei (25 HSK)`,
    taskSpecHash: escrow.taskSpecHash,
    status: escrow.status,
  });

  // Phase 2: A2A HSP Cart Mandate Construction & Gateway Order
  const invoice: AgentPaymentInvoice = {
    invoiceId: "inv_audit_pass_001",
    payerAgent: "0x1111111111111111111111111111111111111111",
    payeeAgent: "0x2222222222222222222222222222222222222222",
    taskId: escrow.taskId,
    taskSpecHash: escrow.taskSpecHash,
    items: [
      { label: "Solana Checked Math Audit", amountUsd: "20.00" },
      { label: "Deterministic Test Suite Generation", amountUsd: "5.00" },
    ],
    totalUsd: "25.00",
    preferredCoin: "USDC",
    targetChainId: 133, // HSK Chain
    recipientAddress: "0x2222222222222222222222222222222222222222",
  };

  const mandate = buildHspCartMandateFromInvoice(invoice);
  const gateway = new HspAgentPaymentGateway();

  console.log("\n[Layer 2 - HSP] A2A Cart Mandate Constructed:");
  console.log(JSON.stringify(mandate, null, 2));

  gateway.submitOrder(mandate, true).then((order) => {
    console.log("\n[Layer 2 - HSP] Gateway Order Created Successfully:", order);
    console.log("=== End Simulation: Autonomous A2A Settlement Complete ===");
  });
}
