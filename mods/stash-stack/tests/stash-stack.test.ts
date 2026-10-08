import { describe, expect, mock, test } from 'claude-code/testing';

import { parseArgs } from '../hooks/args';
import { push, stashRequest, vanished, wiped } from '../hooks/capture';

const DRAFT = 'refactor the auth middleware to use the new token cache';

describe('capture rules', () => {
  test('a message ending in /stash asks to stash the rest', () => {
    expect(stashRequest('hey i wonder /stash')).toBe('hey i wonder');
    expect(stashRequest('hey i wonder\n/stash  ')).toBe('hey i wonder');
    expect(stashRequest('it says: Stashed instead of sent · /stash pop brings it back')).toBe(null);
    expect(stashRequest('look at /stash/x')).toBe(null);
    expect(stashRequest('a/stash')).toBe(null);
  });

  test('a wiped draft is kept, a small edit is not', () => {
    expect(wiped(DRAFT, '')).toBe(DRAFT);
    expect(wiped(DRAFT, '/')).toBe(DRAFT);
    expect(wiped(DRAFT, DRAFT.slice(0, -5))).toBe(null);
    expect(wiped('short', '')).toBe(null);
  });

  test('a draft that vanished between edits is kept', () => {
    expect(vanished(DRAFT, '')).toBe(DRAFT);
    expect(vanished(DRAFT, DRAFT)).toBe(null);
    expect(vanished(DRAFT, `${DRAFT} more`)).toBe(null);
    expect(vanished('', 'x')).toBe(null);
  });

  test('the stack is newest first and keeps one copy of a draft', () => {
    const a = { text: 'a', at: 1 };
    const b = { text: 'b', at: 2 };
    expect(push([a], b)).toEqual([b, a]);
    expect(push([b, a], { text: 'a', at: 3 })).toEqual([{ text: 'a', at: 3 }, b]);
    expect(push([b, a], { text: 'b', at: 4 })).toEqual([b, a]);
  });
});

test('parseArgs reads git-like verbs', () => {
  expect(parseArgs('')).toEqual({ kind: 'list' });
  expect(parseArgs('pop')).toEqual({ kind: 'pop', index: 0 });
  expect(parseArgs('pop 2')).toEqual({ kind: 'pop', index: 2 });
  expect(parseArgs('apply stash@{1}')).toEqual({ kind: 'apply', index: 1 });
  expect(parseArgs('drop 3')).toEqual({ kind: 'drop', index: 3 });
  expect(parseArgs('clear')).toEqual({ kind: 'clear' });
});

const composer = { kind: 'composer' } as const;
const presentation = { layout: 'main', columns: 100 } as never;
const editor = { kind: 'composer' } as never;

// The engine raises prompt.edit as the editor does; the test kit's typings
// leave it off `$.prompt`, so it is reached through this.
type Edit = { origin: never; text: string; cursor: number; start: number; end: number; inputText: string };
const edit = ($: unknown, e: Edit): Promise<unknown> => ($ as { prompt: { edit: (e: Edit) => Promise<unknown> } }).prompt.edit(e);

test('wiping a draft stashes it and /stash pop puts it back', async ($, on) => {
  const clock = mock.clock(on);
  mock.store(on);
  let box = '';
  on('session.root', () => ({ value: '/repo' }));
  on('prompt.edit', ($, e) => {
    box = e.text.slice(0, e.start) + e.inputText + e.text.slice(e.end);
    return { text: box, cursor: e.start + e.inputText.length };
  });
  on('prompt.read', () => ({ value: { text: box, cursor: box.length } }));
  on('prompt.fill', ($, e) => {
    box = e.text;
    return { isFilled: true, text: box, cursor: box.length };
  });

  await edit($, { origin: editor, text: '', cursor: 0, start: 0, end: 0, inputText: DRAFT });
  await edit($, { origin: editor, text: DRAFT, cursor: DRAFT.length, start: 0, end: DRAFT.length, inputText: '' });
  expect(box).toBe('');

  const ran = await $.command.run({ command: 'stash', args: 'pop', origin: composer, presentation });
  await clock.settle();

  expect(ran.text).toContain('Popped stash@{0}');
  expect(box).toBe(DRAFT);
  const again = await $.command.run({ command: 'stash', args: 'pop', origin: composer, presentation });
  expect(again.text).toBe('The stash is empty.');
});

test('a sent draft is not stashed', async ($, on) => {
  mock.clock(on);
  mock.store(on);
  on('session.root', () => ({ value: '/repo' }));
  on('prompt.edit', ($, e) => ({ text: e.text.slice(0, e.start) + e.inputText + e.text.slice(e.end), cursor: 0 }));
  on('prompt.submit', ($, e) => ({ text: e.text }));

  await edit($, { origin: editor, text: '', cursor: 0, start: 0, end: 0, inputText: DRAFT });
  await $.prompt.submit({ text: DRAFT, wait: false, origin: composer });
  await edit($, { origin: editor, text: '', cursor: 0, start: 0, end: 0, inputText: 'n' });

  const ran = await $.command.run({ command: 'stash', args: 'pop', origin: composer, presentation });
  expect(ran.text).toBe('The stash is empty.');
});

test('a message ending in /stash is stashed, not sent', async ($, on) => {
  const clock = mock.clock(on);
  mock.store(on);
  let box = '';
  let sent = 0;
  on('session.root', () => ({ value: '/repo' }));
  on('prompt.submit', ($, e) => {
    sent += 1;
    return { text: e.text };
  });
  on('prompt.read', () => ({ value: { text: box, cursor: box.length } }));
  on('prompt.fill', ($, e) => {
    box = e.text;
    return { isFilled: true, text: box, cursor: box.length };
  });

  const result = await $.prompt.submit({ text: `${DRAFT} /stash`, wait: false, origin: composer });
  expect(result.drop).toBe('Stashed instead of sent · /stash pop brings it back');
  expect(sent).toBe(0);

  await $.command.run({ command: 'stash', args: 'pop', origin: composer, presentation });
  await clock.settle();
  expect(box).toBe(DRAFT);
});

test('the status line counts the stash and goes away when it is empty', async ($, on) => {
  const clock = mock.clock(on);
  mock.store(on);
  const statuses: (string | undefined)[] = [];
  on('session.root', () => ({ value: '/repo' }));
  on('ui.status', ($, e) => {
    statuses.push(e.text);
    return { value: undefined };
  });
  on('ui.toast', () => ({ value: undefined }));
  on('prompt.submit', ($, e) => ({ text: e.text }));
  on('prompt.read', () => ({ value: { text: '', cursor: 0 } }));
  on('prompt.fill', ($, e) => ({ isFilled: true, text: e.text, cursor: e.text.length }));

  await $.prompt.submit({ text: `${DRAFT} /stash`, wait: false, origin: composer });
  expect(statuses.at(-1)).toBe('stash: 1 · /stash');

  await $.command.run({ command: 'stash', args: 'pop', origin: composer, presentation });
  await clock.settle();
  expect(statuses.at(-1)).toBe(undefined);
});
