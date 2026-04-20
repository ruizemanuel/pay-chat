/**
 * Stablecoins that MiniPay explicitly supports. Used when decoding ERC-20
 * Transfer events so that on-chain context blocks can show "$1.50 USDT"
 * instead of the raw token address + base units. Keys are lowercased for
 * case-insensitive matching against Celo mainnet addresses.
 */
export const KNOWN_TOKENS: Record<string, { symbol: string; decimals: number }> = {
  "0x48065fbbe25f71c9282ddf5e1cd6d6a887483d5e": { symbol: "USDT", decimals: 6 },
  "0xceba9300f2b948710d2653dd7b07f33a8b32118c": { symbol: "USDC", decimals: 6 },
  "0x765de816845861e75a25fca122bb6898b8b1282a": { symbol: "USDm", decimals: 18 },
};

/**
 * Shared site-wide constants. Importable from both server and client code.
 */
export const SITE = {
  name: "pay-chat",
  tagline: "AI agent that reads Celo on-chain data",
  description:
    "AI agent inside MiniPay that reads Celo on-chain data — paste any tx hash or contract address and get a real explanation. $0.02 per answer in USDT, with verifiable on-chain receipts.",
  productionUrl: "https://pay-chat-nine.vercel.app",
  supportUrl: "https://t.me/paychat_support",
  supportLabel: "t.me/paychat_support",
  githubUrl: "https://github.com/ruizemanuel/pay-chat",
  contractAddress: "0x962BC4ad7671Db17d975AB42D4dA5110bC13b66a",
  contractExplorerUrl:
    "https://celoscan.io/address/0x962BC4ad7671Db17d975AB42D4dA5110bC13b66a",
  paymentToken: "USDT",
  pricePerQuery: "$0.02",
  network: "Celo Mainnet",
  /** Date the latest TOS / Privacy revisions were published. */
  legalEffectiveDate: "2026-04-19",
} as const;
