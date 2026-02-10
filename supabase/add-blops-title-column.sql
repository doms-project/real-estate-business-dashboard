-- Add title column to blops table
ALTER TABLE blops ADD COLUMN IF NOT EXISTS title TEXT;

-- Optional: Populate existing records with content as title if title is null
-- UPDATE blops SET title = content WHERE title IS NULL;