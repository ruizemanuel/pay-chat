import "server-only";

import {
  decodeEventLog,
  formatEther,
  formatUnits,
  getAddress,
  type Address,
  type Hash,
  type Log,
} from "viem";

import { publicClient } from "@/lib/celo-public";
import { etherscan } from "@/lib/etherscan";
import { KNOWN_TOKENS } from "@/lib/site";

export type TxSummary = {
  hash: Hash;
  status: "success" | "reverted";
  from: Address;
  to: Address | null;
  valueCelo: string;
  gasUsed: string;
  gasCostCelo: string;
  erc20Transfers: Array<{
    token: Address;
    tokenSymbol?: string;
    from: Address;
    to: Address;
    amount: string;
  }>;
  logCount: number;
  truncated: boolean;
};

export type ContractSummary = {
  address: Address;
  verified: boolean;
  name?: string;
  compiler?: string;
};

export type EoaRecentTx = {
  hash: Hash;
  direction: "in" | "out";
  counterparty: Address;
  valueLabel: string;
  timestamp: string;
};

export type EoaSummary = {
  address: Address;
  recentTxs: EoaRecentTx[];
  totalRecent: number;
};

export type ChainContextBlock =
  | { kind: "tx"; hash: Hash; data: TxSummary }
  | { kind: "contract"; address: Address; data: ContractSummary }
  | { kind: "eoa"; address: Address; data: EoaSummary }
  | { kind: "self"; address: Address; data: EoaSummary };

const TX_HASH_REGEX = /\b0x[a-fA-F0-9]{64}\b/g;
const ADDRESS_REGEX = /\b0x[a-fA-F0-9]{40}\b/g;

/**
 * Catches asks about the user's own wallet history in both English and
 * Spanish. Allows up to 3 words between the pronoun and the keyword so
 * natural phrases like "my last transaction" / "mi última actividad" also
 * match. Deliberately conservative otherwise — prefers a false negative
 * (skip fetching history) over false positive (wasted RPC call).
 */
const SELF_HISTORY_PATTERNS = [
  /\b(my|mine)(?:\s+\w+){0,3}\s+(wallet|tx|txs|transactions?|history|activity|balance)\b/i,
  /\b(mi|mis)(?:\s+\w+){0,3}\s+(wallet|billetera|tx|transacci|histori|movimiento|balance|activid|reciente|últim)/i,
  /\bwhat\s+(have|did)\s+i\s+(do|done|sent|paid)/i,
  /\b(qué|cuánto|cuanto)\s+(hice|gasté|gaste|mandé|mande|envié|envie|pagué|pague)/i,
];

export function hasSelfHistoryIntent(text: string): boolean {
  return SELF_HISTORY_PATTERNS.some((pattern) => pattern.test(text));
}

const ERC20_TRANSFER_ABI = [
  {
    type: "event",
    name: "Transfer",
    inputs: [
      { type: "address", name: "from", indexed: true },
      { type: "address", name: "to", indexed: true },
      { type: "uint256", name: "value", indexed: false },
    ],
  },
] as const;

const MAX_DECODED_TRANSFERS = 10;

export function detectReferences(text: string): {
  txHashes: Hash[];
  addresses: Address[];
} {
  const txHashes = Array.from(
    new Set((text.match(TX_HASH_REGEX) ?? []).map((h) => h.toLowerCase())),
  ) as Hash[];

  const txHashesLower = txHashes.map((h) => h.toLowerCase());
  const rawAddresses = Array.from(
    new Set((text.match(ADDRESS_REGEX) ?? []).map((a) => a.toLowerCase())),
  ).filter((a) => !txHashesLower.some((h) => h.includes(a)));

  const addresses = rawAddresses.map((a) => getAddress(a));
  return { txHashes, addresses };
}

function decodeErc20Transfer(
  log: Log,
): { token: Address; from: Address; to: Address; rawValue: bigint } | null {
  try {
    const decoded = decodeEventLog({
      abi: ERC20_TRANSFER_ABI,
      data: log.data,
      topics: log.topics,
    });
    if (decoded.eventName !== "Transfer") return null;
    return {
      token: log.address as Address,
      from: decoded.args.from as Address,
      to: decoded.args.to as Address,
      rawValue: decoded.args.value as bigint,
    };
  } catch {
    return null;
  }
}

