import { describe, expect, test } from 'claude-code/testing'

import { resolveModel } from '../hooks/models'
import { closestName, parseTag } from '../hooks/parse'

describe('resolveModel', () => {
  test('maps short names to full ids and passes claude ids through', () => {
    expect(resolveModel('haiku')).toBe('claude-haiku-4-5-20251001')
    expect(resolveModel('opus[1m]')).toBe('claude-opus-5-5[1m]')
    expect(resolveModel('claude-sonnet-5-5')).toBe('claude-sonnet-5-5')
    expect(resolveModel('hiaku')).toBe(null)
  })
})

describe('parseTag', () => {
  test('finds a tag at the start, middle or end and strips it', () => {
    expect(parseTag('::haiku summarize this')).toEqual({ model: 'haiku', text: 'summarize this' })
    expect(parseTag('summarize ::Opus this')).toEqual({ model: 'opus', text: 'summarize this' })
    expect(parseTag('summarize this\n::claude-sonnet-5-5')).toEqual({
      model: 'claude-sonnet-5-5',
      text: 'summarize this',
    })
  })

  test('takes @ for model names only', () => {
    expect(parseTag('@haiku summarize this')).toEqual({ model: 'haiku', text: 'summarize this' })
    expect(parseTag('fix it @claude-opus-5-5')).toEqual({ model: 'claude-opus-5-5', text: 'fix it' })
    expect(parseTag('read @src/app.ts')).toBe(null)
    expect(parseTag('ask @agent-reviewer')).toBe(null)
    expect(parseTag('mail me@opus.dev')).toBe(null)
    expect(parseTag('see @haiku.md')).toBe(null)
    expect(parseTag('see @README.md')).toBe(null)
  })

  test('takes @ for near misses of a model name, so the picker can catch them', () => {
    expect(parseTag('2+2 @hiaku')).toEqual({ model: 'hiaku', text: '2+2' })
    expect(parseTag('@sonet go')).toEqual({ model: 'sonet', text: 'go' })
    expect(closestName('hiaku')).toBe('haiku')
    expect(closestName('package')).toBe(null)
  })

  test('leaves text without a standalone tag alone', () => {
    expect(parseTag('call Foo::bar() please')).toBe(null)
    expect(parseTag('no tag here')).toBe(null)
    expect(parseTag(':: haiku')).toBe(null)
  })
})

const composer = { kind: 'composer' } as const

test('a tagged prompt runs its turn on the tagged model, the next one does not', async ($, on) => {
  const sent: string[] = []
  const models: string[] = []

  on('prompt.submit', ($, e) => {
    sent.push(e.text)
    return { text: e.text }
  })
  on('turn.start', ($, e) => ({ turnId: e.turnId }))
  on('turn.step', async function* ($, e) {
    models.push(e.model)
    return { turnId: e.turnId, index: e.index, answer: '', toolUses: [], stopReason: 'end_turn', usage: null }
  })
  on('turn.complete', () => ({ text: '' }))

  const step = async (turnId: string) => {
    await $.turn.start({ turnId, text: '' })
    const stream = $.turn.step({ turnId, index: 0, model: 'session-model', messageCount: 1 })
    for await (const _ of stream) {
      // drain
    }
    await $.turn.complete({ turnId, answer: '', durationMs: 1, isAborted: false, reason: 'answer' })
  }

  await $.prompt.submit({ text: 'explain @haiku this', wait: false, origin: composer })
  await step('t1')
  await $.prompt.submit({ text: 'and now this', wait: false, origin: composer })
  await step('t2')

  expect(sent).toEqual(['explain this', 'and now this'])
  expect(models).toEqual(['claude-haiku-4-5-20251001', 'session-model'])
})

test('a subagent inside a tagged turn keeps its own model', async ($, on) => {
  const models: string[] = []
  on('prompt.submit', ($, e) => ({ text: e.text }))
  on('turn.start', ($, e) => ({ turnId: e.turnId }))
  on('turn.step', async function* ($, e) {
    models.push(e.model)
    return { turnId: e.turnId, index: e.index, answer: '', toolUses: [], stopReason: 'end_turn', usage: null }
  })

  await $.prompt.submit({ text: '::opus go', wait: false, origin: composer })
  await $.turn.start({ turnId: 't1', text: '' })
  for await (const _ of $.turn.step({ turnId: 't1', index: 0, model: 'm', messageCount: 1, agentId: 'a1' })) {
  }

  expect(models).toEqual(['m'])
})

test('a tag with no message is refused', async ($, on) => {
  on('prompt.submit', ($, e) => ({ text: e.text }))

  const result = await $.prompt.submit({ text: '  ::haiku  ', wait: false, origin: composer })

  expect(result.drop).toBe('@haiku needs a message to go with it')
})

test('an unknown model asks which one to use', async ($, on) => {
  const models: string[] = []
  on('prompt.submit', ($, e) => ({ text: e.text }))
  on('turn.start', ($, e) => ({ turnId: e.turnId }))
  on('turn.step', async function* ($, e) {
    models.push(e.model)
    return { turnId: e.turnId, index: e.index, answer: '', toolUses: [], stopReason: 'end_turn', usage: null }
  })
  on('tool.call', { tool: 'AskUserQuestion' }, ($, e) => ({
    result: {
      questions: e.questions,
      answers: { 'No model called "hiaku". Which one should this message use?': 'sonnet' },
    },
  }))

  await $.prompt.submit({ text: 'hi @hiaku', wait: false, origin: composer })
  await $.turn.start({ turnId: 't1', text: '' })
  for await (const _ of $.turn.step({ turnId: 't1', index: 0, model: 'm', messageCount: 1 })) {
  }

  expect(models).toEqual(['claude-sonnet-5-5'])
})

test('a dismissed picker keeps the message unsent', async ($, on) => {
  on('prompt.submit', ($, e) => ({ text: e.text }))
  on('tool.call', { tool: 'AskUserQuestion' }, () => ({ deny: 'dismissed' }))

  const result = await $.prompt.submit({ text: 'hi @hiaku', wait: false, origin: composer })

  expect(result.drop).toBe('No model called "hiaku"; the message was not sent')
})
