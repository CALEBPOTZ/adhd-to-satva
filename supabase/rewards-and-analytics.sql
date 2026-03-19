-- Rewards table
create table if not exists rewards (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  cost int not null, -- XP cost to redeem
  icon text default '🎁',
  active boolean default true,
  created_at timestamptz default now()
);

-- Reward redemptions (spending log)
create table if not exists redemptions (
  id uuid primary key default gen_random_uuid(),
  reward_id uuid references rewards(id),
  user_id uuid references users(id),
  cost int not null,
  redeemed_at timestamptz default now()
);

-- Add spendable_xp to users (total_xp is lifetime, spendable is the "wallet")
alter table users add column if not exists spendable_xp int default 0;

-- Update existing users to have spendable_xp = total_xp
update users set spendable_xp = total_xp where spendable_xp = 0;

-- Enable realtime + RLS
alter publication supabase_realtime add table rewards;
alter publication supabase_realtime add table redemptions;
alter table rewards enable row level security;
alter table redemptions enable row level security;
create policy "Allow all" on rewards for all using (true) with check (true);
create policy "Allow all" on redemptions for all using (true) with check (true);

-- Seed rewards (priced based on ~200-400 XP per good day)
-- Small treats: ~1 day effort. Big treats: ~3-5 days effort.
insert into rewards (name, description, cost, icon) values
  ('Bag of Chips', 'A tasty snack — you earned it!', 150, '🍟'),
  ('Ice Cream (shop)', 'Go get a proper scoop', 300, '🍦'),
  ('Ice Cream (home)', 'Grab some from the freezer', 100, '🍨'),
  ('Cheat Meal', 'One guilt-free meal of whatever you want', 500, '🍔'),
  ('Gaming 1hr', 'One hour of uninterrupted gaming time', 400, '🎮'),
  ('Movie', 'Pick any movie — full cinema experience or couch', 600, '🎬'),
  ('Durian', 'The king of fruits — treat yourself!', 350, '🍈');
