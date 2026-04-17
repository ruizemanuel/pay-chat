"use client";

import { useEffect } from "react";
import { useAccount, useConnect, useConnectors } from "wagmi";

export function useAutoConnect(): void {
  const connectors = useConnectors();
  const { connect } = useConnect();
  const { isConnected, isConnecting, isReconnecting } = useAccount();

  useEffect(() => {
    if (isConnected || isConnecting || isReconnecting) return;
    const injected = connectors[0];
    if (injected) connect({ connector: injected });
  }, [connectors, connect, isConnected, isConnecting, isReconnecting]);
}
