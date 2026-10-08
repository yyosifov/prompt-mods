export type StashAction =
  | { kind: 'list' }
  | { kind: 'pop'; index: number }
  | { kind: 'apply'; index: number }
  | { kind: 'drop'; index: number }
  | { kind: 'clear' }
  | { kind: 'help'; text: string }

const index = (raw: string | undefined): number => {
  const match = /^(?:stash@\{)?(\d+)\}?$/.exec(raw ?? '')
  return match === null ? 0 : Number(match[1])
}

export const parseArgs = (args: string): StashAction => {
  const [verb = 'list', arg] = args.trim().split(/\s+/)
  switch (verb.toLowerCase()) {
    case '':
    case 'list':
    case 'ls':
      return { kind: 'list' }
    case 'pop':
      return { kind: 'pop', index: index(arg) }
    case 'apply':
      return { kind: 'apply', index: index(arg) }
    case 'drop':
      return { kind: 'drop', index: index(arg) }
    case 'clear':
      return { kind: 'clear' }
    default:
      return { kind: 'help', text: verb }
  }
}
