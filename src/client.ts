import {
  type Hex,
  toHex,
} from "viem";
import {
  type TaskEscrowConfig,
  type TaskEscrowRecord,
  type ChannelRecord,
  type MicropayTicket,
  type NetworkConfig,
  HSK_TESTNET,
} from "./types.js";
import {
  computeTaskSpecHash,
  computeSettlementDigest,
  computeMicropayDigest,
  verifySettlementSignature,
} from "./crypto.js";

export class AgentPayProtocol {
  public escrows: Map<string, TaskEscrowRecord> = new Map();
  public channels: Map<string, ChannelRecord> = new Map();
  public contractAddress: `0x${string}`;
  public network: NetworkConfig;

  constructor(
    contractAddress: `0x${string}` = "0x89c62341109a1D91062341109a1D91062341109a",
    network: NetworkConfig = HSK_TESTNET
  ) {
    this.contractAddress = contractAddress;
    this.network = network;
  }

  /**
   * Locks native HSK in escrow for an autonomous agent task.
   */
  createEscrow(config: TaskEscrowConfig): TaskEscrowRecord {
    if (this.escrows.has(config.taskId)) {
      throw new Error(`Escrow already exists for taskId: ${config.taskId}`);
    }
    if (config.amountWei <= 0n) {
      throw new Error("Amount must be greater than zero");
    }

    const taskSpecHash = computeTaskSpecHash(config.taskSpec);
    const deadlineTimestamp = Date.now() + config.durationSeconds * 1000;

    const record: TaskEscrowRecord = {
      taskId: config.taskId,
      initiator: config.initiatorAddress,
      worker: config.workerAddress,
      amountWei: config.amountWei,
      taskSpecHash,
      deadlineTimestamp,
      status: "Active",
    };

    this.escrows.set(config.taskId, record);
    return record;
  }

  /**
   * Releases escrow to worker upon cryptographic verification of execution proof signature.
   */
  async settleEscrow(
    taskId: string,
    proofHash: `0x${string}`,
    signature: Hex
  ): Promise<TaskEscrowRecord> {
    const escrow = this.escrows.get(taskId);
    if (!escrow) {
      throw new Error(`Escrow not found: ${taskId}`);
    }
    if (escrow.status !== "Active") {
      throw new Error(`Escrow is not active: ${escrow.status}`);
    }
    if (Date.now() > escrow.deadlineTimestamp) {
      throw new Error("Task deadline has passed");
    }

    const digest = computeSettlementDigest(taskId, proofHash, this.contractAddress);
    const recoveredSigner = await verifySettlementSignature(digest, signature);

    // Verify signer is authorized initiator
    if (recoveredSigner.toLowerCase() !== escrow.initiator.toLowerCase()) {
      throw new Error(`Invalid signature: recovered ${recoveredSigner}, expected ${escrow.initiator}`);
    }

    escrow.status = "Settled";
    escrow.settledAt = Date.now();
    escrow.proofHash = proofHash;

    return escrow;
  }

  /**
   * Refunds escrow back to initiator if deadline expired without completion.
   */
  refundEscrow(taskId: string, callerAddress: `0x${string}`): TaskEscrowRecord {
    const escrow = this.escrows.get(taskId);
    if (!escrow) {
      throw new Error(`Escrow not found: ${taskId}`);
    }
    if (escrow.status !== "Active") {
      throw new Error(`Escrow is not active: ${escrow.status}`);
    }
    if (Date.now() <= escrow.deadlineTimestamp) {
      throw new Error("Deadline has not yet passed; cannot refund active escrow");
    }
    if (callerAddress.toLowerCase() !== escrow.initiator.toLowerCase()) {
      throw new Error("Only initiator can request refund");
    }

    escrow.status = "Refunded";
    return escrow;
  }

  /**
   * Opens an off-chain streaming micropayment channel.
   */
  openChannel(
    channelId: string,
    sender: `0x${string}`,
    receiver: `0x${string}`,
    depositWei: bigint,
    durationSeconds: number
  ): ChannelRecord {
    if (this.channels.has(channelId)) {
      throw new Error(`Channel already exists: ${channelId}`);
    }
    if (depositWei <= 0n) {
      throw new Error("Deposit must be greater than zero");
    }

    const channel: ChannelRecord = {
      channelId,
      sender,
      receiver,
      totalDepositWei: depositWei,
      settledAmountWei: 0n,
      expirationTimestamp: Date.now() + durationSeconds * 1000,
      isOpen: true,
    };

    this.channels.set(channelId, channel);
    return channel;
  }

  /**
   * Receiver claims cumulative micropayment from channel using sender's signed ticket.
   */
  async claimMicropayment(ticket: MicropayTicket): Promise<bigint> {
    const channel = this.channels.get(ticket.channelId);
    if (!channel) {
      throw new Error(`Channel not found: ${ticket.channelId}`);
    }
    if (!channel.isOpen) {
      throw new Error("Channel is closed");
    }
    if (ticket.cumulativeAmountWei > channel.totalDepositWei) {
      throw new Error("Ticket exceeds channel deposit");
    }
    if (ticket.cumulativeAmountWei <= channel.settledAmountWei) {
      throw new Error("Ticket amount must be strictly greater than previously settled amount");
    }

    const digest = computeMicropayDigest(
      ticket.channelId,
      ticket.cumulativeAmountWei,
      this.contractAddress
    );
    const recoveredSigner = await verifySettlementSignature(digest, ticket.signature);

    if (recoveredSigner.toLowerCase() !== channel.sender.toLowerCase()) {
      throw new Error(`Invalid ticket signature: recovered ${recoveredSigner}, expected ${channel.sender}`);
    }

    const payoutDelta = ticket.cumulativeAmountWei - channel.settledAmountWei;
    channel.settledAmountWei = ticket.cumulativeAmountWei;

    return payoutDelta;
  }

  /**
   * Closes channel after expiration and calculates refund.
   */
  closeChannel(channelId: string, callerAddress: `0x${string}`): bigint {
    const channel = this.channels.get(channelId);
    if (!channel) {
      throw new Error(`Channel not found: ${channelId}`);
    }
    if (!channel.isOpen) {
      throw new Error("Channel already closed");
    }

    const isExpired = Date.now() >= channel.expirationTimestamp;
    const isReceiver = callerAddress.toLowerCase() === channel.receiver.toLowerCase();

    if (!isExpired && !isReceiver) {
      throw new Error("Cannot close channel before expiration unless initiated by receiver");
    }

    channel.isOpen = false;
    const remainingRefund = channel.totalDepositWei - channel.settledAmountWei;
    return remainingRefund;
  }
}
