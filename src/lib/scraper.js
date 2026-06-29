import { supabaseAdmin } from './supabase';

// Dental categories to rotate through
export const categories = [
  "Dentist", "Family Dentist", "General Dentistry", "Cosmetic Dentist",
  "Pediatric Dentist", "Orthodontist", "Dental Clinic", "Emergency Dentist"
];

// Small/mid US towns in low digital agency saturation zones
export const towns = [
  // Appalachia (Eastern Time)
  { name: "Beckley", state: "WV" },
  { name: "Clarksburg", state: "WV" },
  { name: "Parkersburg", state: "WV" },
  { name: "Martinsburg", state: "WV" },
  { name: "Wheeling", state: "WV" },
  { name: "Fairmont", state: "WV" },
  { name: "Bluefield", state: "WV" },
  { name: "Pikeville", state: "KY" },
  { name: "Hazard", state: "KY" },
  { name: "Prestonsburg", state: "KY" },
  { name: "Harlan", state: "KY" },
  { name: "Abingdon", state: "VA" },
  { name: "Bristol", state: "VA" },
  { name: "Wytheville", state: "VA" },
  
  // Deep South (Central Time)
  { name: "Tupelo", state: "MS" },
  { name: "Oxford", state: "MS" },
  { name: "Greenville", state: "MS" },
  { name: "Columbus", state: "MS" },
  { name: "Meridian", state: "MS" },
  { name: "Dothan", state: "AL" },
  { name: "Decatur", state: "AL" },
  { name: "Florence", state: "AL" },
  { name: "Selma", state: "AL" },
  { name: "Cullman", state: "AL" },
  { name: "Jonesboro", state: "AR" },
  { name: "Hot Springs", state: "AR" },
  { name: "El Dorado", state: "AR" },
  
  // Rural Midwest (Central Time)
  { name: "Salina", state: "KS" },
  { name: "Hays", state: "KS" },
  { name: "Garden City", state: "KS" },
  { name: "Hutchinson", state: "KS" },
  { name: "Emporia", state: "KS" },
  { name: "Kearney", state: "NE" },
  { name: "Grand Island", state: "NE" },
  { name: "North Platte", state: "NE" },
  { name: "Norfolk", state: "NE" },
  { name: "Hastings", state: "NE" },
  { name: "Ottumwa", state: "IA" },
  { name: "Fort Dodge", state: "IA" },
  { name: "Mason City", state: "IA" }
];

// Helper to lookup timezone based on state code
export function lookupTimezone(state) {
  const easternStates = ["WV", "KY", "VA"];
  const centralStates = ["MS", "AL", "AR", "KS", "NE", "IA"];
  
  if (easternStates.includes(state)) return "Eastern";
  if (centralStates.includes(state)) return "Central";
  return "Central"; // Fallback default
}

// Helper to lookup region based on state code
export function lookupRegion(state) {
  const appalachia = ["WV", "KY", "VA"];
  const deepSouth = ["MS", "AL", "AR"];
  const midwest = ["KS", "NE", "IA"];
  
  if (appalachia.includes(state)) return "Appalachia";
  if (deepSouth.includes(state)) return "Deep South";
  if (midwest.includes(state)) return "Midwest";
  return "Unknown";
}

// Generate deterministic search combinations (8 categories * 40 towns = 320 combinations)
export function generateCombinations() {
  const combinations = [];
  for (const category of categories) {
    for (const town of towns) {
      combinations.push({
        category,
        town: town.name,
        state: town.state
      });
    }
  }
  return combinations;
}

