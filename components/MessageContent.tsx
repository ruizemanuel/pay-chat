"use client";

import {
  IconCheck,
  IconCopy,
  IconExternalLink,
} from "@tabler/icons-react";
import { useState } from "react";

import { tokenizeMessage, truncateHex } from "@/lib/parse-message";

export function MessageContent({ text }: { text: string }) {
  const tokens = tokenizeMessage(text);
  return (
    <>
      {tokens.map((token, i) => {
        if (token.type === "text") {
          return <span key={i}>{token.value}</span>;
        }
        const explorerUrl =
          token.type === "address"
            ? `https://celoscan.io/address/${token.value}`
            : `https://celoscan.io/tx/${token.value}`;
        const label = token.type === "address" ? "address" : "transaction";
        return (
          <HexChip
            key={i}
            full={token.value}
            explorerUrl={explorerUrl}
            label={label}
          />
        );
      })}
    </>
  );
}

function HexChip({
  full,
  explorerUrl,
  label,
}: {
  full: string;
  explorerUrl: string;
  label: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(full);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard unavailable (insecure context / denied permission); silent
    }
  }

  return (
    <span className="mx-0.5 inline-flex items-center gap-1 rounded-md bg-zinc-200/70 px-1.5 py-0.5 align-baseline font-mono text-[12px] text-zinc-800 dark:bg-zinc-700/70 dark:text-zinc-100">
      <button
        type="button"
        onClick={copy}
        title={copied ? "Copied" : `Copy ${label}`}
        aria-label={copied ? "Copied" : `Copy ${label}`}
        className="inline-flex items-center gap-1 focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-1 focus-visible:outline-zinc-400"
      >
        <span>{truncateHex(full)}</span>
        {copied ? (
          <IconCheck
            size={12}
            aria-hidden="true"
            className="text-emerald-500"
          />
        ) : (
          <IconCopy size={12} aria-hidden="true" className="opacity-60" />
        )}
      </button>
      <a
        href={explorerUrl}
        target="_blank"
        rel="noopener noreferrer"
        title={`Open ${label} on Celoscan`}
        aria-label={`Open ${label} on Celoscan`}
        className="opacity-60 hover:opacity-100 focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-1 focus-visible:outline-zinc-400"
      >
        <IconExternalLink size={12} aria-hidden="true" />
      </a>
    </span>
  );
}
