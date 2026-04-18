"use client";

import { useEffect } from "react";
import { useAccount, useConnect, useConnectors } from "wagmi";
import { useIsMiniPay } from "@/hooks/useIsMiniPay";

/**
 * Auto-connect on mount, but only inside MiniPay where the wallet is
 * implicit and a Connect button would be against MiniPay's UX rules.
 * In a regular browser we leave the user in control — they click Connect
 * when they want to start paying for queries.
 */
export function useAutoConnect(): void {
  const isMiniPay = useIsMiniPay();
  const connectors = useConnectors();
  const { connect } = useConnect();
  const { isConnected, isConnecting, isReconnecting } = useAccount();

  useEffect(() => {
    if (!isMiniPay) return;
    if (isConnected || isConnecting || isReconnecting) return;
    const injected = connectors[0];
    if (injected) connect({ connector: injected });
  }, [
    isMiniPay,
    connectors,
    connect,
    isConnected,
    isConnecting,
    isReconnecting,
  ]);
}
