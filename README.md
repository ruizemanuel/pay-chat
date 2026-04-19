# pay-chat

**AI pay-per-query MiniApp on Celo.** Ask anything inside the MiniPay wallet — every answer costs $0.02 USDT and settles on Celo Mainnet with an on-chain receipt event.

🌐 **Live**: <https://pay-chat-nine.vercel.app>
📜 **PromptReceipt contract** (verified): [`0x962BC4ad7671Db17d975AB42D4dA5110bC13b66a`](https://celoscan.io/address/0x962BC4ad7671Db17d975AB42D4dA5110bC13b66a)

## How it works

1. User asks a question.
2. Backend returns `HTTP 402 Payment Required` per the [x402 protocol](https://x402.org).
3. User signs an EIP-2612 permit for $0.02 USDT (no on-chain transaction for the user, no gas).
4. Server-side thirdweb facilitator settles the payment on Celo, then calls Groq (Llama 3.3 70B) — or Cerebras (gpt-oss-120b) as automatic failover.
5. The server wallet emits a `PromptPaid(user, model, queryHash, timestamp)` event from `PromptReceipt.sol` so every answer has a verifiable on-chain receipt.

## Stack

- **Framework**: Next.js 16 (App Router · Turbopack) · TypeScript strict
- **Styling**: Tailwind v4 · `@tabler/icons-react`
- **Wallet**: wagmi 3 + viem 2 + `injected()` connector
- **Payments**: thirdweb x402 (`useFetchWithPayment` + `settlePayment`)
- **LLM**: Groq Llama 3.3 70B with Cerebras `gpt-oss-120b` as automatic failover, plus a preflight health check so the user is never charged when the model is unreachable
- **Contracts**: Hardhat 2 + Solidity 0.8.28 + OpenZeppelin `Ownable`
- **Deploy**: Vercel with GitHub auto-deploy on `main`
- **Package manager**: pnpm

## Local development

```bash
pnpm install
cp .env.example .env.local   # fill in the secrets
pnpm dev                     # http://localhost:3000
```

To test inside MiniPay's Developer Mode, load the production URL directly (no ngrok required) or expose `localhost:3000` over HTTPS with `ngrok http 3000` and paste the tunnel URL.

## Scripts

| Script | What it does |
|---|---|
| `pnpm dev` | Next.js dev server (Turbopack) |
| `pnpm build` | Production build |
| `pnpm lint` · `pnpm typecheck` | ESLint · `tsc --noEmit` |
| `pnpm test` | Vitest unit tests |
| `pnpm hh:test` | Hardhat contract tests |
| `pnpm hh:deploy:celo` | Deploy `PromptReceipt.sol` to Celo mainnet |
| `pnpm build:icons` | Rasterize `public/icon.svg` into PNG icons |

## Project layout

```
app/                    Next.js App Router (chat, /api/chat, /tos, /privacy)
components/             ChatApp, Footer, WalletBadge
hooks/                  useAutoConnect, useIsMiniPay, useIsMounted
lib/                    wagmi config, x402 server, thirdweb client, llm router, prompt-receipt
contracts/              PromptReceipt.sol
scripts/                deploy-prompt-receipt.ts, build-icon.mjs
```

## License

[MIT](./LICENSE)

---

Built for [Celo Proof of Ship](https://talent.app/~/earn/celo-proof-of-ship). Support: <https://t.me/paychat_support>.
