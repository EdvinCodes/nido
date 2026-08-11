'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { can, type MemberRole } from '@/lib/auth';
import {
  inviteMemberAction,
  removeMemberAction,
  revokeInviteAction,
  updateMemberRoleAction,
} from '@/features/spaces/actions';

type MemberRow = {
  user_id: string;
  role: MemberRole;
  status: string;
  joined_at: string;
  profiles: { id: string; display_name: string; avatar_url: string | null } | null;
};

type InviteRow = {
  id: string;
  email: string | null;
  role: string;
  expires_at: string;
  created_at: string;
};

type GhostRow = {
  id: string;
  display_name: string;
  color: string;
};

export function MembersManager({
  spaceId,
  role,
  members,
  invitations,
  ghosts,
}: {
  spaceId: string;
  role: MemberRole;
  members: MemberRow[];
  invitations: InviteRow[];
  ghosts: GhostRow[];
}) {
  const t = useTranslations('members');
  const tCommon = useTranslations('common');
  const [email, setEmail] = useState('');
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [confirmRemove, setConfirmRemove] = useState<MemberRow | null>(null);
  const canInvite = can(role, 'members.invite');
  const canManage = can(role, 'members.manage');

  return (
    <div className="space-y-8 p-4 lg:p-8">
      <h1 className="text-xl font-semibold tracking-tight">{t('title')}</h1>

      {canInvite ? (
        <div className="flex flex-col gap-3 rounded-lg border border-border p-4 sm:flex-row sm:items-end">
          <div className="flex-1 space-y-2">
            <Label htmlFor="invite-email">{t('inviteEmail')}</Label>
            <Input
              id="invite-email"
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
              }}
            />
          </div>
          <Button
            disabled={pending}
            onClick={() => {
              startTransition(async () => {
                const result = await inviteMemberAction({
                  spaceId,
                  email: email || undefined,
                  role: 'member',
                });
                if (result.ok) {
                  setInviteLink(result.data.link);
                  setEmail('');
                }
              });
            }}
          >
            {t('invite')}
          </Button>
          <Button
            variant="outline"
            disabled={pending}
            onClick={() => {
              startTransition(async () => {
                const result = await inviteMemberAction({ spaceId, role: 'member' });
                if (result.ok) setInviteLink(result.data.link);
              });
            }}
          >
            {t('inviteLink')}
          </Button>
        </div>
      ) : null}

      {inviteLink ? (
        <div className="rounded-lg border border-primary/40 bg-primary/5 p-4 text-sm">
          <p className="font-medium">{t('linkCreated')}</p>
          <p className="mt-2 font-mono text-xs break-all">{inviteLink}</p>
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left">
            <tr>
              <th className="px-3 py-2">{tCommon('name')}</th>
              <th className="px-3 py-2">{t('role')}</th>
              <th className="px-3 py-2">{t('status')}</th>
              <th className="px-3 py-2">{t('joined')}</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {members.map((m) => (
              <tr key={m.user_id} className="border-t border-border">
                <td className="px-3 py-2">{m.profiles?.display_name ?? m.user_id}</td>
                <td className="px-3 py-2">
                  {canManage ? (
                    <Select
                      value={m.role}
                      onValueChange={(value) => {
                        startTransition(async () => {
                          await updateMemberRoleAction({
                            spaceId,
                            userId: m.user_id,
                            role: value as MemberRole,
                          });
                        });
                      }}
                    >
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(['owner', 'admin', 'member', 'viewer'] as const).map((r) => (
                          <SelectItem key={r} value={r}>
                            {t(`roles.${r}`)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    t(`roles.${m.role}`)
                  )}
                </td>
                <td className="px-3 py-2">
                  {t(`statuses.${m.status as 'active' | 'invited' | 'left' | 'removed'}`)}
                </td>
                <td className="px-3 py-2">{new Date(m.joined_at).toISOString().slice(0, 10)}</td>
                <td className="px-3 py-2 text-right">
                  {canManage ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setConfirmRemove(m);
                      }}
                    >
                      {t('remove')}
                    </Button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {invitations.length > 0 ? (
        <div className="space-y-2">
          <h2 className="font-medium">{t('pending')}</h2>
          <ul className="space-y-2">
            {invitations.map((inv) => (
              <li
                key={inv.id}
                className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm"
              >
                <span>
                  {inv.email ?? '—'} · {t(`roles.${inv.role as 'member'}`)}
                </span>
                {canManage ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      startTransition(async () => {
                        await revokeInviteAction({ spaceId, invitationId: inv.id });
                      });
                    }}
                  >
                    {t('revoke')}
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {ghosts.length > 0 ? (
        <div className="space-y-2">
          <h2 className="font-medium">{t('ghosts')}</h2>
          <ul className="space-y-2">
            {ghosts.map((g) => (
              <li
                key={g.id}
                className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm"
              >
                <span className="flex items-center gap-2">
                  <span
                    className="size-3 rounded-full"
                    style={{ backgroundColor: g.color }}
                    aria-hidden
                  />
                  {g.display_name}
                </span>
                {canInvite ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      startTransition(async () => {
                        const result = await inviteMemberAction({
                          spaceId,
                          role: 'member',
                          participantId: g.id,
                        });
                        if (result.ok) setInviteLink(result.data.link);
                      });
                    }}
                  >
                    {t('inviteGhost')}
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <Dialog
        open={!!confirmRemove}
        onOpenChange={() => {
          setConfirmRemove(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {t('removeConfirm', {
                name: confirmRemove?.profiles?.display_name ?? '',
              })}
            </DialogTitle>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => {
                setConfirmRemove(null);
              }}
            >
              {tCommon('cancel')}
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (!confirmRemove) return;
                startTransition(async () => {
                  await removeMemberAction({ spaceId, userId: confirmRemove.user_id });
                  setConfirmRemove(null);
                });
              }}
            >
              {tCommon('confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
