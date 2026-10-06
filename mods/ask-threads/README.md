# ask-threads

Side questions that don't vanish. Like `/btw`, but every question becomes a thread you can list, reopen, continue, and hand to the main conversation.

```
/ask why did we pick SQLite over Postgres here?
```

The answer opens in a pane. It is asked over the main conversation's context (its prompt cache, no tools) and stays out of the main transcript, so the main task is undisturbed. `/ask` runs right away, even while Claude is mid-turn.

## Commands

| Command | Does |
| --- | --- |
| `/ask <question>` | Ask a side question; starts thread #N |
| `/ask` or `/ask list` | List this session's threads |
| `/ask N` | Reopen thread #N |
| `/ask N <follow-up>` | Continue thread #N (or type in the pane's field) |
| `/ask pull N` | Send thread #N to Claude with your next message |
| `/ask drop N` | Delete thread #N |

In a thread, **Send to main chat** does the same as `/ask pull N`: the whole thread goes to Claude as hidden context with your next message, once. The status line confirms it until you send.

## Install

```
/plugin install ask-threads --marketplace yyosifov/prompt-mods
```

## Notes

- Threads last for the session.
- The answer sees the main conversation as of its last model request; text Claude is streaming at that moment is not included yet.
- Why not extend `/btw` itself? A mod can't reliably take over a built-in command that runs mid-turn, so `/ask` is its own command and `/btw` is left as it is.
