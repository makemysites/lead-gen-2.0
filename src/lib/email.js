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

  const recipientName = owner_name ? `Dr. ${owner_name}` : 'Doctor';
  const subject = demo_link
    ? `Custom website design preview for ${practice_name}`
    : `Free homepage design mockup for ${practice_name}`;

  // Compiles email template
  const emailHtml = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #1E293B; line-height: 1.6;">
      <p style="font-size: 16px; margin-bottom: 20px;">Hi ${recipientName},</p>
      
      <p style="font-size: 15px; margin-bottom: 16px;">
        I was searching for top-rated dental practices in your area and noticed that <strong>${practice_name}</strong> doesn't have an active website, or your current link isn't loading. 
      </p>
      
      ${demo_link ? `
        <p style="font-size: 15px; margin-bottom: 16px;">
          I actually went ahead and built a <strong>free homepage mockup demo website</strong> specifically for your practice so you can see what is possible. You can check it out here:
        </p>
        <div style="margin: 25px 0; text-align: left;">
          <a href="${demo_link}" target="_blank" style="background-color: #1D4ED8; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 15px; display: inline-block; box-shadow: 0 4px 6px -1px rgba(29, 78, 216, 0.2);">
            View Custom Demo Site &rarr;
          </a>
        </div>
        <p style="font-size: 15px; margin-bottom: 16px;">
          If you love the design and layout, we can connect it to your domain. If not, there is absolutely no charge, and no obligations whatsoever.
        </p>
      ` : `
        <p style="font-size: 15px; margin-bottom: 16px;">
          I specialize in building modern, high-converting websites for dental clinics. I would love to build a <strong>free custom homepage mockup</strong> for your practice so you can see exactly how it would look — completely free of cost, with no payment info required up front.
        </p>
        <p style="font-size: 15px; margin-bottom: 16px;">
          If you like the mockup, we can launch it and make it yours. If not, no worries at all!
        </p>
      `}
      
      <p style="font-size: 15px; margin-bottom: 24px;">
        Would you be open to checking out a free mockup for your practice? Reply to this email and let me know.
      </p>
      
      <p style="font-size: 15px; margin-bottom: 0; border-top: 1px solid #E2E8F0; padding-top: 20px; color: #64748B;">
        Best regards,<br />
        <strong>Abhinay</strong><br />
        Founder, MakeMySites<br />
        <a href="https://makemysites.in" style="color: #1D4ED8; text-decoration: none;">makemysites.in</a><br />
        Email: <a href="mailto:abhinay@makemysites.in" style="color: #1D4ED8; text-decoration: none;">abhinay@makemysites.in</a>
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