export async function fetchTxSummary(hash: Hash): Promise<TxSummary | null> {
  const [receipt, transaction] = await Promise.all([
    publicClient.getTransactionReceipt({ hash }).catch(() => null),
    publicClient.getTransaction({ hash }).catch(() => null),
  ]);
  if (!receipt || !transaction) return null;

  // Decode only known ERC-20 Transfer events. Unknown logs are counted but
  // not surfaced to keep the context block compact for the LLM.
  const decoded = receipt.logs
    .map(decodeErc20Transfer)
    .filter((x): x is NonNullable<typeof x> => x !== null);

  const truncated = decoded.length > MAX_DECODED_TRANSFERS;
  const capped = decoded.slice(0, MAX_DECODED_TRANSFERS);

  const erc20Transfers = capped.map((t) => {
    const known = KNOWN_TOKENS[t.token.toLowerCase()];
    const decimals = known?.decimals ?? 18;
    return {
      token: t.token,
      tokenSymbol: known?.symbol,
      from: t.from,
      to: t.to,
      amount: formatUnits(t.rawValue, decimals),
    };
  });

  const gasPrice =
    receipt.effectiveGasPrice ?? transaction.gasPrice ?? BigInt(0);
  const gasCostWei = receipt.gasUsed * gasPrice;

  return {
    hash,
    status: receipt.status === "success" ? "success" : "reverted",
    from: receipt.from,
    to: receipt.to,
    valueCelo: formatEther(transaction.value),
    gasUsed: receipt.gasUsed.toString(),
    gasCostCelo: formatEther(gasCostWei),
    erc20Transfers,
    logCount: receipt.logs.length,
    truncated,
  };
}

async function isContract(address: Address): Promise<boolean> {
  try {
    const bytecode = await publicClient.getBytecode({ address });
    return typeof bytecode === "string" && bytecode !== "0x" && bytecode.length > 2;
  } catch {
    return false;
  }
}

async function fetchContractSummary(
  address: Address,
): Promise<ContractSummary | null> {
  try {
    const result = await etherscan.getSourceCode(address);
    const entry = result[0];
    const verified =
      typeof entry?.SourceCode === "string" && entry.SourceCode.length > 0;
    return {
      address,
      verified,
      name: entry?.ContractName ? entry.ContractName : undefined,
      compiler: entry?.CompilerVersion ? entry.CompilerVersion : undefined,
    };
  } catch {
    return null;
  }
}

const MAX_EOA_TXS = 10;

async function fetchEoaSummary(address: Address): Promise<EoaSummary | null> {
  const [natives, tokens] = await Promise.all([
    etherscan.getTxList(address, MAX_EOA_TXS).catch(() => []),
    etherscan.getTokenTxList(address, MAX_EOA_TXS).catch(() => []),
  ]);

  const addressLower = address.toLowerCase();

  const nativeEntries: EoaRecentTx[] = natives.map((tx) => {
    const direction: "in" | "out" =
      tx.from.toLowerCase() === addressLower ? "out" : "in";
    const counterparty = (direction === "out" ? tx.to : tx.from) as Address;
    const celo = formatEther(BigInt(tx.value));
    const isReverted = tx.isError === "1";
    return {
      hash: tx.hash as Hash,
      direction,
      counterparty,
      valueLabel: `${celo} CELO${isReverted ? " (reverted)" : ""}`,
      timestamp: new Date(Number(tx.timeStamp) * 1000).toISOString(),
    };
  });

  const tokenEntries: EoaRecentTx[] = tokens.map((tx) => {
    const direction: "in" | "out" =
      tx.from.toLowerCase() === addressLower ? "out" : "in";
    const counterparty = (direction === "out" ? tx.to : tx.from) as Address;
    const decimals = Number(tx.tokenDecimal) || 18;
    const amount = formatUnits(BigInt(tx.value), decimals);
    const symbol = tx.tokenSymbol || "token";
    return {
      hash: tx.hash as Hash,
      direction,
      counterparty,
      valueLabel: `${amount} ${symbol}`,
      timestamp: new Date(Number(tx.timeStamp) * 1000).toISOString(),
    };
  });

  const merged = [...nativeEntries, ...tokenEntries].sort(
    (a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp),
  );

  return {
    address,
    recentTxs: merged.slice(0, MAX_EOA_TXS),
    totalRecent: merged.length,
  };
}

async function fetchAddressBlock(
  address: Address,
): Promise<ChainContextBlock | null> {
  const contract = await isContract(address);
  if (contract) {
    const data = await fetchContractSummary(address);
    if (!data) return null;
    return { kind: "contract", address, data };
  }
  const data = await fetchEoaSummary(address);
  if (!data) return null;
  return { kind: "eoa", address, data };
}

export async function enrichContext(
  userMessage: string,
  connectedAddress?: Address,
): Promise<ChainContextBlock[]> {
  const { txHashes, addresses } = detectReferences(userMessage);
  const wantsSelfHistory =
    connectedAddress !== undefined && hasSelfHistoryIntent(userMessage);

  if (
    txHashes.length === 0 &&
    addresses.length === 0 &&
    !wantsSelfHistory
  ) {
    return [];
  }

  const [txBlocks, addressBlocks, selfBlock] = await Promise.all([
    Promise.all(
      txHashes.map(async (hash) => {
        const data = await fetchTxSummary(hash);
        if (!data) return null;
        return { kind: "tx" as const, hash, data };
      }),
    ),
    Promise.all(addresses.map((addr) => fetchAddressBlock(addr))),
    (async () => {
      if (!wantsSelfHistory || !connectedAddress) return null;
      const data = await fetchEoaSummary(connectedAddress);
      if (!data) return null;
      return { kind: "self" as const, address: connectedAddress, data };
    })(),
  ]);

  return [...txBlocks, ...addressBlocks, selfBlock].filter(
    (b): b is ChainContextBlock => b !== null,
  );
}
