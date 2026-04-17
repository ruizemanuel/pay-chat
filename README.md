# pay-chat

**AI pay-per-query MiniApp on Celo.** Ask OpenAI, Anthropic, or Groq from inside MiniPay — pay `$0.02` in stablecoin per answer, no subscription, no signup.

> **Status:** active development.

## What makes it different from ChatGPT / Claude / Grok

1. **Phone tip** (`@celo/identity` ODIS) — send the AI's answer to a friend's phone number; they receive it in their MiniPay wallet. Not possible in any web chat.
2. **On-chain receipts** — every paid query emits a `PromptPaid` event on Celo mainnet. Verifiable on Celoscan. Useful for businesses expensing AI, students proving honest use, auditable usage.
3. **Zero-signup in-app UX** — MiniPay users are already wallet-verified; one tap and you're chatting. Works in regions where `chatgpt.com` + card payments are friction (Nigeria, Ghana, Argentina, Kenya).
4. **Pay-per-use** — $0.02 per query beats $20/month subscriptions for casual users. Model shopping (auto-route by price/speed) in one UI.

## Stack

- **Framework**: Next.js 16 (App Router, Turbopack) · TypeScript strict
- **Styling**: Tailwind v4 · `@tabler/icons-react`
- **Wallet**: wagmi 3 + viem 2 + `injected()` connector
- **Payments**: thirdweb x402 (`useFetchWithPayment` + `settlePayment`)
- **Identity**: `@celo/identity` for phone → address lookup (ODIS)
- **Contracts**: Hardhat 3 + Solidity 0.8.28 on Celo mainnet (42220) and Celo Sepolia (11142220)
- **Deploy**: Vercel (edge route handlers)
- **Package manager**: pnpm

## Quick start

```bash
pnpm install
pnpm dev             # http://localhost:3000
```

Test inside MiniPay:

```bash
ngrok http 3000
# Copy the ngrok HTTPS URL into MiniPay: Settings → Developer → Load Test Page
```

## Scripts

| Script | What it does |
|---|---|
| `pnpm dev` | Next.js dev server with Turbopack |
| `pnpm build` | Production build |
| `pnpm start` | Serve production build |
| `pnpm lint` | ESLint |
| `pnpm typecheck` | `tsc --noEmit` in strict mode |
| `pnpm test` | Vitest run |
| `pnpm test:watch` | Vitest watch mode |
| `pnpm test:ui` | Vitest UI |

## Environment

Copy `.env.example` to `.env.local` and fill in:

```
OPENAI_API_KEY=
ANTHROPIC_API_KEY=
GROQ_API_KEY=
THIRDWEB_SECRET_KEY=
SERVER_WALLET_PK=
CELO_RPC=https://forno.celo.org
```

## License

MIT
