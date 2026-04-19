import { beforeEach, describe, expect, it, vi } from "vitest";
import { pad, toHex, type Address, type Hash } from "viem";

vi.mock("server-only", () => ({}));

const getTransactionReceipt = vi.fn();
const getTransaction = vi.fn();
const getBytecode = vi.fn();
const getBlock = vi.fn();
const readContract = vi.fn();

vi.mock("@/lib/celo-public", () => ({
  publicClient: {
    getTransactionReceipt: (args: { hash: Hash }) => getTransactionReceipt(args),
    getTransaction: (args: { hash: Hash }) => getTransaction(args),
    getBytecode: (args: { address: Address }) => getBytecode(args),
    getBlock: (args: { blockNumber: bigint }) => getBlock(args),
    readContract: (args: { address: Address; functionName: string }) =>
      readContract(args),
  },
}));

const getSourceCode = vi.fn();
const getTxList = vi.fn();
const getTokenTxList = vi.fn();
const getContractCreation = vi.fn();

vi.mock("@/lib/etherscan", () => ({
  etherscan: {
    getSourceCode: (address: Address) => getSourceCode(address),
    getTxList: (address: Address, limit?: number) => getTxList(address, limit),
    getTokenTxList: (address: Address, limit?: number) =>
      getTokenTxList(address, limit),
    getContractCreation: (address: Address) => getContractCreation(address),
  },
  EtherscanError: class EtherscanError extends Error {},
}));

import {
  detectReferences,
  enrichContext,
  fetchTxSummary,
  hasSelfHistoryIntent,
} from "@/lib/chain-context";

const TRANSFER_TOPIC =
  "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

// Celo mainnet USDT
const USDT: Address = "0x48065fBBe25F71C9282ddf5e1cD6D6A887483D5e";
// Random mainnet addresses used as user/recipient in mocks
const USER: Address = "0xe6319a868bdB273118d2A8d63E82Cc405f9cF4c2";
const SERVER: Address = "0x4dba906e137c62E11c1428ea067b0DE0d65B9fb2";

const TX_HASH: Hash =
  "0x0e5a734d0fb60b0996898b1f8a6affa20a35186c3146758a39be9fefdcd20a28";

function buildTransferLog(opts: {
  token: Address;
  from: Address;
  to: Address;
  rawValue: bigint;
}) {
  return {
    address: opts.token,
    topics: [
      TRANSFER_TOPIC,
      pad(opts.from, { size: 32 }),
      pad(opts.to, { size: 32 }),
    ],
    data: pad(toHex(opts.rawValue), { size: 32 }),
    logIndex: 0,
    blockNumber: BigInt(0),
    blockHash: pad("0x00", { size: 32 }),
    transactionHash: pad("0x00", { size: 32 }),
    transactionIndex: 0,
    removed: false,
  };
}

describe("detectReferences", () => {
  it("returns empty for plain text", () => {
    expect(detectReferences("hello how are you")).toEqual({
      txHashes: [],
      addresses: [],
    });
  });

  it("finds a single tx hash (64 hex)", () => {
    const { txHashes, addresses } = detectReferences(`explain ${TX_HASH}`);
    expect(txHashes).toHaveLength(1);
    expect(txHashes[0]).toBe(TX_HASH.toLowerCase());
    expect(addresses).toHaveLength(0);
  });

  it("finds a single address (40 hex)", () => {
    const contract = "0x962BC4ad7671Db17d975AB42D4dA5110bC13b66a";
    const { txHashes, addresses } = detectReferences(
      `what is ${contract}? is it safe?`,
    );
    expect(txHashes).toHaveLength(0);
    expect(addresses).toHaveLength(1);
    // Returned checksummed
    expect(addresses[0]).toBe(contract);
  });

  it("handles tx hash + address in the same message without double-counting", () => {
    const contract = "0x962BC4ad7671Db17d975AB42D4dA5110bC13b66a";
    const msg = `tx ${TX_HASH} and address ${contract}`;
    const { txHashes, addresses } = detectReferences(msg);
    expect(txHashes).toHaveLength(1);
    expect(addresses).toHaveLength(1);
    expect(addresses[0]).toBe(contract);
  });

  it("dedupes repeated references", () => {
    const msg = `see ${TX_HASH} again ${TX_HASH}`;
    expect(detectReferences(msg).txHashes).toHaveLength(1);
  });
});

