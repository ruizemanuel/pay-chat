import "server-only";

import { Engine, getContract, prepareContractCall } from "thirdweb";
import { celo } from "thirdweb/chains";
import { keccak256, toBytes } from "viem";
import { serverWalletAddress, thirdwebServerClient } from "@/lib/x402-server";

const receiptAddress = process.env.NEXT_PUBLIC_PROMPT_RECEIPT_ADDRESS;

const LOG_PROMPT_SIGNATURE =
  "function logPrompt(address user, string model, bytes32 queryHash)";

function hashPrompt(prompt: string): `0x${string}` {
  return keccak256(toBytes(prompt));
}

/**
 * Fire-and-forget: enqueue a `PromptReceipt.logPrompt` transaction from the
 * server wallet so the on-chain receipt gets a rich `PromptPaid` event next
 * to the x402 USDC transfer. We don't await the on-chain settlement — the
 * chat response shouldn't wait on this, the event lands seconds later and
 * is independently verifiable on Celoscan.
 */
export function logPromptReceipt(args: {
  user: string;
  model: string;
  prompt: string;
}): void {
  if (!receiptAddress) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[prompt-receipt] skipping: NEXT_PUBLIC_PROMPT_RECEIPT_ADDRESS is not set");
    }
    return;
  }

  const contract = getContract({
    client: thirdwebServerClient,
    chain: celo,
    address: receiptAddress,
  });

  const transaction = prepareContractCall({
    contract,
    method: LOG_PROMPT_SIGNATURE,
    params: [args.user, args.model, hashPrompt(args.prompt)],
  });

  const serverAccount = Engine.serverWallet({
    client: thirdwebServerClient,
    address: serverWalletAddress,
    chain: celo,
  });

  serverAccount
    .enqueueTransaction({ transaction })
    .then((result) => {
      if (process.env.NODE_ENV !== "production") {
        console.log("[prompt-receipt] queued", result.transactionId);
      }
    })
    .catch((error: unknown) => {
      if (process.env.NODE_ENV !== "production") {
        console.warn("[prompt-receipt] enqueue failed", error);
      }
    });
}
