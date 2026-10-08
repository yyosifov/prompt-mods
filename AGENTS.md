# Agent Instructions

Canonical entry point for Claude, Codex, Cursor, and any other coding agent working in this repo. `CLAUDE.md` points here; it is not a second copy.

## What this is

Claude Code mods, one folder per mod under `mods/<mod>/`, published through `.claude-plugin/marketplace.json`. Each mod is TypeScript loaded by the Claude Code engine: `hooks/register.ts(x)` exports `register`, `types/index.d.ts` holds its `$.state` contract, `tests/*.test.ts` covers its behaviour.

## Collaboration

- Act as a co-founder, not a yes-man: say when something doesn't make sense and propose a better approach.
- Explain your reasoning; ask questions when context is missing.

## Code style

Code should be self-documenting: readable, simple expressions over clever one-liners, and variables and intermediate results named so the intent is clear without a comment.

### Formatting

Biome enforces formatting and lint (`biome.json`, the same settings as the platform API). Run `bun run lint:fix` rather than formatting by hand.

- Semicolons at the end of every statement, and between members of object types: `{ id: number; text: string }`.
- Single quotes, two-space indentation, trailing commas in every multi-line literal, lines up to 150 characters.
- Always use braces for control flow, even for a one-line body. No `if (x) return;` on one line.

```typescript
// Bad
if (!entry) return;

// Good
if (!entry) {
  return;
}
```

### Naming

- Types and interfaces: PascalCase, no prefix (`Choice`, `StashAction`).
- Constants: UPPER_CASE (`MAX_ENTRIES`).
- Variables and functions: camelCase (`resolveModel`).
- Files: kebab-case (`stash-stack.test.ts`).

### Types

- Give every named function an explicit return type, `Promise<…>` for async ones. Inline callbacks can rely on inference.
- No non-null assertions (`value!`). Narrow with a check or use `??`.

### Async

- No `await` inside a ternary. Use a `let` and an explicit `if` block for the async path.
- No `return await`. Assign the awaited value to a named `const`, then return it.

```typescript
// Bad
const effort = isEffort(word) ? word : await pick($, word, 'effort');

// Good
let effort: string | null = word;

if (!isEffort(word)) {
  effort = await pick($, word, 'effort');
}
```

```typescript
// Bad
return await $.store.get(key);

// Good
const stack = await $.store.get(key);
return stack;
```

### Comments

- Never write a comment that restates what the code does.
- Comment only *why*, when the reason isn't obvious from the code.
- Never put a comment directly before an `if` statement.
- No bare separator lines (`// ====`) without a meaningful label.
- `// HACK: reason` marks a known workaround.

### Engine constraints

- Hooks take `($, e, next)` positionally, so an unused `$` stays (Biome's unused-parameter rule is off for this reason).
- Helpers that take `$` are top-level functions, not closures inside `register`; the engine's validator rejects the latter.
- A streaming hook such as `turn.step` is an `async function*` that ends with `return yield* next(...)`.
- Names the engine dictates keep its spelling: `register`, `interface PluginState` in `types/index.d.ts`.
- Get UI elements from `$.ui.resolve(e)` and check an element exists before using it (`Input` is missing on mobile).

## Errors and feedback

- Never swallow an error. When an operation fails, tell the person what failed and why, via `$.ui.log`, `$.ui.toast`, a `drop` reason or the command's `text`, with the concrete cause in the message.
- A mod does nothing until it is used: no always-on status lines, no unasked UI.

## Before committing

Run from the repo root (`bun install` once):

```sh
bun run lint
claude plugin validate mods/<mod>
claude plugin test mods/<mod>
claude plugin validate .
```

Type-check with `tsc -p <mod folder>` in a copy the engine has loaded. The generated types under `.claude-plugin/types/` are gitignored, so the check can't run from the repo itself.

## Git

- Commit messages say why, not what.
- Never add `Co-Authored-By` lines to commit messages.
- Never commit secrets or `.claude-plugin/types/`.
