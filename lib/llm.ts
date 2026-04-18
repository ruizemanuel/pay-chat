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
  "You are pay-chat, a concise general-purpose AI assistant. Answer whatever the user asks — any topic, not limited to wallets, crypto, or MiniPay. Match the user's language. Be direct and useful. Refuse briefly if asked something illegal or harmful.";

type ChatCompletionResponse = {
  choices: Array<{ message: { content: string } }>;
};

async function callProvider(
  provider: ProviderConfig,
  messages: ChatMessage[],
): Promise<LlmResult> {
  const apiKey = process.env[provider.apiKeyEnv];
  if (!apiKey) {
    throw new Error(`${provider.apiKeyEnv} is not set`);
  }

  const startedAt = Date.now();
  const response = await fetch(provider.endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: provider.model,
      messages: [{ role: "system", content: SYSTEM_PROMPT }, ...messages],
      max_tokens: 1024,
      temperature: 0.7,
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
 */
export async function callLlm(
  messages: ChatMessage[],
  _modelKey?: string | undefined,
): Promise<LlmResult> {
  const failures: string[] = [];
  for (const provider of PROVIDERS) {
    try {
      return await callProvider(provider, messages);
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
