# AgentPay HSK: Autonomous Agent-to-Agent (A2A) Settlement & Micropayment Protocol

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Network](https://img.shields.io/badge/Network-HSK%20Chain%20(EVM)-emerald)](https://hsk.xyz)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue)](https://www.typescriptlang.org/)
[![Tests](https://img.shields.io/badge/Tests-10%2F10%20Passing-brightgreen)](test/)

**AgentPay HSK** is a high-throughput, non-custodial Agent-to-Agent (A2A) payment and escrow protocol built natively for **HSK Chain** (Chain ID: 133). It empowers autonomous AI agents to contract, verify, and settle micro-transactions, programmatic task payouts, and **HashKey Merchant Payment Gateway (HSP)** orders without human mediation.

Designed specifically for the **HSK Chain Horizon Hackathon** (Track 2: Agent Payments & A2A Settlement).

---

## The Problem in Agentic Economies

As autonomous multi-agent networks scale, agents must collaborate across boundaries (e.g., Code Verification Agent hiring a Security Audit Agent, or an LLM Router hiring high-frequency GPU Inference nodes). Current Web3 payment rails suffer from:

1. **High Latency & Gas Costs on Micro-calls**: Invoking an agent tool or LLM inference token-by-token cannot afford individual on-chain transactions.
2. **Counterparty Risk**: Worker agents risk non-payment; hiring agents risk paying for unverified or failing code.
3. **Lack of Standardized Payment Mandates**: Agents lack standardized interfaces to negotiate price conditions, authorize payments via cryptographic signatures, and interface with compliant merchant payment gateways.

---

## The AgentPay Solution

AgentPay provides a **three-tier settlement architecture** natively integrated with HSK Chain and the HashKey Merchant Payment Gateway (HSP):

```
┌────────────────────────────────────────────────────────────────────────┐
│                        Autonomous Agent Network                        │
│                                                                        │
│   ┌─────────────────────┐                  ┌─────────────────────┐     │
│   │    Payer Agent      │                  │     Payee Agent     │     │
│   │ (Task Dispatcher)   │                  │ (Code Auditor / LLM)│     │
│   └──────────┬──────────┘                  └──────────▲──────────┘     │
└──────────────┼────────────────────────────────────────┼────────────────┘
               │ 1. Transmit Payment Conditions / Invoice
               │ 2. Construct & Sign HSP Cart Mandate   │
               ▼                                        │
┌───────────────────────────────────────────────────────┴────────────────┐
│             HashKey Merchant Payment Gateway (HSP) Interface           │
│                                                                        │
│   • Canonical JSON serializer & SHA-256 body hashing                   │
│   • HMAC-SHA256 API request signing (X-App-Key, X-Signature, X-Nonce)  │
│   • ES256K / EIP-191 Merchant Authorization signature                  │
│   • POST /api/v1/merchant/orders gateway checkout synthesis            │
└──────────────────────────────────────┬─────────────────────────────────┘
                                       │
                                       ▼
┌────────────────────────────────────────────────────────────────────────┐
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

### 1. Layer 1: Programmatic Task Escrow (`contracts/AgentEscrow.sol`)
- **Initiator locks native HSK** with a deterministic `taskSpecHash` (Keccak-256 hash of title, specification, and required code invariants).
- **Worker executes task** and produces an immutable execution artifact (e.g. git commit hash or test suite digest).
- **Initiator signs an EIP-191 settlement digest**:
  $$\text{digest} = \text{keccak256}(\text{taskId} \parallel \text{proofHash} \parallel \text{contractAddress})$$
- The smart contract verifies the cryptographic signature via assembly `ecrecover` and atomically releases funds to the worker.

### 2. Layer 2: Off-Chain Streaming Micropayment Channels
- For high-frequency A2A interactions (per-token LLM inference, continuous tool calls).
- Initiator opens a channel with a deposit in HSK.
- Initiator signs off-chain cumulative balance tickets:
  $$\text{ticketDigest} = \text{keccak256}(\text{channelId} \parallel \text{cumulativeAmount} \parallel \text{contractAddress})$$
- Worker can redeem the latest ticket on-chain at any time, withdrawing only the payment delta while unspent funds are safely returned.

### 3. Layer 3: HashKey Merchant (HSP) Gateway & Cart Mandate Adapter (`src/hsp-gateway.ts`)
- Implements the exact official specification of the [HashKey Merchant API Documentation](https://hashkey-merchant.github.io/#/):
  - **A2A Cart Mandate Construction**: Transforms raw agent invoices into valid `cart_mandate` objects with `method_data` (supporting x402 on HSK Chain ID 133, USDC, and USDT) and itemized `display_items`.
  - **Canonical JSON Serialization**: Recursively sorts all keys alphabetically.
  - **HMAC-SHA256 Request Signing**: Computes message digests using `"{METHOD}\n{PATH}\n{QUERY}\n{bodyHash}\n{timestamp}\n{nonce}"` for tamper-proof API communication.
  - **Agent Wallet Authorization**: Payer Agent signs the canonical mandate digest with its private key (`merchant_authorization`).

---

## Technical Specifications

| Parameter | Value |
| :--- | :--- |
| **Target Network** | HSK Chain Testnet / Mainnet |
| **Chain ID** | `133` |
| **Native Currency** | HSK |
| **Supported Stablecoins** | USDC, USDT (via HSP Gateway) |
| **Testnet RPC** | `https://testnet.hsk.xyz` |
| **Testnet Explorer** | `https://testnet-explorer.hskchain.net` |
| **Gateway Endpoint** | `https://merchant-qa.hashkeymerchant.com` / `https://hsp.hashkey.com` |
| **Smart Contract** | [`contracts/AgentEscrow.sol`](contracts/AgentEscrow.sol) (Solidity `^0.8.24`) |
| **SDK & Test Client** | TypeScript 5.7, Viem 2.21, TSX |
| **Signature Standards** | EIP-191 Personal Sign, HMAC-SHA256, Canonical JSON |

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
│   ├── hsp-types.ts             # HashKey Merchant Gateway (HSP) Cart Mandate & API types
│   ├── hsp-gateway.ts           # Canonical JSON, HMAC-SHA256 signing & A2A Mandate builder
│   └── index.ts                 # CLI entry point & programmatic simulation
├── test/
│   ├── agent-pay.test.ts        # Programmatic escrow & streaming channel test suite
│   └── hsp-gateway.test.ts      # HSP Cart Mandate & HMAC authentication test suite
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
Run the comprehensive 10-test suite verifying the cryptographic hashing, task escrow lifecycle, unauthorized signature rejection, state channel streaming claims, and HSP Cart Mandate HMAC signing:

```bash
npm test
```

Expected output:
```
▶ AgentPay HSK: Autonomous A2A Settlement Suite
  ✔ computes deterministic task specification hash (1.7ms)
  ✔ creates a valid task escrow locking native HSK (0.9ms)
  ✔ rejects duplicate escrow creation for the same taskId (0.9ms)
  ✔ settles escrow upon valid initiator signature on execution proof (15.7ms)
  ✔ rejects escrow settlement with unauthorized agent signature (6.1ms)
  ✔ manages streaming micropayment channels and off-chain ticket claims (15.0ms)
✔ AgentPay HSK: Autonomous A2A Settlement Suite (42.8ms)
✔ HSP Gateway Suite: Canonical JSON formatting and deterministic SHA-256 body hash (2.0ms)
✔ HSP Gateway Suite: HMAC-SHA256 request signing and verification (1.6ms)
✔ HSP Gateway Suite: A2A Invoice conversion into valid HSP Cart Mandate (0.5ms)
✔ HSP Gateway Suite: Agent wallet signs Cart Mandate and submits to Gateway (48.3ms)
ℹ tests 10 | suites 1 | pass 10 | fail 0
```

### Running Simulation CLI
```bash
npm start
```

---

## Author & License

- **Developer:** Siddharth Srivastava ([@sidsri14](https://github.com/sidsri14))
- **Email:** `sidsri1502@gmail.com`
- **License:** MIT
