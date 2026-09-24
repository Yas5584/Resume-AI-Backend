/**
 * Splits raw input text on commas and/or newlines, trims outer whitespace,
 * preserves internal spaces (e.g. "React Native", "Machine Learning") and
 * punctuation (e.g. "Node.js", "C++"), removes empty entries, and deduplicates
 * case-insensitively while preserving original casing.
 */
export function parseDelimitedValues(
  raw: string,
  existing: string[] = [],
): string[] {
  const seen = new Set(existing.map((v) => v.trim().toLowerCase()));
  const result: string[] = [];

  for (const part of raw.split(/[,\r\n]+/)) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const lower = trimmed.toLowerCase();
    if (!seen.has(lower)) {
      seen.add(lower);
      result.push(trimmed);
    }
  }

  return result;
}
