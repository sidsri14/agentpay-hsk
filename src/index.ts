export * from "./types.js";
export * from "./crypto.js";
export * from "./client.js";

import { AgentPayProtocol } from "./client.js";
import { parseEther } from "viem";

// CLI execution simulation demo
if (process.argv[1]?.includes("index")) {
  console.log("=== AgentPay HSK: Autonomous A2A Settlement Simulation ===");
  const protocol = new AgentPayProtocol();

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

  console.log("Locked Escrow Created:", {
    taskId: escrow.taskId,
    amount: `${escrow.amountWei.toString()} wei (25 HSK)`,
    taskSpecHash: escrow.taskSpecHash,
    status: escrow.status,
  });
}
