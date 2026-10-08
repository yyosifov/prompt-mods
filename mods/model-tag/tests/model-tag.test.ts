import type { On } from 'claude-code'
import { describe, expect, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'

import { resolveModel, shortName } from '../hooks/models'
import { closestName, parseTags } from '../hooks/parse'

describe('resolveModel', () => {
  test('maps short names to full ids and passes claude ids through', () => {
    expect(resolveModel('haiku')).toBe('claude-haiku-4-5-20251001')
    expect(resolveModel('opus[1m]')).toBe('claude-opus-5-5[1m]')
    expect(resolveModel('claude-sonnet-5-5')).toBe('claude-sonnet-5-5')
    expect(resolveModel('hiaku')).toBe(null)
  })

  test('shortName reads an id back as its name', () => {
    expect(shortName('claude-haiku-4-5-20251001')).toBe('haiku')
    expect(shortName('claude-opus-5-5[1m]')).toBe('opus[1m]')
    expect(shortName('claude-sonnet-4-5-20250929')).toBe('sonnet-4-5')
  })
})

describe('parseTags', () => {
  test('finds a model tag at the start, middle or end and strips it', () => {
    expect(parseTags('@haiku summarize this')).toEqual({ model: 'haiku', text: 'summarize this' })
    expect(parseTags('summarize @Opus this')).toEqual({ model: 'opus', text: 'summarize this' })
    expect(parseTags('fix it @claude-opus-5-5')).toEqual({ model: 'claude-opus-5-5', text: 'fix it' })
    expect(parseTags('summarize this\n::claude-sonnet-5-5')).toEqual({ model: 'claude-sonnet-5-5', text: 'summarize this' })
  })

  test('finds effort tags alone and next to a model tag', () => {
    expect(parseTags('@max find the race')).toEqual({ effort: 'max', text: 'find the race' })
    expect(parseTags('@haiku @low quick one')).toEqual({ model: 'haiku', effort: 'low', text: 'quick one' })
    expect(parseTags('tricky bug @opus @xhigh')).toEqual({ model: 'opus', effort: 'xhigh', text: 'tricky bug' })
  })

  test('takes near misses so the picker can catch them', () => {
    expect(parseTags('2+2 @hiaku')).toEqual({ model: 'hiaku', text: '2+2' })
    expect(parseTags('go @hihg')).toEqual({ effort: 'hihg', text: 'go' })
    expect(closestName('hiaku')).toEqual({ name: 'haiku', kind: 'model' })
    expect(closestName('meduim')).toEqual({ name: 'medium', kind: 'effort' })
    expect(closestName('package')).toBe(null)
  })

  test('leaves mentions, code and plain text alone', () => {
    expect(parseTags('read @src/app.ts')).toBe(null)
    expect(parseTags('ask @agent-reviewer')).toBe(null)
    expect(parseTags('mail me@opus.dev')).toBe(null)
    expect(parseTags('see @haiku.md')).toBe(null)
    expect(parseTags('see @README.md')).toBe(null)
    expect(parseTags('ping @me')).toBe(null)
    expect(parseTags('call Foo::bar() please')).toBe(null)
    expect(parseTags('no tag here')).toBe(null)
  })
})

const composer = { kind: 'composer' } as const
const usage = { input_tokens: 0, output_tokens: 0, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 }

type Step = { model: string; effort?: unknown }

// Stands in for the engine beneath the plugin: records each main request.
const engine = ($: Engine, on: On, steps: Step[]) => {
  on('prompt.submit', ($, e) => ({ text: e.text }))
  on('turn.start', ($, e) => ({ turnId: e.turnId }))
  on('turn.step', async function* ($, e) {
    steps.push({ model: e.model, effort: e.effort })
    return { turnId: e.turnId, index: e.index, answer: '', toolUses: [], stopReason: 'end_turn', usage: null }
  })
  on('turn.complete', () => ({ text: '' }))

  return async (turnId: string, agentId?: string) => {
    await $.turn.start({ turnId, text: '' })
    const step = { turnId, index: 0, model: 'claude-opus-5-5', effort: 'high' as const, messageCount: 1 }
    for await (const _ of $.turn.step(agentId === undefined ? step : { ...step, agentId })) {
    }
    await $.turn.complete({ turnId, answer: '', durationMs: 1, isAborted: false, reason: 'answer', usage: { ...usage, model: 'm' } } as never)
  }
}

test('a tagged prompt runs its turn on the tagged model and effort, the next one does not', async ($, on) => {
  const steps: Step[] = []
  const turn = engine($, on, steps)

  await $.prompt.submit({ text: 'explain @haiku @low this', wait: false, origin: composer })
  await turn('t1')
  await $.prompt.submit({ text: 'and now this', wait: false, origin: composer })
  await turn('t2')

  expect(steps).toEqual([
    { model: 'claude-haiku-4-5-20251001', effort: 'low' },
    { model: 'claude-opus-5-5', effort: 'high' },
  ])
})

test('an effort tag alone keeps the session model', async ($, on) => {
  const steps: Step[] = []
  const turn = engine($, on, steps)

  await $.prompt.submit({ text: '@max think hard', wait: false, origin: composer })
  await turn('t1')

  expect(steps).toEqual([{ model: 'claude-opus-5-5', effort: 'max' }])
})

test('a subagent inside a tagged turn keeps its own model', async ($, on) => {
  const steps: Step[] = []
  const turn = engine($, on, steps)

  await $.prompt.submit({ text: '@haiku go', wait: false, origin: composer })
  await turn('t1', 'a1')

  expect(steps).toEqual([{ model: 'claude-opus-5-5', effort: 'high' }])
})

test('an unknown model asks which one to use', async ($, on) => {
  const steps: Step[] = []
  const turn = engine($, on, steps)
  on('tool.call', { tool: 'AskUserQuestion' }, ($, e) => ({
    result: { questions: e.questions, answers: { 'No model called "hiaku". Which one should this message use?': 'sonnet' } },
  }))

  await $.prompt.submit({ text: 'hi @hiaku', wait: false, origin: composer })
  await turn('t1')

  expect(steps).toEqual([{ model: 'claude-sonnet-5-5', effort: 'high' }])
})

test('a dismissed picker keeps the message unsent', async ($, on) => {
  on('prompt.submit', ($, e) => ({ text: e.text }))
  on('tool.call', { tool: 'AskUserQuestion' }, () => ({ deny: 'dismissed' }))

  const result = await $.prompt.submit({ text: 'hi @hiaku', wait: false, origin: composer })

  expect(result.drop).toBe('No model called "hiaku"; the message was not sent')
})

test('a tag with no message is refused', async ($, on) => {
  on('prompt.submit', ($, e) => ({ text: e.text }))

  const result = await $.prompt.submit({ text: '  @haiku @low ', wait: false, origin: composer })

  expect(result.drop).toBe('A model or effort tag needs a message to go with it')
})
