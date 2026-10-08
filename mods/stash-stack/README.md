# stash-stack

`git stash` for your prompt. Wipe a draft without sending it (Ctrl+U, select-all and delete, clearing the box) and it is kept on a stack. `/stash pop` puts it back.

```
/stash pop
```

Or end a message with `/stash` to stash it instead of sending it:

```
refactor the auth middleware to use the new token cache /stash
```

Only the last word counts, so a message that mentions `/stash` is sent as written.

A toast confirms each stash. Short drafts (under 15 characters) and drafts you send are not kept.

## Commands

| Command | Does |
| --- | --- |
| `/stash` or `/stash list` | Open the stack in a pane, with Pop and Drop per entry |
| `/stash pop [N]` | Put draft N (default 0, the newest) back in the prompt box and remove it from the stack |
| `/stash apply [N]` | Same, but keep it on the stack |
| `/stash drop [N]` | Delete draft N |
| `/stash clear` | Delete every stashed draft |

`N` can also be written `stash@{N}`.

## Install

```
/plugin install stash-stack --marketplace yyosifov/prompt-mods
```

## Settings

| Setting | Default | Does |
| --- | --- | --- |
| `showStatus` | on | Shows `stash: N · /stash` in the status line while the stash holds anything |

Change it from the plugin's config menu in `/plugin`.

## Notes

- Stashes are kept per project (git root) and survive restarts, in `~/.claude/plugins/store/`.
- The stack keeps the 50 newest drafts; stashing the same text twice keeps one copy.
