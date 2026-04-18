export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type LlmResult = {
  content: string;
  model: string;
  provider: string;
};

type ProviderId = "groq";

type ModelConfig = {
  provider: ProviderId;
  model: string;
};

const MODELS: Record<string, ModelConfig> = {
  auto: { provider: "groq", model: "llama-3.3-70b-versatile" },
  "llama-3.3-70b": { provider: "groq", model: "llama-3.3-70b-versatile" },
  "llama-3.1-8b": { provider: "groq", model: "llama-3.1-8b-instant" },
};

const SYSTEM_PROMPT =
  "You are pay-chat, a concise AI assistant inside the MiniPay wallet on Celo. Answer in the language of the user's question. Be helpful and direct. If the user asks something illegal or harmful, refuse briefly.";

export function pickModel(modelKey: string | undefined): ModelConfig {
  return MODELS[modelKey ?? "auto"] ?? MODELS.auto;
}

export async function callLlm(
  messages: ChatMessage[],
  modelKey: string | undefined,
): Promise<LlmResult> {
  const config = pickModel(modelKey);

  if (config.provider === "groq") {
    return callGroq(messages, config.model);
  }

  throw new Error(`Unsupported provider: ${config.provider}`);
}

async function callGroq(messages: ChatMessage[], model: string): Promise<LlmResult> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error("GROQ_API_KEY is not set");
  }

  const payload = {
    model,
    messages: [{ role: "system", content: SYSTEM_PROMPT }, ...messages],
    max_tokens: 1024,
    temperature: 0.7,
  };

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Groq API error ${response.status}: ${errorBody}`);
  }

  const data = (await response.json()) as {
    choices: Array<{ message: { content: string } }>;
  };

  const content = data.choices[0]?.message.content ?? "";
  return { content, model, provider: "groq" };
}
