export type Stashed = { text: string; at: number }

declare module 'claude-code' {
  interface PluginState {
    'stash-stack': {
      // Newest first, as git numbers stash@{0}.
      stack: Stashed[]
    }
  }
}
