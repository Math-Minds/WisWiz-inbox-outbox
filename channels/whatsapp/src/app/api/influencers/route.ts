import { NextRequest, NextResponse } from 'next/server';
import { listInfluencers } from '@/lib/influencer-store';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const search = searchParams.get('search')?.toLowerCase();
    const status = searchParams.get('status');
    const archived = searchParams.get('archived');

    let influencers = await listInfluencers();

    // Default: hide archived unless explicitly requested
    if (archived === 'true') {
      influencers = influencers.filter((i) => i.archived);
    } else if (archived !== 'all') {
      influencers = influencers.filter((i) => !i.archived);
    }

    if (search) {
      influencers = influencers.filter(
        (i) =>
          i.naam.toLowerCase().includes(search) ||
          i.tiktok?.toLowerCase().includes(search)
      );
    }

    if (status) {
      influencers = influencers.filter((i) => i.dealStatus === status);
    }

    return NextResponse.json(influencers);
  } catch (error) {
    console.error('[API] GET /api/influencers error:', error);
    return NextResponse.json(
      { error: 'Failed to list influencers' },
      { status: 500 }
    );
  }
}
