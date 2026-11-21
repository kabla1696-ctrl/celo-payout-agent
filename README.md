# Nishi Payout Agent

Pays freelancers in **local stablecoins on Celo**. A client pays in USDT; the agent
converts it on [Textile FX](https://fx-docs.textilecredit.com) into the freelancer's
local stablecoin (cNGN, wBRL, wARS, wMXN, wCOP or IDRX) and pays their wallet — all
onchain, every transaction tagged with the hackathon attribution code, and the agent
itself registered on [ERC-8004](https://docs.celo.org/build-on-celo/build-with-ai/8004).

Built for the Celo **"Agents Open for Business"** hackathon (20 Nov – 7 Dec 2026),
**Stablecoin Corridors** track.

## How it works

```
payout --to <freelancer wallet> --currency wBRL --amount 5
  1. preview   Textile RFQ preview (free) — shows the rate before committing
  2. quote     firm quote, USDT -> wBRL, bound to the agent wallet (60s TTL)
  3. approve   takerPays to the Textile reactor
  4. swap      broadcast transactions.swap with the attribution tag appended
  5. pay       transfer the wBRL to the freelancer (tagged transfer)
  6. receipt   tx hashes, rate and amounts saved to receipts/<rfqId>.json
```

No API key needed: Textile RFQ works keyless — the agent signs a short
EIP-712 `TakerControl` proof that it controls the taker wallet. Quotes are firm
for 60 seconds and all-or-nothing.

## Setup

```bash
npm install
node src/cli.js genkey        # fresh agent wallet — SAVE the key to a mode-600 .env
                              # file OUTSIDE this repo, never commit it
TAKER_PRIVATE_KEY=0x... node src/cli.js preview --sell USDT --buy wBRL --amount 5
```

`.env` is loaded from the repo root or its parent directory. Only `TAKER_PRIVATE_KEY`
(and optionally `ATTRIBUTION_CODE`, assigned at hackathon registration) are read.

## Testnet first

The RFQ flow is tested on BSC testnet (chain 97, cNGN <-> USDT) and Base Sepolia,
where the size floor is ~$0.01 instead of $1:

```bash
node src/cli.js preview --sell cNGN --buy USDT --amount 0.05 --chain bsc-testnet
node src/cli.js payout --to 0x... --currency USDT --amount 0.05 --chain bsc-testnet
```

(Use `--sell`/`--buy` on preview; payout always sells USDT on Celo mainnet.)

## Register the agent (ERC-8004)

```bash
node src/cli.js register --chain celo-sepolia   # testnet first
node src/cli.js register --chain celo           # mainnet, after funding gas
```

`register` mints the agent identity NFT and prints the agent ID. Update
`agent-registration.json` with the ID and your repo URL.

## Attribution

Every swap and payout carries the hackathon attribution tag
([ERC-8021](https://github.com/celo-org/attribution-tags), `@celo/attribution-tags`).
The code was assigned at Loops registration: `celo_1c8609d4e9a0`. Set it with
`ATTRIBUTION_CODE=celo_1c8609d4e9a0` in `.env` (it is also the code default).

## License

MIT
