import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { sendColdEmail } from '@/lib/email';

export async function PATCH(request, { params }) {
  try {
    const { id } = params;
    const body = await request.json();

    // 1. Retrieve the existing lead details
    const { data: existingLead, error: getError } = await supabaseAdmin
      .from('leads')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (getError || !existingLead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    // 2. Prepare update payload
    const updateData = { ...body };

    // Set timestamps for explicit status changes
    if (body.status === 'called' && existingLead.status !== 'called') {
      updateData.called_at = new Date().toISOString();
    }
    if (body.status === 'demo_sent' && existingLead.status !== 'demo_sent') {
      updateData.demo_sent_at = new Date().toISOString();
    }

    // Check if we are capturing an email address for the first time
    const isNewEmailAdded = body.email && !existingLead.email;

    // 3. Update the lead record in Supabase
    const { data: updatedLead, error: updateError } = await supabaseAdmin
      .from('leads')
      .update(updateData)
      .eq('id', id)
      .select()
      .maybeSingle();

    if (updateError) throw updateError;

    // 4. Trigger cold email automation if email was added for the first time
    if (isNewEmailAdded) {
      try {
        await sendColdEmail(updatedLead);

        // Update the status to 'demo_sent' and set demo_sent_at automatically
        const { data: finalLead, error: finalError } = await supabaseAdmin
          .from('leads')
          .update({
            status: 'demo_sent',
            demo_sent_at: new Date().toISOString()
          })
          .eq('id', id)
          .select()
          .maybeSingle();

        if (finalError) throw finalError;

        return NextResponse.json({ lead: finalLead, emailSent: true });
      } catch (emailErr) {
        console.error('Failed to send automated cold email:', emailErr);
        // Do not crash the API, return lead update + error message so the UI can display a toast notification
        return NextResponse.json({
          lead: updatedLead,
          emailSent: false,
          emailError: emailErr.message
        });
      }
    }

    return NextResponse.json({ lead: updatedLead, emailSent: false });
  } catch (error) {
    console.error('Error updating lead:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
