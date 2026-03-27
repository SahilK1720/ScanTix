-- Migration 019: Fix event_staff schema.
-- Removed DROP statements to ensure idempotency with our custom runner.
-- The runner will skip this if the tables already exist (by catching "already exists" error).


-- Recreate event_staff with token-based schema (no user account required)
CREATE TABLE event_staff (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id        UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    organizer_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name            TEXT NOT NULL,
    email           TEXT NOT NULL,
    phone_number    TEXT NOT NULL,
    access_token    UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    is_revoked      BOOLEAN NOT NULL DEFAULT FALSE,
    tickets_scanned INTEGER NOT NULL DEFAULT 0,
    last_active_at  TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT event_staff_unique_email UNIQUE (event_id, email)
);

CREATE INDEX idx_event_staff_event     ON event_staff(event_id);
CREATE INDEX idx_event_staff_token     ON event_staff(access_token);
CREATE INDEX idx_event_staff_organizer ON event_staff(organizer_id);

-- Scan log table (one record per scanned ticket, enforces no double-scanning)
CREATE TABLE scanned_tickets (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    staff_id   UUID NOT NULL REFERENCES event_staff(id) ON DELETE CASCADE,
    ticket_id  UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    event_id   UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    scanned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT scanned_tickets_unique_ticket UNIQUE (ticket_id)
);

CREATE INDEX idx_scanned_tickets_staff ON scanned_tickets(staff_id);
CREATE INDEX idx_scanned_tickets_event ON scanned_tickets(event_id);
