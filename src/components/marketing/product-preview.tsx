import { getTranslations } from 'next-intl/server';

/** CSS-built ledger preview inside a device frame — sharp at every density, no mock images. */
export async function ProductPreview() {
  const t = await getTranslations('marketing.preview');

  const rows = [
    { cat: 'G', name: t('row1'), sub: t('row1Sub'), amount: '−42,50 €', tone: 'expense' as const },
    { cat: 'T', name: t('row2'), sub: t('row2Sub'), amount: '−18,00 €', tone: 'expense' as const },
    {
      cat: '↑',
      name: t('row3'),
      sub: t('row3Sub'),
      amount: '+2.850,00 €',
      tone: 'income' as const,
    },
  ];

  return (
    <div className="relative mx-auto w-full max-w-lg">
      <div
        className="pointer-events-none absolute -inset-8 rounded-full bg-primary/25 blur-3xl"
        aria-hidden
      />
      <div
        className="relative rotate-[-2deg] rounded-2xl border border-border/80 bg-surface p-1 shadow-float transition-transform duration-500 hover:rotate-0"
        aria-hidden
      >
        <div className="overflow-hidden rounded-xl border border-border bg-background">
          <div className="flex items-center gap-2 border-b border-border px-4 py-3">
            <span className="size-2.5 rounded-full bg-expense/80" />
            <span className="size-2.5 rounded-full bg-warning/80" />
            <span className="size-2.5 rounded-full bg-income/80" />
            <span className="ml-2 text-xs text-muted-foreground">{t('windowTitle')}</span>
          </div>
          <div className="space-y-1 p-3">
            <div className="flex items-center justify-between px-2 py-1 text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
              <span>{t('dayLabel')}</span>
              <span className="text-expense">−60,50 €</span>
            </div>
            {rows.map((row) => (
              <div
                key={row.name}
                className="flex items-center gap-3 rounded-lg bg-surface-raised/60 px-2 py-2"
              >
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary">
                  {row.cat}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{row.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">{row.sub}</span>
                </span>
                <span
                  className={
                    row.tone === 'income'
                      ? 'text-sm font-medium text-income'
                      : 'text-sm font-medium text-expense'
                  }
                >
                  {row.amount}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
