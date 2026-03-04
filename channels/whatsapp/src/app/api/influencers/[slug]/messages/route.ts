import { NextRequest, NextResponse } from 'next/server';
import { getWhatsAppMessages } from '@/lib/influencer-store';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const messages = await getWhatsAppMessages(slug);
    return NextResponse.json(messages);
  } catch (error) {
    console.error('[API] GET /api/influencers/[slug]/messages error:', error);
    return NextResponse.json(
      { error: 'Failed to get messages' },
      { status: 500 }
    );
  }
}
