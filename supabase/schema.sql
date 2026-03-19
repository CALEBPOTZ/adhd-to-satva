-- ADHD to Satva — Database Schema
-- Run this in your Supabase SQL editor

-- Users (just 2)
create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  total_xp int default 0,
  level int default 1,
  current_streak int default 0,
  longest_streak int default 0,
  last_active_date date,
  created_at timestamptz default now()
);

-- Seed users
insert into users (name) values ('Caleb'), ('Shakti')
on conflict (name) do nothing;

-- Tasks
create table if not exists tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category text not null check (category in ('chore', 'life_goal', 'sadhana', 'habit')),
  description text,
  micro_steps text[],
  xp_reward int default 10,
  difficulty int default 1 check (difficulty between 1 and 5),
  recurring text check (recurring in ('daily', 'bidaily', 'weekly', 'biweekly', 'monthly', 'bimonthly', 'anytime')),
  assigned_to uuid references users(id),
  icnu_type text,
  icnu_config jsonb,
  active boolean default true,
  created_at timestamptz default now()
);

-- Task completions
create table if not exists completions (
  id uuid primary key default gen_random_uuid(),
  task_id uuid references tasks(id),
  user_id uuid references users(id),
  completed_at timestamptz default now(),
  xp_earned int not null,
  used_timer boolean default false,
  timer_seconds int,
  combo_multiplier float default 1.0
);

-- Sadhana log (per user per day)
create table if not exists sadhana_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id),
  date date not null default current_date,
  japa_completed_at timestamptz,
  japa_rounds int default 0,
  reading_minutes int default 0,
  arti_puja boolean default false,
  flower_offering boolean default false,
  offering_plate boolean default false,
  class_minutes int default 0,
  xp_earned int default 0,
  unique(user_id, date)
);

-- Enable realtime
alter publication supabase_realtime add table users;
alter publication supabase_realtime add table tasks;
alter publication supabase_realtime add table completions;
alter publication supabase_realtime add table sadhana_log;

-- RLS policies (open for now — only 2 users, no auth)
alter table users enable row level security;
alter table tasks enable row level security;
alter table completions enable row level security;
alter table sadhana_log enable row level security;

create policy "Allow all" on users for all using (true) with check (true);
create policy "Allow all" on tasks for all using (true) with check (true);
create policy "Allow all" on completions for all using (true) with check (true);
create policy "Allow all" on sadhana_log for all using (true) with check (true);
