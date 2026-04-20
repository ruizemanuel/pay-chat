import "server-only";

import type { Address } from "viem";

const BASE_URL = "https://api.etherscan.io/v2/api";
const CELO_CHAIN_ID = 42220;
const TIMEOUT_MS = 5000;

type EtherscanEnvelope<T> = {
  status: "0" | "1";
  message: string;
  result: T;
};

export type EtherscanSourceCode = {
  SourceCode: string;
  ABI: string;
  ContractName: string;
  CompilerVersion: string;
  OptimizationUsed: string;
  Proxy: string;
  Implementation: string;
};

export type EtherscanNativeTx = {
  hash: string;
  blockNumber: string;
  timeStamp: string;
  from: string;
  to: string;
  value: string;
  gasPrice: string;
  gasUsed: string;
  isError: string;
  methodId: string;
  functionName: string;
};

export type EtherscanTokenTx = {
  hash: string;
  blockNumber: string;
  timeStamp: string;
  from: string;
  to: string;
  value: string;
  contractAddress: string;
  tokenName: string;
  tokenSymbol: string;
  tokenDecimal: string;
};

export type EtherscanContractCreation = {
  contractAddress: string;
  contractCreator: string;
  txHash: string;
};

class EtherscanError extends Error {
  constructor(
    message: string,
    readonly code: "no_key" | "http" | "api" | "timeout" | "unknown",
  ) {
    super(message);
    this.name = "EtherscanError";
  }
}

async function callOnce<T>(params: Record<string, string>): Promise<T> {
  const apiKey = process.env.ETHERSCAN_API_KEY;
  if (!apiKey) {
    throw new EtherscanError("ETHERSCAN_API_KEY not set", "no_key");
  }

  const url = new URL(BASE_URL);
  url.search = new URLSearchParams({
    chainid: String(CELO_CHAIN_ID),
    apikey: apiKey,
    ...params,
  }).toString();

  let response: Response;
  try {
    response = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
  } catch (error) {
    const name = error instanceof Error ? error.name : "";
    const code = name === "TimeoutError" ? "timeout" : "unknown";
    throw new EtherscanError(
      `Etherscan fetch failed: ${error instanceof Error ? error.message : "unknown"}`,
      code,
    );
  }

  if (!response.ok) {
    throw new EtherscanError(
      `Etherscan HTTP ${response.status}`,
      "http",
    );
  }

  const body = (await response.json()) as EtherscanEnvelope<T>;
  // Etherscan returns status "0" for both errors AND "no data found" cases.
  // For list endpoints an empty array is a legitimate "no data" response, so
  // we treat status "0" with message "No transactions found" or result == []
  // as success with empty data; anything else as error.
  if (body.status === "0") {
    const isEmptyList = Array.isArray(body.result) && body.result.length === 0;
    if (isEmptyList || /no\s+(transactions|records)\s+found/i.test(body.message)) {
      return body.result;
    }
    throw new EtherscanError(
      `Etherscan API error: ${body.message}`,
      "api",
    );
  }

  return body.result;
}

/**
 * Single retry on transient Etherscan errors (api, http, timeout). Generic
 * `NOTOK` responses come back as `code: "api"` and are usually rate-limit
 * hits that clear within a second. `no_key` and `unknown` are not retried.
 */
async function call<T>(params: Record<string, string>): Promise<T> {
  try {
    return await callOnce<T>(params);
  } catch (error) {
    if (
      error instanceof EtherscanError &&
      (error.code === "api" || error.code === "http" || error.code === "timeout")
    ) {
      await new Promise((resolve) => setTimeout(resolve, 500));
      return callOnce<T>(params);
    }
    throw error;
  }
}

export const etherscan = {
  /**
   * Returns contract source metadata. `SourceCode` is empty when the contract
   * is not verified. Always returns an array of length 1 (Etherscan's shape).
   */
  getSourceCode: (address: Address) =>
    call<EtherscanSourceCode[]>({
      module: "contract",
      action: "getsourcecode",
      address,
    }),

  /** Native CELO transfer history for an address (most recent first). */
  getTxList: (address: Address, limit = 10) =>
    call<EtherscanNativeTx[]>({
      module: "account",
      action: "txlist",
      address,
      startblock: "0",
      endblock: "99999999",
      page: "1",
      offset: String(limit),
      sort: "desc",
    }),

  /** ERC-20 token transfers involving an address (most recent first). */
  getTokenTxList: (address: Address, limit = 10) =>
    call<EtherscanTokenTx[]>({
      module: "account",
      action: "tokentx",
      address,
      startblock: "0",
      endblock: "99999999",
      page: "1",
      offset: String(limit),
      sort: "desc",
    }),

  /** Returns the deployer + creation tx hash for a contract address. */
  getContractCreation: (address: Address) =>
    call<EtherscanContractCreation[]>({
      module: "contract",
      action: "getcontractcreation",
      contractaddresses: address,
    }),
};

export { EtherscanError };
