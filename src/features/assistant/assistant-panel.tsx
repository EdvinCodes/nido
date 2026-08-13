'use client';

import { X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { AssistantView } from '@/features/assistant/assistant-view';
import type { AiConversationRow } from '@/features/assistant/queries';
import type { AiProviderName } from '@/lib/ai/provider-names';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';

export function AssistantPanel({
  open,
  onOpenChange,
  spaceId,
  consentActive,
  modelLabel,
  configuredProviders,
  conversations,
  suggestedContext,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  spaceId: string;
  consentActive: boolean;
  modelLabel: string | null;
  configuredProviders: AiProviderName[];
  conversations: AiConversationRow[];
  suggestedContext: { hasBudgets: boolean; hasGoals: boolean; hasSubscriptions: boolean };
}) {
  const t = useTranslations('assistant.panel');

  return (
    <>
      <aside
        className={cn(
          'fixed inset-y-0 right-0 z-30 hidden w-[min(100%,28rem)] flex-col border-l border-border bg-background shadow-lg lg:flex',
          open ? 'flex' : 'lg:hidden',
        )}
        aria-hidden={!open}
      >
        <PanelChrome
          title={t('title')}
          onClose={() => {
            onOpenChange(false);
          }}
        >
          <AssistantView
            spaceId={spaceId}
            consentActive={consentActive}
            modelLabel={modelLabel}
            configuredProviders={configuredProviders}
            conversations={conversations}
            suggestedContext={suggestedContext}
            variant="panel"
          />
        </PanelChrome>
      </aside>

      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="right"
          className="flex w-full flex-col p-0 sm:max-w-lg lg:hidden"
          showCloseButton={false}
        >
          <PanelChrome
            title={t('title')}
            onClose={() => {
              onOpenChange(false);
            }}
          >
            <AssistantView
              spaceId={spaceId}
              consentActive={consentActive}
              modelLabel={modelLabel}
              configuredProviders={configuredProviders}
              conversations={conversations}
              suggestedContext={suggestedContext}
              variant="panel"
            />
          </PanelChrome>
        </SheetContent>
      </Sheet>
    </>
  );
}

function PanelChrome({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const t = useTranslations('assistant.panel');
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h2 className="text-sm font-semibold">{title}</h2>
        <Button
          type="button"
          size="icon-sm"
          variant="ghost"
          onClick={onClose}
          aria-label={t('close')}
        >
          <X className="size-4" />
        </Button>
      </div>
      <div className="flex min-h-0 flex-1 flex-col">{children}</div>
    </div>
  );
}
