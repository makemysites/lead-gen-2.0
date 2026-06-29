import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const date = searchParams.get('date');
    const state = searchParams.get('state');
    const specialty = searchParams.get('specialty');
    const hasEmail = searchParams.get('hasEmail');
    const search = searchParams.get('search');

    let query = supabaseAdmin.from('leads').select('*');

    // Filter by status
    if (status) {
      query = query.eq('status', status);
    }

    // Filter by date
    if (date === 'today') {
      const now = new Date();
      const istTime = new Date(now.getTime() + (5.5 * 60 * 60 * 1000));
      const todayIST = istTime.toISOString().split('T')[0];
      query = query.eq('scraped_date', todayIST);
    } else if (date === 'week') {
      const now = new Date();
      const istTime = new Date(now.getTime() + (5.5 * 60 * 60 * 1000));
      // Go back 7 days
      const oneWeekAgo = new Date(istTime.getTime() - (7 * 24 * 60 * 60 * 1000));
      const oneWeekAgoStr = oneWeekAgo.toISOString().split('T')[0];
      query = query.gte('scraped_date', oneWeekAgoStr);
    }

    // Filter by state
    if (state && state !== 'all') {
      query = query.eq('state', state);
    }

    // Filter by specialty
    if (specialty && specialty !== 'all') {
      query = query.eq('specialty', specialty);
    }

    // Filter by presence of email
    if (hasEmail === 'yes') {
      query = query.not('email', 'is', null).neq('email', '');
    } else if (hasEmail === 'no') {
      // Supabase OR condition to capture both null and empty string
      query = query.or('email.is.null,email.eq.');
    }

    // Filter by search query (practice name)
    if (search) {
      query = query.ilike('practice_name', `%${search}%`);
    }

    // Sort order depends on status
    if (status === 'to_call') {
      query = query.order('scraped_date', { ascending: false });
    } else if (status === 'called') {
      query = query.order('called_at', { ascending: false });
    } else if (status === 'follow_up') {
      query = query.order('follow_up_datetime', { ascending: true });
    } else if (status === 'demo_sent') {
      query = query.order('demo_sent_at', { ascending: false });
    } else {
      query = query.order('created_at', { ascending: false });
    }

    const { data, error } = await query;

    if (error) throw error;

    return NextResponse.json(data || []);
  } catch (error) {
    console.error('Error fetching leads:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
