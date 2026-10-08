export const MIN_LENGTH = 15;
export const MAX_ENTRIES = 50;

// Only as the last word: a message that mentions the command, or quotes the mod's own
// notice, is sent as written.
const STASH_SUFFIX = /(^|\s)\/stash\s*$/;

export const stashRequest = (text: string): string | null => {
  const isRequest = STASH_SUFFIX.test(text);
  if (!isRequest) {
    return null;
  }

  const draft = text.replace(STASH_SUFFIX, '').trim();
  return draft === '' ? null : draft;
};

const isWorthKeeping = (draft: string): boolean => draft.trim().length >= MIN_LENGTH;

// The draft to keep when the box went from `before` to `after`: most of a
// worthwhile draft wiped in one go (Ctrl+U, select-all + delete, a cut).
export const wiped = (before: string, after: string): string | null =>
  isWorthKeeping(before) && after.trim().length <= before.trim().length * 0.2 ? before : null;

// The draft to keep when the box no longer holds what it last held, with no
// edit of ours in between (Ctrl+S, Ctrl+C, a clear the editor did itself).
export const vanished = (last: string, now: string): string | null =>
  isWorthKeeping(last) && now !== last && !now.includes(last.trim()) ? last : null;

export const push = <T extends { text: string }>(stack: readonly T[], entry: T): T[] => {
  const isAlreadyNewest = stack[0]?.text === entry.text;
  if (isAlreadyNewest) {
    return [...stack];
  }

  const others = stack.filter((s) => s.text !== entry.text);
  return [entry, ...others].slice(0, MAX_ENTRIES);
};
