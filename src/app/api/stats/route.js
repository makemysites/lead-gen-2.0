import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET() {
  try {
    const now = new Date();
    const istTime = new Date(now.getTime() + (5.5 * 60 * 60 * 1000));
    const todayIST = istTime.toISOString().split('T')[0];

    // Fetch counts in parallel using head requests for maximum performance
    const [
      totalRes,
      toCallRes,
      calledRes,
      followUpRes,
      demoSentRes,
      rejectedRes,
      todayRes,
      apiUsageRes
    ] = await Promise.all([
      supabaseAdmin.from('leads').select('*', { count: 'exact', head: true }),
      supabaseAdmin.from('leads').select('*', { count: 'exact', head: true }).eq('status', 'to_call'),
      supabaseAdmin.from('leads').select('*', { count: 'exact', head: true }).eq('status', 'called'),
      supabaseAdmin.from('leads').select('*', { count: 'exact', head: true }).eq('status', 'follow_up'),
      supabaseAdmin.from('leads').select('*', { count: 'exact', head: true }).eq('status', 'demo_sent'),
      supabaseAdmin.from('leads').select('*', { count: 'exact', head: true }).eq('status', 'rejected'),
      supabaseAdmin.from('leads').select('*', { count: 'exact', head: true }).eq('scraped_date', todayIST),
      supabaseAdmin.from('api_usage').select('*').eq('date', todayIST).maybeSingle()
    ]);

    if (totalRes.error) throw totalRes.error;

    return NextResponse.json({
      total: totalRes.count || 0,
      toCall: toCallRes.count || 0,
      called: calledRes.count || 0,
      followUp: followUpRes.count || 0,
      demoSent: demoSentRes.count || 0,
      rejected: rejectedRes.count || 0,
      todayCount: todayRes.count || 0,
      apiUsageToday: apiUsageRes.data ? apiUsageRes.data.calls_made : 0,
      apiLimitToday: apiUsageRes.data ? apiUsageRes.data.daily_limit : 60,
      apiLimitReached: apiUsageRes.data ? apiUsageRes.data.is_limit_reached : false
    });
  } catch (error) {
    console.error('Error fetching statistics:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
