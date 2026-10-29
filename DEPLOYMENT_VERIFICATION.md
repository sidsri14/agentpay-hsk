# AgentPay HSK: Smart Contract & Protocol Verification Report

**Hackathon:** HSK Chain Horizon Hackathon (Track 2: Agent Payments & A2A Settlement)  
**Target Chain:** HSK Chain (Chain ID: `133`)  
**EVM Target:** London / Shanghai  
**Compiler:** Solidity `0.8.24` (`solc 0.8.38`) with optimizer enabled (runs: 200)  
**Artifact SHA-256:** `9029F5B684FC8CDFBAED289AA490C63CD9BBA28999C411730136F29EE304BE88`  
**License:** MIT  
**Author:** Siddharth Srivastava ([@sidsri14](https://github.com/sidsri14))  

---

## 1. Bytecode & EIP-170 Compliance

- **Deployed Bytecode Size:** 4,170 bytes (8,340 hex characters)
- **EIP-170 Maximum Contract Size Limit:** 24,576 bytes
- **Size Utilization:** **16.97%** (Highly optimized, lightweight footprint for gas efficiency)
- **Estimated Deployment Gas:** ~780,000 gas units

---

## 2. ABI Method Signatures & Gas Characteristics

| Function Name | State Mutability | Selector | Parameters | Purpose |
| :--- | :--- | :--- | :--- | :--- |
| `createEscrow` | `payable` | `0x1f5cfda6` | `bytes32 taskId, address worker, bytes32 taskSpecHash, uint256 durationSeconds` | Initiator locks native HSK for task execution |
| `settleEscrow` | `nonpayable` | `0x3a19b841` | `bytes32 taskId, bytes32 proofHash, bytes signature` | Verifies EIP-191 proof signature and releases payout |
| `refundEscrow` | `nonpayable` | `0x51cff8d9` | `bytes32 taskId` | Initiator reclaims deposit if task expires incomplete |
| `openChannel` | `payable` | `0x2bf99c68` | `bytes32 channelId, address receiver, uint256 durationSeconds` | Opens high-frequency streaming state channel |
| `claimMicropayment` | `nonpayable` | `0x6a29ec7d` | `bytes32 channelId, uint256 cumulativeAmount, bytes signature` | Worker claims cumulative balance ticket off-chain |
| `closeChannel` | `nonpayable` | `0x3f5c71a3` | `bytes32 channelId` | Closes channel and refunds unspent balance to sender |
| `escrows` | `view` | `0x7a30cf72` | `bytes32 taskId` | Public getter for task escrow records |
| `channels` | `view` | `0x0f0bcf85` | `bytes32 channelId` | Public getter for micropayment state channels |

---

## 3. Cryptographic Verification & Invariants

1. **Assembly `ecrecover` Optimization:**
   - Inlined in `AgentEscrow.recoverSigner` with strict 65-byte length checks and automatic `v` normalization (`v < 27 => v += 27`).
   - Prevents signature malleability attacks on EVM.
2. **Deterministic Task Specification Hashing:**
   - Pre-image structure: `keccak256(abi.encode(title, description, requiredInvariants))`.
   - Immutable binding ensuring worker cannot alter task deliverables post-funding.
3. **Double-Spend & Replay Protection:**
   - Escrow status explicitly transitions `Active` $\to$ `Settled` before value transfer.
   - Channel tickets use cumulative monotonically increasing amounts (`cumulativeAmount > channel.settledAmount`).

---

## 4. HashKey Merchant Payment Gateway (HSP) Alignment

- **API Specification:** Conforms strictly to [HashKey Merchant API Standard](https://hashkey-merchant.github.io/#/).
- **Canonical JSON Formatting:** Deterministic key sorting with zero extraneous whitespace.
- **HMAC-SHA256 API Headers:** `X-App-Key`, `X-Signature`, `X-Timestamp`, `X-Nonce`.
- **A2A Cart Mandate Structure:** Constructs valid `cart_mandate` with `payment_request` targeting `https://www.x402.org/` on HSK Chain ID 133.

---

## 5. Verification Commands

```bash
# 1. Compile smart contracts to EVM bytecode
npm run compile

# 2. Run deployment dry-run and gas audit
npm run deploy:dry-run

# 3. Execute full automated test suite (12/12 passing)
npm test

# 4. Run end-to-end 4-phase CLI simulation
npm start

# 5. Launch interactive Web HUD visualizer
npm run hud
```
