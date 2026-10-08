import { EFFORTS } from './efforts'
import { MODELS } from './models'

// A tag stands on its own, at the start of the text or after whitespace, so
// `Foo::bar()` and `me@opus.dev` are left alone.
//   `@haiku`, `@low`: model and effort names and near misses (`@hiaku`), so
//     `@src/app.ts` and `@agent-x` stay mentions
//   `::anything`: any model string, passed through as written
const AT_TAG = /(^|\s)@([a-z][\w.\-]*(?:\[1m\])?)(?=\s|$)/gi
const COLON_TAG = /(^|\s)::([a-z][\w.\-\[\]]*)(?=\s|$)/gi
const MODEL_NAMES = Object.keys(MODELS)
const MAX_TYPOS = 2
// Shorter words must match exactly: `@me` is too far from anything to guess.
const MIN_FUZZY_LENGTH = 4

export type Kind = 'model' | 'effort'

export type Tags = { model?: string; effort?: string; text: string }

const distance = (a: string, b: string): number => {
  let row = Array.from({ length: b.length + 1 }, (_, j) => j)
  for (let i = 1; i <= a.length; i++) {
    const next = [i]
    for (let j = 1; j <= b.length; j++) {
      next[j] = Math.min(
        (row[j] ?? 0) + 1,
        (next[j - 1] ?? 0) + 1,
        (row[j - 1] ?? 0) + (a[i - 1] === b[j - 1] ? 0 : 1),
      )
    }
    row = next
  }

  return row[b.length] ?? 0
}

// The known name a word is, or is a typo of, and which kind it names.
export const closestName = (word: string): { name: string; kind: Kind } | null => {
  const base = word.toLowerCase().replace(/\[1m\]$/, '')
  const limit = base.length >= MIN_FUZZY_LENGTH ? MAX_TYPOS : 0
  let best: { name: string; kind: Kind } | null = null
  let bestDistance = limit + 1
  const candidates: [string, Kind][] = [
    ...MODEL_NAMES.map((name): [string, Kind] => [name, 'model']),
    ...EFFORTS.map((name): [string, Kind] => [name, 'effort']),
  ]
  for (const [name, kind] of candidates) {
    const d = distance(base, name)
    if (d < bestDistance) {
      best = { name, kind }
      bestDistance = d
    }
  }

  return best
}

const kindOf = (word: string): Kind | null =>
  /^claude-/i.test(word) ? 'model' : (closestName(word)?.kind ?? null)

// Every model and effort tag in the text, the first of each kind winning, and
// the text with the tags taken out.
export const parseTags = (text: string): Tags | null => {
  const found: { start: number; end: number; kind: Kind; word: string }[] = []
  for (const match of text.matchAll(AT_TAG)) {
    const word = match[2] ?? ''
    const kind = kindOf(word)
    if (kind !== null) {
      const start = (match.index ?? 0) + (match[1] ?? '').length
      found.push({ start, end: start + word.length + 1, kind, word })
    }
  }
  for (const match of text.matchAll(COLON_TAG)) {
    const word = match[2] ?? ''
    const start = (match.index ?? 0) + (match[1] ?? '').length
    found.push({ start, end: start + word.length + 2, kind: 'model', word })
  }
  if (found.length === 0) {
    return null
  }

  let stripped = text
  for (const tag of [...found].sort((a, b) => b.start - a.start)) {
    stripped = `${stripped.slice(0, tag.start).trimEnd()} ${stripped.slice(tag.end).trimStart()}`
  }

  const first = (kind: Kind) => found.filter(t => t.kind === kind).sort((a, b) => a.start - b.start)[0]?.word.toLowerCase()
  const tags: Tags = { text: stripped.trim() }
  const model = first('model')
  const effort = first('effort')
  if (model !== undefined) tags.model = model
  if (effort !== undefined) tags.effort = effort

  return tags
}
