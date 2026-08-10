/**
 * Demo users from `supabase/seed.sql`. Available only when the local stack has been
 * reset with seed data (`pnpm db:reset`). Never shown in production UI.
 */
export const DEV_DEMO_USER = {
  label: 'Alex',
  email: 'alex@demo.nido.local',
  password: 'password123',
  spaceName: 'Casa de Alex y Sam',
} as const;

export const DEV_DEMO_USER_ALT = {
  label: 'Sam',
  email: 'sam@demo.nido.local',
  password: 'password123',
} as const;
