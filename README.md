# pay-chat

**AI assistant inside MiniPay that reads Celo on-chain data, paid per query in USDT.** Every answer costs $0.02 USDT, settles on Celo Mainnet via x402, and emits a verifiable on-chain receipt.

🌐 **Live**: <https://pay-chat-nine.vercel.app>
📜 **PromptReceipt contract** (verified): [`0x962BC4ad7671Db17d975AB42D4dA5110bC13b66a`](https://celoscan.io/address/0x962BC4ad7671Db17d975AB42D4dA5110bC13b66a)

## What makes it different from a generic chatbot

- **Reads the chain.** Paste any Celo tx hash and get a plain-language explanation. Drop a contract address and get its name, owner, age, power functions (mint / pause / upgrade / transferOwnership), and recent activity. Ask "what have I been doing on Celo?" and get a summary of your actual transactions. None of this is invented — it's fetched live from Celo RPC + the Etherscan V2 unified API and injected as authoritative context before the model answers.
- **Tap-to-copy chips.** Addresses and tx hashes in answers are rendered as compact chips that copy the full hex on click and link to Celoscan in one tap.
- **Smart-wallet aware.** Detects EIP-7702 delegated EOAs (account abstraction) by bytecode prefix and routes them through the activity path instead of asking for source code that doesn't exist.
- **Pay per query, not per month.** No subscription, no signup, no credit card. Sign one EIP-2612 permit per question — the user never pays gas.
- **Receipts on-chain.** Every answer emits a `PromptPaid(user, model, queryHash, timestamp)` event from a verified `Ownable` contract — auditable, expensable, no trust in the backend required.

## How it works

1. User asks a question inside MiniPay (or any browser via the explicit Connect button).
2. Backend returns `HTTP 402 Payment Required` per the [x402 protocol](https://x402.org).
3. User signs an EIP-2612 permit for $0.02 USDT — no on-chain transaction for the user, no gas.
4. Server-side thirdweb facilitator settles the payment on Celo and exposes the payer address.
5. **Chain-context enrichment** (defensive, wrapped in try/catch so it can never break the flow):
   - Regex scans the user's message + the assistant's previous reply for `0x[a-f0-9]{64}` (tx hashes) and `0x[a-f0-9]{40}` (addresses).
   - Heuristic intent detector matches phrases like "my last transactions" / "mi historial" to also enrich with the connected wallet's activity.
   - For each match, viem fetches the tx receipt (decoding ERC-20 Transfer events) or classifies the address (EOA / contract / EIP-7702 smart wallet) and pulls the right structured summary from Etherscan V2 (chainid=42220).
   - The structured blocks are injected as a `role: "system"` message before the model is called, with `temperature: 0.3` to keep it grounded.
6. LLM call: Groq Llama 3.3 70B, with Cerebras `gpt-oss-120b` as automatic failover. A preflight ping ensures the user is never charged when both providers are unreachable.
7. `PromptReceipt.logPrompt(...)` is enqueued from the server wallet so the on-chain receipt event lands a few seconds later.

## Stack

- **Framework**: Next.js 16 (App Router · Turbopack) · TypeScript strict
- **Styling**: Tailwind v4 · `@tabler/icons-react`
- **Wallet**: wagmi 3 + viem 2 + `injected()` connector
- **Payments**: thirdweb x402 (`useFetchWithPayment` client side, `settlePayment` + facilitator server side)
- **Chain reads**: viem public client + Etherscan V2 unified API (single key covers all Etherscan-family explorers, including Celoscan)
- **LLM**: Groq Llama 3.3 70B with Cerebras `gpt-oss-120b` as automatic failover
- **Contracts**: Hardhat 2 + Solidity 0.8.28 + OpenZeppelin `Ownable`
- **Deploy**: Vercel with GitHub auto-deploy on `main`
- **Package manager**: pnpm

## Local development

```bash
pnpm install
cp .env.example .env.local   # fill in the secrets
pnpm dev                     # http://localhost:3000
```

You'll need keys for: Groq, Cerebras, thirdweb (client + secret), the thirdweb-managed server wallet address, and an [Etherscan V2 API key](https://etherscan.io/apis) (the same key works on Celoscan).

To test inside MiniPay's Developer Mode, load the production URL directly (no tunnel needed) or expose `localhost:3000` over HTTPS with `ngrok http 3000` and paste the tunnel URL into the Mini App test page.

## Scripts

| Script | What it does |
|---|---|
| `pnpm dev` | Next.js dev server (Turbopack) |
| `pnpm build` | Production build |
| `pnpm lint` · `pnpm typecheck` | ESLint · `tsc --noEmit` |
| `pnpm test` | Vitest unit tests (chain-context + Etherscan wrapper + message tokenizer) |
| `pnpm hh:test` | Hardhat contract tests |
| `pnpm hh:deploy:celo` | Deploy `PromptReceipt.sol` to Celo mainnet |
| `pnpm build:icons` | Rasterize `public/icon.svg` into PNG icons |

## Project layout

```
app/                          Next.js App Router (chat UI, /api/chat, /tos, /privacy)
components/
  ChatApp.tsx                 Mobile-first chat UI with new-chat reset, sample prompts
  MessageContent.tsx          Renders addresses + tx hashes as tap-to-copy chips
  Footer.tsx, WalletBadge.tsx
hooks/                        useAutoConnect, useIsMiniPay, useIsMounted
lib/
  wagmi.ts                    wagmi config (Celo + Celo Sepolia, injected connector)
  x402-server.ts              thirdweb client + x402 facilitator + payment token config
  payments.ts                 client-side wrapFetchWithPayment helper
  llm.ts                      Groq + Cerebras router, system prompt, chain-context injection
  prompt-receipt.ts           Fire-and-forget logPrompt() via thirdweb Engine
  celo-public.ts              viem public client for server-side chain reads
  etherscan.ts                Etherscan V2 wrapper (concurrency-limited + retried)
  chain-context.ts            Reference detector + tx / address / self-history enrichment
  parse-message.ts            Tokenizer for chip rendering
  site.ts                     Shared product constants (URLs, contract address, known tokens)
contracts/                    PromptReceipt.sol (Ownable, emits PromptPaid)
scripts/                      deploy-prompt-receipt.ts, build-icon.mjs
```

## License

[MIT](./LICENSE)

---

Built for [Celo Proof of Ship](https://talent.app/~/earn/celo-proof-of-ship). Support: <https://t.me/paychat_support>.
