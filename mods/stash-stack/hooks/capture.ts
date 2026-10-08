// Drafts shorter than this are not worth keeping.
export const MIN_LENGTH = 15
export const MAX_ENTRIES = 50

const isWorthKeeping = (draft: string): boolean => draft.trim().length >= MIN_LENGTH

// The draft to keep when the box went from `before` to `after`: most of a
// worthwhile draft wiped in one go (Ctrl+U, select-all + delete, a cut).
export const wiped = (before: string, after: string): string | null =>
  isWorthKeeping(before) && after.trim().length <= before.trim().length * 0.2 ? before : null

// The draft to keep when the box no longer holds what it last held, with no
// edit of ours in between (Ctrl+S, Ctrl+C, a clear the editor did itself).
export const vanished = (last: string, now: string): string | null =>
  isWorthKeeping(last) && now !== last && !now.includes(last.trim()) ? last : null

export const push = <T extends { text: string }>(stack: readonly T[], entry: T): T[] =>
  stack[0]?.text === entry.text ? [...stack] : [entry, ...stack.filter(s => s.text !== entry.text)].slice(0, MAX_ENTRIES)
