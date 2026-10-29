# AgentPay HSK: Autonomous Agent-to-Agent (A2A) Settlement & Micropayment Protocol

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Network](https://img.shields.io/badge/Network-HSK%20Chain%20(EVM)-emerald)](https://hsk.xyz)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue)](https://www.typescriptlang.org/)
[![Tests](https://img.shields.io/badge/Tests-6%2F6%20Passing-brightgreen)](test/agent-pay.test.ts)

**AgentPay HSK** is a high-throughput, non-custodial Agent-to-Agent (A2A) payment and escrow protocol built natively for **HSK Chain** (Chain ID: 133). It empowers autonomous AI agents to contract, verify, and settle micro-transactions and programmatic task payouts without human mediation.

Designed for the **HSK Chain Horizon Hackathon** (Track 2: Agent Payments & A2A Settlement).

---

## The Problem in Agentic Economies

As autonomous multi-agent networks scale, agents must collaborate across boundaries (e.g., Code Verification Agent hiring a Security Audit Agent, or an LLM Router hiring high-frequency GPU Inference nodes). Current Web3 payment rails suffer from:

1. **High Latency & Gas Costs on Micro-calls**: Invoking an agent tool or LLM inference token-by-token cannot afford individual on-chain transactions.
2. **Counterparty Risk**: Worker agents risk non-payment; hiring agents risk paying for unverified or failing code.
3. **Lack of Cryptographic Invariant Verification**: Payment releases are rarely tied to deterministic cryptographic execution proofs.

---

## The AgentPay Solution

AgentPay solves this with a **dual-layer settlement architecture** implemented in Solidity 0.8.24 and Viem:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        Autonomous Agent Network                        │
│                                                                        │
│   ┌─────────────────────┐                  ┌─────────────────────┐     │
│   │   Initiator Agent   │                  │    Worker Agent     │     │
│   │ (Task Dispatcher)   │                  │ (Code Auditor / LLM)│     │
│   └──────────┬──────────┘                  └──────────▲──────────┘     │
└──────────────┼────────────────────────────────────────┼────────────────┘
               │                                        │                 
       1. Lock Escrow / Channel                         │                 
               │                                        │                 
               ▼                                        │                 
┌───────────────────────────────────────────────────────┴────────────────┐
│                         HSK Chain EVM (Chain ID: 133)                  │
│                                                                        │
│   ┌────────────────────────────────────────────────────────────────┐   │
│   │                      AgentEscrow Contract                      │   │
│   │                                                                │   │
│   │  [Layer 1: Task Escrow]          [Layer 2: Micropay Channels]  │   │
│   │  • Deterministic taskSpecHash    • High-frequency streaming    │   │
│   │  • EIP-191 proof verification    • Cumulative balance tickets  │   │
│   │  • Automatic timeout refund      • Sub-millisecond off-chain   │   │
│   │  • Zero human intermediary       • Single on-chain claim/close │   │
│   └────────────────────────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────────────────────┘
```

### 1. Layer 1: Programmatic Task Escrow
- **Initiator locks native HSK** with a deterministic `taskSpecHash` (Keccak-256 hash of title, specification, and required code invariants).
- **Worker executes task** and produces an immutable execution artifact (e.g. git commit hash or test suite digest).
- **Initiator (or authorized guardrail agent) signs an EIP-191 settlement digest**:
  $$\text{digest} = \text{keccak256}(\text{taskId} \parallel \text{proofHash} \parallel \text{contractAddress})$$
- The smart contract verifies the cryptographic signature via assembly `ecrecover` and atomically releases funds to the worker.

### 2. Layer 2: Off-Chain Streaming Micropayment Channels
- For high-frequency A2A interactions (per-token LLM inference, API polling, continuous data feeds).
- Initiator opens a channel with a deposit in HSK.
- Initiator signs off-chain cumulative balance tickets:
  $$\text{ticketDigest} = \text{keccak256}(\text{channelId} \parallel \text{cumulativeAmount} \parallel \text{contractAddress})$$
- Worker can redeem the latest ticket on-chain at any time or upon channel expiration, withdrawing only the payment delta while unspent funds are safely returned.

---

## Technical Specifications

| Parameter | Value |
| :--- | :--- |
| **Target Network** | HSK Chain Testnet / Mainnet |
| **Chain ID** | `133` (HSK Testnet) |
| **Native Currency** | HSK |
| **Testnet RPC** | `https://testnet.hsk.xyz` |
| **Testnet Explorer** | `https://testnet-explorer.hskchain.net` |
| **Smart Contract** | [`contracts/AgentEscrow.sol`](contracts/AgentEscrow.sol) (Solidity `^0.8.24`) |
| **SDK & Test Client** | TypeScript 5.7, Viem 2.21, TSX |
| **Signature Standard** | EIP-191 Personal Sign with EIP-55 Checksummed addresses |

---

## Repository Structure

```
d:\agentpay-hsk\
├── contracts/
│   └── AgentEscrow.sol          # Production Solidity smart contract with assembly ecrecover
├── src/
│   ├── types.ts                 # Type definitions & HSK network configuration
│   ├── crypto.ts                # Deterministic hashing & EIP-191 signature utilities
│   ├── client.ts                # AgentPayProtocol client SDK for autonomous agents
│   └── index.ts                 # CLI entry point & programmatic simulation
├── test/
│   └── agent-pay.test.ts        # Node test runner suite with 6 comprehensive test cases
├── package.json
└── tsconfig.json
```

---

## Getting Started

### Prerequisites
- Node.js >= 18
- npm

### Installation
```bash
git clone https://github.com/sidsri14/agentpay-hsk.git
cd agentpay-hsk
npm install
```

### Running Tests
Run the comprehensive test suite verifying the cryptographic hashing, task escrow lifecycle, unauthorized signature rejection, and state channel streaming claims:

```bash
npm test
```

Expected output:
```
▶ AgentPay HSK: Autonomous A2A Settlement Suite
  ✔ computes deterministic task specification hash (1.9ms)
  ✔ creates a valid task escrow locking native HSK (0.6ms)
  ✔ rejects duplicate escrow creation for the same taskId (0.5ms)
  ✔ settles escrow upon valid initiator signature on execution proof (9.2ms)
  ✔ rejects escrow settlement with unauthorized agent signature (4.2ms)
  ✔ manages streaming micropayment channels and off-chain ticket claims (9.3ms)
✔ AgentPay HSK: Autonomous A2A Settlement Suite (27.9ms)
```

### Running Simulation CLI
```bash
npm start
```

---

## Smart Contract Interface (`AgentEscrow.sol`)

### Task Escrow Functions
- `createEscrow(bytes32 taskId, address worker, bytes32 taskSpecHash, uint256 durationSeconds) external payable`
- `settleEscrow(bytes32 taskId, bytes32 proofHash, bytes calldata signature) external`
- `refundEscrow(bytes32 taskId) external`

### Streaming Micropayment Functions
- `openChannel(bytes32 channelId, address receiver, uint256 durationSeconds) external payable`
- `claimMicropayment(bytes32 channelId, uint256 cumulativeAmount, bytes calldata signature) external`
- `closeChannel(bytes32 channelId) external`

---

## Real-World Use Case: Automated Solana Invariant Audit Escrow

In `test/agent-pay.test.ts`, AgentPay simulates an autonomous hiring workflow:
1. **Agent A (Supervisor)** creates an escrow for `task_hsk_perpetual_001` with specification `Bittern Labs Solana perpetual margin audit` requiring invariants `["i64_checked_abs", "u128_notional_math", "margin_ceiling"]`.
2. **Agent B (Worker)** inspects the Rust program, writes the fix, and runs `cargo test` (17/17 passing).
3. The proof hash `keccak256("17/17 cargo tests passed cleanly")` is submitted.
4. Agent A verifies the test output, signs the release digest, and Agent B receives programmatic payout in HSK.

---

## Author & License

- **Developer:** Siddharth Srivastava ([@sidsri14](https://github.com/sidsri14))
- **Email:** `sidsri1502@gmail.com`
- **License:** MIT
