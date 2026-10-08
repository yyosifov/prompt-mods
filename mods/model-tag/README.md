# model-tag

Pick the model and effort for one message without leaving the prompt box.

```
explain this stack trace @haiku
@opus @max find the race condition
quick one @low
```

The tags are removed from the message, that turn runs on what they name (tool loops included), and the next message goes back to the session's settings. Subagents keep their own model.

No tags, no change: the mod does nothing until a message carries a tag. While a tagged turn runs, the status line shows what it runs on, like `▸ haiku · low (this turn)`.

## Tags

| Tag | Model |
| --- | --- |
| `@opus` | `claude-opus-5-5` |
| `@sonnet` | `claude-sonnet-5-5` |
| `@haiku` | `claude-haiku-4-5-20251001` |
| `@fable` | `claude-fable-5-1` |
| `@claude-…` | any full model id, as written |
| `::anything` | any model string, as written |

Add `[1m]` for the 1M context variant: `@opus[1m]`.

| Effort tag | |
| --- | --- |
| `@low` `@medium` `@high` `@xhigh` `@max` | reasoning effort for this message |

Model and effort tags combine: `@haiku @low`. A model that takes no effort setting ignores the effort tag.

- `@` only counts as a tag for model names and near misses, so `@src/app.ts` and `@agent-reviewer` stay normal mentions.
- A typo like `@hiaku` or `@hihg` opens a picker with the closest match first. Dismiss it and the message is not sent.
- A dim line in the transcript (`▸ This message runs on haiku (…), low effort`) and the status line confirm it.

## Install

```
/plugin install model-tag --marketplace yyosifov/prompt-mods
```

## Notes

- Short names map to full ids in [`hooks/models.ts`](hooks/models.ts): mods send the model string to the API as written. PRs welcome when new models ship.
- Want to switch the session's model without losing your draft? That's built in: `Option+P` (needs Option-as-Meta in your terminal), or `Ctrl+S` to stash the draft, run `/model`, and it comes back.
