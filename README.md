# prompt-mods

Small, finished [Claude Code mods](https://github.com/anthropics/claude-code/tree/main/mods) for the prompt box.

| Mod | What it does |
| --- | --- |
| [model-tag](mods/model-tag) | Write `@haiku` or `@max` in a message and that one turn runs on that model or effort. No `/model`, no retyping. |
| [ask-threads](mods/ask-threads) | `/ask` side questions that you can list, reopen, continue, and send to the main conversation. |
| [stash-stack](mods/stash-stack) | `git stash` for your prompt: drafts you wipe without sending are kept; `/stash pop` brings them back. |

## Install

In a Claude Code terminal session:

```
/plugin install model-tag --marketplace yyosifov/prompt-mods
/plugin install ask-threads --marketplace yyosifov/prompt-mods
/plugin install stash-stack --marketplace yyosifov/prompt-mods
```

Answer `y` to add the marketplace, then pick a scope (user scope = every session). The mod is active right away.

## Develop

```sh
claude plugin validate mods/<mod>
claude plugin test mods/<mod>
claude --plugin-dir mods/<mod>   # run a session with your local copy
```

## License

MIT
