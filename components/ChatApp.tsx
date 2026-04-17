"use client";

import { IconRobot, IconSend2, IconUser } from "@tabler/icons-react";
import { useState, type FormEvent } from "react";
import { useAutoConnect } from "@/hooks/useAutoConnect";
import { useIsMiniPay } from "@/hooks/useIsMiniPay";
import { WalletBadge } from "./WalletBadge";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

export function ChatApp() {
  const isMiniPay = useIsMiniPay();
  useAutoConnect();

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = input.trim();
    if (!trimmed) return;
    setMessages((prev) => [
      ...prev,
      { id: crypto.randomUUID(), role: "user", content: trimmed },
    ]);
    setInput("");
    // TODO(day-3): POST /api/chat with 402 payment flow
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
          </ul>
        )}
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
            className="flex-1 rounded-full border border-zinc-200 bg-zinc-50 px-4 py-3 text-base outline-none transition focus:border-zinc-400 focus:bg-white dark:border-zinc-800 dark:bg-zinc-900 dark:focus:bg-zinc-900"
          />
          <button
            type="submit"
            disabled={!input.trim()}
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
      {!isMiniPay ? (
        <p className="text-xs text-amber-600 dark:text-amber-400">
          Open this app inside MiniPay for the full experience.
        </p>
      ) : null}
    </div>
  );
}

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === "user";
  return (
    <li className={`flex gap-2 ${isUser ? "flex-row-reverse" : ""}`}>
      <span
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
          isUser ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900" : "bg-zinc-200 dark:bg-zinc-800"
        }`}
        aria-hidden="true"
      >
        {isUser ? <IconUser size={16} /> : <IconRobot size={16} />}
      </span>
      <div
        className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed ${
          isUser
            ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"
            : "bg-zinc-100 text-zinc-900 dark:bg-zinc-900 dark:text-zinc-100"
        }`}
      >
        {message.content}
      </div>
    </li>
  );
}
