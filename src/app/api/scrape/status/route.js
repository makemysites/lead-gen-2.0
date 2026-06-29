import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { lookupRegion } from '@/lib/scraper';

export async function GET() {
  try {
    const now = new Date();
    const istTime = new Date(now.getTime() + (5.5 * 60 * 60 * 1000));
    const todayIST = istTime.toISOString().split('T')[0];

    // 1. Get today's scrape run status
    const { data: todayRun } = await supabaseAdmin
      .from('scrape_runs')
      .select('*')
      .eq('run_date', todayIST)
      .maybeSingle();

    // 2. Get today's API usage details
    const { data: todayUsage } = await supabaseAdmin
      .from('api_usage')
      .select('*')
      .eq('date', todayIST)
      .maybeSingle();

    // 3. Get last 7 scrape runs
    const { data: runHistory } = await supabaseAdmin
      .from('scrape_runs')
      .select('run_date, leads_found, api_calls_made, status, message')
      .order('run_date', { ascending: false })
      .limit(7);

    // 4. Calculate Zone (Region) Performance
    const { data: leadsData, error: leadsError } = await supabaseAdmin
      .from('leads')
      .select('state, email, status');

    if (leadsError) throw leadsError;

    const regionsStats = {
      'Appalachia': { total: 0, withEmail: 0, demoSent: 0 },
      'Deep South': { total: 0, withEmail: 0, demoSent: 0 },
      'Midwest': { total: 0, withEmail: 0, demoSent: 0 }
    };

    if (leadsData) {
      leadsData.forEach(lead => {
        const region = lookupRegion(lead.state);
        if (regionsStats[region]) {
          regionsStats[region].total += 1;
          if (lead.email && lead.email.trim() !== '') {
            regionsStats[region].withEmail += 1;
          }
          if (lead.status === 'demo_sent') {
            regionsStats[region].demoSent += 1;
          }
        }
      });
    }

    const zonePerformance = Object.keys(regionsStats).map(regionName => {
      const stats = regionsStats[regionName];
      return {
        region: regionName,
        totalLeads: stats.total,
        emailCaptureRate: stats.total > 0 ? Math.round((stats.withEmail / stats.total) * 100) : 0,
        demoSentRate: stats.total > 0 ? Math.round((stats.demoSent / stats.total) * 100) : 0
      };
    });

    return NextResponse.json({
      todayRun: todayRun || null,
      todayUsage: todayUsage || { calls_made: 0, daily_limit: 60, is_limit_reached: false },
      runHistory: runHistory || [],
      zonePerformance
    });
  } catch (error) {
    console.error('Error fetching scrape status:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(request) {
  try {
    const { dailyLimit } = await request.json();
    if (dailyLimit === undefined || dailyLimit < 10 || dailyLimit > 100) {
      return NextResponse.json({ error: 'Daily limit must be between 10 and 100.' }, { status: 400 });
    }

    const now = new Date();
    const istTime = new Date(now.getTime() + (5.5 * 60 * 60 * 1000));
    const todayIST = istTime.toISOString().split('T')[0];

    // Check if usage row exists
    let { data: todayUsage } = await supabaseAdmin
      .from('api_usage')
      .select('*')
      .eq('date', todayIST)
      .maybeSingle();

    if (todayUsage) {
      // Update existing
      const isLimitReached = todayUsage.calls_made >= dailyLimit;
      const { data: updatedUsage, error } = await supabaseAdmin
        .from('api_usage')
        .update({
          daily_limit: dailyLimit,
          is_limit_reached: isLimitReached
        })
        .eq('id', todayUsage.id)
        .select()
        .single();
      
      if (error) throw error;
      return NextResponse.json({ success: true, usage: updatedUsage });
    } else {
      // Create new
      const { data: newUsage, error } = await supabaseAdmin
        .from('api_usage')
        .insert({
          date: todayIST,
          calls_made: 0,
          daily_limit: dailyLimit,
          is_limit_reached: false
        })
        .select()
        .single();
        
      if (error) throw error;
      return NextResponse.json({ success: true, usage: newUsage });
    }
  } catch (error) {
    console.error('Error updating daily limit:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// Clear all leads (Danger Zone)
export async function DELETE(request) {
  try {
    const { confirmText } = await request.json();
    if (confirmText !== 'DELETE') {
      return NextResponse.json({ error: 'Invalid confirmation text. Must type DELETE.' }, { status: 400 });
    }

    // Delete all records from leads, scrape_runs, and api_usage
    const deleteLeads = supabaseAdmin.from('leads').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    const deleteRuns = supabaseAdmin.from('scrape_runs').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    const deleteUsage = supabaseAdmin.from('api_usage').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    
    // Reset search pointer
    const resetPointer = supabaseAdmin.from('search_pointer').update({ pointer_index: 0 }).eq('id', 1);

    await Promise.all([deleteLeads, deleteRuns, deleteUsage, resetPointer]);

    return NextResponse.json({ success: true, message: 'All database tables successfully cleared.' });
  } catch (error) {
    console.error('Error clearing database:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
