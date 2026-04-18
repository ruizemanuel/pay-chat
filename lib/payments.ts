"use client";

import { EIP1193 } from "thirdweb/wallets";
import { wrapFetchWithPayment } from "thirdweb/x402";
import { thirdwebClient } from "@/lib/thirdweb-client";

export class WalletNotAvailableError extends Error {
  constructor() {
    super("MiniPay wallet not detected. Open this app inside MiniPay.");
    this.name = "WalletNotAvailableError";
  }
}

export async function payAndFetch(
  url: string,
  init?: RequestInit,
): Promise<Response> {
  if (typeof window === "undefined" || !window.ethereum) {
    throw new WalletNotAvailableError();
  }

  const wallet = EIP1193.fromProvider({ provider: window.ethereum });
  await wallet.connect({ client: thirdwebClient });

  const fetchWithPayment = wrapFetchWithPayment(fetch, thirdwebClient, wallet);
  return fetchWithPayment(url, init);
}
