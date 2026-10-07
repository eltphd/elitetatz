-- 010: booking loop — the client asks for a date after the deposit, the
-- artist has final say and confirms it; an optional design-draft fee is
-- quoted separately from the shop's tattoo-time deposit.
alter table matches
  add column if not exists design_fee_cents integer,
  add column if not exists date_request text;
