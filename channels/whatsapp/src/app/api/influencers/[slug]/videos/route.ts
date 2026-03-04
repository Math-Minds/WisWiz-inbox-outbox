import { NextRequest, NextResponse } from 'next/server';
import { getVideos, saveVideos } from '@/lib/influencer-store';
import type { Video } from '@/lib/types';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const videos = await getVideos(slug);
    return NextResponse.json(videos);
  } catch (error) {
    console.error('[API] GET /api/influencers/[slug]/videos error:', error);
    return NextResponse.json(
      { error: 'Failed to get videos' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const body = await request.json();

    const video: Video = {
      id: `vid_${Date.now()}`,
      platform: body.platform || 'tiktok',
      url: body.url || null,
      titel: body.titel || null,
      datum_gepost: body.datum_gepost || null,
      status: body.status || 'concept',
      views: body.views || null,
      likes: body.likes || null,
      comments: body.comments || null,
      notitie: body.notitie || null,
    };

    const videos = await getVideos(slug);
    videos.push(video);
    await saveVideos(slug, videos);

    return NextResponse.json(videos);
  } catch (error) {
    console.error('[API] POST /api/influencers/[slug]/videos error:', error);
    return NextResponse.json(
      { error: 'Failed to add video' },
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
    const body = await request.json();

    if (!body.id) {
      return NextResponse.json(
        { error: 'Missing required field: id' },
        { status: 400 }
      );
    }

    const videos = await getVideos(slug);
    const index = videos.findIndex((v) => v.id === body.id);

    if (index === -1) {
      return NextResponse.json(
        { error: 'Video not found' },
        { status: 404 }
      );
    }

    const { id, ...updates } = body;
    videos[index] = { ...videos[index], ...updates };
    await saveVideos(slug, videos);

    return NextResponse.json(videos);
  } catch (error) {
    console.error('[API] PATCH /api/influencers/[slug]/videos error:', error);
    return NextResponse.json(
      { error: 'Failed to update video' },
      { status: 500 }
    );
  }
}
