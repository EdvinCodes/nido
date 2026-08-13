import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { AssistantView } from '@/features/assistant/assistant-view';
import { getAiConsent, isConsentActive, listConversations } from '@/features/assistant/queries';
import { isAssistantConfigured } from '@/lib/ai/assistant-enabled';
import { getModelLabel, listConfiguredProviders } from '@/lib/ai/providers';
import { createClient } from '@/lib/supabase/server';

export default async function AssistantPage({ params }: { params: Promise<{ spaceId: string }> }) {
  const { spaceId } = await params;
  if (!isAssistantConfigured()) notFound();

  const t = await getTranslations('assistant.panel');
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) notFound();

  const consent = await getAiConsent(spaceId);
  const conversations = await listConversations(spaceId, user.id);

  const [{ count: budgetCount }, { count: goalCount }, { count: subscriptionCount }] =
    await Promise.all([
      supabase.from('budgets').select('*', { count: 'exact', head: true }).eq('space_id', spaceId),
      supabase.from('goals').select('*', { count: 'exact', head: true }).eq('space_id', spaceId),
      supabase
        .from('recurring_rules')
        .select('*', { count: 'exact', head: true })
        .eq('space_id', spaceId)
        .eq('kind', 'subscription'),
    ]);

  return (
    <main className="flex min-h-0 flex-1 flex-col">
      <div className="border-b border-border px-4 py-3 lg:hidden">
        <h1 className="text-lg font-semibold">{t('title')}</h1>
      </div>
      <AssistantView
        spaceId={spaceId}
        consentActive={isConsentActive(consent)}
        modelLabel={getModelLabel()}
        configuredProviders={listConfiguredProviders()}
        conversations={conversations}
        suggestedContext={{
          hasBudgets: (budgetCount ?? 0) > 0,
          hasGoals: (goalCount ?? 0) > 0,
          hasSubscriptions: (subscriptionCount ?? 0) > 0,
        }}
        variant="page"
      />
    </main>
  );
}
