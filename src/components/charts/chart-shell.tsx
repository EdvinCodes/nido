'use client';

import { useId, useState, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

export type ChartTableColumn = {
  key: string;
  label: string;
  align?: 'left' | 'right';
};

export type ChartTableRow = Record<string, string>;

type ChartShellProps = {
  title: string;
  className?: string;
  heightClassName?: string;
  loading?: boolean | undefined;
  empty?: boolean | undefined;
  emptyLabel?: string | undefined;
  columns: ChartTableColumn[];
  rows: ChartTableRow[];
  children: ReactNode;
};

/** Shared chrome: skeleton, empty, visually-hidden table + toggle for a11y. */
export function ChartShell({
  title,
  className,
  heightClassName = 'h-64',
  loading,
  empty,
  emptyLabel,
  columns,
  rows,
  children,
}: ChartShellProps) {
  const t = useTranslations('charts');
  const tableId = useId();
  const [showTable, setShowTable] = useState(false);

  if (loading) {
    return (
      <div className={cn('flex flex-col gap-2', className)}>
        <Skeleton className={cn('w-full rounded-xl', heightClassName)} />
      </div>
    );
  }

  if (empty) {
    return (
      <div
        className={cn(
          'flex items-center justify-center rounded-xl border border-dashed border-border bg-surface/40 px-4 text-sm text-muted-foreground',
          heightClassName,
          className,
        )}
      >
        {emptyLabel ?? t('empty')}
      </div>
    );
  }

  return (
    <div className={cn('flex min-w-0 flex-col gap-2 overflow-hidden', className)}>
      <div className={cn('w-full min-w-0', heightClassName)}>{children}</div>
      <div className="flex justify-end">
        <Button
          type="button"
          variant="ghost"
          size="xs"
          aria-expanded={showTable}
          aria-controls={tableId}
          onClick={() => {
            setShowTable((value) => !value);
          }}
        >
          {showTable ? t('hideTable') : t('showTable')}
        </Button>
      </div>
      <table
        id={tableId}
        className={cn('w-full text-sm', showTable ? 'table' : 'sr-only')}
        aria-label={title}
      >
        <caption className={showTable ? 'mb-2 text-left text-xs text-muted-foreground' : 'sr-only'}>
          {title}
        </caption>
        <thead>
          <tr className="border-b border-border text-left text-xs text-muted-foreground">
            {columns.map((column) => (
              <th
                key={column.key}
                scope="col"
                className={cn('px-2 py-1.5 font-medium', column.align === 'right' && 'text-right')}
              >
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index} className="border-b border-border/60">
              {columns.map((column) => (
                <td
                  key={column.key}
                  className={cn('px-2 py-1.5', column.align === 'right' && 'amount text-right')}
                >
                  {row[column.key] ?? '—'}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