describe("hasSelfHistoryIntent", () => {
  it("matches direct 'my wallet / my tx'", () => {
    expect(hasSelfHistoryIntent("my wallet balance")).toBe(true);
    expect(hasSelfHistoryIntent("my tx")).toBe(true);
  });

  it("matches phrases with words between pronoun and keyword", () => {
    expect(hasSelfHistoryIntent("my last transaction on Celo")).toBe(true);
    expect(hasSelfHistoryIntent("summarize my last transactions on Celo")).toBe(
      true,
    );
    expect(hasSelfHistoryIntent("mi última actividad")).toBe(true);
    expect(hasSelfHistoryIntent("resumí mis últimas transacciones")).toBe(true);
  });

  it("matches 'what did I do' pattern", () => {
    expect(hasSelfHistoryIntent("what have I done this week?")).toBe(true);
    expect(hasSelfHistoryIntent("cuánto gasté en transacciones?")).toBe(true);
  });

  it("does not match unrelated sentences", () => {
    expect(hasSelfHistoryIntent("my favorite movie")).toBe(false);
    expect(hasSelfHistoryIntent("explain stablecoins")).toBe(false);
    expect(hasSelfHistoryIntent("what is MiniPay?")).toBe(false);
  });
});

describe("fetchTxSummary", () => {
  beforeEach(() => {
    getTransactionReceipt.mockReset();
    getTransaction.mockReset();
  });

  it("returns null when RPC call fails", async () => {
    getTransactionReceipt.mockRejectedValue(new Error("rpc down"));
    getTransaction.mockRejectedValue(new Error("rpc down"));
    const result = await fetchTxSummary(TX_HASH);
    expect(result).toBeNull();
  });

  it("summarizes a successful USDT transfer and resolves the symbol", async () => {
    getTransactionReceipt.mockResolvedValue({
      status: "success",
      from: USER,
      to: SERVER,
      gasUsed: BigInt(50000),
      effectiveGasPrice: BigInt(25000000000), // 25 gwei
      logs: [
        buildTransferLog({
          token: USDT,
          from: USER,
          to: SERVER,
          rawValue: BigInt(20000), // 0.02 USDT (6 decimals)
        }),
      ],
    });
    getTransaction.mockResolvedValue({
      value: BigInt(0),
      gasPrice: BigInt(25000000000),
    });

    const summary = await fetchTxSummary(TX_HASH);
    expect(summary).not.toBeNull();
    expect(summary).toMatchObject({
      hash: TX_HASH,
      status: "success",
      from: USER,
      to: SERVER,
      valueCelo: "0",
      logCount: 1,
      truncated: false,
    });
    expect(summary!.erc20Transfers).toHaveLength(1);
    expect(summary!.erc20Transfers[0]).toMatchObject({
      token: USDT,
      tokenSymbol: "USDT",
      from: USER,
      to: SERVER,
      amount: "0.02",
    });
    // gasUsed × effectiveGasPrice = 50_000 × 25 gwei = 0.00125 CELO
    expect(summary!.gasCostCelo).toBe("0.00125");
  });

  it("marks status reverted when the tx failed", async () => {
    getTransactionReceipt.mockResolvedValue({
      status: "reverted",
      from: USER,
      to: SERVER,
      gasUsed: BigInt(30000),
      effectiveGasPrice: BigInt(25000000000),
      logs: [],
    });
    getTransaction.mockResolvedValue({
      value: BigInt(0),
      gasPrice: BigInt(25000000000),
    });

    const summary = await fetchTxSummary(TX_HASH);
    expect(summary!.status).toBe("reverted");
    expect(summary!.erc20Transfers).toEqual([]);
  });

  it("truncates to 10 decoded transfers and sets truncated: true", async () => {
    const logs = Array.from({ length: 12 }, () =>
      buildTransferLog({
        token: USDT,
        from: USER,
        to: SERVER,
        rawValue: BigInt(1),
      }),
    );
    getTransactionReceipt.mockResolvedValue({
      status: "success",
      from: USER,
      to: SERVER,
      gasUsed: BigInt(200000),
      effectiveGasPrice: BigInt(25000000000),
      logs,
    });
    getTransaction.mockResolvedValue({
      value: BigInt(0),
      gasPrice: BigInt(25000000000),
    });

    const summary = await fetchTxSummary(TX_HASH);
    expect(summary!.erc20Transfers).toHaveLength(10);
    expect(summary!.truncated).toBe(true);
    expect(summary!.logCount).toBe(12);
  });

  it("ignores non-Transfer logs gracefully", async () => {
    const nonTransferLog = {
      address: USDT,
      topics: ["0x1234567890abcdef00000000000000000000000000000000000000000000beef"],
      data: "0x",
      logIndex: 0,
      blockNumber: BigInt(0),
      blockHash: pad("0x00", { size: 32 }),
      transactionHash: pad("0x00", { size: 32 }),
      transactionIndex: 0,
      removed: false,
    };
    getTransactionReceipt.mockResolvedValue({
      status: "success",
      from: USER,
      to: SERVER,
      gasUsed: BigInt(50000),
      effectiveGasPrice: BigInt(25000000000),
      logs: [nonTransferLog],
    });
    getTransaction.mockResolvedValue({
      value: BigInt(0),
      gasPrice: BigInt(25000000000),
    });

    const summary = await fetchTxSummary(TX_HASH);
    expect(summary!.erc20Transfers).toEqual([]);
    expect(summary!.logCount).toBe(1);
  });
});

