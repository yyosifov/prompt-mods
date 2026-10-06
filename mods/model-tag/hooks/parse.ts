import { MODELS } from './models'

// A tag stands on its own, at the start of the text or after whitespace, so
// `Foo::bar()` and `me@opus.dev` are left alone.
//   `@haiku`: model names and near misses (`@hiaku`), so `@src/app.ts` and
//     `@agent-x` stay mentions
//   `::anything`: any model string, passed through as written
const AT_TAG = /(^|\s)@([a-z][\w.\-]*(?:\[1m\])?)(?=\s|$)/gi
const COLON_TAG = /(^|\s)::([a-z][\w.\-\[\]]*)(?=\s|$)/i
const NAMES = Object.keys(MODELS)
const MAX_TYPOS = 2

export type Tagged = { model: string; text: string }

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

// The known name a word is, or is a typo of; null for anything else.
export const closestName = (word: string): string | null => {
  const base = word.toLowerCase().replace(/\[1m\]$/, '')
  let best: string | null = null
  let bestDistance = MAX_TYPOS + 1
  for (const name of NAMES) {
    const d = distance(base, name)
    if (d < bestDistance) {
      best = name
      bestDistance = d
    }
  }

  return best
}

const isModelWord = (word: string): boolean =>
  /^claude-/i.test(word) || closestName(word) !== null

const strip = (text: string, match: RegExpExecArray): Tagged => {
  const [whole, lead = '', model = ''] = match
  const before = text.slice(0, match.index + lead.length)
  const after = text.slice(match.index + whole.length)
  const stripped = (before.trimEnd() + ' ' + after.trimStart()).trim()

  return { model: model.toLowerCase(), text: stripped }
}

export const parseTag = (text: string): Tagged | null => {
  for (const match of text.matchAll(AT_TAG)) {
    if (isModelWord(match[2] ?? '')) {
      return strip(text, match as RegExpExecArray)
    }
  }

  const colon = COLON_TAG.exec(text)

  return colon === null ? null : strip(text, colon)
}
