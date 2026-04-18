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

/**
 * Payment token — defaults to USDT on Celo because MiniPay auto-converts
 * every incoming stablecoin to USDT for its users. Accepting USDT directly
 * means MiniPay users don't need to swap before paying for a query.
 *
 * Addresses on Celo mainnet:
 *   USDT: 0x48065fBBe25F71C9282ddf5e1cD6D6A887483D5e (6 decimals, supports EIP-2612 permit)
 *   USDC: 0xcebA9300f2b948710d2653dD7B07f33A8B32118C (6 decimals)
 *   USDm: 0x765DE816845861e75A25fCA122bb6898B8B1282a (18 decimals, Mento)
 */
const PAYMENT_TOKEN_ADDRESS = (process.env.PAYMENT_TOKEN_ADDRESS ??
  "0x48065fBBe25F71C9282ddf5e1cD6D6A887483D5e") as `0x${string}`;
const PAYMENT_TOKEN_DECIMALS = Number.parseInt(
  process.env.PAYMENT_TOKEN_DECIMALS ?? "6",
  10,
);

// Amount in cents (integer). "2" → $0.02 equivalent in the chosen token.
const priceCents = BigInt(process.env.PAY_PER_QUERY_CENTS ?? "2");
const amountInBaseUnits = (
  priceCents *
  BigInt(10) ** BigInt(PAYMENT_TOKEN_DECIMALS - 2)
).toString();

export const pricePerQuery = {
  amount: amountInBaseUnits,
  asset: {
    address: PAYMENT_TOKEN_ADDRESS,
    decimals: PAYMENT_TOKEN_DECIMALS,
  },
};
