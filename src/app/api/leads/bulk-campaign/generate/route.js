import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { towns, categories, lookupTimezone } from '@/lib/scraper';

// Force dynamic execution for API route
export const dynamic = 'force-dynamic';

const firstNames = [
  'James', 'Mary', 'John', 'Patricia', 'Robert', 'Jennifer', 'Michael', 'Linda',
  'William', 'Elizabeth', 'David', 'Barbara', 'Richard', 'Susan', 'Joseph', 'Jessica',
  'Thomas', 'Sarah', 'Charles', 'Karen', 'Christopher', 'Nancy', 'Daniel', 'Lisa',
  'Matthew', 'Betty', 'Anthony', 'Margaret', 'Mark', 'Sandra', 'Donald', 'Ashley'
];

const lastNames = [
  'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis',
  'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson', 'Thomas',
  'Taylor', 'Moore', 'Jackson', 'Martin', 'Lee', 'Perez', 'Thompson', 'White',
  'Harris', 'Sanchez', 'Clark', 'Ramirez', 'Lewis', 'Robinson', 'Walker', 'Young'
];

const clinicSuffixes = [
  'Dental Care', 'Family Dentistry', 'Dental Clinic', 'Dental Associates',
  'Dentistry for Kids', 'Cosmetic Dentistry', 'Emergency Dental Clinic', 'Orthodontic Center'
];

export async function POST(request) {
  try {
    const { count = 100, targetEmail = 'abhinay@makemysites.in' } = await request.json();

    if (count < 1 || count > 250) {
      return NextResponse.json({ error: 'Count must be between 1 and 250' }, { status: 400 });
    }

    // Split target email into username and domain for sub-addressing
    let emailUser = 'abhinay';
    let emailDomain = 'makemysites.in';
    if (targetEmail && targetEmail.includes('@')) {
      const parts = targetEmail.split('@');
      emailUser = parts[0];
      emailDomain = parts[1];
    }

    // Format current date as IST date string (YYYY-MM-DD)
    const now = new Date();
    const istTime = new Date(now.getTime() + (5.5 * 60 * 60 * 1000));
    const todayIST = istTime.toISOString().split('T')[0];

    const generatedLeads = [];

    for (let i = 0; i < count; i++) {
      const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
      const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
      const ownerName = `${firstName} ${lastName}`;
      
      const town = towns[Math.floor(Math.random() * towns.length)];
      const clinicSuffix = clinicSuffixes[Math.floor(Math.random() * clinicSuffixes.length)];
      const practiceName = `${town.name} ${clinicSuffix}`;
      
      const specialty = categories[Math.floor(Math.random() * categories.length)];
      const timezone = lookupTimezone(town.state);
      
      const rating = (Math.random() * (4.8 - 3.5) + 3.5).toFixed(1);
      const totalReviews = Math.floor(Math.random() * 85) + 5;
      
      // Construct unique sub-address
      const sanitizedName = ownerName.toLowerCase().replace(/[^a-z0-9]/g, '_');
      const uniqueEmail = `${emailUser}+${sanitizedName}_${Math.floor(Math.random() * 10000)}@${emailDomain}`;

      const phoneArea = Math.floor(Math.random() * (999 - 200) + 200);
      const phonePrefix = Math.floor(Math.random() * (999 - 200) + 200);
      const phoneLine = Math.floor(Math.random() * (9999 - 1000) + 1000);
      const phone = `+1 (${phoneArea}) ${phonePrefix}-${phoneLine}`;

      const placeId = `mock_place_${Date.now()}_${i}_${Math.random().toString(36).substr(2, 5)}`;

      generatedLeads.push({
        place_id: placeId,
        practice_name: practiceName,
        owner_name: ownerName,
        specialty: specialty,
        city: town.name,
        state: town.state,
        timezone: timezone,
        phone: phone,
        address: `${Math.floor(Math.random() * 8000) + 100} Main St, ${town.name}, ${town.state}`,
        google_maps_url: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(practiceName + ' ' + town.name)}`,
        rating: parseFloat(rating),
        total_reviews: totalReviews,
        email: uniqueEmail,
        email_source: 'manual',
        demo_link: null,
        scraped_date: todayIST,
        status: 'to_call',
        notes: 'Generated via Bulk Outreach Campaign'
      });
    }

    // Insert in batches of 50 to prevent Supabase transaction limits/timeouts
    const batchSize = 50;
    const insertedLeads = [];

    for (let i = 0; i < generatedLeads.length; i += batchSize) {
      const batch = generatedLeads.slice(i, i + batchSize);
      const { data, error } = await supabaseAdmin
        .from('leads')
        .insert(batch)
        .select();

      if (error) {
        console.error('Error inserting batch:', error);
        throw error;
      }
      
      if (data) {
        insertedLeads.push(...data);
      }
    }

    return NextResponse.json({
      success: true,
      count: insertedLeads.length,
      leads: insertedLeads
    });
  } catch (error) {
    console.error('Error generating bulk campaign leads:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
