export type SuggestedPrompt = {
  id: string;
  text: string;
};

/** Space-aware starter questions for an empty assistant thread. */
export function buildSuggestedPrompts({
  hasBudgets,
  hasGoals,
  hasSubscriptions,
}: {
  hasBudgets: boolean;
  hasGoals: boolean;
  hasSubscriptions: boolean;
}): SuggestedPrompt[] {
  const prompts: SuggestedPrompt[] = [
    { id: 'month-summary', text: 'How did we do financially last month?' },
    { id: 'top-categories', text: 'Where did most of our money go last month?' },
    { id: 'cut-200', text: 'Where can we cut €200 a month?' },
  ];
  if (hasSubscriptions) {
    prompts.push({ id: 'subscriptions', text: 'Which subscriptions look unused?' });
  }
  if (hasBudgets) {
    prompts.push({ id: 'budgets', text: 'Which budgets are we over this month?' });
  }
  if (hasGoals) {
    prompts.push({ id: 'goals', text: 'How are our savings goals progressing?' });
  }
  return prompts.slice(0, 4);
}
