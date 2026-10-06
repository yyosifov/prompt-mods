import type { Exchange, Thread } from '../types'

const PREAMBLE =
  'This is a side question (/ask) asked while the main task continues. ' +
  'Answer it directly and briefly from what you already know of this conversation; ' +
  'it does not change the main task.'

const transcript = (exchanges: readonly Exchange[]): string =>
  exchanges
    .filter(x => x.answer !== null)
    .map(x => `Q: ${x.question}\nA: ${x.answer}`)
    .join('\n\n')

// The one message the fork answers: the thread so far, then the new question.
export const forkPrompt = (earlier: readonly Exchange[], question: string): string => {
  const before = transcript(earlier)

  return before === ''
    ? `${PREAMBLE}\n\n${question}`
    : `${PREAMBLE}\n\nThe side conversation so far:\n\n${before}\n\nFollow-up: ${question}`
}

// What the model reads beside the next prompt for a pulled thread.
export const pulledContext = (thread: Thread): string =>
  `The user pulled in side thread #${thread.id} (a /ask conversation you had alongside this one):\n\n${transcript(thread.exchanges)}`
