import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { grantAiConsentAction, revokeAiConsentAction } from '@/features/assistant/actions';
import { getAiConsent, isConsentActive } from '@/features/assistant/queries';
import { AiSettingsClient } from '@/features/assistant/ai-settings-client';
import { isAssistantConfigured } from '@/lib/ai/assistant-enabled';
import { getModelLabel } from '@/lib/ai/providers';
import { route } from '@/lib/routes';
import { createClient } from '@/lib/supabase/server';
import { can } from '@/lib/auth';

export default async function AiSettingsPage({ params }: { params: Promise<{ spaceId: string }> }) {
  const { spaceId } = await params;
  const t = await getTranslations('assistant.settings');
  const configured = isAssistantConfigured();
  const modelLabel = getModelLabel();
  const consent = await getAiConsent(spaceId);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: membership } = user
    ? await supabase
        .from('space_members')
        .select('role')
        .eq('space_id', spaceId)
        .eq('user_id', user.id)
        .eq('status', 'active')
        .maybeSingle()
    : { data: null };

  const canManage = membership ? can(membership.role, 'space.update') : false;

  return (
    <div className="space-y-6 p-4 lg:p-8">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{t('title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('body')}</p>
      </div>

      {!configured ? (
        <div className="rounded-xl border border-border bg-surface p-4 text-sm">
          <p>{t('notConfigured')}</p>
          <p className="mt-2">
            <Link
              href={route('/docs')}
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              {t('docsLink')}
            </Link>
          </p>
        </div>
      ) : (
        <AiSettingsClient
          spaceId={spaceId}
          canManage={canManage}
          modelLabel={modelLabel}
          consentActive={isConsentActive(consent)}
          useRealNames={consent?.use_real_names ?? false}
          retentionDays={consent?.retention_days ?? 90}
          provider={consent?.provider ?? null}
          onGrant={grantAiConsentAction}
          onRevoke={revokeAiConsentAction}
        />
      )}
    </div>
  );
}
