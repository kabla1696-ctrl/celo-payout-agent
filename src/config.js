// Shared config: chains, tokens, Textile FX API.
// Mainnet values from the hackathon Loops page + Textile FX docs (21 Nov 2026).
export const TEXTILE_API = 'https://api.textilecredit.com/v2';

export const CHAINS = {
  celo: {
    id: 42220,
    name: 'Celo',
    rpc: 'https://forno.celo.org',
    // Textile LimitOrderReactor on Celo mainnet
    reactor: '0xa9AA0a64769cBed4d3B1Ceb4Df01CdE915C235b3',
    erc8004Identity: '0x8004A169FB4a3325136EB29fA0ceB6D2e539a432',
  },
  celoSepolia: {
    id: 11142220,
    name: 'Celo Sepolia',
    rpc: 'https://forno.celo-sepolia.celo-testnet.org',
    erc8004Identity: '0x8004A818BFB912233c491871b3d84c89A494BD9e',
  },
  bscTestnet: {
    id: 97,
    name: 'BSC Testnet',
    rpc: 'https://data-seed-prebsc-1-s1.bnbchain.org:8545',
    reactor: '0x65B2f3847b391783e15554D5f2826FBaF318a7Df',
  },
  baseSepolia: {
    id: 84532,
    name: 'Base Sepolia',
    rpc: 'https://sepolia.base.org',
  },
};

// Celo mainnet stablecoins (from the hackathon page). USDT is 6 decimals on Celo.
export const CELO_TOKENS = {
  USDT: { address: '0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e', decimals: 6, symbol: 'USDT' },
  cNGN: { address: '0xF6829D7393dAe24509eb1E52eE8e572e2E271a4f', decimals: 6, symbol: 'cNGN' },
  IDRX: { address: '0x18Bc5bcC660cf2B9cE3cd51a404aFe1a0cBD3C22', decimals: 2, symbol: 'IDRX' },
  wARS: { address: '0x0DC4F92879B7670e5f4e4e6e3c801D229129D90D', decimals: 18, symbol: 'wARS' },
  wBRL: { address: '0xD76f5Faf6888e24D9F04Bf92a0c8B921FE4390e0', decimals: 18, symbol: 'wBRL' },
  wMXN: { address: '0x337E7456B420bD3481e7FA61fA9850343d610d34', decimals: 18, symbol: 'wMXN' },
  wCOP: { address: '0x8a1D45e102e886510e891d2Ec656a708991e2D76', decimals: 18, symbol: 'wCOP' },
};

// BSC testnet tokens (Textile testnet guide)
export const BSC_TESTNET_TOKENS = {
  cNGN: { address: '0x8a078b182bA9649c03982c2a80CDcc81cdc99dA8', decimals: 6, symbol: 'cNGN' },
  USDT: { address: '0x337610d27c682E347C9cD60BD4b3b107C9d34dDd', decimals: 18, symbol: 'USDT' },
};

// Attribution code: assigned at Loops registration (site-issued 21 Nov 2026:
// celo_1c8609d4e9a0 — NOT the slug-derived guess celo_82005376ffb1).
export const ATTRIBUTION_CODE = process.env.ATTRIBUTION_CODE || 'celo_1c8609d4e9a0';
// GitHub repo slug the code is derived from (codeFromRepo). Set at registration.
export const REPO_SLUG = 'kabla1696-ctrl/celo-payout-agent';