describe("enrichContext — tx path", () => {
  beforeEach(() => {
    getTransactionReceipt.mockReset();
    getTransaction.mockReset();
    getBytecode.mockReset();
    getSourceCode.mockReset();
    getTxList.mockReset();
    getTokenTxList.mockReset();
  });

  it("returns [] when no references are found", async () => {
    const blocks = await enrichContext("what is stablecoin?");
    expect(blocks).toEqual([]);
  });

  it("returns a tx block when the message contains a hash", async () => {
    getTransactionReceipt.mockResolvedValue({
      status: "success",
      from: USER,
      to: SERVER,
      gasUsed: BigInt(50000),
      effectiveGasPrice: BigInt(25000000000),
      logs: [
        buildTransferLog({
          token: USDT,
          from: USER,
          to: SERVER,
          rawValue: BigInt(20000),
        }),
      ],
    });
    getTransaction.mockResolvedValue({
      value: BigInt(0),
      gasPrice: BigInt(25000000000),
    });

    const blocks = await enrichContext(`explain ${TX_HASH}`);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].kind).toBe("tx");
    if (blocks[0].kind === "tx") {
      expect(blocks[0].hash).toBe(TX_HASH.toLowerCase());
      expect(blocks[0].data.erc20Transfers[0].tokenSymbol).toBe("USDT");
    }
  });

  it("skips failed fetches without throwing", async () => {
    getTransactionReceipt.mockRejectedValue(new Error("rpc down"));
    getTransaction.mockRejectedValue(new Error("rpc down"));

    const blocks = await enrichContext(`explain ${TX_HASH}`);
    expect(blocks).toEqual([]);
  });
});

