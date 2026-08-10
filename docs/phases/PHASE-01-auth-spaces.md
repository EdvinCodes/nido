# Phase 01 — Authentication and spaces

## Goal

A real person can sign up, complete onboarding, land in their own household, invite their
partner, and switch between spaces. The multi-tenant foundation is in place and provably
airtight: a member of one space cannot read a single row belonging to another, verified by
tests, not by inspection.

## Required reading

- [`../02-DATA-MODEL.md`](../02-DATA-MODEL.md) — §§ 3, 4 (categories only), 14
- [`../04-FEATURES.md`](../04-FEATURES.md) — § 1, § 12 (Members)
- [`../01-ARCHITECTURE.md`](../01-ARCHITECTURE.md) — §§ 4, 5, 6
- [`../03-DESIGN-SYSTEM.md`](../03-DESIGN-SYSTEM.md) — § 5

## Tasks

### 1. Database

One migration per table group, each containing the table, its indexes, `enable row level
security`, every policy, the `updated_at` trigger, and column comments.

1. `nido.profiles`, plus a trigger on `auth.users` insert that creates the profile row
   using the OAuth display name or the email local part as a fallback.
2. `nido.spaces`.
3. `nido.participants`.
4. `nido.space_members`.
5. `nido.space_invitations`.
6. `nido.categories`, with the max-depth-two check trigger.
7. `nido.audit_log` and the generic `nido.tg_audit()` trigger function, attached to spaces,
   members, and participants.
8. `nido.create_space(p_name text, p_kind, p_currency, p_timezone, p_participants jsonb)` —
   a `security definer` RPC that atomically creates the space, the owner's participant, the
   owner's membership, any ghost participants, and the default category tree. Creating a
   space through five separate client calls is a partial-failure bug waiting to happen.
9. `nido.accept_invitation(p_token text)` — a `security definer` RPC that hashes the token,
   validates expiry and single use, creates or links the participant, inserts the
   membership, and marks the invitation accepted. Constant-time comparison; generic error
   messages that do not reveal whether a token exists.
10. Default category seed data as a SQL function so both `create_space` and `seed.sql` use
    the same source.

### 2. RLS policies

Apply the canonical policy set from [`../02-DATA-MODEL.md`](../02-DATA-MODEL.md) § 14, with
the documented deviations for `profiles`, `space_invitations`, and `audit_log`.

Specific rules worth stating explicitly:

- A user may read the profiles of people who share at least one active space with them, and
  nobody else's.
- Only `owner` may delete a space or change another member's role to `owner`.
- An `owner` cannot remove themselves while they are the only owner.
- `viewer` has select only, on everything.

### 3. pgTAP tests

`supabase/tests/` with one file per table. Every policy needs both directions. At minimum:

- A user in space A gets zero rows selecting space B's spaces, participants, members,
  categories, and audit log.
- A `viewer` cannot insert or update a category.
- A `member` cannot change roles.
- The last owner cannot be removed.
- An expired invitation cannot be accepted.
- An invitation cannot be accepted twice.
- `create_space` rolls back entirely if any step fails.

### 4. Authentication UI

Route group `(auth)`: `/sign-in`, `/sign-up`, `/forgot-password`, `/reset-password`, and
`/auth/callback`.

- Email + password with real validation and a password strength indicator; magic link;
  Google OAuth.
- `react-hook-form` + Zod, with the same schema used by the Server Action.
- Precise, human error messages: wrong password, unconfirmed email, rate limited, and
  "an account already exists with this email, try signing in" — never a generic failure.
- A split layout: the form on one side, a quiet branded panel with a product screenshot on
  the other, collapsing to form-only on mobile.
- Middleware protects `/s/*` and redirects unauthenticated users to `/sign-in?next=...`,
  returning them to their destination after login.

### 5. Onboarding

Route `/onboarding`, a three-step wizard with a progress indicator and browser-back support
between steps, exactly as specified in [`../04-FEATURES.md`](../04-FEATURES.md) § 1. State
lives in the URL. The final step calls `nido.create_space` once and redirects to
`/s/[spaceId]`.

A user who already has at least one space is redirected away from `/onboarding` unless they
explicitly chose to create another space.

### 6. Space shell and switching

- Routes become `/s/[spaceId]/...`. A layout resolves the space, verifies membership, and
  provides it through a server-side context; a non-member gets a 404, never a 403, so space
  ids cannot be probed.
- The space switcher (sidebar top on desktop, header on mobile) lists the user's spaces with
  their kind and member avatars, plus "Create new space".
- The last active space is remembered on the profile so `/` redirects an authenticated user
  straight to it.
- Navigation renders the destinations from [`../03-DESIGN-SYSTEM.md`](../03-DESIGN-SYSTEM.md)
  § 5, with the ones belonging to later phases disabled and visibly marked as coming soon,
  rather than hidden — it makes the roadmap legible to anyone who runs the project.

### 7. Members and invitations

`/s/[spaceId]/settings/members`:

- A table of members with avatar, name, role, status, and join date.
- Invite by email (sends a link via Supabase Auth email or Resend) or by copyable link.
  The raw token is displayed once and never again.
- Pending invitations list with resend and revoke.
- Role changes and removal, guarded by the rules above, each with a confirmation dialog
  naming the person and the consequence.
- Ghost participants shown alongside members with a "send invitation" action that links the
  resulting membership to the existing participant, preserving their history.
- `/invite/[token]` handles the accept flow for both logged-in and logged-out users,
  routing through sign-up and completing automatically afterwards.

### 8. Categories management

`/s/[spaceId]/settings/categories`: a two-level tree with drag to reorder and re-parent,
inline rename, colour picker restricted to the category palette plus a custom hex field,
lucide icon picker with search, archive, and create. Merging categories is Phase 02's
problem — leave it out.

### 9. Profile settings

`/s/[spaceId]/settings/profile`: display name, avatar upload to the storage bucket, locale,
timezone, theme, and the colourblind-safe palette toggle. Changing the locale re-renders the
app in the new language without a full reload.

## Acceptance criteria

- [x] A new user can sign up, complete onboarding, and reach a dashboard placeholder inside
      their own space, all without touching the database by hand.
- [x] Creating a space seeds the owner's participant, the membership, ghost participants,
      and the full default category tree in a single atomic call.
- [x] Inviting a second user by link works end to end in an incognito window, and the new
      member sees the same space with the same categories.
- [x] A user belonging to two spaces can switch between them, and the URL reflects the
      active space.
- [x] Every pgTAP test passes, including every negative case listed above.
- [x] Visiting another space's URL as a non-member returns 404.
- [x] A `viewer` sees the UI without any create or edit affordance, and the corresponding
      Server Actions reject them even when called directly.
- [x] The auth pages, onboarding, and settings all work at 375 px and 1440 px in both themes
      and report no axe violations.
- [x] Every string is translated in both `es` and `en`.
- [x] `pnpm verify` and `pnpm test:db` pass.

## Out of scope

Transactions, accounts, any analytics, and the real landing page. The dashboard route
renders an empty state that says the ledger arrives in the next phase.

## Verification

```bash
pnpm db:reset && pnpm verify && pnpm test:db && pnpm test:e2e
```

Playwright specs required by this phase: `auth.spec.ts` (sign up → onboarding → space),
`invite.spec.ts` (invite → accept in a second browser context → both see the space), and
`rls.spec.ts` (a second space's URL returns 404).
