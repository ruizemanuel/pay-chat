import type { Address } from "viem";
import { Engine } from "thirdweb";
import { settlePayment } from "thirdweb/x402";
import {
  enrichContext,
  type ChainContextBlock,
} from "@/lib/chain-context";
import { callLlm, preflightLlm, type ChatMessage } from "@/lib/llm";
import { logPromptReceipt } from "@/lib/prompt-receipt";
import {
  paymentNetwork,
  pricePerQuery,
  serverWalletAddress,
  thirdwebFacilitator,
  thirdwebServerClient,
} from "@/lib/x402-server";

export const runtime = "nodejs";

type ChatRequestBody = {
  messages: ChatMessage[];
  model?: string;
};

export async function POST(request: Request) {
  let body: ChatRequestBody;
  try {
    body = (await request.json()) as ChatRequestBody;
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }

  if (!Array.isArray(body.messages) || body.messages.length === 0) {
    return Response.json({ error: "messages_required" }, { status: 400 });
  }

  const paymentData =
    request.headers.get("PAYMENT-SIGNATURE") ?? request.headers.get("X-PAYMENT");

  // Pre-flight the LLM BEFORE settling the user's payment. If the provider
  // is down or the key is restricted, we'd rather return a free 503 than
  // charge $0.02 USDC for an answer we can't produce.
  if (paymentData) {
    const health = await preflightLlm(body.model);
    if (!health.ok) {
      console.error("[chat] llm preflight failed — refusing to settle", health);
      return Response.json(
        { error: "llm_unavailable", detail: health.error },
        { status: 503 },
      );
    }
  }

  const settlement = await settlePayment({
    resourceUrl: request.url,
    method: "POST",
    paymentData,
    payTo: serverWalletAddress,
    network: paymentNetwork,
    price: pricePerQuery,
    facilitator: thirdwebFacilitator,
    routeConfig: {
      description: "AI chat completion (multi-provider routed)",
      mimeType: "application/json",
    },
  });

  if (settlement.status !== 200) {
    return Response.json(settlement.responseBody, {
      status: settlement.status,
      headers: settlement.responseHeaders,
    });
  }

  if (process.env.NODE_ENV !== "production") {
    console.log(
      "[x402] paymentReceipt:",
      JSON.stringify(settlement.paymentReceipt, null, 2),
    );
  }

  // The facilitator returns an Engine queueId in `transaction`, not the
  // onchain hash. Resolve to the real hash in parallel with the LLM call so
  // the user sees a verifiable Celoscan receipt.
  const queueId = settlement.paymentReceipt.transaction;
  const payer = settlement.paymentReceipt.payer as Address | undefined;
  const latestUserPrompt =
    body.messages[body.messages.length - 1]?.content ?? "";

  // Pull on-chain context (tx explainer, address inspector, self history)
  // so the LLM answers factually about Celo data mentioned in the prompt.
  // Wrapped defensively: any failure here must NOT break the paid request.
  let chainContext: ChainContextBlock[] = [];
  if (process.env.ENABLE_CHAIN_CONTEXT !== "false") {
    try {
      chainContext = await enrichContext(latestUserPrompt, payer);
    } catch (error) {
      console.warn(
        "[chain-context] enrich failed, continuing without context",
        error,
      );
    }
  }

  const [llmResult, transactionHash] = await Promise.all([
    callLlm(body.messages, body.model, chainContext).catch(
      (error: unknown) => ({
        error: error instanceof Error ? error.message : "llm_unknown_error",
      }),
    ),
    resolveOnchainHash(queueId),
  ]);

  if ("error" in llmResult) {
    return Response.json(
      { error: "llm_failed", detail: llmResult.error },
      { status: 502 },
    );
  }

  if (payer && latestUserPrompt) {
    logPromptReceipt({
      user: payer,
      model: `${llmResult.provider}/${llmResult.model}`,
      prompt: latestUserPrompt,
    });
  }

  return Response.json(
    {
      content: llmResult.content,
      model: llmResult.model,
      provider: llmResult.provider,
      paymentReceipt: {
        ...settlement.paymentReceipt,
        transactionHash,
      },
    },
    { headers: settlement.responseHeaders },
  );
}

async function resolveOnchainHash(queueId: string): Promise<string | undefined> {
  try {
    const result = await Engine.waitForTransactionHash({
      client: thirdwebServerClient,
      transactionId: queueId,
      timeoutInSeconds: 20,
    });
    return result.transactionHash;
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[x402] waitForTransactionHash failed", error);
    }
    return undefined;
  }
}