// Google Places Text Search (New API)
async function googlePlacesTextSearchNew(query) {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    throw new Error('GOOGLE_PLACES_API_KEY is not set');
  }

  const response = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.nationalPhoneNumber,places.rating,places.userRatingCount,places.websiteUri'
    },
    body: JSON.stringify({
      textQuery: query
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Google Places API error: ${response.statusText}. details: ${errorText}`);
  }

  const data = await response.json();
  return data.places || [];
}

// Main execution function
export async function runDailyScrape() {
  // Format current date as IST date string (YYYY-MM-DD)
  const now = new Date();
  const istTime = new Date(now.getTime() + (5.5 * 60 * 60 * 1000));
  const todayIST = istTime.toISOString().split('T')[0];

  // 1. Check if run for today already exists and succeeded
  const { data: existingRun } = await supabaseAdmin
    .from('scrape_runs')
    .select('*')
    .eq('run_date', todayIST)
    .eq('status', 'success')
    .maybeSingle();

  if (existingRun) {
    return { status: 'skipped', message: 'Daily scrape already completed successfully today.' };
  }

  // 2. Fetch or create today's API usage log
  let { data: apiUsage } = await supabaseAdmin
    .from('api_usage')
    .select('*')
    .eq('date', todayIST)
    .maybeSingle();

  if (!apiUsage) {
    const { data: newUsage, error } = await supabaseAdmin
      .from('api_usage')
      .insert({
        date: todayIST,
        calls_made: 0,
        daily_limit: 60,
        is_limit_reached: false
      })
      .select()
      .maybeSingle();
      
    if (error) {
      console.error('Error creating API usage log:', error);
    }
    apiUsage = newUsage || { date: todayIST, calls_made: 0, daily_limit: 60, is_limit_reached: false };
  }

  if (apiUsage.is_limit_reached) {
    return { status: 'api_limit_hit', message: 'API limit already reached today.' };
  }

  // 3. Log start of scrape run
  const { data: currentRun } = await supabaseAdmin
    .from('scrape_runs')
    .select('*')
    .eq('run_date', todayIST)
    .maybeSingle();

  let runId;
  if (currentRun) {
    runId = currentRun.id;
    await supabaseAdmin
      .from('scrape_runs')
      .update({
        status: 'running',
        message: 'Scraping in progress...',
        started_at: new Date().toISOString()
      })
      .eq('id', runId);
  } else {
    const { data: newRun } = await supabaseAdmin
      .from('scrape_runs')
      .insert({
        run_date: todayIST,
        status: 'running',
        message: 'Scraping started...',
        started_at: new Date().toISOString()
      })
      .select()
      .maybeSingle();
    runId = newRun?.id;
  }

  let leadsFound = 0;
  let apiCallsToday = apiUsage.calls_made;
  const limit = apiUsage.daily_limit;
  let apiLimitReached = false;

  // 4. Retrieve search pointer
  const { data: pointerData } = await supabaseAdmin
    .from('search_pointer')
    .select('pointer_index')
    .eq('id', 1)
    .maybeSingle();
  let pointerIndex = pointerData ? pointerData.pointer_index : 0;

  const combinations = generateCombinations();
  const totalCombinations = combinations.length;

  // 5. Scrape loop
  for (let i = 0; i < totalCombinations; i++) {
    if (leadsFound >= 50) break;

    const currentComboIndex = (pointerIndex + i) % totalCombinations;
    const combo = combinations[currentComboIndex];

    // Check API Limit BEFORE every single Google API call (CRITICAL rule #4)
    if (apiCallsToday >= limit) {
      apiLimitReached = true;
      break;
    }

    const query = `${combo.category} in ${combo.town} ${combo.state}`;
    let places = [];

    try {
      places = await googlePlacesTextSearchNew(query);
    } catch (err) {
      console.error(`Google Places query failed gracefully for "${query}":`, err);
      // Gracefully handle and skip to next query, never crash (CRITICAL rule #10)
      places = [];
    }

    apiCallsToday += 1;

    // Save api usage immediately to guarantee strict tracking
    await supabaseAdmin
      .from('api_usage')
      .update({
        calls_made: apiCallsToday,
        is_limit_reached: apiCallsToday >= limit
      })
      .eq('date', todayIST);

    // Process places found
    for (const place of places) {
      if (leadsFound >= 50) break;

      // Verify the lead has NO website
      if (!place.websiteUri) {
        // Query to check if lead exists
        const { data: existingLead } = await supabaseAdmin
          .from('leads')
          .select('id')
          .eq('place_id', place.id)
          .maybeSingle();

        if (!existingLead) {
          const timezone = lookupTimezone(combo.state);

          // Format phone number for US (+1 prefix if not present) (CRITICAL rule #9)
          let formattedPhone = place.nationalPhoneNumber || '';
          if (formattedPhone) {
            const digitsOnly = formattedPhone.replace(/\D/g, '');
            // Standard US local number has 10 digits
            if (digitsOnly.length === 10) {
              formattedPhone = `+1 ${formattedPhone}`;
            } else if (digitsOnly.length === 11 && digitsOnly.startsWith('1')) {
              // Standardizing "+1 (AAA) BBB-CCCC" or similar
              formattedPhone = `+${formattedPhone.trim()}`;
            }
          }

          // Insert lead to Supabase
          await supabaseAdmin.from('leads').insert({
            place_id: place.id,
            practice_name: place.displayName?.text || 'Dental Practice',
            owner_name: null,
            specialty: combo.category,
            city: combo.town,
            state: combo.state,
            timezone: timezone,
            phone: formattedPhone,
            address: place.formattedAddress || '',
            google_maps_url: `https://www.google.com/maps/place/?q=place_id:${place.id}`,
            rating: place.rating || null,
            total_reviews: place.userRatingCount || 0,
            email: null,
            email_source: null,
            demo_link: null,
            scraped_date: todayIST,
            status: 'to_call',
            notes: ''
          });

          leadsFound += 1;

          // Rate limit write transactions
          await new Promise((resolve) => setTimeout(resolve, 300));
        }
      }
    }

    // Save pointer update
    const nextPointerIndex = (currentComboIndex + 1) % totalCombinations;
    await supabaseAdmin
      .from('search_pointer')
      .update({
        pointer_index: nextPointerIndex,
        updated_at: new Date().toISOString()
      })
      .eq('id', 1);

    // Rate limit Google Search calls
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  // 6. Complete scrape runs status
  let finalStatus = 'success';
  let finalMsg = `Scrape complete. ${leadsFound} new leads added.`;

  if (apiLimitReached) {
    finalStatus = 'api_limit_hit';
    finalMsg = `Google API daily limit of ${limit} calls reached. Found ${leadsFound} leads before limit.`;
    await supabaseAdmin
      .from('api_usage')
      .update({ is_limit_reached: true })
      .eq('date', todayIST);
  }

  if (runId) {
    await supabaseAdmin
      .from('scrape_runs')
      .update({
        status: finalStatus,
        leads_found: leadsFound,
        api_calls_made: apiCallsToday,
        message: finalMsg,
        completed_at: new Date().toISOString()
      })
      .eq('id', runId);
  }

  return {
    status: finalStatus,
    leadsFound,
    apiCallsMade: apiCallsToday,
    message: finalMsg
  };
}
