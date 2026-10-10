export type MentionQuery = { symbol: '@' | '#'; query: string; start: number; end: number };
export type MentionOption = { id: number; label: string; detail: string; selected: boolean; disabled: boolean };

/** Only trigger at a word boundary, so email addresses and embedded hashes remain ordinary text. */
export function mentionAt(value: string, caret: number): MentionQuery | null {
  const match = value.slice(0, caret).match(/(?:^|[\s(])([@#])([^\s@#]*)$/u);
  if (!match) return null;
  return { symbol: match[1] as '@' | '#', query: match[2], start: caret - match[2].length - 1, end: caret };
}
