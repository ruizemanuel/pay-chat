"use client";

import {
  IconAlertTriangle,
  IconExternalLink,
  IconRobot,
  IconSend2,
  IconSparkles,
  IconUser,
} from "@tabler/icons-react";
import { useState, type FormEvent } from "react";
import { useAutoConnect } from "@/hooks/useAutoConnect";
import { payAndFetch, WalletNotAvailableError } from "@/lib/payments";
import { SITE } from "@/lib/site";
import { WalletBadge } from "./WalletBadge";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  receiptUrl?: string;
};

type ChatResponse = {
  content: string;
  paymentReceipt?: {
    transaction?: string;
    transactionHash?: string;
    network?: string;
  } & Record<string, unknown>;
};

const CELO_MAINNET_NETWORKS = new Set(["celo", "eip155:42220", "42220"]);
const TX_HASH_PATTERN = /^0x[0-9a-fA-F]{64}$/;

const SAMPLE_PROMPTS = [
  "What is MiniPay? Explain it like I'm a non-crypto user.",
  "How can I send money to my family abroad using stablecoins?",
  "Explain stablecoins to a small business owner in 2 sentences.",
];

function extractReceipt(
  receipt: ChatResponse["paymentReceipt"],
): { hash: string; network: string } | undefined {
  if (!receipt) return undefined;
  const candidate = receipt.transactionHash ?? receipt.transaction;
  if (typeof candidate !== "string" || !TX_HASH_PATTERN.test(candidate)) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(
        "[pay-chat] paymentReceipt missing valid onchain hash",
        receipt,
      );
    }
    return undefined;
  }
  const network = typeof receipt.network === "string" ? receipt.network : "celo";
  return { hash: candidate, network };
}

function explorerUrl(hash: string, network: string): string {
  if (CELO_MAINNET_NETWORKS.has(network)) {
    return `https://celoscan.io/tx/${hash}`;
  }
  if (network === "celo-sepolia" || network === "eip155:11142220" || network === "11142220") {
    return `https://sepolia.celoscan.io/tx/${hash}`;
  }
  return `https://celoscan.io/tx/${hash}`;
}

function stringifyError(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  if (err && typeof err === "object") {
    const obj = err as Record<string, unknown>;
    if (typeof obj.message === "string") return obj.message;
    if (typeof obj.reason === "string") return obj.reason;
    if (typeof obj.shortMessage === "string") return obj.shortMessage;
    const nested = obj.error;
    if (nested && typeof nested === "object" && "message" in nested) {
      const m = (nested as Record<string, unknown>).message;
      if (typeof m === "string") return m;
    }
    try {
      const json = JSON.stringify(err);
      if (json && json !== "{}") return json;
    } catch {
      // fall through
    }
  }
  return "Unknown error";
}

function mapError(err: unknown): string {
  if (err instanceof WalletNotAvailableError) return err.message;
  const raw = stringifyError(err);
  const lower = raw.toLowerCase();
  if (
    lower.includes("user rejected") ||
    lower.includes("user denied") ||
    lower.includes("rejected the request") ||
    lower.includes("4001") // MetaMask user-rejected code
  ) {
    return "Payment cancelled in the wallet.";
  }
  if (lower.includes("insufficient") || lower.includes("not enough")) {
    return `Not enough ${SITE.paymentToken} in this wallet to cover ${SITE.pricePerQuery}.`;
  }
  if (lower.includes("locked") || lower.includes("not unlocked")) {
    return "Your wallet is locked. Unlock it and try again.";
  }
  if (lower.includes("disconnected") || lower.includes("not connected")) {
    return "Wallet disconnected. Reconnect and try again.";
  }
  if (lower.includes("llm_unavailable")) {
    return "Both AI providers are unreachable. Try again in a minute.";
  }
  if (lower.includes("llm_failed")) {
    return "The AI provider returned an error. You were not charged.";
  }
  if (lower.includes("timeout") || lower.includes("aborted")) {
    return "The request timed out. Check your connection and try again.";
  }
  if (lower.includes("network") || lower.includes("fetch")) {
    return "Network error. Check your connection and try again.";
  }
  return raw.slice(0, 200);
}

type Status = "idle" | "preparing" | "settling" | "thinking";

function statusLabel(status: Status): string {
  switch (status) {
    case "preparing":
      return "Sign the payment in your wallet…";
    case "settling":
      return `Settling ${SITE.pricePerQuery} on Celo…`;
    case "thinking":
      return "Asking the model…";
    default:
      return "";
  }
}

