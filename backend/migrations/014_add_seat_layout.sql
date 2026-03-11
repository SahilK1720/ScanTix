-- Add seat_layout column for choosing between 'grid' and 'stadium' layouts
ALTER TABLE events ADD COLUMN seat_layout VARCHAR(50) DEFAULT 'grid';
