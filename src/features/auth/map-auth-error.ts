import type { ActionError } from '@/lib/auth/authed-action';

type AuthLikeError = {
  message: string;
  status?: number | undefined;
};

/** Map Supabase Auth errors to stable codes the UI can translate. */
export function mapAuthError(error: AuthLikeError): ActionError {
  const message = error.message.toLowerCase();
  const status = error.status;

  if (message.includes('invalid login credentials') || message.includes('invalid_credentials')) {
    return { code: 'invalid_credentials', message: 'Wrong email or password.' };
  }
  if (message.includes('email not confirmed')) {
    return { code: 'email_not_confirmed', message: 'Confirm your email before signing in.' };
  }
  if (message.includes('user already registered') || message.includes('already been registered')) {
    return {
      code: 'email_exists',
      message: 'An account already exists with this email. Try signing in.',
    };
  }
  if (status === 429 || message.includes('rate limit') || message.includes('too many')) {
    return { code: 'rate_limited', message: 'Too many attempts. Try again in a moment.' };
  }
  if (message.includes('password')) {
    return { code: 'weak_password', message: error.message };
  }

  return { code: 'auth_error', message: error.message };
}
