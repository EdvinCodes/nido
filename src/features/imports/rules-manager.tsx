'use client';

import { useState, useTransition } from 'react';
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
import {
  applyCategorizationRuleAction,
  createCategorizationRuleAction,
  deleteCategorizationRuleAction,
  reorderCategorizationRulesAction,
  testCategorizationRuleAction,
} from '@/features/imports/actions';
import type { CategorizationRuleRow } from '@/features/imports/types';
import type { MemberRole } from '@/lib/auth';
import { can } from '@/lib/auth';

type CategoryOption = { id: string; name: string };

export function RulesManager({
  spaceId,
  role,
  rules: initialRules,
  categories,
}: {
  spaceId: string;
  role: MemberRole;
  rules: CategorizationRuleRow[];
  categories: CategoryOption[];
}) {
  const t = useTranslations('import.rules');
  const [rules, setRules] = useState(initialRules);
  const [pending, startTransition] = useTransition();
  const canEdit = can(role, 'categories.update');

  const [pattern, setPattern] = useState('');
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? '');
  const [testResult, setTestResult] = useState<{ count: number } | null>(null);

  const createRule = () => {
    startTransition(async () => {
      const res = await createCategorizationRuleAction({
        spaceId,
        matchType: 'contains',
        pattern,
        field: 'merchant',
        categoryId,
      });
      if (!res.ok) toast.error(res.error.message);
      else {
        toast.success(t('created'));
        setPattern('');
      }
    });
  };

  const moveRule = (ruleId: string, direction: -1 | 1) => {
    const idx = rules.findIndex((r) => r.id === ruleId);
    const next = [...rules];
    const swap = idx + direction;
    if (swap < 0 || swap >= next.length) return;
    const a = next[idx];
    const b = next[swap];
    if (!a || !b) return;
    next[idx] = b;
    next[swap] = a;
    setRules(next);
    startTransition(async () => {
      await reorderCategorizationRulesAction({
        spaceId,
        ruleIds: next.map((r) => r.id),
      });
    });
  };

  return (
    <div className="space-y-6 p-4 lg:p-8">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{t('title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('description')}</p>
      </div>

      {canEdit && (
        <div className="space-y-3 rounded-lg border p-4">
          <h2 className="text-sm font-medium">{t('addRule')}</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>{t('pattern')}</Label>
              <Input
                value={pattern}
                onChange={(e) => {
                  setPattern(e.target.value);
                }}
              />
            </div>
            <div>
              <Label>{t('category')}</Label>
              <Select
                value={categoryId}
                onValueChange={(v) => {
                  setCategoryId(v);
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button onClick={createRule} disabled={pending || !pattern}>
            {t('addRule')}
          </Button>
        </div>
      )}

      <ul className="divide-y rounded-lg border">
        {rules.map((rule, index) => {
          const cat = categories.find((c) => c.id === rule.category_id);
          return (
            <li key={rule.id} className="flex flex-wrap items-center gap-3 p-4 text-sm">
              <span className="font-mono text-xs text-muted-foreground">#{index + 1}</span>
              <span className="flex-1">
                {t('ruleLine', {
                  match: rule.match_type,
                  pattern: rule.pattern,
                  category: cat?.name ?? '—',
                })}
              </span>
              <span className="text-muted-foreground">{t('hits', { count: rule.hit_count })}</span>
              {canEdit && (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      moveRule(rule.id, -1);
                    }}
                  >
                    ↑
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      moveRule(rule.id, 1);
                    }}
                  >
                    ↓
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      startTransition(async () => {
                        const res = await testCategorizationRuleAction({
                          spaceId,
                          ruleId: rule.id,
                        });
                        if (res.ok) setTestResult({ count: res.data.count });
                      });
                    }}
                  >
                    {t('test')}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      startTransition(async () => {
                        const res = await applyCategorizationRuleAction({
                          spaceId,
                          ruleId: rule.id,
                        });
                        if (res.ok) toast.success(t('applied', { count: res.data.updated }));
                      });
                    }}
                  >
                    {t('apply')}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      startTransition(async () => {
                        await deleteCategorizationRuleAction({ spaceId, ruleId: rule.id });
                        setRules((r) => r.filter((x) => x.id !== rule.id));
                      });
                    }}
                  >
                    {t('delete')}
                  </Button>
                </>
              )}
            </li>
          );
        })}
      </ul>

      {testResult && (
        <p className="text-sm text-muted-foreground">
          {t('testResult', { count: testResult.count })}
        </p>
      )}
    </div>
  );
}