export function ChatApp() {
  useAutoConnect();

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);

  const isSending = status !== "idle";

  async function send(prompt: string) {
    if (isSending) return;
    const trimmed = prompt.trim();
    if (!trimmed) return;

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: trimmed,
    };
    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setInput("");
    setError(null);
    setStatus("preparing");

    try {
      // payAndFetch internally: 1) connect/sign in wallet, 2) POST → 402 →
      // sign payment → POST again. We can't peek inside its phases, so we
      // optimistically progress the status to "settling" once it returns
      // and to "thinking" inferred via the response body — for the demo
      // labels are good enough.
      const response = await payAndFetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: nextMessages.map(({ role, content }) => ({ role, content })),
        }),
      });
      setStatus("thinking");

      if (!response.ok) {
        const errorPayload = (await response.json().catch(() => ({}))) as {
          error?: string;
          detail?: string;
        };
        const tag = errorPayload.error ?? `Request failed (${response.status})`;
        throw new Error(`${tag}: ${errorPayload.detail ?? ""}`);
      }

      const data = (await response.json()) as ChatResponse;
      const receipt = extractReceipt(data.paymentReceipt);
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: data.content,
          receiptUrl: receipt ? explorerUrl(receipt.hash, receipt.network) : undefined,
        },
      ]);
    } catch (err) {
      setError(mapError(err));
    } finally {
      setStatus("idle");
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void send(input);
  }

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
        <div className="flex items-center gap-2">
          <IconRobot size={22} aria-hidden="true" />
          <h1 className="text-base font-semibold">{SITE.name}</h1>
        </div>
        <WalletBadge />
      </header>

      <main
        className="flex flex-1 flex-col overflow-y-auto px-4 py-4"
        aria-busy={isSending}
      >
        {messages.length === 0 ? (
          <EmptyState disabled={isSending} onPick={(prompt) => void send(prompt)} />
        ) : (
          <ul className="flex flex-col gap-3">
            {messages.map((message) => (
              <MessageBubble key={message.id} message={message} />
            ))}
            {isSending ? <TypingIndicator label={statusLabel(status)} /> : null}
          </ul>
        )}
        {error ? (
          <div
            role="alert"
            className="mt-3 flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200"
          >
            <IconAlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
            <span>{error}</span>
          </div>
        ) : null}
      </main>

      <form
        onSubmit={handleSubmit}
        className="border-t border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-950"
      >
        <label htmlFor="prompt" className="sr-only">
          Prompt
        </label>
        <div className="flex items-end gap-2">
          <input
            id="prompt"
            name="prompt"
            type="text"
            inputMode="text"
            enterKeyHint="send"
            autoComplete="off"
            placeholder="Ask anything…"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            disabled={isSending}
            className="flex-1 rounded-full border border-zinc-200 bg-zinc-50 px-4 py-3 text-base outline-none transition focus:border-zinc-400 focus:bg-white disabled:opacity-60 dark:border-zinc-800 dark:bg-zinc-900 dark:focus:bg-zinc-900"
          />
          <button
            type="submit"
            disabled={!input.trim() || isSending}
            className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-950 text-white transition hover:bg-zinc-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-950 disabled:cursor-not-allowed disabled:bg-zinc-300 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200 dark:focus-visible:outline-white dark:disabled:bg-zinc-700"
            aria-label="Send message"
          >
            <IconSend2 size={18} aria-hidden="true" />
          </button>
        </div>
      </form>
    </div>
  );
}

function EmptyState({
  disabled,
  onPick,
}: {
  disabled: boolean;
  onPick: (prompt: string) => void;
}) {
  return (
    <div className="m-auto flex w-full max-w-sm flex-col items-center gap-4 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-900">
        <IconRobot size={28} aria-hidden="true" />
      </span>
      <div className="space-y-2">
        <h2 className="text-lg font-semibold">Ask anything onchain</h2>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Each answer costs {SITE.pricePerQuery} {SITE.paymentToken} and settles on{" "}
          {SITE.network}.
        </p>
      </div>
      <ul className="flex w-full flex-col gap-2">
        {SAMPLE_PROMPTS.map((prompt) => (
          <li key={prompt}>
            <button
              type="button"
              onClick={() => onPick(prompt)}
              disabled={disabled}
              className="flex w-full items-start gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-left text-sm text-zinc-700 transition hover:border-zinc-300 hover:bg-zinc-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-400 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              <IconSparkles size={14} className="mt-1 shrink-0 text-zinc-400" aria-hidden="true" />
              <span>{prompt}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === "user";
  return (
    <li className={`flex gap-2 ${isUser ? "flex-row-reverse" : ""}`}>
      <span
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
          isUser
            ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"
            : "bg-zinc-200 dark:bg-zinc-800"
        }`}
        aria-hidden="true"
      >
        {isUser ? <IconUser size={16} /> : <IconRobot size={16} />}
      </span>
      <div className="flex max-w-[80%] flex-col gap-1">
        <div
          className={`whitespace-pre-wrap rounded-2xl px-3.5 py-2 text-sm leading-relaxed ${
            isUser
              ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"
              : "bg-zinc-100 text-zinc-900 dark:bg-zinc-900 dark:text-zinc-100"
          }`}
        >
          {message.content}
        </div>
        {message.receiptUrl ? (
          <a
            href={message.receiptUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 self-start rounded text-[11px] text-zinc-500 transition hover:text-zinc-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-400 dark:text-zinc-400 dark:hover:text-zinc-100"
          >
            <span>View receipt on Celoscan</span>
            <IconExternalLink size={12} aria-hidden="true" />
          </a>
        ) : null}
      </div>
    </li>
  );
}

function TypingIndicator({ label }: { label: string }) {
  return (
    <li className="flex gap-2" aria-live="polite" aria-label={label}>
      <span
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zinc-200 dark:bg-zinc-800"
        aria-hidden="true"
      >
        <IconRobot size={16} />
      </span>
      <div className="flex flex-col gap-1">
        <div className="rounded-2xl bg-zinc-100 px-3.5 py-2 text-sm text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
          <span className="inline-flex items-center gap-1" aria-hidden="true">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" />
            <span
              className="h-1.5 w-1.5 animate-pulse rounded-full bg-current"
              style={{ animationDelay: "150ms" }}
            />
            <span
              className="h-1.5 w-1.5 animate-pulse rounded-full bg-current"
              style={{ animationDelay: "300ms" }}
            />
          </span>
        </div>
        {label ? (
          <span className="px-1 text-[11px] text-zinc-400 dark:text-zinc-500">{label}</span>
        ) : null}
      </div>
    </li>
  );
}
