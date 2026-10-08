import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Stashed } from '../types'
import { parseArgs } from './args'
import { push, vanished, wiped } from './capture'

const PANE = 'stash-stack'
const stack = atom({ plugin: 'stash-stack', key: 'stack' } as const, [])

// The stack is kept per project, across sessions, like git's.
const storeKey = async ($: EngineInterface) => `stack:${await $.session.root()}`

const save = async ($: EngineInterface, next: Stashed[]) => {
  await update($, stack, () => next)
  await $.store.set(await storeKey($), next)
}

const preview = (text: string, width: number): string => {
  const line = text.replace(/\s+/g, ' ').trim()
  return line.length > width ? `${line.slice(0, width - 1)}…` : line
}

// What the box held after the last edit we saw; a reload starts it over.
let last = ''

const keep = async ($: EngineInterface, text: string) => {
  const entry = { text, at: await $.clock.now() }
  await save($, push(await read($, stack), entry))
  $.ui.toast(`Stashed: ${preview(text, 40)} · /stash pop`)
}

// Puts an entry back in the box, after the command's own run has cleared it.
const restore = async ($: EngineInterface, index: number, isKept: boolean) => {
  const list = await read($, stack)
  const entry = list[index]
  if (entry === undefined) {
    return { text: list.length === 0 ? 'The stash is empty.' : `No stash@{${index}}; /stash lists ${list.length}.` }
  }

  $.clock.after(0, () => {
    void (async () => {
      const { text: draft } = await $.prompt.read()
      await $.prompt.fill({ text: entry.text, mode: draft.trim() === '' ? 'replace' : 'append' })
      last = entry.text
      if (!isKept) {
        await save($, (await read($, stack)).filter((_, i) => i !== index))
      }
    })()
  })

  return { text: `${isKept ? 'Applied' : 'Popped'} stash@{${index}}: ${preview(entry.text, 60)}` }
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'stash',
      description: 'Drafts you wiped without sending: list, pop, apply, drop',
      argumentHint: '[list | pop [N] | apply [N] | drop [N] | clear]',
    })
    const kept = await $.store.get(await storeKey($))
    if (Array.isArray(kept)) {
      await update($, stack, () => kept as Stashed[])
    }

    return next(e)
  })

  on('prompt.edit', async ($, e, next) => {
    const gone = vanished(last, e.text)
    const box = await next(e)
    const cleared = wiped(e.text, box.text)
    last = box.text

    const draft = cleared ?? gone
    if (draft !== null) {
      await keep($, draft)
    }

    return box
  })

  // A sent draft is not a lost one.
  on('prompt.submit', ($, e, next) => {
    last = ''
    return next(e)
  })

  on('command.run', { command: 'stash' }, async ($, e) => {
    const action = parseArgs(e.args)
    switch (action.kind) {
      case 'list':
        await $.ui.open({ id: PANE, title: 'stash', focus: true })
        return {}
      case 'pop':
        return restore($, action.index, false)
      case 'apply':
        return restore($, action.index, true)
      case 'drop': {
        const list = await read($, stack)
        if (list[action.index] === undefined) {
          return { text: `No stash@{${action.index}}.` }
        }
        await save($, list.filter((_, i) => i !== action.index))
        return { text: `Dropped stash@{${action.index}}.` }
      }
      case 'clear':
        await save($, [])
        return { text: 'Stash cleared.' }
      case 'help':
        return { text: `Unknown: ${action.text}. Use /stash [list | pop [N] | apply [N] | drop [N] | clear].` }
    }
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text, Button } = $.ui.resolve(e)
    const list = await read($, stack)
    const width = Math.max(20, (e.viewport?.columns ?? 80) - 30)

    return (
      <Box flexDirection="column">
        {list.length === 0 && <Text dimColor>Nothing stashed. Drafts you wipe without sending land here.</Text>}
        {list.map((entry, i) => (
          <Box key={`s${i}`}>
            <Text dimColor>{`stash@{${i}}  `}</Text>
            <Text>{preview(entry.text, width)}  </Text>
            <Button key={`pop${i}`} label="Pop" onPress={() => void restore($, i, false)} />
            <Text> </Text>
            <Button key={`drop${i}`} label="Drop" dimColor onPress={() => void save($, list.filter((_, j) => j !== i))} />
          </Box>
        ))}
      </Box>
    )
  })
}
