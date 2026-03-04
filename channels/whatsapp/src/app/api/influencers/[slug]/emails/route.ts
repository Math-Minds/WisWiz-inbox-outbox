import { NextRequest, NextResponse } from 'next/server';
import { getEmailThreads } from '@/lib/influencer-store';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const threads = await getEmailThreads(slug);
    return NextResponse.json(threads);
  } catch (error) {
    console.error('[API] GET /api/influencers/[slug]/emails error:', error);
    return NextResponse.json(
      { error: 'Failed to get email threads' },
      { status: 500 }
    );
  }
}
