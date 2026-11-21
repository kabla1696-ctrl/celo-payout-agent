// CLI for the Nishi Payout Agent.
//   node src/cli.js genkey
//     -> prints a fresh agent wallet address + private key (save it to a mode-600
//        .env file OUTSIDE the repo, never commit it)
//   node src/cli.js preview --sell USDT --buy wBRL --amount 5 [--chain celo]
//   node src/cli.js payout --to 0x... --currency wBRL --amount 5 [--chain celo] [--dry-run]
//   node src/cli.js register [--chain celo-sepolia|celo]
//
// Env: TAKER_PRIVATE_KEY (the agent wallet), ATTRIBUTION_CODE (assigned at Loops
// registration; defaults to celo_test1234 for dev).
import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { celo, celoSepolia, bscTestnet, baseSepolia } from 'viem/chains';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { BSC_TESTNET_TOKENS, CELO_TOKENS, CHAINS } from './config.js';
import { previewQuote } from './textile.js';
import { runPayout } from './payout.js';
import { registerAgent } from './register-agent.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..');

// Tiny .env loader (repo/.env, then ../.env in the workspace). No dependency.
for (const p of [join(REPO_ROOT, '.env'), join(REPO_ROOT, '..', '.env')]) {
  if (!existsSync(p)) continue;
  for (const line of readFileSync(p, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.+?)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
  }
}

const CHAIN_ALIASES = {
  celo: 'celo', 'celo-mainnet': 'celo',
  'celo-sepolia': 'celoSepolia', sepolia: 'celoSepolia',
  'bsc-testnet': 'bscTestnet', bsctestnet: 'bscTestnet',
  'base-sepolia': 'baseSepolia', basesepolia: 'baseSepolia',
};
const VIEM_CHAINS = { celo, celoSepolia, bscTestnet, baseSepolia };

function chainFor(name) {
  const key = CHAIN_ALIASES[name] || 'celo';
  const c = CHAINS[key];
  const viemChain = VIEM_CHAINS[key];
  return { ...c, ...viemChain, rpc: c.rpc };
}

const TOKENS = { celo: CELO_TOKENS, 'celo-sepolia': CELO_TOKENS, 'bsc-testnet': BSC_TESTNET_TOKENS, 'base-sepolia': CELO_TOKENS };

function arg(name, def) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : def;
}
function flag(name) { return process.argv.includes(`--${name}`); }

function loadAccount() {
  const pk = process.env.TAKER_PRIVATE_KEY;
  if (!pk) throw new Error('TAKER_PRIVATE_KEY is not set (see README: save it in a mode-600 .env outside the repo)');
  return privateKeyToAccount(pk.startsWith('0x') ? pk : `0x${pk}`);
}

const cmd = process.argv[2];

if (cmd === 'genkey') {
  const pk = generatePrivateKey();
  const account = privateKeyToAccount(pk);
  console.log(`Agent wallet address: ${account.address}`);
  console.log(`Private key (SAVE ONCE to a mode-600 .env file, never commit, never share):\n${pk}`);
  process.exit(0);
}

if (cmd === 'preview') {
  const chainName = arg('chain', 'celo');
  const chain = chainFor(chainName);
  const tokens = TOKENS[chainName] || CELO_TOKENS;
  const sell = tokens[arg('sell', 'USDT')];
  const buy = tokens[arg('buy', 'wBRL')];
  const amount = arg('amount', '5');
  const { parseUnits } = await import('viem');
  const data = await previewQuote({
    chainId: chain.id,
    sellToken: sell.address, buyToken: buy.address,
    sellAmount: parseUnits(amount, sell.decimals).toString(),
  });
  console.log(JSON.stringify(data, null, 2));
  process.exit(0);
}

if (cmd === 'payout') {
  const chainName = arg('chain', 'celo');
  const chain = chainFor(chainName);
  const tokens = TOKENS[chainName] || CELO_TOKENS;
  const account = loadAccount();
  const recipient = arg('to');
  if (!recipient) throw new Error('--to <freelancer wallet> is required');
  const currency = arg('currency', 'wBRL');
  const buy = tokens[currency];
  if (!buy) throw new Error(`unknown currency ${currency} (try cNGN, wBRL, wARS, wMXN, wCOP, IDRX)`);
  const sellSymbol = arg('sell', 'USDT');
  const sell = tokens[sellSymbol];
  if (!sell) throw new Error(`unknown sell token ${sellSymbol}`);
  const receipt = await runPayout({
    account, chain,
    sellToken: sell, buyToken: buy,
    amountUsd: arg('amount', '5'),
    recipient, dryRun: flag('dry-run'),
  });
  mkdirSync(join(REPO_ROOT, 'receipts'), { recursive: true });
  const file = join(REPO_ROOT, 'receipts', `${receipt.rfqId || 'dry-run'}.json`);
  writeFileSync(file, JSON.stringify({ ...receipt, at: new Date().toISOString() }, null, 2));
  console.log(`\nReceipt saved: ${file}`);
  process.exit(0);
}

if (cmd === 'register') {
  const chainName = arg('chain', 'celo-sepolia');
  const chain = chainFor(chainName);
  const account = loadAccount();
  const registration = JSON.parse(readFileSync(join(REPO_ROOT, 'agent-registration.json'), 'utf8'));
  // data: URI keeps the registration file onchain until the repo URL is final.
  const agentURI = `data:application/json;base64,${Buffer.from(JSON.stringify(registration)).toString('base64')}`;
  const { agentId, hash } = await registerAgent({
    account, chain, registry: chain.erc8004Identity, agentURI,
  });
  console.log(`\nAgent registered: ID ${agentId} (tx ${hash})`);
  console.log('Update agent-registration.json with the agent ID, then re-run with --uri to point at the hosted file.');
  process.exit(0);
}

console.log(`Usage:
  node src/cli.js genkey
  node src/cli.js preview --sell USDT --buy wBRL --amount 5 [--chain celo]
  node src/cli.js payout --to 0x... --currency wBRL --amount 5 [--chain celo] [--dry-run]
  node src/cli.js register [--chain celo-sepolia|celo]`);
process.exit(1);
