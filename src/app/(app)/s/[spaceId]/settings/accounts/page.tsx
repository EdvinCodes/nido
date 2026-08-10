import { notFound } from 'next/navigation';
import { AccountsManager } from '@/features/accounts/accounts-manager';
import { getAccountBalance, listAccounts } from '@/features/accounts/queries';
import { getSpaceForMember } from '@/features/spaces/queries';

export default async function AccountsSettingsPage({
  params,
}: {
  params: Promise<{ spaceId: string }>;
}) {
  const { spaceId } = await params;
  const membership = await getSpaceForMember(spaceId);
  if (!membership) notFound();

  const accounts = await listAccounts(spaceId);
  const balances: Record<string, number> = {};
  await Promise.all(
    accounts.map(async (account) => {
      balances[account.id] = await getAccountBalance(account.id);
    }),
  );

  return (
    <AccountsManager
      spaceId={spaceId}
      role={membership.role}
      initial={accounts}
      balances={balances}
    />
  );
}
