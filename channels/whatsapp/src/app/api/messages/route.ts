/**
 * Messages API
 *
 * GET /api/messages?phone=x          - Get messages for a contact
 * GET /api/messages?phone=x&limit=20 - Get limited messages
 */

import { NextRequest, NextResponse } from 'next/server';
import { getMessages, listChats } from '@/lib/file-store';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const phone = searchParams.get('phone');
  const limit = parseInt(searchParams.get('limit') || '100');
  const offset = parseInt(searchParams.get('offset') || '0');

  if (!phone) {
    // Return list of all chats
    const chats = await listChats();
    return NextResponse.json(chats);
  }

  const messages = await getMessages(phone, { limit, offset });
  return NextResponse.json(messages);
}
