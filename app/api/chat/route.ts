import { Engine } from "thirdweb";
import { settlePayment } from "thirdweb/x402";
import { callLlm, type ChatMessage } from "@/lib/llm";
import {
  paymentNetwork,
  pricePerQueryUsd,
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

  const settlement = await settlePayment({
    resourceUrl: request.url,
    method: "POST",
    paymentData,
    payTo: serverWalletAddress,
    network: paymentNetwork,
    price: pricePerQueryUsd,
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

  const [llmResult, transactionHash] = await Promise.all([
    callLlm(body.messages, body.model).catch((error: unknown) => ({
      error: error instanceof Error ? error.message : "llm_unknown_error",
    })),
    resolveOnchainHash(queueId),
  ]);

  if ("error" in llmResult) {
    return Response.json(
      { error: "llm_failed", detail: llmResult.error },
      { status: 502 },
    );
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
