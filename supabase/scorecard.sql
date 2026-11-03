-- Weekly scorecard for the lead inbox. Read-only. Run in the Supabase SQL
-- editor or through the MCP execute_sql tool; the presence monitor pastes the
-- result into its monthly note. Counts only, no names.
--
-- Columns: week (Monday), leads by channel, median hours to Lacey's first
-- reply, how many she quoted, how many paid a deposit, how many were passed.

with leads as (
  select
    m.id,
    date_trunc('week', m.created_at)::date as week,
    coalesce(m.channel, case when m.conversation_id is not null then 'concierge' else 'web' end) as channel,
    m.status,
    m.created_at,
    m.artist_responded_at
  from matches m
  where m.created_at >= now() - interval '12 weeks'
),
by_week as (
  select
    week,
    count(*) as leads,
    count(*) filter (where channel = 'web') as web,
    count(*) filter (where channel = 'concierge') as concierge,
    count(*) filter (where channel = 'email') as email,
    count(*) filter (where channel in ('instagram', 'facebook')) as social,
    count(*) filter (where channel = 'sms') as sms,
    count(*) filter (where channel = 'manual') as by_hand,
    round((percentile_cont(0.5) within group (order by extract(epoch from (artist_responded_at - created_at)) / 3600.0))::numeric, 1) as median_hours_to_reply,
    count(*) filter (where status in ('accepted', 'paid', 'booked', 'completed')) as quoted,
    count(*) filter (where status in ('paid', 'booked', 'completed')) as deposit_paid,
    count(*) filter (where status = 'rejected') as passed,
    count(*) filter (where status = 'pending' and created_at < now() - interval '48 hours') as waiting_over_48h
  from leads
  group by week
)
select * from by_week order by week desc;

-- Files and channel health over the same window.
-- select channel, count(*) as events, count(*) filter (where outcome = 'error') as errors,
--        count(*) filter (where outcome = 'duplicate') as duplicates
-- from inbound_events where received_at >= now() - interval '12 weeks' group by channel;

-- Hold timers (migration 016): how often the system had to say "still with
-- Lacey" and friends, by week and hold. A rising A1/A2 count is the number to
-- act on; D and E mean clients are paying and then waiting.
-- select date_trunc('week', sent_at)::date as week, hold, count(*)
-- from hold_events where sent_at >= now() - interval '12 weeks'
-- group by 1, 2 order by 1 desc, 2;
