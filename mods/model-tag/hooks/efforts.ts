export const EFFORTS = ['low', 'medium', 'high', 'xhigh', 'max'] as const;

export type Effort = (typeof EFFORTS)[number];

// AskUserQuestion takes four options; `xhigh` is still reachable under Other.
export const EFFORT_PICKER = ['low', 'medium', 'high', 'max'];

export const isEffort = (word: string): word is Effort => (EFFORTS as readonly string[]).includes(word);
