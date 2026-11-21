// The payout job, end to end:
//   1. preview the rate (free) so the requester sees the price first
//   2. request a firm Textile FX quote (USDT -> local stablecoin)
//   3. approve takerPays to the reactor, then broadcast the swap with the
//      hackathon attribution tag appended to the calldata
//   4. pay the freelancer the local stablecoin (tagged transfer)
//   5. return a receipt
import {
  concat, createPublicClient, createWalletClient, encodeFunctionData,
  erc20Abi, http, parseUnits,
} from 'viem';
import { toDataSuffix } from '@celo/attribution-tags';
import { ATTRIBUTION_CODE } from './config.js';
import { previewQuote, requestFirmQuote, submitTxHash } from './textile.js';

export async function runPayout({ account, chain, sellToken, buyToken, amountUsd, recipient, dryRun = false }) {
  const sellAmount = parseUnits(amountUsd, sellToken.decimals).toString();
  const wallet = createWalletClient({ account, chain, transport: http() });
  const pub = createPublicClient({ chain, transport: http() });
  const tag = toDataSuffix(ATTRIBUTION_CODE);

  console.log(`\n== Payout job: ${amountUsd} ${sellToken.symbol} -> ${buyToken.symbol} -> ${recipient}`);
  console.log(`   agent wallet: ${account.address}`);

  // 1. Preview (free, no commitment)
  const preview = await previewQuote({
    chainId: chain.id,
    sellToken: sellToken.address,
    buyToken: buyToken.address,
    sellAmount,
  });
  if (preview.status !== 'preview') throw new Error(`preview unavailable: ${JSON.stringify(preview)}`);
  console.log(`   preview: pay ${preview.takerPays} ${sellToken.symbol}, receive ~${preview.buyAmount} ${buyToken.symbol}`);

  if (dryRun) return { preview };

  // 2. Firm quote (60s TTL — move fast from here)
  const rfq = await requestFirmQuote({
    account, chainId: chain.id,
    sellToken: sellToken.address, buyToken: buyToken.address, sellAmount,
  });
  const { quote, transactions } = rfq;
  console.log(`   firm quote ${rfq.rfqId}: pay ${quote.takerPays}, receive ${quote.buyAmount}, expires ${quote.expiresAt}`);
  const takerPays = BigInt(quote.takerPays);
  const reactor = quote.reactor;

  // 3a. Approve takerPays to the reactor (skip if allowance already covers it).
  // USDT-style tokens reject approve(nonzero -> nonzero): reset to 0 first.
  const allowance = await pub.readContract({
    address: sellToken.address, abi: erc20Abi, functionName: 'allowance',
    args: [account.address, reactor],
  });
  if (allowance < takerPays) {
    if (allowance > 0n) {
      console.log('   resetting allowance to 0 first (USDT-style token)...');
      const resetHash = await wallet.sendTransaction({
        to: sellToken.address,
        data: encodeFunctionData({ abi: erc20Abi, functionName: 'approve', args: [reactor, 0n] }),
      });
      await pub.waitForTransactionReceipt({ hash: resetHash });
    }
    console.log(`   approving ${takerPays} ${sellToken.symbol} to reactor ${reactor}...`);
    const approveHash = await wallet.sendTransaction({
      to: transactions.approval.to,
      data: transactions.approval.data,
    });
    await pub.waitForTransactionReceipt({ hash: approveHash });
    console.log(`   approval mined: ${approveHash}`);
  }

  // 3b. Broadcast the swap with the attribution tag appended.
  if (new Date(quote.expiresAt).getTime() < Date.now() + 5000) {
    throw new Error('quote expired before broadcast — request a new one');
  }
  const taggedSwapData = concat([transactions.swap.data, tag]);
  console.log(`   broadcasting swap (tagged ${ATTRIBUTION_CODE})...`);
  const swapHash = await wallet.sendTransaction({
    to: transactions.swap.to,
    data: taggedSwapData,
    value: BigInt(transactions.swap.value || '0'),
  });
  const swapReceipt = await pub.waitForTransactionReceipt({ hash: swapHash });
  console.log(`   swap mined: ${swapHash} (status ${swapReceipt.status})`);
  if (swapReceipt.status !== 'success') throw new Error(`swap reverted: ${swapHash}`);
  try { await submitTxHash(rfq.rfqId, rfq.claimToken, swapHash); } catch (e) { console.log(`   (submit notice failed, non-fatal: ${e.message})`); }

  // 4. Pay the freelancer the local stablecoin we just received (tagged transfer).
  const received = BigInt(quote.buyAmount);
  const balance = await pub.readContract({
    address: buyToken.address, abi: erc20Abi, functionName: 'balanceOf', args: [account.address],
  });
  const payAmount = received <= balance ? received : balance;
  if (payAmount === 0n) throw new Error('no local stablecoin received from the swap');
  console.log(`   paying freelancer ${payAmount} ${buyToken.symbol} -> ${recipient}...`);
  const transferData = encodeFunctionData({
    abi: erc20Abi, functionName: 'transfer', args: [recipient, payAmount],
  });
  const payHash = await wallet.sendTransaction({
    to: buyToken.address,
    data: concat([transferData, tag]),
  });
  const payReceipt = await pub.waitForTransactionReceipt({ hash: payHash });
  console.log(`   payout mined: ${payHash} (status ${payReceipt.status})`);
  if (payReceipt.status !== 'success') throw new Error(`payout transfer reverted: ${payHash}`);

  return {
    rfqId: rfq.rfqId,
    rate: quote.rateRay,
    paid: quote.takerPays,
    received: quote.buyAmount,
    swapHash,
    payHash,
    recipient,
    currency: buyToken.symbol,
    attributionCode: ATTRIBUTION_CODE,
  };
}
