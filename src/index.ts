export * from "./types.js";
export * from "./crypto.js";
export * from "./client.js";
export * from "./hsp-types.js";
export * from "./hsp-gateway.js";

import { AgentPayProtocol } from "./client.js";
import {
  buildHspCartMandateFromInvoice,
  HspAgentPaymentGateway,
} from "./hsp-gateway.js";
import {
  computeSettlementDigest,
  computeMicropayDigest,
} from "./crypto.js";
import { type AgentPaymentInvoice } from "./hsp-types.js";
import { parseEther, toHex, keccak256 } from "viem";
import { privateKeyToAccount, generatePrivateKey } from "viem/accounts";

// CLI execution simulation demo
if (process.argv[1]?.includes("index")) {
  async function runDemo() {
    console.log("=== AgentPay HSK: Autonomous A2A Settlement & HSP Gateway Simulation ===");
    const protocol = new AgentPayProtocol();

    const initiatorAccount = privateKeyToAccount(generatePrivateKey());
    const workerAccount = privateKeyToAccount(generatePrivateKey());

    // Phase 1: On-Chain Programmatic Escrow
    const escrow = protocol.createEscrow({
      taskId: "task_agent_audit_101",
      initiatorAddress: initiatorAccount.address,
      workerAddress: workerAccount.address,
      amountWei: parseEther("25.0"), // 25 HSK
      taskSpec: {
        title: "Solana Perpetual Position Margin Invariant Audit",
        description: "Perform checked arithmetic bug fix on LeverUp position program",
        requiredInvariants: ["i64_checked_abs", "u128_notional_math", "ceiling_division_margin"],
      },
      durationSeconds: 3600,
    });

    console.log("\n[Phase 1: Layer 1 Task Escrow Created]");
    console.log({
      taskId: escrow.taskId,
      amount: "25.0 HSK",
      initiator: escrow.initiator,
      worker: escrow.worker,
      taskSpecHash: escrow.taskSpecHash,
      status: escrow.status,
    });

    // Phase 2: A2A HSP Cart Mandate Construction & Gateway Order
    const invoice: AgentPaymentInvoice = {
      invoiceId: "inv_audit_pass_001",
      payerAgent: initiatorAccount.address,
      payeeAgent: workerAccount.address,
      taskId: escrow.taskId,
      taskSpecHash: escrow.taskSpecHash,
      items: [
        { label: "Solana Checked Math Audit", amountUsd: "20.00" },
        { label: "Deterministic Test Suite Generation", amountUsd: "5.00" },
      ],
      totalUsd: "25.00",
      preferredCoin: "USDC",
      targetChainId: 133, // HSK Chain
      recipientAddress: workerAccount.address,
    };

    const mandate = buildHspCartMandateFromInvoice(invoice);
    const gateway = new HspAgentPaymentGateway();

    console.log("\n[Phase 2: Layer 2 HSP Cart Mandate & Gateway Checkout]");
    const order = await gateway.submitOrder(mandate, true);
    console.log({
      orderId: order.order_id,
      checkoutUrl: order.checkout_url,
      status: order.status,
      expiresAt: new Date(order.expires_at * 1000).toISOString(),
    });

    // Phase 3: Cryptographic Task Execution Proof & Escrow Settlement
    const proofHash = keccak256(toHex("17/17 cargo tests passed cleanly, 0 clippy warnings"));
    const digest = computeSettlementDigest(escrow.taskId, proofHash, protocol.contractAddress);
    const signature = await initiatorAccount.signMessage({ message: { raw: digest } });

    const settledEscrow = await protocol.settleEscrow(escrow.taskId, proofHash, signature);
    console.log("\n[Phase 3: EIP-191 Proof Verification & On-Chain Settlement]");
    console.log({
      taskId: settledEscrow.taskId,
      status: settledEscrow.status,
      proofHash: settledEscrow.proofHash,
      settledAt: new Date(settledEscrow.settledAt!).toISOString(),
    });

    // Phase 4: High-Frequency Streaming State Channel
    const channelId = "chan_inference_stream_202";
    protocol.openChannel(channelId, initiatorAccount.address, workerAccount.address, parseEther("10.0"), 3600);

    // Stream 2 micropayment tickets
    const ticket1Amount = parseEther("2.5");
    const ticketDigest1 = computeMicropayDigest(channelId, ticket1Amount, protocol.contractAddress);
    const ticketSig1 = await initiatorAccount.signMessage({ message: { raw: ticketDigest1 } });
    const delta1 = await protocol.claimMicropayment({
      channelId,
      cumulativeAmountWei: ticket1Amount,
      nonce: 1,
      signature: ticketSig1,
    });

    const ticket2Amount = parseEther("6.0");
    const ticketDigest2 = computeMicropayDigest(channelId, ticket2Amount, protocol.contractAddress);
    const ticketSig2 = await initiatorAccount.signMessage({ message: { raw: ticketDigest2 } });
    const delta2 = await protocol.claimMicropayment({
      channelId,
      cumulativeAmountWei: ticket2Amount,
      nonce: 2,
      signature: ticketSig2,
    });

    const refund = protocol.closeChannel(channelId, workerAccount.address);
    console.log("\n[Phase 4: Off-Chain Streaming Micropayments Channel]");
    console.log({
      channelId,
      totalDeposited: "10.0 HSK",
      ticket1ClaimDelta: "2.5 HSK",
      ticket2ClaimDelta: "3.5 HSK",
      totalWorkerClaimed: "6.0 HSK",
      initiatorRefunded: `${Number(refund) / 1e18} HSK`,
      channelClosed: true,
    });

    console.log("\n=== End Simulation: Dual-Layer A2A Settlement Completed Deterministically ===");
  }

  runDemo().catch(console.error);
}
