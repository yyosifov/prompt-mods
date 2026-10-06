import { describe, expect, mock, test } from 'claude-code/testing'

import { parseArgs } from '../hooks/args'
import { forkPrompt } from '../hooks/prompts'

describe('parseArgs', () => {
  test('reads list, ask, open, follow-up, pull and drop', () => {
    expect(parseArgs('')).toEqual({ kind: 'list' })
    expect(parseArgs('list')).toEqual({ kind: 'list' })
    expect(parseArgs('why is the sky blue?')).toEqual({ kind: 'ask', question: 'why is the sky blue?' })
    expect(parseArgs('3')).toEqual({ kind: 'open', id: 3 })
    expect(parseArgs('#3 and at night?')).toEqual({ kind: 'follow', id: 3, question: 'and at night?' })
    expect(parseArgs('pull 2')).toEqual({ kind: 'pull', id: 2 })
    expect(parseArgs('drop #2')).toEqual({ kind: 'drop', id: 2 })
  })

  test('a question that starts with a verb is still a question', () => {
    expect(parseArgs('pull requests: how many are open?').kind).toBe('ask')
    expect(parseArgs('list the TODOs')).toEqual({ kind: 'ask', question: 'list the TODOs' })
  })
})

test('a follow-up carries the thread so far', () => {
  const prompt = forkPrompt([{ question: 'what is X?', answer: 'X is Y.' }], 'and Z?')
  expect(prompt).toContain('Q: what is X?\nA: X is Y.')
  expect(prompt).toContain('Follow-up: and Z?')
})

const composer = { kind: 'composer' } as const
const presentation = { layout: 'main', columns: 100 } as never

test('/ask asks the fork, files the answer, and opens the pane', async ($, on) => {
  const clock = mock.clock(on)
  const asked: string[] = []
  const opened: string[] = []
  on('model.fork', ($, e) => {
    asked.push(e.prompt)
    return { value: { isAnswered: true, text: 'Because of Rayleigh scattering.', usage: { input_tokens: 1, output_tokens: 1, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 } } }
  })
  on('ui.open', ($, e) => {
    opened.push(e.id)
    return { value: { isPlaced: true as const } }
  })

  const ran = await $.command.run({ command: 'ask', args: 'why is the sky blue?', origin: composer, presentation })
  await clock.settle()

  expect(ran.text).toBe(undefined)
  expect(opened).toEqual(['ask-threads'])
  expect(asked[0]).toContain('why is the sky blue?')
})

test('a pulled thread rides along with the next prompt', async ($, on) => {
  const clock = mock.clock(on)
  const contexts: (readonly string[] | undefined)[] = []
  on('model.fork', () => ({ value: { isAnswered: true, text: 'Blue.', usage: { input_tokens: 1, output_tokens: 1, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 } } }))
  on('ui.open', () => ({ value: { isPlaced: true as const } }))
  on('prompt.submit', ($, e) => {
    contexts.push(e.context)
    return { text: e.text }
  })

  await $.command.run({ command: 'ask', args: 'sky colour?', origin: composer, presentation })
  await clock.settle()
  await $.command.run({ command: 'ask', args: 'pull 1', origin: composer, presentation })
  await $.prompt.submit({ text: 'go on', wait: false, origin: composer })
  await $.prompt.submit({ text: 'and again', wait: false, origin: composer })

  expect(contexts[0]?.[0]).toContain('side thread #1')
  expect(contexts[1]).toBe(undefined)
})

test('an unknown thread number says so', async $ => {
  const ran = await $.command.run({ command: 'ask', args: '9 more?', origin: composer, presentation })
  expect(ran.text).toBe('No ask thread #9. /ask list shows them.')
})
