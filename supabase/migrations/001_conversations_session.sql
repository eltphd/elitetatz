-- Add session tracking and mode to conversations
alter table conversations
  add column if not exists session_id text,
  add column if not exists mode text default 'marketplace';
