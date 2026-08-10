import type { Database } from '@/lib/supabase/database.types';

export type MemberRole = Database['nido']['Enums']['member_role'];
export type SpaceKind = Database['nido']['Enums']['space_kind'];
export type MemberStatus = Database['nido']['Enums']['member_status'];
export type CategoryKind = Database['nido']['Enums']['category_kind'];

export type SpaceAction =
  | 'space.read'
  | 'space.update'
  | 'space.delete'
  | 'members.invite'
  | 'members.manage'
  | 'members.transfer_ownership'
  | 'categories.create'
  | 'categories.update'
  | 'categories.delete'
  | 'transactions.create'
  | 'transactions.update'
  | 'transactions.delete'
  | 'accounts.create'
  | 'accounts.update'
  | 'accounts.delete'
  | 'tags.create'
  | 'profile.update';

const ROLE_PERMISSIONS: Record<MemberRole, ReadonlySet<SpaceAction>> = {
  owner: new Set([
    'space.read',
    'space.update',
    'space.delete',
    'members.invite',
    'members.manage',
    'members.transfer_ownership',
    'categories.create',
    'categories.update',
    'categories.delete',
    'transactions.create',
    'transactions.update',
    'transactions.delete',
    'accounts.create',
    'accounts.update',
    'accounts.delete',
    'tags.create',
    'profile.update',
  ]),
  admin: new Set([
    'space.read',
    'space.update',
    'members.invite',
    'members.manage',
    'categories.create',
    'categories.update',
    'categories.delete',
    'transactions.create',
    'transactions.update',
    'transactions.delete',
    'accounts.create',
    'accounts.update',
    'accounts.delete',
    'tags.create',
    'profile.update',
  ]),
  member: new Set([
    'space.read',
    'categories.create',
    'categories.update',
    // A member can create/update transactions, and delete their own (RLS enforces ownership).
    'transactions.create',
    'transactions.update',
    'transactions.delete',
    'accounts.create',
    'accounts.update',
    'tags.create',
    'profile.update',
  ]),
  viewer: new Set(['space.read', 'profile.update']),
};

/** UI affordance helper. SQL RLS remains the source of truth. */
export function can(role: MemberRole, action: SpaceAction): boolean {
  return ROLE_PERMISSIONS[role].has(action);
}

export function isContributor(role: MemberRole): boolean {
  return role === 'owner' || role === 'admin' || role === 'member';
}
