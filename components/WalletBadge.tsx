"use client";

import { IconWallet } from "@tabler/icons-react";
import { useAccount } from "wagmi";

function truncate(address: string) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function WalletBadge() {
  const { address, isConnected, chainId } = useAccount();

  if (!isConnected || !address) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900">
        <IconWallet size={14} />
        <span>Not connected</span>
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-300">
      <IconWallet size={14} />
      <span className="font-mono">{truncate(address)}</span>
      <span className="text-emerald-600/70 dark:text-emerald-400/70">· {chainId}</span>
    </span>
  );
}
