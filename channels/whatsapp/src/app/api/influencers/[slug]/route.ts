import { NextRequest, NextResponse } from 'next/server';
import { getInfluencer, updateProfile } from '@/lib/influencer-store';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const profile = await getInfluencer(slug);

    if (!profile) {
      return NextResponse.json(
        { error: 'Influencer not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(profile);
  } catch (error) {
    console.error('[API] GET /api/influencers/[slug] error:', error);
    return NextResponse.json(
      { error: 'Failed to get influencer' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const updates = await request.json();

    const existing = await getInfluencer(slug);
    if (!existing) {
      return NextResponse.json(
        { error: 'Influencer not found' },
        { status: 404 }
      );
    }

    const updated = await updateProfile(slug, updates);
    return NextResponse.json(updated);
  } catch (error) {
    console.error('[API] PATCH /api/influencers/[slug] error:', error);
    return NextResponse.json(
      { error: 'Failed to update influencer' },
      { status: 500 }
    );
  }
}
