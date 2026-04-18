"use client";

import { IconLoader2, IconWallet } from "@tabler/icons-react";
import { useAccount, useConnect, useConnectors } from "wagmi";
import { useIsMounted } from "@/hooks/useIsMounted";

function truncate(address: string) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function WalletBadge() {
  const isMounted = useIsMounted();
  const { address, isConnected, chainId } = useAccount();
  const connectors = useConnectors();
  const { connect, isPending } = useConnect();

  if (!isMounted) {
    return <PendingPill label="Loading…" />;
  }

  if (isConnected && address) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-300">
        <IconWallet size={14} />
        <span className="font-mono">{truncate(address)}</span>
        <span className="text-emerald-600/70 dark:text-emerald-400/70">· {chainId}</span>
      </span>
    );
  }

  const injected = connectors[0];
  const handleConnect = () => {
    if (injected) connect({ connector: injected });
  };

  return (
    <button
      type="button"
      onClick={handleConnect}
      disabled={!injected || isPending}
      className="inline-flex items-center gap-1.5 rounded-full bg-zinc-950 px-3 py-1 text-xs font-medium text-white transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200"
    >
      {isPending ? <IconLoader2 size={14} className="animate-spin" /> : <IconWallet size={14} />}
      <span>{isPending ? "Connecting…" : "Connect"}</span>
    </button>
  );
}

function PendingPill({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900">
      <IconWallet size={14} />
      <span>{label}</span>
    </span>
  );
}
