/**
 * Splits a piece of text (typically an LLM response) into a sequence of
 * plain-text spans and on-chain identifier matches (addresses + tx hashes)
 * so the UI can replace identifiers with copy-to-clipboard chips.
 *
 * Pure function with no client-only deps so it's testable in vitest and
 * importable from both server and client code.
 */

export type MessageToken =
  | { type: "text"; value: string }
  | { type: "address"; value: `0x${string}` }
  | { type: "hash"; value: `0x${string}` };

const HASH_REGEX = /\b0x[a-fA-F0-9]{64}\b/g;
const ADDRESS_REGEX = /\b0x[a-fA-F0-9]{40}\b/g;

type RawMatch = {
  start: number;
  end: number;
  type: "address" | "hash";
  value: string;
};

export function tokenizeMessage(text: string): MessageToken[] {
  if (!text) return [];

  const matches: RawMatch[] = [];

  for (const m of text.matchAll(HASH_REGEX)) {
    if (m.index === undefined) continue;
    matches.push({
      start: m.index,
      end: m.index + m[0].length,
      type: "hash",
      value: m[0],
    });
  }

  for (const m of text.matchAll(ADDRESS_REGEX)) {
    if (m.index === undefined) continue;
    // Defensive: word boundaries should already prevent overlap with a 64-hex
    // hash, but keep this check so a future regex tweak can't quietly break it.
    const inHash = matches.some(
      (h) =>
        h.type === "hash" &&
        m.index! >= h.start &&
        m.index! + m[0].length <= h.end,
    );
    if (inHash) continue;
    matches.push({
      start: m.index,
      end: m.index + m[0].length,
      type: "address",
      value: m[0],
    });
  }

  matches.sort((a, b) => a.start - b.start);

  const tokens: MessageToken[] = [];
  let cursor = 0;
  for (const match of matches) {
    if (match.start > cursor) {
      tokens.push({ type: "text", value: text.slice(cursor, match.start) });
    }
    tokens.push({
      type: match.type,
      value: match.value as `0x${string}`,
    });
    cursor = match.end;
  }
  if (cursor < text.length) {
    tokens.push({ type: "text", value: text.slice(cursor) });
  }
  return tokens;
}

/** Format an address or hash as `0x1234…abcd` for chip display. */
export function truncateHex(value: string, head = 6, tail = 4): string {
  if (value.length <= head + tail + 1) return value;
  return `${value.slice(0, head)}…${value.slice(-tail)}`;
}
