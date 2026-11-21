// ERC-8004 Identity Registry: register the agent so anyone can discover it.
// Docs: https://docs.celo.org/build-on-celo/build-with-ai/8004
// register(string agentURI) mints an ERC-721 identity NFT and returns the agent ID
// (read the ID from the Registered event on the receipt — the return value at
// simulation time can be stale if someone else registers first).
import { createPublicClient, createWalletClient, http } from 'viem';

const IDENTITY_ABI = [
  {
    name: 'register', type: 'function', stateMutability: 'nonpayable',
    inputs: [{ name: 'agentURI', type: 'string' }],
    outputs: [{ name: 'agentId', type: 'uint256' }],
  },
  {
    name: 'setAgentURI', type: 'function', stateMutability: 'nonpayable',
    inputs: [{ name: 'agentId', type: 'uint256' }, { name: 'newURI', type: 'string' }],
    outputs: [],
  },
  {
    anonymous: false, name: 'Registered', type: 'event',
    inputs: [
      { indexed: true, name: 'agentId', type: 'uint256' },
      { indexed: true, name: 'owner', type: 'address' },
      { indexed: false, name: 'agentURI', type: 'string' },
    ],
  },
];

export async function registerAgent({ account, chain, registry, agentURI }) {
  const wallet = createWalletClient({ account, chain, transport: http() });
  const pub = createPublicClient({ chain, transport: http() });
  console.log(`Registering agent on ERC-8004 (${chain.name})...`);
  console.log(`  registry: ${registry}`);
  console.log(`  agentURI: ${agentURI.slice(0, 120)}${agentURI.length > 120 ? '...' : ''}`);
  const hash = await wallet.writeContract({
    address: registry, abi: IDENTITY_ABI, functionName: 'register', args: [agentURI],
  });
  const receipt = await pub.waitForTransactionReceipt({ hash });
  console.log(`  tx: ${hash} (status ${receipt.status})`);
  if (receipt.status !== 'success') throw new Error('registration reverted');
  const log = receipt.logs.find((l) => l.address.toLowerCase() === registry.toLowerCase());
  let agentId = null;
  if (log) {
    // Registered(uint256 agentId, address owner, string agentURI): agentId is topic[1]
    agentId = BigInt(log.topics[1]).toString();
  }
  console.log(`  agent ID: ${agentId}`);
  return { hash, agentId };
}

export async function setAgentURI({ account, chain, registry, agentId, agentURI }) {
  const wallet = createWalletClient({ account, chain, transport: http() });
  const pub = createPublicClient({ chain, transport: http() });
  const hash = await wallet.writeContract({
    address: registry, abi: IDENTITY_ABI, functionName: 'setAgentURI',
    args: [BigInt(agentId), agentURI],
  });
  const receipt = await pub.waitForTransactionReceipt({ hash });
  console.log(`  setAgentURI tx: ${hash} (status ${receipt.status})`);
  return { hash };
}
