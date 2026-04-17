"use client";

import { useSyncExternalStore } from "react";

function subscribe() {
  return () => {};
}

function getSnapshot() {
  return window.ethereum?.isMiniPay === true;
}

function getServerSnapshot() {
  return false;
}

export function useIsMiniPay(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
