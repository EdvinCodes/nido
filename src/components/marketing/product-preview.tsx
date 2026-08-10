'use client';

import { motion, useReducedMotion } from 'motion/react';

type PreviewRow = {
  cat: string;
  name: string;
  sub: string;
  amount: string;
  tone: 'expense' | 'income';
};

type ProductPreviewProps = {
  windowTitle: string;
  dayLabel: string;
  rows: PreviewRow[];
};

/** Full-bleed ledger scene for the landing hero — product as atmosphere, not a card. */
export function ProductPreview({ windowTitle, dayLabel, rows }: ProductPreviewProps) {
  const reduceMotion = useReducedMotion();

  return (
    <div className="relative mx-auto w-full max-w-4xl" aria-hidden>
      <div className="absolute inset-x-8 -bottom-8 h-24 bg-primary/15 blur-3xl" />
      <div className="relative overflow-hidden rounded-t-2xl border border-b-0 border-border/70 bg-surface/90 shadow-float backdrop-blur-sm">
        <div className="flex items-center gap-3 border-b border-border/60 px-5 py-3.5">
          <div className="flex gap-1.5">
            <span className="size-2.5 rounded-full bg-expense/70" />
            <span className="size-2.5 rounded-full bg-warning/70" />
            <span className="size-2.5 rounded-full bg-income/70" />
          </div>
          <span className="text-xs tracking-wide text-muted-foreground">{windowTitle}</span>
        </div>
        <div className="space-y-1 px-3 py-3 sm:px-4">
          <div className="flex items-center justify-between px-3 py-2 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
            <span>{dayLabel}</span>
            <span className="amount text-expense">−60,50 €</span>
          </div>
          {rows.map((row, index) => (
            <motion.div
              key={row.name}
              className="flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-surface-raised/70"
              initial={reduceMotion ? false : { opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{
                duration: 0.4,
                delay: 0.45 + index * 0.08,
                ease: [0.32, 0.72, 0, 1],
              }}
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary">
                {row.cat}
              </span>
              <span className="min-w-0 flex-1 text-left">
                <span className="block truncate text-sm font-medium">{row.name}</span>
                <span className="block truncate text-xs text-muted-foreground">{row.sub}</span>
              </span>
              <span
                className={
                  row.tone === 'income'
                    ? 'amount text-sm font-medium text-income'
                    : 'amount text-sm font-medium text-expense'
                }
              >
                {row.amount}
              </span>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
