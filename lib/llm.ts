import type { ChainContextBlock } from "@/lib/chain-context";

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type LlmResult = {
  content: string;
  model: string;
  provider: ProviderId;
};

type ProviderId = "groq" | "cerebras";

type ProviderConfig = {
  id: ProviderId;
  label: string;
  endpoint: string;
  apiKeyEnv: "GROQ_API_KEY" | "CEREBRAS_API_KEY";
  model: string;
};

/**
 * Ordered list of LLM providers. `callLlm` walks this list in order and
 * returns the first successful response, so the first entry is the primary
 * and the rest are automatic fallbacks. Keeping the model quality similar
 * across providers so users get comparable answers regardless of who
 * actually handled the call.
 */
const PROVIDERS: ProviderConfig[] = [
  {
    id: "groq",
    label: "groq/llama-3.3-70b",
    endpoint: "https://api.groq.com/openai/v1/chat/completions",
    apiKeyEnv: "GROQ_API_KEY",
    model: "llama-3.3-70b-versatile",
  },
  {
    id: "cerebras",
    label: "cerebras/gpt-oss-120b",
    endpoint: "https://api.cerebras.ai/v1/chat/completions",
    apiKeyEnv: "CEREBRAS_API_KEY",
    model: "gpt-oss-120b",
  },
];

const SYSTEM_PROMPT =
  "You are pay-chat, a concise AI assistant running as a pay-per-query chat " +
  "inside MiniPay on Celo mainnet (chain ID 42220). You can answer any topic " +
  "in general, but for any on-chain question your scope is Celo only — never " +
  "claim activity on Ethereum, Polygon, BNB, Solana, Arbitrum, or any other " +
  "chain unless the user explicitly asks about that other chain. The native " +
  "token on Celo is CELO, not ETH. Common Celo protocols include Mento, " +
  "Ubeswap, Aave (Celo market), and Uniswap (Celo market). Never invent " +
  "specific tx history, balances, token transfers, or protocol interactions " +
  "for a wallet. If you don't have on-chain data about an address or tx the " +
  "user asked about, just say so plainly (e.g. 'I couldn't fetch on-chain " +
  "data for that address right now') — never mention internal terms like " +
  "'CONTEXT block', 'system prompt', 'EoaSummary', or 'enrichment'; those " +
  "are implementation details the user shouldn't see. Match the user's " +
  "language. Be direct. Refuse briefly if asked something illegal or harmful.";

const CHAIN_CONTEXT_PROMPT =
  "The next message contains structured on-chain data fetched from Celo " +
  "mainnet for identifiers in the recent conversation (the user's latest " +
  "message and your previous reply). Treat this data as authoritative and " +
  "use it to answer factually. Never invent hashes, addresses, amounts, " +
  "chains, or protocol interactions — if a piece of info isn't in the data, " +
  "say you don't have it instead of guessing. Mention addresses and tx " +
  "hashes verbatim (full 0x… form) — the UI converts them into compact " +
  "copy-able chips, so do NOT truncate them yourself. When summarizing a " +
  "wallet's activity, call out both native CELO transfers and ERC-20 token " +
  "transfers if both are present. Speak in the user's language and natural " +
  "tone — never expose internal field names or system terminology.";

function buildContextMessage(blocks: ChainContextBlock[]): ChatMessage {
  return {
    role: "system",
    content: `CONTEXT:\n${JSON.stringify(blocks, null, 2)}`,
  };
}

type ChatCompletionResponse = {
  choices: Array<{ message: { content: string } }>;
};

async function callProvider(
  provider: ProviderConfig,
  messages: ChatMessage[],
  chainContext?: ChainContextBlock[],
): Promise<LlmResult> {
  const apiKey = process.env[provider.apiKeyEnv];
  if (!apiKey) {
    throw new Error(`${provider.apiKeyEnv} is not set`);
  }

  const hasContext = (chainContext?.length ?? 0) > 0;
  const systemMessages: ChatMessage[] = hasContext
    ? [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "system", content: CHAIN_CONTEXT_PROMPT },
        buildContextMessage(chainContext!),
      ]
    : [{ role: "system", content: SYSTEM_PROMPT }];

  const startedAt = Date.now();
  const response = await fetch(provider.endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: provider.model,
      messages: [...systemMessages, ...messages],
      max_tokens: 1024,
      temperature: hasContext ? 0.3 : 0.7,
    }),
    signal: AbortSignal.timeout(20_000),
  });

  const elapsed = Date.now() - startedAt;

  if (!response.ok) {
    const errorBody = await response.text();
    console.error(
      `[llm][${provider.id}] HTTP ${response.status} after ${elapsed}ms: ${errorBody}`,
    );
    throw new Error(`${provider.id} ${response.status}`);
  }

  const data = (await response.json()) as ChatCompletionResponse;
  const content = data.choices[0]?.message.content ?? "";
  if (process.env.NODE_ENV !== "production") {
    console.log(`[llm][${provider.id}] ok in ${elapsed}ms`);
  }
  return { content, model: provider.model, provider: provider.id };
}

/**
 * Call the LLM with automatic fallback across providers. Returns as soon as
 * any provider answers successfully. Throws only when every provider fails.
 *
 * Optional `chainContext` blocks are prepended as an extra system message so
 * the model answers factually about on-chain data instead of hallucinating.
 */
export async function callLlm(
  messages: ChatMessage[],
  _modelKey?: string | undefined,
  chainContext?: ChainContextBlock[],
): Promise<LlmResult> {
  const failures: string[] = [];
  for (const provider of PROVIDERS) {
    try {
      return await callProvider(provider, messages, chainContext);
    } catch (error) {
      const detail = error instanceof Error ? error.message : "unknown";
      failures.push(`${provider.id}:${detail}`);
    }
  }
  throw new Error(`all providers failed — ${failures.join(" | ")}`);
}

/**
 * Tiny health probe used before settling a payment. Returns OK as soon as
 * any provider is reachable so the user only gets charged when at least
 * one model can actually answer.
 */
export async function preflightLlm(_modelKey?: string | undefined): Promise<
  { ok: true } | { ok: false; error: string }
> {
  const failures: string[] = [];
  for (const provider of PROVIDERS) {
    const apiKey = process.env[provider.apiKeyEnv];
    if (!apiKey) {
      failures.push(`${provider.id}:missing-key`);
      continue;
    }
    try {
      const response = await fetch(provider.endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: provider.model,
          messages: [{ role: "user", content: "." }],
          max_tokens: 1,
        }),
        signal: AbortSignal.timeout(5_000),
      });
      if (response.ok) {
        return { ok: true };
      }
      const text = await response.text();
      failures.push(`${provider.id}:${response.status}:${text.slice(0, 80)}`);
    } catch (error) {
      const detail = error instanceof Error ? error.message : "unknown";
      failures.push(`${provider.id}:${detail}`);
    }
  }
  return { ok: false, error: failures.join(" | ") };
}
