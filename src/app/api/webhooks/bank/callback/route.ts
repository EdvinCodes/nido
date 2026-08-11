import { NextResponse } from 'next/server';
import { getBankProvider, isBankSyncEnabled } from '@/features/banking/lib';

/** OAuth / consent return URL stub for bank providers. */
export async function GET(request: Request) {
  if (!isBankSyncEnabled()) {
    return NextResponse.json({ error: 'bank_sync_disabled' }, { status: 503 });
  }

  const url = new URL(request.url);
  const ref = url.searchParams.get('ref') ?? url.searchParams.get('state');
  if (!ref) {
    return NextResponse.json({ error: 'missing_ref' }, { status: 400 });
  }

  try {
    const provider = getBankProvider();
    const accounts = await provider.completeSession(ref);
    return NextResponse.json({ ok: true, accounts });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'callback_failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
