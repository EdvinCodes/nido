import type { ReactNode } from 'react';
import { SettingsNav } from '@/components/layout/settings-nav';

export default async function SettingsLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ spaceId: string }>;
}) {
  const { spaceId } = await params;

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden lg:flex-row">
      <SettingsNav spaceId={spaceId} />
      <main className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto" id="main-content">
        {children}
      </main>
    </div>
  );
}
