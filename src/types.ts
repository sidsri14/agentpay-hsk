export type EscrowStatus = "None" | "Active" | "Settled" | "Refunded" | "Disputed";

export interface TaskEscrowConfig {
  taskId: string;
  initiatorAddress: `0x${string}`;
  workerAddress: `0x${string}`;
  amountWei: bigint;
  taskSpec: {
    title: string;
    description: string;
    requiredInvariants: string[];
  };
  durationSeconds: number;
}

export interface TaskEscrowRecord {
  taskId: string;
  initiator: `0x${string}`;
  worker: `0x${string}`;
  amountWei: bigint;
  taskSpecHash: `0x${string}`;
  deadlineTimestamp: number;
  status: EscrowStatus;
  settledAt?: number;
  proofHash?: `0x${string}`;
}

export interface TaskExecutionProof {
  taskId: string;
  proofHash: `0x${string}`;
  testOutput: string;
  signature: `0x${string}`;
}

export interface MicropayTicket {
  channelId: string;
  cumulativeAmountWei: bigint;
  nonce: number;
  signature: `0x${string}`;
}

export interface ChannelRecord {
  channelId: string;
  sender: `0x${string}`;
  receiver: `0x${string}`;
  totalDepositWei: bigint;
  settledAmountWei: bigint;
  expirationTimestamp: number;
  isOpen: boolean;
}

export interface NetworkConfig {
  name: string;
  chainId: number;
  rpcUrl: string;
  currencySymbol: string;
  explorerUrl: string;
}

export const HSK_TESTNET: NetworkConfig = {
  name: "HSKChain Testnet",
  chainId: 133,
  rpcUrl: "https://testnet.hsk.xyz",
  currencySymbol: "HSK",
  explorerUrl: "https://testnet-explorer.hskchain.net",
};
