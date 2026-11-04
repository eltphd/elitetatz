-- 017 — Onboarding: when the artist dismissed the first-visit walkthrough (2026-11-03).
--
-- /dashboard opens with a three-step card (home screen, the five taps, the
-- hold timers) until the artist taps "Got it". The tap is recorded here, on
-- her row, so it holds across phones and browsers; nothing is kept in the
-- browser. Null means she has never dismissed it. Clearing it brings the
-- card back.

alter table artists
  add column if not exists walkthrough_dismissed_at timestamptz;
