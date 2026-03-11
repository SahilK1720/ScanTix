-- Drop the old image_url column and add image_urls array
ALTER TABLE events
DROP COLUMN IF EXISTS image_url;

-- Add image_urls array and default to an empty array
ALTER TABLE events
ADD COLUMN image_urls TEXT[] NOT NULL DEFAULT '{}';
