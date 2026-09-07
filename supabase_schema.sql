-- 1. Create Projects Table
CREATE TABLE public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  user_id UUID -- Optional for now, useful if adding authentication later
);

-- 2. Create Tracks Table
CREATE TABLE public.tracks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT CHECK (type IN ('vocal', 'instrumental')),
  color TEXT DEFAULT 'blue',
  volume FLOAT DEFAULT 1.0,
  pan FLOAT DEFAULT 0.0,
  muted BOOLEAN DEFAULT FALSE,
  soloed BOOLEAN DEFAULT FALSE,
  effects JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Create Clips Table
CREATE TABLE public.clips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  track_id UUID REFERENCES public.tracks(id) ON DELETE CASCADE,
  media_url TEXT NOT NULL, -- URL to the file in Supabase Storage
  start_time FLOAT DEFAULT 0.0,
  duration FLOAT DEFAULT 0.0,
  offset_time FLOAT DEFAULT 0.0,
  trim_start FLOAT DEFAULT 0.0,
  trim_end FLOAT DEFAULT 0.0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Set up Storage Buckets
-- Note: You might need to run these Storage queries one by one, 
-- or create them directly from the Supabase Dashboard UI -> Storage -> "New bucket"
INSERT INTO storage.buckets (id, name, public) VALUES ('audio-uploads', 'audio-uploads', true);
INSERT INTO storage.buckets (id, name, public) VALUES ('mix-exports', 'mix-exports', true);

-- Enable public access for uploaded files (if needed)
CREATE POLICY "Public Access" ON storage.objects FOR SELECT USING (bucket_id = 'audio-uploads' OR bucket_id = 'mix-exports');
CREATE POLICY "Public Upload" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'audio-uploads' OR bucket_id = 'mix-exports');
