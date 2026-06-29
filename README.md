# 🦷 US Dental Lead Generation & Outreach CRM

An automated, serverless CRM built for website developers to discover top-rated US dentists without active websites, schedule cold calls, and automate email pitch campaigns.

---

## 🚀 Free Tier Tech Stack (Zero Spending)

- **Framework**: Next.js 14 (App Router) & React 18
- **Database**: Supabase PostgreSQL (Free 500MB database + Realtime subscriptions)
- **Email Gateway**: Resend (Free tier: 3,000 emails/month, 100/day)
- **Deployment**: Vercel (Free Hobby tier)
- **Scheduler**: Vercel Cron Jobs (Free scheduler triggers daily scrape)
- **Data Source**: Google Places API (New) Text Search (utilizes free $200/month Google Cloud credit)

---

## 🛠️ Step-by-Step Setup Guide

### Step 1: Create and Configure your Supabase Project

1. Sign up for a free account at [supabase.com](https://supabase.com) and create a new project named `dental-outreach-crm`.
2. Open the **SQL Editor** in the Supabase Dashboard and click **New Query**.
3. Copy the SQL schema from [supabase/schema.sql](file:///d:/LeadGenerator%202.0/supabase/schema.sql) and paste it into the editor. Click **Run** to generate the tables:
   - `leads`: Customer contact details, outreach status, notes, follow-up dates.
   - `scrape_runs`: Log files auditing the daily scraper results.
   - `api_usage`: Tracker preventing excess Google API calls.
   - `search_pointer`: Rotation pointer index tracking category and town iterations.
4. Copy your project connection credentials to `.env.local` (see Environment Variables section below).

---

### Step 2: Get a Google Places API (New) Key

1. Navigate to the [Google Cloud Console](https://console.cloud.google.com).
2. Create a new project and enable the **Places API (New)**.
3. Generate an API Key under **APIs & Services > Credentials**.
4. Set up an **API restriction** limiting the key usage to the **Places API (New)**.
5. Set up **HTTP referrer restrictions** once your Vercel URL is available to prevent API theft.
6. **Strict Cost Protection Cap**: Navigate to **IAM & Admin > Quotas & System Limits**. Search for "Text Search Requests" under Places API and configure a daily cap of **100 requests**. This guarantees you will never exceed the Google Cloud free credit limit.
7. Paste the API key into `GOOGLE_PLACES_API_KEY` in `.env.local`.

---

### Step 3: Setup Resend for Cold Email Automation

1. Create a free account at [resend.com](https://resend.com) (no credit card required).
2. Click **Domains > Add Domain** and enter your domain name: `makemysites.in`.
3. Configure the provided TXT and MX records in your domain DNS registrar (e.g. GoDaddy, Hostinger) to verify domain authority.
4. Go to **API Keys** and click **Create API Key** with Full Access permissions.
5. Paste the key into `RESEND_API_KEY` in `.env.local`.

---

### Step 4: Configure Local Environment

Create a `.env.local` file in your workspace root directory and add the following keys:

```env
# Supabase Keys (Copy from Supabase Settings > API)
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-public-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Google Cloud Places Key
GOOGLE_PLACES_API_KEY=your-google-api-key

# Resend API Key
RESEND_API_KEY=re_your-resend-api-key

# Vercel Cron Authentication Key (Select a secure random string)
CRON_SECRET=your-random-cron-secret-key
```

---

### Step 5: Test the Application Locally

1. Run the local dev server:
   ```bash
   npm run dev
   ```
2. Navigate to [http://localhost:3000](http://localhost:3000). The dashboard should display connections, countdowns, and tables.
3. Open the **Settings** view to verify the API connection displays a green **CONNECTED** status.
4. Trigger a manual test scrape in the background using curl:
   ```bash
   curl -H "Authorization: Bearer test" http://localhost:3000/api/cron/daily-scrape
   ```
5. Confirm that new leads successfully pop up in real-time on your dashboard and "To Call" table!
6. Enter a test email address on the "To Call" lead table and click outside the box (blur event). Verify that:
   - A success toast is displayed: `📧 Cold email sent automatically!`
   - The status updates to `demo_sent` and the lead relocates to the **Demo Sent** tab.
   - The recipient mailbox receives a professional pitch sent from `abhinay@makemysites.in`.

---

### Step 6: Deploy to Vercel

1. Push your project files to a GitHub repository.
2. Sign in to [Vercel](https://vercel.com) and click **Add New > Project**. Select your repository.
3. In Vercel's project setup screen, configure all the environment variables from your `.env.local` file.
4. Click **Deploy**. Vercel will build the application.
5. Once deployed, the Vercel Scheduler will automatically parse `vercel.json` and configure the daily cron trigger schedule for 1:30 AM UTC (7:00 AM IST) daily.

---

## 🎯 Lead Outreach Execution Strategy

### Timezone Target Window
The scraped US dentist leads reside in the **US Eastern** and **US Central** time zones.
- **Calling hours (US 9:00 AM – 5:00 PM)** match **7:30 PM – 3:30 AM IST (India)**.
- For best cold-calling conversions, execute call lists in the late evening/night from India.

### Cold Email Trigger Logic
Our custom CRM initiates contact automatically:
- When you first discover a dentist's email address (via cold call, Facebook, or web enrichment), input the address in the **To Call** view.
- The system automatically compiles the business context, selects the appropriate template (e.g. customized demo site mockup pitch if a `demo_link` is present vs. a free homepage design mockup pitch if no link exists yet), dispatches the email via **Resend**, and updates the status to **Demo Sent** in the database.
