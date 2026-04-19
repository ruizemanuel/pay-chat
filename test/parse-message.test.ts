import { describe, expect, it } from "vitest";

import { tokenizeMessage, truncateHex } from "@/lib/parse-message";

const ADDR = "0x962BC4ad7671Db17d975AB42D4dA5110bC13b66a";
const HASH =
  "0x0e5a734d0fb60b0996898b1f8a6affa20a35186c3146758a39be9fefdcd20a28";

describe("tokenizeMessage", () => {
  it("returns [] for empty input", () => {
    expect(tokenizeMessage("")).toEqual([]);
  });

  it("returns a single text token when there are no matches", () => {
    const tokens = tokenizeMessage("Hello world, no addresses here.");
    expect(tokens).toEqual([
      { type: "text", value: "Hello world, no addresses here." },
    ]);
  });

  it("splits text around a single address", () => {
    const tokens = tokenizeMessage(`Owner is ${ADDR} today.`);
    expect(tokens).toEqual([
      { type: "text", value: "Owner is " },
      { type: "address", value: ADDR },
      { type: "text", value: " today." },
    ]);
  });

  it("splits text around a single tx hash", () => {
    const tokens = tokenizeMessage(`See tx ${HASH}.`);
    expect(tokens).toEqual([
      { type: "text", value: "See tx " },
      { type: "hash", value: HASH },
      { type: "text", value: "." },
    ]);
  });

  it("handles a mix of address and hash in the same message", () => {
    const text = `Tx ${HASH} was sent to ${ADDR}.`;
    const tokens = tokenizeMessage(text);
    expect(tokens).toHaveLength(5);
    expect(tokens[0]).toEqual({ type: "text", value: "Tx " });
    expect(tokens[1]).toEqual({ type: "hash", value: HASH });
    expect(tokens[2]).toEqual({ type: "text", value: " was sent to " });
    expect(tokens[3]).toEqual({ type: "address", value: ADDR });
    expect(tokens[4]).toEqual({ type: "text", value: "." });
  });

  it("does NOT match a 40-char address hidden inside a 64-char hash", () => {
    // The hash above contains many 40-hex substrings — none should be
    // emitted as an address token because of word boundaries.
    const tokens = tokenizeMessage(HASH);
    expect(tokens).toHaveLength(1);
    expect(tokens[0]).toEqual({ type: "hash", value: HASH });
  });

  it("emits multiple addresses in order", () => {
    const a2 = "0x4dba906e137c62E11c1428ea067b0DE0d65B9fb2";
    const tokens = tokenizeMessage(`From ${ADDR} to ${a2}.`);
    expect(tokens.map((t) => t.type)).toEqual([
      "text",
      "address",
      "text",
      "address",
      "text",
    ]);
    expect((tokens[1] as { value: string }).value).toBe(ADDR);
    expect((tokens[3] as { value: string }).value).toBe(a2);
  });

  it("preserves leading and trailing whitespace", () => {
    const tokens = tokenizeMessage(`  ${ADDR}  `);
    expect(tokens).toHaveLength(3);
    expect(tokens[0]).toEqual({ type: "text", value: "  " });
    expect(tokens[2]).toEqual({ type: "text", value: "  " });
  });
});

describe("truncateHex", () => {
  it("truncates a 42-char address to 0x1234…abcd", () => {
    expect(truncateHex(ADDR)).toBe("0x962B…b66a");
  });

  it("truncates a 66-char hash with default head/tail", () => {
    expect(truncateHex(HASH)).toBe("0x0e5a…0a28");
  });

  it("returns short input unchanged", () => {
    expect(truncateHex("0xabcd")).toBe("0xabcd");
  });

  it("respects custom head/tail", () => {
    expect(truncateHex(ADDR, 4, 6)).toBe("0x96…13b66a");
  });
});
