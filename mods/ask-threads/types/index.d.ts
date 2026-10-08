export type Exchange = { question: string; answer: string | null; error?: string };

export type Thread = { id: number; startedAt: number; exchanges: Exchange[] };

declare module 'claude-code' {
  interface PluginState {
    'ask-threads': {
      threads: Thread[];
      // The thread the pane shows; null shows the list.
      openId: number | null;
      // Threads whose next answer is on its way.
      busy: number[];
      // Threads to hand the model with the next prompt.
      pulled: number[];
    };
  }
}
