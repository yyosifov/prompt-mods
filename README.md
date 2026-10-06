# prompt-mods

Small, finished [Claude Code mods](https://github.com/anthropics/claude-code/tree/main/mods) for the prompt box.

| Mod | What it does |
| --- | --- |
| [model-tag](mods/model-tag) | Write `@haiku` in a message and that one turn runs on Haiku. No `/model`, no retyping. |

## Install

In a Claude Code terminal session:

```
/plugin install model-tag --marketplace yyosifov/prompt-mods
```

Answer `y` to add the marketplace, then pick a scope (user scope = every session). The mod is active right away.

## Develop

```sh
claude plugin validate mods/model-tag
claude plugin test mods/model-tag
claude --plugin-dir mods/model-tag   # run a session with your local copy
```

## License

MIT
