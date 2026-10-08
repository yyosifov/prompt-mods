export type AskAction =
  | { kind: 'list' }
  | { kind: 'ask'; question: string }
  | { kind: 'open'; id: number }
  | { kind: 'follow'; id: number; question: string }
  | { kind: 'pull'; id: number }
  | { kind: 'drop'; id: number };

export const parseArgs = (args: string): AskAction => {
  const text = args.trim();
  if (text === '' || text === 'list' || text === 'ls') {
    return { kind: 'list' };
  }

  const verb = /^(pull|drop|rm|open)\s+#?(\d+)$/i.exec(text);
  if (verb !== null) {
    const id = Number(verb[2]);
    const name = (verb[1] ?? '').toLowerCase();
    if (name === 'pull') {
      return { kind: 'pull', id };
    }
    if (name === 'open') {
      return { kind: 'open', id };
    }

    return { kind: 'drop', id };
  }

  const numbered = /^#?(\d+)(?:\s+([\s\S]+))?$/.exec(text);
  if (numbered !== null) {
    const id = Number(numbered[1]);
    const question = numbered[2]?.trim();
    return question ? { kind: 'follow', id, question } : { kind: 'open', id };
  }

  return { kind: 'ask', question: text };
};
