"use client";

import {
  IconAlertTriangle,
  IconExternalLink,
  IconRobot,
  IconSend2,
  IconUser,
} from "@tabler/icons-react";
import { useState, type FormEvent } from "react";
import { useAutoConnect } from "@/hooks/useAutoConnect";
import { useIsMiniPay } from "@/hooks/useIsMiniPay";
import { payAndFetch, WalletNotAvailableError } from "@/lib/payments";
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

export function ChatApp() {
  const isMiniPay = useIsMiniPay();
  useAutoConnect();

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || isSending) return;

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: trimmed,
    };
    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setInput("");
    setError(null);
    setIsSending(true);

    try {
      const response = await payAndFetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: nextMessages.map(({ role, content }) => ({ role, content })),
        }),
      });

      if (!response.ok) {
        const errorPayload = await response.json().catch(() => ({}));
        throw new Error(errorPayload.error ?? `Request failed (${response.status})`);
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
      const message =
        err instanceof WalletNotAvailableError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Something went wrong";
      setError(message);
    } finally {
      setIsSending(false);
    }
  }

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
        <div className="flex items-center gap-2">
          <IconRobot size={22} aria-hidden="true" />
          <h1 className="text-base font-semibold">pay-chat</h1>
        </div>
        <WalletBadge />
      </header>

      <main className="flex flex-1 flex-col overflow-y-auto px-4 py-4">
        {messages.length === 0 ? (
          <EmptyState isMiniPay={isMiniPay} />
        ) : (
          <ul className="flex flex-col gap-3">
            {messages.map((message) => (
              <MessageBubble key={message.id} message={message} />
            ))}
            {isSending ? <TypingIndicator /> : null}
          </ul>
        )}
        {error ? (
          <div className="mt-3 flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200">
            <IconAlertTriangle size={16} className="mt-0.5 shrink-0" />
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
            className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-950 text-white transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:bg-zinc-300 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200 dark:disabled:bg-zinc-700"
            aria-label="Send"
          >
            <IconSend2 size={18} />
          </button>
        </div>
        <p className="mt-2 text-center text-[11px] text-zinc-400">
          You pay per answer in stablecoin · no subscription
        </p>
      </form>
    </div>
  );
}

function EmptyState({ isMiniPay }: { isMiniPay: boolean }) {
  return (
    <div className="m-auto flex max-w-sm flex-col items-center gap-3 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-900">
        <IconRobot size={28} aria-hidden="true" />
      </span>
      <h2 className="text-lg font-semibold">Ask AI, pay per answer</h2>
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        Pick any question. We route it to the best model and charge a couple of cents in
        stablecoin — no subscription, no signup.
      </p>
      <p className="text-xs text-zinc-400">
        {isMiniPay
          ? "Connected via MiniPay. Type a question to get started."
          : "Connect a wallet on Celo to start. Each answer settles onchain."}
      </p>
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
            className="inline-flex items-center gap-1 self-start text-[11px] text-zinc-500 transition hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
          >
            <span>View receipt on Celoscan</span>
            <IconExternalLink size={12} />
          </a>
        ) : null}
      </div>
    </li>
  );
}

function TypingIndicator() {
  return (
    <li className="flex gap-2" aria-live="polite">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zinc-200 dark:bg-zinc-800">
        <IconRobot size={16} />
      </span>
      <div className="rounded-2xl bg-zinc-100 px-3.5 py-2 text-sm text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
        <span className="inline-flex items-center gap-1">
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
    </li>
  );
}
