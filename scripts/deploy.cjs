const fs = require('fs');
const path = require('path');
const { createWalletClient, createPublicClient, http } = require('viem');
const { privateKeyToAccount } = require('viem/accounts');
const { defineChain } = require('viem');

const hskTestnet = defineChain({
  id: 133,
  name: 'HSK Testnet',
  network: 'hsk-testnet',
  nativeCurrency: {
    decimals: 18,
    name: 'HSK',
    symbol: 'HSK',
  },
  rpcUrls: {
    default: {
      http: [process.env.HSK_RPC_URL || 'https://testnet.hsk.xyz'],
    },
    public: {
      http: [process.env.HSK_RPC_URL || 'https://testnet.hsk.xyz'],
    },
  },
  blockExplorers: {
    default: { name: 'Explorer', url: 'https://testnet-explorer.hskchain.net' },
  },
});

async function main() {
  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey) {
    console.error('Error: Please provide PRIVATE_KEY environment variable (e.g. PRIVATE_KEY=0x... node scripts/deploy.cjs)');
    process.exit(1);
  }

  const account = privateKeyToAccount(privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`);
  console.log(`Deploying AgentEscrow from account: ${account.address}`);

  const publicClient = createPublicClient({
    chain: hskTestnet,
    transport: http(),
  });

  const walletClient = createWalletClient({
    account,
    chain: hskTestnet,
    transport: http(),
  });

  const artifactPath = path.resolve(__dirname, '../artifacts/AgentEscrow.json');
  if (!fs.existsSync(artifactPath)) {
    console.error('Artifact not found. Please run "npm run compile" first.');
    process.exit(1);
  }

  const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));

  console.log('Sending deployment transaction to HSK Testnet (Chain ID: 133)...');
  const hash = await walletClient.deployContract({
    abi: artifact.abi,
    bytecode: artifact.bytecode,
  });

  console.log(`Transaction hash: ${hash}`);
  console.log('Waiting for receipt...');
  const receipt = await publicClient.waitForTransactionReceipt({ hash });

  console.log('AgentEscrow deployed successfully!');
  console.log(`Contract Address: ${receipt.contractAddress}`);
  console.log(`Explorer URL: https://testnet-explorer.hskchain.net/address/${receipt.contractAddress}`);
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { main };
