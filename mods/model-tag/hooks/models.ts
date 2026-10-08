// `turn.step` sends the model string to the API as written, so short names
// are mapped to full ids here. Update when new models ship.
export const MODELS: Readonly<Record<string, string>> = {
  opus: 'claude-opus-5-5',
  sonnet: 'claude-sonnet-5-5',
  haiku: 'claude-haiku-5-5',
  fable: 'claude-fable-5-1',
};

export const PICKER_OPTIONS = Object.keys(MODELS);

const LONG_CONTEXT = '[1m]';

export const resolveModel = (name: string): string | null => {
  const isLong = name.endsWith(LONG_CONTEXT);
  const base = isLong ? name.slice(0, -LONG_CONTEXT.length) : name;
  const id = MODELS[base] ?? (base.startsWith('claude-') ? base : null);

  return id === null ? null : id + (isLong ? LONG_CONTEXT : '');
};

export const shortName = (id: string): string => {
  const isLong = id.endsWith(LONG_CONTEXT);
  const base = isLong ? id.slice(0, -LONG_CONTEXT.length) : id;
  const known = Object.entries(MODELS).find(([, full]) => full === base)?.[0];
  const name = known ?? base.replace(/^claude-/, '').replace(/-\d{8}$/, '');

  return name + (isLong ? LONG_CONTEXT : '');
};
