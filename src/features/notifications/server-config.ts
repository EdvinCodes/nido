import { getServerEnv } from '@/lib/env';

export function getEmailConfigured(): boolean {
  return Boolean(getServerEnv().RESEND_API_KEY);
}

export function getPushConfigured(): boolean {
  const env = getServerEnv();
  return Boolean(env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY);
}

export function getVapidPublicKey(): string | null {
  return getServerEnv().VAPID_PUBLIC_KEY ?? null;
}
