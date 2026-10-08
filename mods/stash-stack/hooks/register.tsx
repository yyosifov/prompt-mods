import type { EngineInterface, Register } from 'claude-code';
import { atom, read, update } from 'claude-code';

import type { Stashed } from '../types';
import { parseArgs } from './args';
import { push, stashRequest, vanished, wiped } from './capture';

const PANE = 'stash-stack';
const stack = atom({ plugin: 'stash-stack', key: 'stack' } as const, []);

// The stack is kept per project, across sessions, like git's.
const storeKey = async ($: EngineInterface): Promise<string> => {
  const root = await $.session.root();
  return `stack:${root}`;
};

// Set from the `showStatus` option each time the module loads.
let isStatusShown = true;

const showCount = ($: EngineInterface, count: number): void => {
  const isVisible = isStatusShown && count > 0;
  $.ui.status(isVisible ? `stash: ${count} · /stash` : undefined);
};

const save = async ($: EngineInterface, next: Stashed[]): Promise<void> => {
  await update($, stack, () => next);
  showCount($, next.length);
  const key = await storeKey($);
  await $.store.set(key, next);
};

const drop = async ($: EngineInterface, index: number): Promise<void> => {
  const list = await read($, stack);
  await save(
    $,
    list.filter((_, i) => i !== index),
  );
};

const preview = (text: string, width: number): string => {
  const line = text.replace(/\s+/g, ' ').trim();
  return line.length > width ? `${line.slice(0, width - 1)}…` : line;
};

// What the box held after the last edit we saw; a reload starts it over.
let last = '';

const keep = async ($: EngineInterface, text: string): Promise<void> => {
  const at = await $.clock.now();
  const list = await read($, stack);
  await save($, push(list, { text, at }));
  $.ui.toast(`Stashed: ${preview(text, 40)} · /stash pop`);
};

const fill = async ($: EngineInterface, entry: Stashed, index: number, isKept: boolean): Promise<void> => {
  const { text: draft } = await $.prompt.read();
  await $.prompt.fill({ text: entry.text, mode: draft.trim() === '' ? 'replace' : 'append' });
  last = entry.text;
  if (!isKept) {
    await drop($, index);
  }
};

const restore = async ($: EngineInterface, index: number, isKept: boolean): Promise<{ text: string }> => {
  const list = await read($, stack);
  const entry = list[index];
  if (entry === undefined) {
    const isEmpty = list.length === 0;
    if (isEmpty) {
      return { text: 'The stash is empty.' };
    }

    return { text: `No stash@{${index}}; /stash lists ${list.length}.` };
  }

  // The command's own run clears the box when it ends, so the fill waits for that.
  $.clock.after(0, () => void fill($, entry, index, isKept));

  return { text: `${isKept ? 'Applied' : 'Popped'} stash@{${index}}: ${preview(entry.text, 60)}` };
};

export const register: Register = (on, options) => {
  isStatusShown = options.showStatus !== false;

  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'stash',
      description: 'Drafts you wiped without sending: list, pop, apply, drop',
      argumentHint: '[list | pop [N] | apply [N] | drop [N] | clear]',
    });
    const key = await storeKey($);
    const kept = await $.store.get(key);
    const list = Array.isArray(kept) ? (kept as Stashed[]) : [];
    await update($, stack, () => list);
    // Also takes down a line a reload or an earlier version left behind.
    showCount($, list.length);

    return next(e);
  });

  on('prompt.edit', async ($, e, next) => {
    const gone = vanished(last, e.text);
    const box = await next(e);
    const cleared = wiped(e.text, box.text);
    last = box.text;

    const draft = cleared ?? gone;
    if (draft !== null) {
      await keep($, draft);
    }

    return box;
  });

  // A sent draft is not a lost one.
  on('prompt.submit', async ($, e, next) => {
    last = '';
    const draft = stashRequest(e.text);
    if (draft === null) {
      return next(e);
    }

    await keep($, draft);
    return { drop: 'Stashed instead of sent · /stash pop brings it back' };
  });

  on('command.run', { command: 'stash' }, async ($, e) => {
    const action = parseArgs(e.args);
    switch (action.kind) {
      case 'list':
        await $.ui.open({ id: PANE, title: 'stash', focus: true });
        return {};
      case 'pop':
        return restore($, action.index, false);
      case 'apply':
        return restore($, action.index, true);
      case 'drop': {
        const list = await read($, stack);
        if (list[action.index] === undefined) {
          return { text: `No stash@{${action.index}}.` };
        }
        await drop($, action.index);
        return { text: `Dropped stash@{${action.index}}.` };
      }
      case 'clear':
        await save($, []);
        return { text: 'Stash cleared.' };
      case 'help':
        return { text: `Unknown: ${action.text}. Use /stash [list | pop [N] | apply [N] | drop [N] | clear].` };
    }
  });

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text, Button } = $.ui.resolve(e);
    const list = await read($, stack);
    const width = Math.max(20, (e.viewport?.columns ?? 80) - 30);

    return (
      <Box flexDirection="column">
        {list.length === 0 && <Text dimColor>Nothing stashed. Drafts you wipe without sending land here.</Text>}
        {list.map((entry, i) => (
          <Box key={`s${i}`}>
            <Text dimColor>{`stash@{${i}}  `}</Text>
            <Text>{preview(entry.text, width)} </Text>
            <Button key={`pop${i}`} label="Pop" onPress={() => void restore($, i, false)} />
            <Text> </Text>
            <Button key={`drop${i}`} label="Drop" dimColor onPress={() => void drop($, i)} />
          </Box>
        ))}
      </Box>
    );
  });
};
