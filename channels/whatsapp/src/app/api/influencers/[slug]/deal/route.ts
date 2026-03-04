import { NextRequest, NextResponse } from 'next/server';
import { getOrCreateDeal, saveDeal } from '@/lib/influencer-store';
import type { Deal, Payment } from '@/lib/types';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const deal = await getOrCreateDeal(slug);
    return NextResponse.json(deal);
  } catch (error) {
    console.error('[API] GET /api/influencers/[slug]/deal error:', error);
    return NextResponse.json(
      { error: 'Failed to get deal' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const deal: Deal = await request.json();
    await saveDeal(slug, deal);
    return NextResponse.json(deal);
  } catch (error) {
    console.error('[API] PUT /api/influencers/[slug]/deal error:', error);
    return NextResponse.json(
      { error: 'Failed to update deal' },
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
    const action = request.nextUrl.searchParams.get('action');

    if (action !== 'add_payment') {
      return NextResponse.json(
        { error: 'Unknown action. Supported: ?action=add_payment' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { bedrag, status, datum, methode, referentie, notitie } = body;

    if (bedrag == null || !status || !datum || !methode) {
      return NextResponse.json(
        { error: 'Missing required fields: bedrag, status, datum, methode' },
        { status: 400 }
      );
    }

    const deal = await getOrCreateDeal(slug);

    const payment: Payment = {
      id: `pay_${Date.now()}`,
      bedrag,
      status,
      datum,
      methode,
      referentie: referentie || null,
      notitie: notitie || null,
    };

    deal.betalingen.push(payment);
    deal.tijdlijn.push({
      timestamp: new Date().toISOString(),
      type: 'betaling',
      tekst: `Betaling toegevoegd: ${bedrag} EUR (${status})`,
    });

    await saveDeal(slug, deal);
    return NextResponse.json(deal);
  } catch (error) {
    console.error('[API] POST /api/influencers/[slug]/deal error:', error);
    return NextResponse.json(
      { error: 'Failed to add payment' },
      { status: 500 }
    );
  }
}
