'use client';

import { useCallback, useMemo, useState, useTransition } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Amount } from '@/components/money/amount';
import {
  bulkUpdateImportRowsAction,
  commitImportAction,
  createCategorizationRuleAction,
  exportSpaceAction,
  importSpaceJsonAction,
  previewImportAction,
  saveImportMappingAction,
  undoImportAction,
  updateImportRowAction,
  uploadImportAction,
} from '@/features/imports/actions';
import type { ColumnMappingInput } from '@/features/imports/schemas';
import type { ImportMappingTemplateRow } from '@/features/imports/types';
import type { PreviewImportRow } from '@/features/imports/types';
import { applyMappingToRows } from '@/features/imports/lib/apply-mapping';
import { parseStatementFile } from '@/features/imports/lib/parse-statement-file';
import { bytesToBase64 } from '@/features/imports/lib/encode-base64';
import { formatMoney, money } from '@/lib/money';
import { cn } from '@/lib/utils';

type AccountOption = { id: string; name: string };
type CategoryOption = { id: string; name: string };

const NIDO_FIELDS = [
  'date',
  'description',
  'merchant',
  'amount',
  'debit',
  'credit',
  'externalId',
] as const;

type WizardStep = 'upload' | 'map' | 'preview' | 'commit';

export function ImportWizard({
  spaceId,
  accounts,
  categories,
  templates,
  baseCurrency,
}: {
  spaceId: string;
  accounts: AccountOption[];
  categories: CategoryOption[];
  templates: ImportMappingTemplateRow[];
  baseCurrency: string;
}) {
  const t = useTranslations('import');
  const [step, setStep] = useState<WizardStep>('upload');
  const [pending, startTransition] = useTransition();

  const [batchId, setBatchId] = useState<string | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<ColumnMappingInput>({});
  const [accountId, setAccountId] = useState<string | null>(accounts[0]?.id ?? null);
  const [meta, setMeta] = useState<{
    encoding: string;
    delimiter: string;
    rowCount: number;
  } | null>(null);
  const [previewRows, setPreviewRows] = useState<PreviewImportRow[]>([]);
  const [counts, setCounts] = useState({ toImport: 0, toSkip: 0, duplicates: 0, errors: 0 });
  const [commitResult, setCommitResult] = useState<{ imported: number; skipped: number } | null>(
    null,
  );
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [liveRows, setLiveRows] = useState<Array<ReturnType<typeof applyMappingToRows>[number]>>(
    [],
  );
  const [rawMatrix, setRawMatrix] = useState<string[][]>([]);

  const onFile = useCallback(
    (file: File) => {
      startTransition(async () => {
        const buf = await file.arrayBuffer();
        const bytes = new Uint8Array(buf);
        const base64 = bytesToBase64(bytes);
        const localParsed = parseStatementFile(bytes, file.name);
        setRawMatrix(localParsed.rows);
        setLiveRows(
          applyMappingToRows(
            localParsed.headers,
            localParsed.rows.slice(0, 5),
            localParsed.suggestedMapping,
            localParsed.dateFormat,
          ),
        );
        const source = file.name.toLowerCase().endsWith('.xlsx') ? 'xlsx' : 'csv';
        const result = await uploadImportAction({
          spaceId,
          fileName: file.name,
          source,
          fileData: base64,
        });
        if (!result.ok) {
          toast.error(result.error.message);
          return;
        }
        setBatchId(result.data.batchId);
        setHeaders(result.data.headers);
        setMapping(result.data.suggestedMapping);
        setMeta({
          encoding: result.data.encoding,
          delimiter: result.data.delimiter,
          rowCount: result.data.rowCount,
        });
        setStep('map');
      });
    },
    [spaceId],
  );

  const refreshLivePreview = useCallback(() => {
    if (!headers.length || !rawMatrix.length) return;
    setLiveRows(applyMappingToRows(headers, rawMatrix.slice(0, 5), mapping, 'DMY').slice(0, 5));
  }, [headers, rawMatrix, mapping]);

  const loadPreview = useCallback(() => {
    if (!batchId) return;
    startTransition(async () => {
      const save = await saveImportMappingAction({
        spaceId,
        batchId,
        accountId,
        mapping,
      });
      if (!save.ok) {
        toast.error(save.error.message);
        return;
      }
      const result = await previewImportAction({ spaceId, batchId });
      if (!result.ok) {
        toast.error(result.error.message);
        return;
      }
      setPreviewRows(result.data.rows);
      setCounts(result.data.counts);
      setStep('preview');
    });
  }, [spaceId, batchId, accountId, mapping]);

  const onCommit = () => {
    if (!batchId) return;
    startTransition(async () => {
      const result = await commitImportAction({ spaceId, batchId });
      if (!result.ok) {
        toast.error(result.error.message);
        return;
      }
      setCommitResult(result.data);
      setStep('commit');
    });
  };

  const onUndo = () => {
    if (!batchId) return;
    startTransition(async () => {
      const result = await undoImportAction({ spaceId, batchId });
      if (!result.ok) toast.error(result.error.message);
      else toast.success(t('undoSuccess', { count: result.data.undone }));
    });
  };

  const onCategoryChange = (row: PreviewImportRow, categoryId: string) => {
    startTransition(async () => {
      await updateImportRowAction({
        spaceId,
        rowId: row.id,
        categoryId,
      });
      const cat = categories.find((c) => c.id === categoryId);
      setPreviewRows((rows) =>
        rows.map((r) =>
          r.id === row.id ? { ...r, categoryId, categoryName: cat?.name ?? null } : r,
        ),
      );
      if (row.merchant) {
        toast(t('learnRulePrompt', { merchant: row.merchant, category: cat?.name ?? '' }), {
          action: {
            label: t('learnRuleAction'),
            onClick: () => {
              void createCategorizationRuleAction({
                spaceId,
                matchType: 'contains',
                pattern: row.merchant?.toLowerCase() ?? '',
                field: 'merchant',
                categoryId,
                autoLearned: true,
              }).then((res) => {
                if (res.ok) toast.success(t('ruleCreated'));
              });
            },
          },
        });
      }
    });
  };

  const parentRef = useMemo(() => ({ current: null as HTMLDivElement | null }), []);
  // eslint-disable-next-line react-hooks/incompatible-library -- large import preview lists
  const virtualizer = useVirtualizer({
    count: previewRows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 52,
    overscan: 12,
  });

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-6 overflow-x-hidden p-4 lg:p-8">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{t('title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('description')}</p>
      </div>

      <ol className="flex flex-wrap gap-2 text-xs">
        {(['upload', 'map', 'preview', 'commit'] as WizardStep[]).map((s) => (
          <li
            key={s}
            className={cn(
              'rounded-full px-3 py-1',
              step === s ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground',
            )}
          >
            {t(`steps.${s}`)}
          </li>
        ))}
      </ol>

      {step === 'upload' && (
        <div className="rounded-lg border border-dashed border-border p-8 text-center">
          <Label htmlFor="import-file" className="cursor-pointer">
            <span className="text-sm font-medium">{t('upload.drop')}</span>
            <Input
              id="import-file"
              type="file"
              accept=".csv,.xlsx,.xls,text/csv"
              className="sr-only"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) onFile(file);
              }}
            />
          </Label>
          {meta && (
            <p className="mt-4 text-sm text-muted-foreground">
              {t('upload.meta', {
                encoding: meta.encoding,
                delimiter: meta.delimiter,
                count: meta.rowCount,
              })}
            </p>
          )}
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => {
                void exportSpaceAction({ spaceId }).then((res) => {
                  if (!res.ok) return;
                  const blob = new Blob([res.data.json], { type: 'application/json' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = res.data.fileName;
                  a.click();
                  URL.revokeObjectURL(url);
                });
              }}
            >
              {t('exportSpace')}
            </Button>
            <Label className="inline-flex cursor-pointer items-center rounded-md border px-3 py-2 text-sm">
              {t('importJson')}
              <Input
                type="file"
                accept="application/json,.json"
                className="sr-only"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const text = await file.text();
                  const res = await importSpaceJsonAction({ spaceId, fileData: text });
                  if (res.ok)
                    toast.success(t('jsonImported', { count: res.data.importedTransactions }));
                  else toast.error(res.error.message);
                }}
              />
            </Label>
          </div>
        </div>
      )}

      {step === 'map' && (
        <div className="grid min-w-0 gap-6 lg:grid-cols-2">
          <div className="space-y-4">
            <div>
              <Label>{t('map.account')}</Label>
              <Select
                value={accountId ?? ''}
                onValueChange={(v) => {
                  setAccountId(v || null);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('map.accountPlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {templates.length > 0 && (
              <div>
                <Label>{t('map.savedTemplate')}</Label>
                <Select
                  onValueChange={(id) => {
                    const tpl = templates.find((x) => x.id === id);
                    if (
                      tpl?.mapping &&
                      typeof tpl.mapping === 'object' &&
                      !Array.isArray(tpl.mapping)
                    ) {
                      setMapping(tpl.mapping);
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t('map.savedTemplatePlaceholder')} />
                  </SelectTrigger>
                  <SelectContent>
                    {templates.map((tpl) => (
                      <SelectItem key={tpl.id} value={tpl.id}>
                        {tpl.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {NIDO_FIELDS.map((field) => (
              <div key={field}>
                <Label>{t(`fields.${field}`)}</Label>
                <Select
                  value={mapping[field] ?? '__none__'}
                  onValueChange={(v) => {
                    setMapping((m) => ({ ...m, [field]: v === '__none__' ? null : v }));
                    refreshLivePreview();
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">{t('map.none')}</SelectItem>
                    {headers.map((h) => (
                      <SelectItem key={h} value={h}>
                        {h}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}
            <Button onClick={loadPreview} disabled={pending || !batchId}>
              {t('map.continue')}
            </Button>
          </div>
          <div className="rounded-lg border p-4">
            <h2 className="text-sm font-medium">{t('map.livePreview')}</h2>
            <ul className="mt-3 space-y-2 text-xs text-muted-foreground">
              {liveRows.map((row) => (
                <li key={row.rowIndex}>
                  {row.bookedOn} · {row.description} ·{' '}
                  {row.amountMinor ? formatMoney(money(row.amountMinor, baseCurrency)) : '—'}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {step === 'preview' && (
        <div className="flex min-h-0 flex-1 flex-col gap-4">
          <div className="flex flex-wrap gap-3 text-sm">
            <span>{t('preview.toImport', { count: counts.toImport })}</span>
            <span>{t('preview.toSkip', { count: counts.toSkip })}</span>
            <span>{t('preview.duplicates', { count: counts.duplicates })}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={selected.size === 0 || pending}
              onClick={() => {
                if (!batchId) return;
                startTransition(async () => {
                  await bulkUpdateImportRowsAction({
                    spaceId,
                    batchId,
                    rowIds: [...selected],
                    skipDuplicates: true,
                  });
                  loadPreview();
                });
              }}
            >
              {t('preview.skipDuplicates')}
            </Button>
            <Button size="sm" onClick={onCommit} disabled={pending || counts.toImport === 0}>
              {t('preview.commit')}
            </Button>
          </div>
          <div
            ref={(el) => {
              parentRef.current = el;
            }}
            className="min-h-[320px] flex-1 overflow-auto rounded-lg border"
          >
            <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
              {virtualizer.getVirtualItems().map((vRow) => {
                const row = previewRows[vRow.index];
                if (!row) return null;
                return (
                  <div
                    key={row.id}
                    className="absolute inset-x-0 flex items-center gap-2 border-b px-3 py-2 text-sm"
                    style={{ transform: `translateY(${vRow.start}px)` }}
                  >
                    <input
                      type="checkbox"
                      checked={selected.has(row.id)}
                      onChange={(e) => {
                        setSelected((s) => {
                          const next = new Set(s);
                          if (e.target.checked) next.add(row.id);
                          else next.delete(row.id);
                          return next;
                        });
                      }}
                    />
                    <span className="w-24 shrink-0 text-muted-foreground">{row.bookedOn}</span>
                    <span className="min-w-0 flex-1 truncate">
                      {row.merchant ?? row.description}
                    </span>
                    {row.duplicateOf && (
                      <span className="rounded bg-amber-500/15 px-2 py-0.5 text-xs text-amber-700 dark:text-amber-300">
                        {t('preview.duplicateBadge')}
                      </span>
                    )}
                    <Select
                      value={row.categoryId ?? ''}
                      onValueChange={(v) => {
                        onCategoryChange(row, v);
                      }}
                    >
                      <SelectTrigger className="h-8 w-36">
                        <SelectValue placeholder={t('preview.category')} />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {row.amountMinor && row.kind && (
                      <Amount
                        minor={row.amountMinor}
                        currency={baseCurrency}
                        tone={row.kind === 'income' ? 'income' : 'expense'}
                        className="w-24 text-right"
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {step === 'commit' && commitResult && (
        <div className="rounded-lg border p-6 text-center">
          <h2 className="text-lg font-medium">{t('commit.title')}</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {t('commit.summary', {
              imported: commitResult.imported,
              skipped: commitResult.skipped,
            })}
          </p>
          <div className="mt-4 flex justify-center gap-2">
            <Button variant="outline" onClick={onUndo}>
              {t('commit.undo')}
            </Button>
            <Button
              onClick={() => {
                setStep('upload');
              }}
            >
              {t('commit.another')}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
