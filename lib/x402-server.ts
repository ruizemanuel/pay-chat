import "server-only";

import { createThirdwebClient } from "thirdweb";
import { celo } from "thirdweb/chains";
import { facilitator } from "thirdweb/x402";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} environment variable is required`);
  }
  return value;
}

export const thirdwebServerClient = createThirdwebClient({
  secretKey: requireEnv("THIRDWEB_SECRET_KEY"),
});

export const serverWalletAddress = requireEnv("SERVER_WALLET_ADDRESS");

export const thirdwebFacilitator = facilitator({
  client: thirdwebServerClient,
  serverWalletAddress,
});

export const paymentNetwork = celo;
export const pricePerQueryUsd = `$${process.env.PAY_PER_QUERY_USDM ?? "0.02"}`;
