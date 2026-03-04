import { NextRequest, NextResponse } from 'next/server';
import { getMessages } from '@/lib/file-store';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ phone: string }> }
) {
  const { phone } = await params;
  const decoded = decodeURIComponent(phone);

  try {
    const messages = await getMessages(decoded, { limit: 500 });
    // getMessages returns newest first, reverse to chronological
    return NextResponse.json(messages.reverse());
  } catch (error) {
    console.error('Failed to get messages:', error);
    return NextResponse.json([]);
  }
}
