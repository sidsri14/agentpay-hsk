import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { parseEther, toHex, keccak256 } from "viem";
import { privateKeyToAccount, generatePrivateKey } from "viem/accounts";
import { AgentPayProtocol } from "../src/client.js";
import {
  computeTaskSpecHash,
  computeSettlementDigest,
  computeMicropayDigest,
} from "../src/crypto.js";

describe("AgentPay HSK: Autonomous A2A Settlement Suite", () => {
  const initiatorAccount = privateKeyToAccount(generatePrivateKey());
  const workerAccount = privateKeyToAccount(generatePrivateKey());
  const unauthorizedAccount = privateKeyToAccount(generatePrivateKey());

  const protocol = new AgentPayProtocol();

  test("computes deterministic task specification hash", () => {
    const spec = {
      title: "Audit Solana program",
      description: "Verify ceiling division invariants",
      requiredInvariants: ["ceiling_division", "checked_abs"],
    };
    const hash1 = computeTaskSpecHash(spec);
    const hash2 = computeTaskSpecHash(spec);

    assert.strictEqual(hash1, hash2);
    assert.strictEqual(hash1.length, 66); // 0x + 64 hex
  });

  test("creates a valid task escrow locking native HSK", () => {
    const taskId = "task_hsk_perpetual_001";
    const amount = parseEther("10.0"); // 10 HSK

    const escrow = protocol.createEscrow({
      taskId,
      initiatorAddress: initiatorAccount.address,
      workerAddress: workerAccount.address,
      amountWei: amount,
      taskSpec: {
        title: "Bittern Labs Solana perpetual margin audit",
        description: "Fix arithmetic overflow and ceiling margin",
        requiredInvariants: ["margin_ceiling"],
      },
      durationSeconds: 7200,
    });

    assert.strictEqual(escrow.taskId, taskId);
    assert.strictEqual(escrow.amountWei, amount);
    assert.strictEqual(escrow.status, "Active");
    assert.strictEqual(escrow.initiator, initiatorAccount.address);
    assert.strictEqual(escrow.worker, workerAccount.address);
  });

  test("rejects duplicate escrow creation for the same taskId", () => {
    assert.throws(
      () =>
        protocol.createEscrow({
          taskId: "task_hsk_perpetual_001",
          initiatorAddress: initiatorAccount.address,
          workerAddress: workerAccount.address,
          amountWei: parseEther("5.0"),
          taskSpec: { title: "Dup", description: "Dup", requiredInvariants: [] },
          durationSeconds: 3600,
        }),
      /already exists/
    );
  });

  test("settles escrow upon valid initiator signature on execution proof", async () => {
    const taskId = "task_hsk_perpetual_001";
    const proofHash = keccak256(toHex("17/17 cargo tests passed cleanly"));

    // Initiator signs the settlement digest authorizing payout to worker
    const digest = computeSettlementDigest(taskId, proofHash, protocol.contractAddress);
    const signature = await initiatorAccount.signMessage({ message: { raw: digest } });

    const settled = await protocol.settleEscrow(taskId, proofHash, signature);

    assert.strictEqual(settled.status, "Settled");
    assert.strictEqual(settled.proofHash, proofHash);
    assert.ok(settled.settledAt! > 0);
  });

  test("rejects escrow settlement with unauthorized agent signature", async () => {
    const taskId = "task_unauthorized_002";
    protocol.createEscrow({
      taskId,
      initiatorAddress: initiatorAccount.address,
      workerAddress: workerAccount.address,
      amountWei: parseEther("2.0"),
      taskSpec: { title: "Test", description: "Test", requiredInvariants: [] },
      durationSeconds: 3600,
    });

    const proofHash = keccak256(toHex("fake proof"));
    const digest = computeSettlementDigest(taskId, proofHash, protocol.contractAddress);
    // Unauthorized agent signs
    const unauthorizedSig = await unauthorizedAccount.signMessage({ message: { raw: digest } });

    await assert.rejects(
      () => protocol.settleEscrow(taskId, proofHash, unauthorizedSig),
      /Invalid signature/
    );
  });

  test("enforces refund timeout and initiator authority", () => {
    const taskId = "task_refund_test_003";
    const escrow = protocol.createEscrow({
      taskId,
      initiatorAddress: initiatorAccount.address,
      workerAddress: workerAccount.address,
      amountWei: parseEther("1.0"),
      taskSpec: { title: "Timeout Task", description: "Will expire", requiredInvariants: [] },
      durationSeconds: 1,
    });

    // 1. Cannot refund before deadline passes
    assert.throws(
      () => protocol.refundEscrow(taskId, initiatorAccount.address),
      /Deadline has not yet passed/
    );

    // 2. Manually simulate time elapsed
    escrow.deadlineTimestamp = Date.now() - 1000;

    // 3. Non-initiator cannot refund
    assert.throws(
      () => protocol.refundEscrow(taskId, unauthorizedAccount.address),
      /Only initiator can request refund/
    );

    // 4. Initiator refunds successfully
    const refunded = protocol.refundEscrow(taskId, initiatorAccount.address);
    assert.strictEqual(refunded.status, "Refunded");
  });

  test("manages streaming micropayment channels and off-chain ticket claims", async () => {
    const channelId = "chan_streaming_inference_001";
    const deposit = parseEther("5.0"); // 5 HSK deposit

    // 1. Sender opens micropayment channel
    const channel = protocol.openChannel(
      channelId,
      initiatorAccount.address,
      workerAccount.address,
      deposit,
      3600
    );

    assert.strictEqual(channel.isOpen, true);
    assert.strictEqual(channel.settledAmountWei, 0n);

    // 2. Sender streams signed ticket for 1.5 HSK (e.g. after 1500 model inferences)
    const claim1Amount = parseEther("1.5");
    const digest1 = computeMicropayDigest(channelId, claim1Amount, protocol.contractAddress);
    const sig1 = await initiatorAccount.signMessage({ message: { raw: digest1 } });

    const payoutDelta1 = await protocol.claimMicropayment({
      channelId,
      cumulativeAmountWei: claim1Amount,
      nonce: 1,
      signature: sig1,
    });

    assert.strictEqual(payoutDelta1, parseEther("1.5"));
    assert.strictEqual(protocol.channels.get(channelId)?.settledAmountWei, parseEther("1.5"));

    // 3. Sender streams cumulative ticket for 3.0 HSK (additional 1.5 HSK)
    const claim2Amount = parseEther("3.0");
    const digest2 = computeMicropayDigest(channelId, claim2Amount, protocol.contractAddress);
    const sig2 = await initiatorAccount.signMessage({ message: { raw: digest2 } });

    const payoutDelta2 = await protocol.claimMicropayment({
      channelId,
      cumulativeAmountWei: claim2Amount,
      nonce: 2,
      signature: sig2,
    });

    assert.strictEqual(payoutDelta2, parseEther("1.5"));
    assert.strictEqual(protocol.channels.get(channelId)?.settledAmountWei, parseEther("3.0"));

    // 4. Receiver closes channel and remaining 2.0 HSK is refunded
    const refund = protocol.closeChannel(channelId, workerAccount.address);
    assert.strictEqual(refund, parseEther("2.0"));
    assert.strictEqual(protocol.channels.get(channelId)?.isOpen, false);
  });
});
