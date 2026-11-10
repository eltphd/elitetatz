-- 020 — Delivery receipts on the artist's email log (2026-11-10).
--
-- `status = 'sent'` in artist_notifications (migration 018) means Resend
-- accepted the request, not that her mail server took the message. Resend
-- reports that afterwards by webhook; /api/inbound/email writes it here,
-- matched by provider_id (src/lib/delivery.ts):
--
--   delivery_status  'delivered' | 'delayed' | 'bounced' | 'complained', or
--                    'unconfirmed' when the hourly sweep found no receipt 15
--                    minutes after the send (the operator is alerted once)
--   delivered_at     when her mail server accepted it
--
-- The 7 PM digest reads the latest delivered_at: only with a fresh receipt
-- does its system line say the whole path was checked. No mail is sent to
-- produce any of this.

alter table artist_notifications
  add column if not exists delivery_status text,
  add column if not exists delivered_at timestamptz;

create index if not exists artist_notifications_provider_idx
  on artist_notifications (provider_id) where provider_id is not null;
create index if not exists artist_notifications_delivered_idx
  on artist_notifications (delivered_at desc) where delivered_at is not null;
