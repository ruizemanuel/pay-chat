/**
 * Shared site-wide constants. Importable from both server and client code.
 */
export const SITE = {
  name: "pay-chat",
  tagline: "AI pay-per-query on Celo",
  description:
    "AI pay-per-query MiniApp on Celo. Pay $0.02 in USDT per answer — no subscription, no signup.",
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
