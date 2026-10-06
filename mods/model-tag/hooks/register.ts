import type { Register } from 'claude-code'

import { PICKER_OPTIONS, resolveModel } from './models'
import { closestName, parseTag } from './parse'

type Choice = { name: string; id: string }

export const register: Register = on => {
  // Models asked for by prompts whose turn has not started yet, oldest first.
  const pending: Choice[] = []
  // The model each tagged turn runs on, by turn id.
  const byTurn = new Map<string, Choice>()

  on('prompt.submit', async ($, e, next) => {
    const tagged = parseTag(e.text)
    if (tagged === null) {
      return next(e)
    }

    if (tagged.text === '') {
      return { drop: `@${tagged.model} needs a message to go with it` }
    }

    let name = tagged.model
    let id = resolveModel(name)
    if (id === null) {
      try {
        const guess = closestName(name)
        const options = guess === null ? PICKER_OPTIONS : [guess, ...PICKER_OPTIONS.filter(o => o !== guess)]
        name = (await $.ui.ask(`No model called "${name}". Which one should this message use?`, {
          header: 'Model',
          options,
        })).toLowerCase()
      } catch {
        return { drop: `No model called "${tagged.model}"; the message was not sent` }
      }
      id = resolveModel(name)
      if (id === null) {
        return { drop: `No model called "${name}"; the message was not sent` }
      }
    }

    const choice = { name, id }
    if (e.turnId !== undefined) {
      // Delivered into the running turn: its remaining steps take the model.
      byTurn.set(e.turnId, choice)
      $.ui.status(`▸ ${name} (this turn)`)
    } else {
      pending.push(choice)
    }

    $.ui.log(`▸ This message runs on ${name} (${id})`)

    return next({ ...e, text: tagged.text })
  })

  on('turn.start', ($, e, next) => {
    const choice = pending.shift()
    if (choice !== undefined) {
      byTurn.set(e.turnId, choice)
      $.ui.status(`▸ ${choice.name} (this turn)`)
    }

    return next(e)
  })

  on('turn.step', async function* ($, e, next) {
    const choice = byTurn.get(e.turnId)
    // Subagents keep the model they were given.
    if (choice === undefined || e.agentId !== undefined) {
      return yield* next(e)
    }

    return yield* next({ ...e, model: choice.id })
  })

  on('turn.complete', ($, e, next) => {
    if (e.agentId === undefined && byTurn.delete(e.turnId)) {
      $.ui.status(undefined)
    }

    return next(e)
  })
}
