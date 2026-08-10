import { Suspense } from 'react';
import { SignInForm } from '@/features/auth/sign-in-form';

export default function SignInPage() {
  return (
    <Suspense>
      <SignInForm />
    </Suspense>
  );
}
