-- Add composite indexes to accelerate time-based trade queries
-- Creates index for global chronological queries and per-address queries.

CREATE INDEX IF NOT EXISTS hl_events_trade_at_desc_idx
ON hl_events (at DESC) WHERE type = 'trade';

CREATE INDEX IF NOT EXISTS hl_events_trade_address_at_desc_idx
ON hl_events (address, at DESC) WHERE type = 'trade';
