import {
  keccak256,
  encodePacked,
  toHex,
  hashMessage,
  recoverAddress,
  getAddress,
  type Hex,
} from "viem";

/**
 * Computes deterministic Keccak-256 hash of task specification.
 */
export function computeTaskSpecHash(taskSpec: {
  title: string;
  description: string;
  requiredInvariants: string[];
}): `0x${string}` {
  const jsonStr = JSON.stringify(taskSpec);
  return keccak256(toHex(jsonStr));
}

/**
 * Computes the settlement message digest to be signed by the authorizing agent.
 * Matches: keccak256(abi.encodePacked(taskId, proofHash, contractAddress))
 */
export function computeSettlementDigest(
  taskId: string,
  proofHash: `0x${string}`,
  contractAddress: `0x${string}`
): `0x${string}` {
  return keccak256(
    encodePacked(
      ["bytes32", "bytes32", "address"],
      [toHex(taskId, { size: 32 }), proofHash, getAddress(contractAddress)]
    )
  );
}

/**
 * Computes the micropayment ticket message digest.
 * Matches: keccak256(abi.encodePacked(channelId, cumulativeAmount, contractAddress))
 */
export function computeMicropayDigest(
  channelId: string,
  cumulativeAmountWei: bigint,
  contractAddress: `0x${string}`
): `0x${string}` {
  return keccak256(
    encodePacked(
      ["bytes32", "uint256", "address"],
      [toHex(channelId, { size: 32 }), cumulativeAmountWei, getAddress(contractAddress)]
    )
  );
}

/**
 * Verifies EIP-191 signature and recovers the signer address.
 */
export async function verifySettlementSignature(
  digest: `0x${string}`,
  signature: Hex
): Promise<`0x${string}`> {
  const messageHash = hashMessage({ raw: digest });
  return await recoverAddress({ hash: messageHash, signature });
}
