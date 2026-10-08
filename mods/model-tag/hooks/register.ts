import type { EngineInterface, Register } from 'claude-code';

import { EFFORT_PICKER, type Effort, isEffort } from './efforts';
import { PICKER_OPTIONS, resolveModel, shortName } from './models';
import { closestName, parseTags } from './parse';

// What one tagged message asks for; a field left out keeps the session's.
type Choice = { model?: { name: string; id: string }; effort?: Effort };

async function pick($: EngineInterface, word: string, kind: 'model' | 'effort'): Promise<string | null> {
  const guess = closestName(word)?.name;
  const all = kind === 'model' ? PICKER_OPTIONS : EFFORT_PICKER;
  const options = guess !== undefined && all.includes(guess) ? [guess, ...all.filter((o) => o !== guess)] : all;
  try {
    const answer = await $.ui.ask(`No ${kind} called "${word}". Which one should this message use?`, {
      header: kind === 'model' ? 'Model' : 'Effort',
      options,
    });
    return answer.toLowerCase();
  } catch {
    return null;
  }
}

const label = (model: string, effort: string | number | undefined): string => (effort === undefined ? model : `${model} · ${effort}`);

export const register: Register = (on) => {
  const pending: Choice[] = [];
  const byTurn = new Map<string, Choice>();

  // A reload must not leave a line from an earlier load pinned.
  on('session.start', ($, e, next) => {
    $.ui.status(undefined);
    return next(e);
  });

  on('prompt.submit', async ($, e, next) => {
    const tags = parseTags(e.text);
    if (tags === null) {
      return next(e);
    }

    if (tags.text === '') {
      return { drop: 'A model or effort tag needs a message to go with it' };
    }

    const choice: Choice = {};
    if (tags.model !== undefined) {
      let name = tags.model;
      let id = resolveModel(name);
      if (id === null) {
        name = (await pick($, tags.model, 'model')) ?? '';
        id = resolveModel(name);
      }
      if (id === null) {
        return { drop: `No model called "${tags.model}"; the message was not sent` };
      }
      choice.model = { name, id };
    }
    if (tags.effort !== undefined) {
      let effort: string | null = tags.effort;

      if (!isEffort(effort)) {
        effort = await pick($, tags.effort, 'effort');
      }
      if (effort === null || !isEffort(effort)) {
        return { drop: `No effort called "${tags.effort}"; the message was not sent` };
      }
      choice.effort = effort;
    }

    if (e.turnId !== undefined) {
      // Delivered into the running turn: its remaining steps take the choice.
      byTurn.set(e.turnId, choice);
    } else {
      pending.push(choice);
    }

    const what = [choice.model && `${choice.model.name} (${choice.model.id})`, choice.effort && `${choice.effort} effort`];
    $.ui.log(`▸ This message runs on ${what.filter(Boolean).join(', ')}`);

    return next({ ...e, text: tags.text });
  });

  on('turn.start', ($, e, next) => {
    const choice = pending.shift();
    if (choice !== undefined) {
      byTurn.set(e.turnId, choice);
    }

    return next(e);
  });

  on('turn.step', async function* ($, e, next) {
    // Subagents keep the model they were given.
    const isSubagent = e.agentId !== undefined;
    if (isSubagent) {
      return yield* next(e);
    }

    const choice = byTurn.get(e.turnId);
    if (choice === undefined) {
      return yield* next(e);
    }

    const model = choice.model?.id ?? e.model;
    const effort = choice.effort ?? e.effort;
    $.ui.status(`▸ ${label(shortName(model), effort)} (this turn)`);

    return yield* next({ ...e, model, ...(effort === undefined ? {} : { effort }) });
  });

  on('turn.complete', ($, e, next) => {
    if (e.agentId === undefined && byTurn.delete(e.turnId)) {
      $.ui.status(undefined);
    }

    return next(e);
  });
};
