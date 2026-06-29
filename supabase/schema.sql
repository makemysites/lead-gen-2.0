-- Create leads table
CREATE TABLE IF NOT EXISTS public.leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    place_id TEXT UNIQUE NOT NULL,
    practice_name TEXT NOT NULL,
    owner_name TEXT,
    specialty TEXT,
    city TEXT,
    state TEXT,
    timezone TEXT,
    phone TEXT,
    address TEXT,
    google_maps_url TEXT,
    rating NUMERIC(2,1),
    total_reviews INTEGER,
    email TEXT,
    email_source TEXT CHECK (email_source IN ('enrichment', 'call', 'manual')),
    demo_link TEXT,
    scraped_date DATE NOT NULL,
    status TEXT DEFAULT 'to_call' CHECK (status IN ('to_call', 'called', 'follow_up', 'demo_sent', 'rejected')),
    notes TEXT,
    follow_up_datetime TIMESTAMPTZ,
    follow_up_note TEXT,
    called_at TIMESTAMPTZ,
    demo_sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Create scrape_runs table
CREATE TABLE IF NOT EXISTS public.scrape_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_date DATE UNIQUE NOT NULL,
    leads_found INTEGER DEFAULT 0,
    api_calls_made INTEGER DEFAULT 0,
    status TEXT CHECK (status IN ('success', 'api_limit_hit', 'failed', 'running')),
    message TEXT,
    started_at TIMESTAMPTZ DEFAULT now(),
    completed_at TIMESTAMPTZ
);

-- Create api_usage table
CREATE TABLE IF NOT EXISTS public.api_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date DATE UNIQUE NOT NULL,
    calls_made INTEGER DEFAULT 0,
    daily_limit INTEGER DEFAULT 60,
    is_limit_reached BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Create search_pointer table for rotation index
CREATE TABLE IF NOT EXISTS public.search_pointer (
    id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    pointer_index INTEGER DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Initialize default search pointer if not exists
INSERT INTO public.search_pointer (id, pointer_index) 
VALUES (1, 0)
ON CONFLICT (id) DO NOTHING;

-- Enable Realtime for all three transactional tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.leads;
ALTER PUBLICATION supabase_realtime ADD TABLE public.scrape_runs;
ALTER PUBLICATION supabase_realtime ADD TABLE public.api_usage;