describe("enrichContext — address path", () => {
  const CONTRACT: Address = "0x962BC4ad7671Db17d975AB42D4dA5110bC13b66a";

  beforeEach(() => {
    getTransactionReceipt.mockReset();
    getTransaction.mockReset();
    getBytecode.mockReset();
    getBlock.mockReset();
    readContract.mockReset();
    getSourceCode.mockReset();
    getTxList.mockReset();
    getTokenTxList.mockReset();
    getContractCreation.mockReset();
  });

  it("returns enriched contract block: verified, name, owner, age, power functions", async () => {
    getBytecode.mockResolvedValue("0x608060405234801561...");
    getSourceCode.mockResolvedValue([
      {
        SourceCode: "pragma solidity ^0.8.0; contract PromptReceipt {}",
        ABI: JSON.stringify([
          { type: "function", name: "logPrompt", stateMutability: "nonpayable" },
          { type: "function", name: "owner", stateMutability: "view", outputs: [{ type: "address" }] },
          { type: "function", name: "transferOwnership", stateMutability: "nonpayable" },
          { type: "function", name: "renounceOwnership", stateMutability: "nonpayable" },
        ]),
        ContractName: "PromptReceipt",
        CompilerVersion: "v0.8.28",
        OptimizationUsed: "1",
        Proxy: "0",
        Implementation: "",
      },
    ]);
    getContractCreation.mockResolvedValue([
      {
        contractAddress: CONTRACT.toLowerCase(),
        contractCreator: "0x4dba906e137c62E11c1428ea067b0DE0d65B9fb2",
        txHash: "0xcreationtx",
      },
    ]);
    getTransaction.mockResolvedValue({ blockNumber: BigInt(31000000) });
    getBlock.mockResolvedValue({ timestamp: BigInt(1713398400) }); // 2024-04-18
    readContract.mockResolvedValue("0x4dba906e137c62E11c1428ea067b0DE0d65B9fb2");

    const blocks = await enrichContext(`what is ${CONTRACT}?`);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].kind).toBe("contract");
    if (blocks[0].kind === "contract") {
      const d = blocks[0].data;
      expect(d.verified).toBe(true);
      expect(d.name).toBe("PromptReceipt");
      expect(d.compiler).toBe("v0.8.28");
      expect(d.creator).toBe("0x4dba906e137c62E11c1428ea067b0DE0d65B9fb2");
      expect(d.createdAt).toBe("2024-04-18T00:00:00.000Z");
      expect(typeof d.ageDays).toBe("number");
      expect(d.ageDays).toBeGreaterThan(0);
      expect(d.owner).toBe("0x4dba906e137c62E11c1428ea067b0DE0d65B9fb2");
      expect(d.powerFunctions).toEqual([
        "transferOwnership",
        "renounceOwnership",
      ]);
      expect(d.proxy).toBeUndefined();
    }
  });

  it("marks an unverified contract as verified: false and skips ABI parsing", async () => {
    getBytecode.mockResolvedValue("0x608060");
    getSourceCode.mockResolvedValue([
      {
        SourceCode: "",
        ABI: "Contract source code not verified",
        ContractName: "",
        CompilerVersion: "",
        OptimizationUsed: "",
        Proxy: "0",
        Implementation: "",
      },
    ]);
    getContractCreation.mockResolvedValue([]);
    readContract.mockRejectedValue(new Error("function not found"));

    const blocks = await enrichContext(`what is ${CONTRACT}?`);
    expect(blocks).toHaveLength(1);
    if (blocks[0].kind === "contract") {
      expect(blocks[0].data.verified).toBe(false);
      expect(blocks[0].data.name).toBeUndefined();
      expect(blocks[0].data.powerFunctions).toBeUndefined();
      expect(blocks[0].data.owner).toBeUndefined();
    }
  });

  it("flags upgradeable proxy and includes the implementation address", async () => {
    getBytecode.mockResolvedValue("0x608060");
    getSourceCode.mockResolvedValue([
      {
        SourceCode: "pragma solidity;",
        ABI: "[]",
        ContractName: "MyProxy",
        CompilerVersion: "v0.8.0",
        OptimizationUsed: "1",
        Proxy: "1",
        Implementation: "0x1234567890123456789012345678901234567890",
      },
    ]);
    getContractCreation.mockResolvedValue([]);
    readContract.mockRejectedValue(new Error());

    const blocks = await enrichContext(`what is ${CONTRACT}?`);
    if (blocks[0].kind === "contract") {
      expect(blocks[0].data.proxy).toEqual({
        isProxy: true,
        implementation: "0x1234567890123456789012345678901234567890",
      });
    }
  });

  it("returns an EOA block sorted by timestamp when address has no code", async () => {
    getBytecode.mockResolvedValue("0x");
    getTxList.mockResolvedValue([
      {
        hash: "0xaaa",
        blockNumber: "1",
        timeStamp: "1700000200", // newer
        from: USER,
        to: SERVER,
        value: "1000000000000000000", // 1 CELO
        gasPrice: "25000000000",
        gasUsed: "21000",
        isError: "0",
        methodId: "0x",
        functionName: "",
      },
    ]);
    getTokenTxList.mockResolvedValue([
      {
        hash: "0xbbb",
        blockNumber: "1",
        timeStamp: "1700000100", // older
        from: SERVER,
        to: USER,
        value: "20000", // 0.02 USDT
        contractAddress: USDT.toLowerCase(),
        tokenName: "Tether USD",
        tokenSymbol: "USDT",
        tokenDecimal: "6",
      },
    ]);

    const blocks = await enrichContext(`${USER}`);
    expect(blocks).toHaveLength(1);
    if (blocks[0].kind === "eoa") {
      expect(blocks[0].data.recentTxs).toHaveLength(2);
      // Newer (native 0xaaa) first
      expect(blocks[0].data.recentTxs[0].hash).toBe("0xaaa");
      expect(blocks[0].data.recentTxs[0].direction).toBe("out");
      expect(blocks[0].data.recentTxs[0].valueLabel).toBe("1 CELO");
      // Older (token 0xbbb) second
      expect(blocks[0].data.recentTxs[1].hash).toBe("0xbbb");
      expect(blocks[0].data.recentTxs[1].direction).toBe("in");
      expect(blocks[0].data.recentTxs[1].valueLabel).toBe("0.02 USDT");
    }
  });

  it("returns EOA block with empty recentTxs when address has no activity", async () => {
    getBytecode.mockResolvedValue("0x");
    getTxList.mockResolvedValue([]);
    getTokenTxList.mockResolvedValue([]);

    const blocks = await enrichContext(`${USER}`);
    expect(blocks).toHaveLength(1);
    if (blocks[0].kind === "eoa") {
      expect(blocks[0].data.recentTxs).toEqual([]);
      expect(blocks[0].data.totalRecent).toBe(0);
    }
  });

  it("returns a self block when wallet is connected and intent is my-history", async () => {
    getBytecode.mockResolvedValue("0x"); // not used; intent path skips classify
    getTxList.mockResolvedValue([]);
    getTokenTxList.mockResolvedValue([
      {
        hash: "0xccc",
        blockNumber: "2",
        timeStamp: "1700000300",
        from: SERVER,
        to: USER,
        value: "20000",
        contractAddress: USDT.toLowerCase(),
        tokenName: "Tether USD",
        tokenSymbol: "USDT",
        tokenDecimal: "6",
      },
    ]);

    const blocks = await enrichContext(
      "summarize my last transactions on Celo",
      USER,
    );
    expect(blocks).toHaveLength(1);
    expect(blocks[0].kind).toBe("self");
    if (blocks[0].kind === "self") {
      expect(blocks[0].address).toBe(USER);
      expect(blocks[0].data.recentTxs).toHaveLength(1);
      expect(blocks[0].data.recentTxs[0].valueLabel).toBe("0.02 USDT");
    }
  });

  it("does NOT add self block when no wallet is connected", async () => {
    const blocks = await enrichContext(
      "summarize my last transactions on Celo",
      undefined,
    );
    expect(blocks).toEqual([]);
  });

  it("caps the number of references it resolves per request to 3 per kind", async () => {
    // Five distinct addresses in the same message — only first 3 should
    // be looked up, protecting Etherscan rate limits and LLM context budget.
    const addrs = [
      "0x1111111111111111111111111111111111111111",
      "0x2222222222222222222222222222222222222222",
      "0x3333333333333333333333333333333333333333",
      "0x4444444444444444444444444444444444444444",
      "0x5555555555555555555555555555555555555555",
    ];
    getBytecode.mockResolvedValue("0x");
    getTxList.mockResolvedValue([]);
    getTokenTxList.mockResolvedValue([]);

    const blocks = await enrichContext(addrs.join(" "));
    expect(blocks).toHaveLength(3);
    expect(getBytecode).toHaveBeenCalledTimes(3);
  });

  it("returns multiple blocks when tx hash and address are in same message", async () => {
    // tx path
    getTransactionReceipt.mockResolvedValue({
      status: "success",
      from: USER,
      to: SERVER,
      gasUsed: BigInt(50000),
      effectiveGasPrice: BigInt(25000000000),
      logs: [],
    });
    getTransaction.mockResolvedValue({
      value: BigInt(0),
      gasPrice: BigInt(25000000000),
    });
    // contract path
    getBytecode.mockResolvedValue("0x608060");
    getSourceCode.mockResolvedValue([
      {
        SourceCode: "pragma solidity;",
        ABI: "[]",
        ContractName: "PromptReceipt",
        CompilerVersion: "v0.8.28",
        OptimizationUsed: "1",
        Proxy: "0",
        Implementation: "",
      },
    ]);

    const blocks = await enrichContext(
      `tx ${TX_HASH} and contract ${CONTRACT}`,
    );
    expect(blocks).toHaveLength(2);
    const kinds = blocks.map((b) => b.kind).sort();
    expect(kinds).toEqual(["contract", "tx"]);
  });
});
