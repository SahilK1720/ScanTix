-- Add ticket_type to orders and tickets
ALTER TABLE orders ADD COLUMN IF NOT EXISTS ticket_type VARCHAR(20) NOT NULL DEFAULT 'standard';
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS ticket_type VARCHAR(20) NOT NULL DEFAULT 'standard';
