'use server';

import { redirect } from 'next/navigation';
import { clientEnv } from '@/lib/env';
import { createClient } from '@/lib/supabase/server';
import type { ActionResult } from '@/lib/auth/authed-action';
import {
  forgotPasswordSchema,
  magicLinkSchema,
  resetPasswordSchema,
  signInSchema,
  signUpSchema,
} from './schemas';
import { mapAuthError } from './map-auth-error';
import { safeNext } from './safe-next';
import { route } from '@/lib/routes';

export async function signInAction(raw: unknown): Promise<ActionResult<{ next: string }>> {
  const parsed = signInSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: { code: 'validation', message: 'Invalid credentials.' } };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error) {
    return { ok: false, error: mapAuthError(error) };
  }

  return { ok: true, data: { next: safeNext(parsed.data.next) } };
}

export async function signUpAction(raw: unknown): Promise<ActionResult<{ next: string }>> {
  const parsed = signUpSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: { code: 'validation', message: 'Invalid sign-up details.' } };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { display_name: parsed.data.displayName, full_name: parsed.data.displayName },
      emailRedirectTo: `${clientEnv.NEXT_PUBLIC_APP_URL}/auth/callback?next=${encodeURIComponent(safeNext(parsed.data.next))}`,
    },
  });

  if (error) {
    return { ok: false, error: mapAuthError(error) };
  }

  // Local stack has email confirmation disabled; session may already exist.
  if (data.session) {
    return { ok: true, data: { next: safeNext(parsed.data.next) } };
  }

  return {
    ok: true,
    data: { next: `/sign-in?next=${encodeURIComponent(safeNext(parsed.data.next))}` },
  };
}

export async function signInWithMagicLinkAction(
  raw: unknown,
): Promise<ActionResult<{ sent: true }>> {
  const parsed = magicLinkSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: { code: 'validation', message: 'Invalid email.' } };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data.email,
    options: {
      emailRedirectTo: `${clientEnv.NEXT_PUBLIC_APP_URL}/auth/callback?next=${encodeURIComponent(safeNext(parsed.data.next))}`,
    },
  });

  if (error) {
    return { ok: false, error: mapAuthError(error) };
  }

  return { ok: true, data: { sent: true } };
}

export async function signInWithGoogleAction(next?: string): Promise<void> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${clientEnv.NEXT_PUBLIC_APP_URL}/auth/callback?next=${encodeURIComponent(safeNext(next))}`,
    },
  });

  if (error || !data.url) {
    redirect(route('/sign-in?error=oauth'));
  }

  // OAuth provider URL is absolute; typed routes still require a Route cast.
  redirect(route(data.url));
}

export async function forgotPasswordAction(raw: unknown): Promise<ActionResult<{ sent: true }>> {
  const parsed = forgotPasswordSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: { code: 'validation', message: 'Invalid email.' } };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${clientEnv.NEXT_PUBLIC_APP_URL}/reset-password`,
  });

  if (error) {
    return { ok: false, error: mapAuthError(error) };
  }

  return { ok: true, data: { sent: true } };
}

export async function resetPasswordAction(raw: unknown): Promise<ActionResult<{ done: true }>> {
  const parsed = resetPasswordSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: { code: 'validation', message: 'Invalid password.' } };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });

  if (error) {
    return { ok: false, error: mapAuthError(error) };
  }

  return { ok: true, data: { done: true } };
}

export async function signOutAction(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/sign-in');
}
