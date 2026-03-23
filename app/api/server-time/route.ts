import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * Returns the server's current time in ISO format.
 * Used by clients to calculate time offset and always display server time.
 */
export async function GET() {
  return NextResponse.json(
    { serverTime: new Date().toISOString() },
    {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    }
  );
}
