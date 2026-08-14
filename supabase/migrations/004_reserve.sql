-- Booth reservation flow: reserve a print, get a pickup code, hold for 20 min.
-- Extends drop_claims from a simple lead into a time-boxed reservation.

alter table drop_claims
  add column if not exists code text,
  add column if not exists reserved_at timestamptz,
  add column if not exists expires_at timestamptz,
  add column if not exists booth_index integer;   -- "print N of 10"

-- Widen the status set: reserved (code issued, hold running),
-- expired (20 min passed), picked_up (collected at booth).
alter table drop_claims drop constraint if exists drop_claims_status_check;
alter table drop_claims
  add constraint drop_claims_status_check
  check (status in ('new', 'reserved', 'expired', 'picked_up', 'contacted', 'paid', 'closed'));

create index if not exists drop_claims_reserve_idx
  on drop_claims (artist_handle, drop_slug, status);
