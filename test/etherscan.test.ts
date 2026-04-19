import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { etherscan, EtherscanError } from "@/lib/etherscan";

const ETHERSCAN_BASE = "https://api.etherscan.io/v2/api";
const ORIGINAL_KEY = process.env.ETHERSCAN_API_KEY;

function mockFetchResponse(body: unknown, ok = true, status = 200) {
  return {
    ok,
    status,
    json: async () => body,
  } as unknown as Response;
}

describe("etherscan wrapper", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    process.env.ETHERSCAN_API_KEY = "test-key";
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    if (ORIGINAL_KEY === undefined) {
      delete process.env.ETHERSCAN_API_KEY;
    } else {
      process.env.ETHERSCAN_API_KEY = ORIGINAL_KEY;
    }
  });

  it("sends chainid=42220 and the api key on every call", async () => {
    fetchMock.mockResolvedValue(
      mockFetchResponse({ status: "1", message: "OK", result: [] }),
    );

    await etherscan.getSourceCode(
      "0x962BC4ad7671Db17d975AB42D4dA5110bC13b66a",
    );

    expect(fetchMock).toHaveBeenCalledOnce();
    const url = fetchMock.mock.calls[0][0] as URL;
    expect(url.toString().startsWith(ETHERSCAN_BASE)).toBe(true);
    expect(url.searchParams.get("chainid")).toBe("42220");
    expect(url.searchParams.get("apikey")).toBe("test-key");
    expect(url.searchParams.get("module")).toBe("contract");
    expect(url.searchParams.get("action")).toBe("getsourcecode");
  });

  it("returns getSourceCode result for a verified contract", async () => {
    fetchMock.mockResolvedValue(
      mockFetchResponse({
        status: "1",
        message: "OK",
        result: [
          {
            SourceCode: "pragma solidity ^0.8.0; contract Foo {}",
            ABI: "[]",
            ContractName: "Foo",
            CompilerVersion: "v0.8.28",
            OptimizationUsed: "1",
            Proxy: "0",
            Implementation: "",
          },
        ],
      }),
    );

    const result = await etherscan.getSourceCode(
      "0x962BC4ad7671Db17d975AB42D4dA5110bC13b66a",
    );
    expect(result).toHaveLength(1);
    expect(result[0].ContractName).toBe("Foo");
  });

  it("returns empty SourceCode for an unverified contract", async () => {
    fetchMock.mockResolvedValue(
      mockFetchResponse({
        status: "1",
        message: "OK",
        result: [
          {
            SourceCode: "",
            ABI: "Contract source code not verified",
            ContractName: "",
            CompilerVersion: "",
            OptimizationUsed: "",
            Proxy: "0",
            Implementation: "",
          },
        ],
      }),
    );

    const result = await etherscan.getSourceCode(
      "0x0000000000000000000000000000000000000001",
    );
    expect(result[0].SourceCode).toBe("");
    expect(result[0].ContractName).toBe("");
  });

  it("returns [] for an EOA with no native txs (No transactions found)", async () => {
    fetchMock.mockResolvedValue(
      mockFetchResponse({
        status: "0",
        message: "No transactions found",
        result: [],
      }),
    );

    const result = await etherscan.getTxList(
      "0x0000000000000000000000000000000000000001",
    );
    expect(result).toEqual([]);
  });

  it("returns tx list items for an active address", async () => {
    fetchMock.mockResolvedValue(
      mockFetchResponse({
        status: "1",
        message: "OK",
        result: [
          {
            hash: "0xabc",
            blockNumber: "1",
            timeStamp: "1700000000",
            from: "0xsender",
            to: "0xrecipient",
            value: "1000000000000000000", // 1 CELO in wei
            gasPrice: "25000000000",
            gasUsed: "21000",
            isError: "0",
            methodId: "0x",
            functionName: "",
          },
        ],
      }),
    );

    const result = await etherscan.getTxList(
      "0xe6319a868bdB273118d2A8d63E82Cc405f9cF4c2",
    );
    expect(result).toHaveLength(1);
    expect(result[0].hash).toBe("0xabc");
  });

  it("throws EtherscanError on a non-empty API error response", async () => {
    fetchMock.mockResolvedValue(
      mockFetchResponse({
        status: "0",
        message: "NOTOK",
        result: "Invalid address format",
      }),
    );

    await expect(
      etherscan.getSourceCode("0xnotanaddress" as `0x${string}`),
    ).rejects.toBeInstanceOf(EtherscanError);
  });

  it("throws EtherscanError when HTTP status is not OK", async () => {
    fetchMock.mockResolvedValue(
      mockFetchResponse({ status: "1", message: "OK", result: [] }, false, 503),
    );

    await expect(
      etherscan.getSourceCode("0x962BC4ad7671Db17d975AB42D4dA5110bC13b66a"),
    ).rejects.toBeInstanceOf(EtherscanError);
  });

  it("throws EtherscanError with code=no_key when the api key is missing", async () => {
    delete process.env.ETHERSCAN_API_KEY;
    await expect(
      etherscan.getSourceCode("0x962BC4ad7671Db17d975AB42D4dA5110bC13b66a"),
    ).rejects.toMatchObject({ code: "no_key" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
