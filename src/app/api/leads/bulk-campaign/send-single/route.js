import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { sendColdEmail } from '@/lib/email';

// Force dynamic execution for API route
export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    const { leadId } = await request.json();

    if (!leadId) {
      return NextResponse.json({ error: 'leadId is required' }, { status: 400 });
    }

    // 1. Fetch the lead
    const { data: lead, error: fetchError } = await supabaseAdmin
      .from('leads')
      .select('*')
      .eq('id', leadId)
      .maybeSingle();

    if (fetchError || !lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    if (!lead.email) {
      return NextResponse.json({ error: 'Lead does not have an email address' }, { status: 400 });
    }

    // 2. Send the cold email
    try {
      await sendColdEmail(lead);

      // 3. Update the lead status to demo_sent
      const { data: updatedLead, error: updateError } = await supabaseAdmin
        .from('leads')
        .update({
          status: 'demo_sent',
          demo_sent_at: new Date().toISOString()
        })
        .eq('id', leadId)
        .select()
        .maybeSingle();

      if (updateError) throw updateError;

      return NextResponse.json({
        success: true,
        lead: updatedLead
      });
    } catch (emailErr) {
      console.error(`Failed to send email to lead ${leadId}:`, emailErr);
      
      // Update notes with the failure details so the user can inspect it
      await supabaseAdmin
        .from('leads')
        .update({
          notes: `[Bulk Campaign Fail]: ${emailErr.message}. ${lead.notes || ''}`.substring(0, 1000)
        })
        .eq('id', leadId);

      return NextResponse.json({
        success: false,
        error: emailErr.message
      }, { status: 500 });
    }
  } catch (error) {
    console.error('Error in send-single bulk campaign route:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
