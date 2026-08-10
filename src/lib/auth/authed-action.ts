/**
 * Shared action result type and the authedAction wrapper used by every Server Action.
 * See docs/01-ARCHITECTURE.md §4 and docs/06-CONVENTIONS.md §2.
 */

import { createClient } from '@/lib/supabase/server';
import type { Database } from '@/lib/supabase/database.types';
import type { MemberRole } from './can';
import { can, type SpaceAction } from './can';

export type ActionError = {
  code: string;
  message: string;
  fields?: Record<string, string[]>;
};

export type ActionResult<T> = { ok: true; data: T } | { ok: false; error: ActionError };

export type AuthedContext = {
  userId: string;
  email: string | undefined;
  supabase: Awaited<ReturnType<typeof createClient>>;
};

export type SpaceContext = AuthedContext & {
  spaceId: string;
  role: MemberRole;
  participantId: string;
};

type SchemaParser<T> = { parse: (input: unknown) => T };

async function requireUser(): Promise<AuthedContext | ActionResult<never>> {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return {
      ok: false,
      error: { code: 'unauthenticated', message: 'You must be signed in.' },
    };
  }

  return {
    userId: user.id,
    email: user.email,
    supabase,
  };
}

async function resolveMembership(
  ctx: AuthedContext,
  spaceId: string,
  requiredAction?: SpaceAction,
): Promise<SpaceContext | ActionResult<never>> {
  const { data, error } = await ctx.supabase
    .from('space_members')
    .select('role, participant_id, status')
    .eq('space_id', spaceId)
    .eq('user_id', ctx.userId)
    .eq('status', 'active')
    .maybeSingle();

  if (error || !data) {
    return {
      ok: false,
      error: { code: 'forbidden', message: 'You are not a member of this space.' },
    };
  }

  const role = data.role;
  if (requiredAction && !can(role, requiredAction)) {
    return {
      ok: false,
      error: { code: 'forbidden', message: 'You do not have permission for this action.' },
    };
  }

  return {
    ...ctx,
    spaceId,
    role,
    participantId: data.participant_id,
  };
}

function parseInput<T>(schema: SchemaParser<T> | undefined, raw: unknown): T | ActionResult<never> {
  if (!schema) {
    return raw as T;
  }
  try {
    return schema.parse(raw);
  } catch (err) {
    const fields: Record<string, string[]> = {};
    if (err && typeof err === 'object' && 'issues' in err) {
      const issues = (err as { issues: Array<{ path: PropertyKey[]; message: string }> }).issues;
      for (const issue of issues) {
        const key = issue.path.map(String).join('.') || '_root';
        fields[key] ??= [];
        fields[key].push(issue.message);
      }
    }
    return {
      ok: false,
      error: { code: 'validation', message: 'Invalid input.', fields },
    };
  }
}

function isActionError(value: unknown): value is ActionResult<never> {
  return typeof value === 'object' && value !== null && 'ok' in value && value.ok === false;
}

export function authedAction() {
  return {
    schema<TInput>(schema: SchemaParser<TInput>) {
      return {
        space(
          resolveSpaceId: (args: { input: TInput; ctx: AuthedContext }) => string | Promise<string>,
          options?: { action?: SpaceAction },
        ) {
          return {
            action<TResult>(
              handler: (args: {
                input: TInput;
                ctx: SpaceContext;
              }) => Promise<ActionResult<TResult>>,
            ) {
              return async (raw: unknown): Promise<ActionResult<TResult>> => {
                const userOrError = await requireUser();
                if (isActionError(userOrError)) return userOrError;

                const parsed = parseInput(schema, raw);
                if (isActionError(parsed)) return parsed;

                const spaceId = await resolveSpaceId({ input: parsed, ctx: userOrError });
                const spaceOrError = await resolveMembership(userOrError, spaceId, options?.action);
                if (isActionError(spaceOrError)) return spaceOrError;

                return handler({ input: parsed, ctx: spaceOrError });
              };
            },
          };
        },
        action<TResult>(
          handler: (args: { input: TInput; ctx: AuthedContext }) => Promise<ActionResult<TResult>>,
        ) {
          return async (raw: unknown): Promise<ActionResult<TResult>> => {
            const userOrError = await requireUser();
            if (isActionError(userOrError)) return userOrError;

            const parsed = parseInput(schema, raw);
            if (isActionError(parsed)) return parsed;

            return handler({ input: parsed, ctx: userOrError });
          };
        },
      };
    },
  };
}

export type ProfileRow = Database['nido']['Tables']['profiles']['Row'];
export type SpaceRow = Database['nido']['Tables']['spaces']['Row'];
