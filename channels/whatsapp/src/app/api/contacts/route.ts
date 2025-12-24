/**
 * Contacts API
 *
 * GET  /api/contacts         - List all contacts
 * GET  /api/contacts?phone=x - Get specific contact
 * POST /api/contacts         - Create/update contact
 */

import { NextRequest, NextResponse } from 'next/server';
import { listContacts, getContact, updateContact } from '@/lib/file-store';
import type { Contact } from '@/lib/types';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const phone = searchParams.get('phone');

  if (phone) {
    const contact = await getContact(phone);
    if (!contact) {
      return NextResponse.json({ error: 'Contact not found' }, { status: 404 });
    }
    return NextResponse.json(contact);
  }

  const contacts = await listContacts();
  return NextResponse.json(contacts);
}

export async function POST(request: NextRequest) {
  try {
    const data: Partial<Contact> & { phone: string } = await request.json();

    if (!data.phone) {
      return NextResponse.json(
        { error: 'Phone number is required' },
        { status: 400 }
      );
    }

    const contact = await updateContact(data.phone, data);
    return NextResponse.json(contact);
  } catch (error) {
    console.error('[Contacts] Error:', error);
    return NextResponse.json(
      { error: 'Failed to update contact' },
      { status: 500 }
    );
  }
}
