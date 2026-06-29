/**
 * Sends a cold email to a dentist lead via Resend API
 * @param {Object} lead - The lead database object
 * @returns {Promise<Object>} - Resend API response
 */
export async function sendColdEmail(lead) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error('RESEND_API_KEY environment variable is not defined.');
  }

  const { practice_name, owner_name, email, demo_link } = lead;
  
  if (!email) {
    throw new Error(`Cannot send email to lead ${lead.id} because email is empty.`);
  }

  const firstName = owner_name ? owner_name.split(' ')[0] : 'Doctor';
  const subject = `Website Complete: ${practice_name}`;

  const webLink = demo_link || 'https://makemysites.github.io/bright-smile-dental/';

  // Compiles email template in a casual personal format
  const emailHtml = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #1E293B; line-height: 1.6; font-size: 15px;">
      <p style="margin-bottom: 20px;">Hi ${firstName},</p>
      
      <p style="margin-bottom: 20px;">Just gonna jump straight to the point.</p>
      
      <p style="margin-bottom: 20px;">
        I saw your clinic on google maps, I feel that you are leaking new patients because of no website.<br />
        It is not high converting, and I think it can be drastically improved to get you 50% to 100% more walk-ins month on month.
      </p>
      
      <p style="margin-bottom: 20px;">
        What I simply did was I hit an all-nighter and went ahead and built you a website. I would love to shoot it over, just so you know that I'm not here just for the talk.
      </p>
      
      <p style="margin-bottom: 20px;">
        Have a look at this already-built website: <a href="${webLink}" style="color: #1D4ED8; text-decoration: underline;">${webLink}</a><br />
        If you like it, say yes and I'll make one for you.
      </p>
      
      <p style="margin-bottom: 20px;">
        Thanks.<br />
        Abhinay
      </p>
      
      <p style="margin-bottom: 24px; font-style: italic; color: #475569;">
        P.S: I would love if you have a look at what I've built, might help me sleep peacefully!
      </p>
      
      <p style="color: #94A3B8; font-size: 12px; margin-top: 32px; border-top: 1px solid #E2E8F0; padding-top: 16px;">
        Sent from my iPhone
      </p>
    </div>
  `;

  // Use the standard Resend REST API endpoint via fetch
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      from: 'Abhinay <abhinay@makemysites.in>',
      to: [email],
      subject: subject,
      html: emailHtml
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Resend API dispatch failed: ${response.statusText}. Details: ${errText}`);
  }

  return await response.json();
}
