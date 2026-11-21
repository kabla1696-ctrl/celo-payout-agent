// Textile FX RFQ API v2 client (keyless path — no API key needed).
// Docs: https://fx-docs.textilecredit.com/api/v2/rfq.html
// Flow: preview (free) -> request firm quote -> approve takerPays -> broadcast
// transactions.swap -> POST submit with the tx hash.
import crypto from 'node:crypto';
import { toHex } from 'viem';
import { TEXTILE_API } from './config.js';

const TIMEOUT_MS = 75_000;

async function post(path, body, headers = {}) {
  const res = await fetch(`${TEXTILE_API}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
}

// EIP-712 TakerControl v1 proof — proves the taker wallet is ours.
// domain: { name: "Textile Taker Control", version: "1", chainId }
// One verified proof covers the wallet+chain for ~12h (grant); send unsigned first
// and sign only when the API answers 401 proof_of_control_required.
export async function signTakerControl(account, chainId) {
  const nonce = toHex(crypto.randomBytes(32));
  const issuedAt = Date.now(); // Unix milliseconds
  const signature = await account.signTypedData({
    domain: { name: 'Textile Taker Control', version: '1', chainId },
    types: {
      TakerControl: [
        { name: 'taker', type: 'address' },
        { name: 'chainId', type: 'uint256' },
        { name: 'nonce', type: 'bytes32' },
        { name: 'issuedAt', type: 'uint256' },
      ],
    },
    primaryType: 'TakerControl',
    message: {
      taker: account.address,
      chainId: BigInt(chainId),
      nonce,
      issuedAt: BigInt(issuedAt),
    },
  });
  return { nonce, issuedAt, signature };
}

export async function previewQuote({ chainId, sellToken, buyToken, sellAmount, buyAmount }) {
  const body = { chainId, sellToken, buyToken };
  if (sellAmount) body.sellAmount = sellAmount;
  if (buyAmount) body.buyAmount = buyAmount;
  const { status, json } = await post('/rfq/preview', body);
  if (status !== 200) throw new Error(`preview failed (${status}): ${JSON.stringify(json)}`);
  return json.data;
}

export async function requestFirmQuote({ account, chainId, sellToken, buyToken, sellAmount, buyAmount }) {
  const body = { chainId, sellToken, buyToken, taker: account.address };
  if (sellAmount) body.sellAmount = sellAmount;
  if (buyAmount) body.buyAmount = buyAmount;

  let { status, json } = await post('/rfq/request', body);
  if (status === 401 && json?.error?.details?.reason === 'proof_of_control_required') {
    const takerProof = await signTakerControl(account, chainId);
    ({ status, json } = await post('/rfq/request', { ...body, takerProof }));
  }
  if (status !== 200) throw new Error(`firm quote failed (${status}): ${JSON.stringify(json)}`);
  if (json.data?.status === 'no_quote') {
    const err = new Error(`no quote: ${json.data.reason || 'unknown'}`);
    err.data = json.data;
    throw err;
  }
  return json.data; // { rfqId, claimToken, status: 'quoted', quote, transactions, routing }
}

export async function submitTxHash(rfqId, claimToken, txHash) {
  const { status, json } = await post(`/rfq/${rfqId}/submit`, { txHash }, { 'X-Rfq-Claim': claimToken });
  if (status !== 200 && status !== 409) throw new Error(`submit failed (${status}): ${JSON.stringify(json)}`);
  return json;
}

export async function cancelQuote(rfqId, claimToken) {
  const { status, json } = await post(`/rfq/${rfqId}/cancel`, {}, { 'X-Rfq-Claim': claimToken });
  if (status !== 200) throw new Error(`cancel failed (${status}): ${JSON.stringify(json)}`);
  return json;
}
