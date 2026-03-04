import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

export const dynamic = 'force-dynamic';

const STATUS_FILE = path.join(process.cwd(), 'sync', 'sync-status.json');

export async function GET() {
  try {
    const raw = await fs.readFile(STATUS_FILE, 'utf-8');
    return NextResponse.json(JSON.parse(raw));
  } catch {
    return NextResponse.json({
      status: 'idle',
      qrDataUrl: null,
      updatedAt: null,
      progress: null,
      result: null,
      error: null,
    });
  }
}
