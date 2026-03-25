-- Event cancellations tracking
CREATE TABLE event_cancellations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES events(id),
    organizer_id UUID NOT NULL REFERENCES users(id),
    tickets_sold INT NOT NULL DEFAULT 0,
    total_revenue NUMERIC(12,2) NOT NULL DEFAULT 0,
    cancellation_fee NUMERIC(12,2) NOT NULL DEFAULT 0,
    fee_status TEXT NOT NULL DEFAULT 'outstanding' CHECK (fee_status IN ('outstanding', 'paid')),
    reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Per-ticket refund tracking
CREATE TABLE ticket_refunds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id UUID NOT NULL REFERENCES tickets(id),
    attendee_id UUID NOT NULL REFERENCES users(id),
    event_id UUID NOT NULL REFERENCES events(id),
    payment_id TEXT,
    refund_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
    refund_status TEXT NOT NULL DEFAULT 'pending' CHECK (refund_status IN ('pending', 'processing', 'completed', 'failed')),
    initiated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

-- Add cancellation metadata to events
ALTER TABLE events ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;
ALTER TABLE events ADD COLUMN IF NOT EXISTS cancellation_reason TEXT;
