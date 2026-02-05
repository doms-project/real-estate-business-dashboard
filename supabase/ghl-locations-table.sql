-- Create ghl_locations table to replace JSON file storage
CREATE TABLE IF NOT EXISTS public.ghl_locations (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    city TEXT,
    state TEXT,
    country TEXT DEFAULT 'US',
    address TEXT,
    pit_token TEXT NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id)
);

-- Add RLS (Row Level Security)
ALTER TABLE public.ghl_locations ENABLE ROW LEVEL SECURITY;

-- Create policies for authenticated users
CREATE POLICY "Users can view all active locations" ON public.ghl_locations
    FOR SELECT USING (auth.role() = 'authenticated' AND is_active = true);

CREATE POLICY "Users can insert locations" ON public.ghl_locations
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Users can update their own locations" ON public.ghl_locations
    FOR UPDATE USING (auth.role() = 'authenticated' AND (created_by = auth.uid() OR created_by IS NULL));

CREATE POLICY "Users can delete their own locations" ON public.ghl_locations
    FOR DELETE USING (auth.role() = 'authenticated' AND (created_by = auth.uid() OR created_by IS NULL));

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_ghl_locations_is_active ON public.ghl_locations(is_active);
CREATE INDEX IF NOT EXISTS idx_ghl_locations_created_by ON public.ghl_locations(created_by);

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_ghl_locations_updated_at
    BEFORE UPDATE ON public.ghl_locations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();