/**
 * Normalize inbound text for matching:
 * - lowercase
 * - trim
 * - strip punctuation (keep word chars and spaces)
 * - collapse multiple spaces
 */
export function normalize(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}
