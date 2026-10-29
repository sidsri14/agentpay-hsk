const fs = require('fs');
const path = require('path');
const solc = require('solc');

const contractPath = path.resolve(__dirname, '../contracts/AgentEscrow.sol');
const source = fs.readFileSync(contractPath, 'utf8');

const input = {
  language: 'Solidity',
  sources: {
    'AgentEscrow.sol': {
      content: source,
    },
  },
  settings: {
    optimizer: {
      enabled: true,
      runs: 200,
    },
    outputSelection: {
      '*': {
        '*': ['abi', 'evm.bytecode', 'evm.deployedBytecode'],
      },
    },
  },
};

console.log('Compiling AgentEscrow.sol with solc', solc.version(), '...');
const output = JSON.parse(solc.compile(JSON.stringify(input)));

let hasErrors = false;
if (output.errors) {
  for (const err of output.errors) {
    if (err.severity === 'error') {
      hasErrors = true;
      console.error('ERROR:', err.formattedMessage);
    } else {
      console.warn('WARNING:', err.formattedMessage);
    }
  }
}

if (hasErrors) {
  console.error('Compilation failed with errors.');
  process.exit(1);
}

const contract = output.contracts['AgentEscrow.sol']['AgentEscrow'];
const artifactsDir = path.resolve(__dirname, '../artifacts');
if (!fs.existsSync(artifactsDir)) {
  fs.mkdirSync(artifactsDir, { recursive: true });
}

const artifact = {
  contractName: 'AgentEscrow',
  abi: contract.abi,
  bytecode: '0x' + contract.evm.bytecode.object,
  deployedBytecode: '0x' + contract.evm.deployedBytecode.object,
  compilerVersion: solc.version(),
  compiledAt: new Date().toISOString(),
};

fs.writeFileSync(
  path.join(artifactsDir, 'AgentEscrow.json'),
  JSON.stringify(artifact, null, 2),
  'utf8'
);

console.log('Successfully compiled AgentEscrow.sol!');
console.log('Artifact written to artifacts/AgentEscrow.json');
console.log('Bytecode size:', Math.round(contract.evm.bytecode.object.length / 2), 'bytes');
console.log('ABI methods count:', contract.abi.filter(item => item.type === 'function').length);
