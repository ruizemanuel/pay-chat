import { settlePayment } from "thirdweb/x402";
import { callLlm, type ChatMessage } from "@/lib/llm";
import {
  paymentNetwork,
  pricePerQueryUsd,
  serverWalletAddress,
  thirdwebFacilitator,
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
    console.log("[x402] paymentReceipt:", JSON.stringify(settlement.paymentReceipt, null, 2));
    console.log("[x402] responseHeaders:", JSON.stringify(settlement.responseHeaders, null, 2));
  }

  let llmResult;
  try {
    llmResult = await callLlm(body.messages, body.model);
  } catch (error) {
    const message = error instanceof Error ? error.message : "llm_unknown_error";
    return Response.json({ error: "llm_failed", detail: message }, { status: 502 });
  }

  return Response.json(
    {
      content: llmResult.content,
      model: llmResult.model,
      provider: llmResult.provider,
      paymentReceipt: settlement.paymentReceipt,
    },
    { headers: settlement.responseHeaders },
  );
}
