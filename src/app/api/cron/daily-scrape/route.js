import { NextResponse } from 'next/server';
import { runDailyScrape } from '@/lib/scraper';

// Force dynamic execution for API route
export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    // Security Verification (Vercel Cron Header Verification)
    if (process.env.NODE_ENV === 'production') {
      if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ error: 'Unauthorized: Invalid CRON_SECRET header.' }, { status: 401 });
      }
    } else {
      // In local dev, allow bypass if key matches test or CRON_SECRET is not configured
      if (cronSecret && authHeader !== `Bearer ${cronSecret}` && authHeader !== 'Bearer test') {
        return NextResponse.json({ error: 'Unauthorized: Invalid CRON_SECRET header.' }, { status: 401 });
      }
    }

    // Launch daily scrape engine
    const result = await runDailyScrape();

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      ...result
    });
  } catch (error) {
    console.error('Error running daily scrape cron:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}

// In Next.js, Vercel cron jobs can send POST requests too
export async function POST(request) {
  return GET(request);
}
