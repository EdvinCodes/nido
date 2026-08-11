export type CategoryDelta = {
  id: string | null;
  name: string;
  color: string;
  currentMinor: number;
  previousMinor: number;
  changeMinor: number;
};

export type CompareSummary = {
  incomeDelta: number;
  expenseDelta: number;
  netDelta: number;
  categories: CategoryDelta[];
  driverSentence: string;
};

export function buildCategoryDeltas(
  current: Array<{ id: string | null; name: string; color: string; totalMinor: number }>,
  previous: Array<{ id: string | null; totalMinor: number }>,
): CategoryDelta[] {
  const prevMap = new Map(previous.map((p) => [p.id ?? '__null__', p.totalMinor]));

  return current
    .map((c) => {
      const key = c.id ?? '__null__';
      const previousMinor = prevMap.get(key) ?? 0;
      return {
        id: c.id,
        name: c.name,
        color: c.color,
        currentMinor: c.totalMinor,
        previousMinor,
        changeMinor: c.totalMinor - previousMinor,
      };
    })
    .concat(
      previous
        .filter((p) => !current.some((c) => (c.id ?? '__null__') === (p.id ?? '__null__')))
        .map((p) => ({
          id: p.id,
          name: '—',
          color: '#888888',
          currentMinor: 0,
          previousMinor: p.totalMinor,
          changeMinor: -p.totalMinor,
        })),
    )
    .sort((a, b) => Math.abs(b.changeMinor) - Math.abs(a.changeMinor));
}

export function buildDriverSentence(
  categories: CategoryDelta[],
  formatMinor: (minor: number) => string,
): string {
  const movers = categories.filter((c) => c.changeMinor !== 0).slice(0, 2);
  if (movers.length === 0) return '';

  return movers
    .map((c) => {
      const direction = c.changeMinor > 0 ? 'up' : 'down';
      return `${c.name} ${direction} ${formatMinor(Math.abs(c.changeMinor))}`;
    })
    .join(', ');
}

export function comparePeriodTotals(
  current: { incomeMinor: number; expenseMinor: number },
  previous: { incomeMinor: number; expenseMinor: number },
  categories: CategoryDelta[],
  formatMinor: (minor: number) => string,
): CompareSummary {
  const incomeDelta = current.incomeMinor - previous.incomeMinor;
  const expenseDelta = current.expenseMinor - previous.expenseMinor;
  const netDelta = incomeDelta - expenseDelta;

  return {
    incomeDelta,
    expenseDelta,
    netDelta,
    categories,
    driverSentence: buildDriverSentence(categories, formatMinor),
  };
}
