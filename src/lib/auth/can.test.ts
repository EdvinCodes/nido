import { describe, expect, it } from 'vitest';
import { can, type MemberRole, type SpaceAction } from './can';

describe('can()', () => {
  const cases: Array<[MemberRole, SpaceAction, boolean]> = [
    ['viewer', 'space.read', true],
    ['viewer', 'categories.create', false],
    ['viewer', 'members.invite', false],
    ['member', 'categories.create', true],
    ['member', 'members.manage', false],
    ['admin', 'members.invite', true],
    ['admin', 'space.delete', false],
    ['admin', 'members.transfer_ownership', false],
    ['owner', 'space.delete', true],
    ['owner', 'members.transfer_ownership', true],
    ['member', 'transactions.create', true],
    ['member', 'transactions.update', true],
    ['member', 'transactions.delete', true],
    ['member', 'accounts.create', true],
    ['member', 'accounts.update', true],
    ['member', 'accounts.delete', false],
    ['member', 'tags.create', true],
    ['viewer', 'transactions.create', false],
    ['viewer', 'accounts.create', false],
    ['viewer', 'tags.create', false],
    ['admin', 'transactions.delete', true],
    ['admin', 'accounts.delete', true],
    ['owner', 'accounts.delete', true],
  ];

  it.each(cases)('%s %s → %s', (role, action, expected) => {
    expect(can(role, action)).toBe(expected);
  });
});
