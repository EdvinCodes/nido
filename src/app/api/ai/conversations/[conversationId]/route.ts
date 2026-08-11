import { NextResponse } from 'next/server';
import { loadConversationMessages } from '@/features/assistant/queries';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ conversationId: string }> },
): Promise<Response> {
  const { conversationId } = await params;
  const { searchParams } = new URL(req.url);
  const spaceId = searchParams.get('spaceId');
  if (!spaceId) {
    return NextResponse.json({ error: 'validation' }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }

  const { data: conversation, error } = await supabase
    .from('ai_conversations')
    .select('id')
    .eq('id', conversationId)
    .eq('space_id', spaceId)
    .eq('user_id', user.id)
    .maybeSingle();
  if (error || !conversation) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  const messages = await loadConversationMessages(conversationId);
  return NextResponse.json({ messages });
}
