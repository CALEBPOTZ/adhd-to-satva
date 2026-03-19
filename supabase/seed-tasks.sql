-- Seed tasks for ADHD to Satva
-- Run in Supabase SQL editor AFTER schema.sql
-- XP values weighted by frequency:
--   Daily: 5-25 XP (high volume, low per-task)
--   Bidaily: 10-40 XP
--   Weekly: 35-80 XP (big payoff once a week)
--   Biweekly: 100-130 XP
--   Monthly: 200-250 XP (major reward for monthly tasks)
--   Bimonthly: 350-450 XP (rare but very rewarding)

DO $$
DECLARE
  shakti_id uuid;
BEGIN
  SELECT id INTO shakti_id FROM users WHERE name = 'Shakti';

  -- =====================
  -- DAILY CHORES (shared) — 5-25 XP
  -- =====================
  INSERT INTO tasks (title, category, recurring, xp_reward, difficulty, icnu_type, icnu_config, micro_steps) VALUES
  ('Dishes (muci & suci)', 'chore', 'daily', 15, 1, 'urgency', '{"timer_seconds": 300}',
    ARRAY['Walk to the kitchen', 'Fill the sink with hot water', 'Start with cups and glasses', 'Move to plates', 'Finish with pots']),
  ('Clean kitchen counter', 'chore', 'daily', 10, 1, 'urgency', '{"timer_seconds": 180}',
    ARRAY['Grab the spray bottle', 'Clear everything off the counter', 'Spray and wipe']),
  ('Put all dishes away', 'chore', 'daily', 10, 1, 'urgency', '{"timer_seconds": 180}',
    ARRAY['Open the dish rack', 'Start with the plates', 'Then cups', 'Put away cutlery last']),
  ('Vacuum downstairs and upstairs', 'chore', 'daily', 25, 2, 'urgency', '{"timer_seconds": 900}',
    ARRAY['Get the vacuum out', 'Start with downstairs living room', 'Do the hallway', 'Head upstairs', 'Do the bedroom']),
  ('Clean up workspace', 'chore', 'daily', 10, 1, 'urgency', '{"timer_seconds": 300}',
    ARRAY['Clear papers and trash', 'Wipe the desk', 'Organize cables', 'Put things back in their place']);

  -- ========================
  -- BI-DAILY CHORES (shared) — 10-40 XP
  -- ========================
  INSERT INTO tasks (title, category, recurring, xp_reward, difficulty, icnu_type, icnu_config, micro_steps) VALUES
  ('Put washing machine on', 'chore', 'bidaily', 10, 1, NULL, NULL,
    ARRAY['Grab the laundry basket', 'Sort clothes', 'Load the machine', 'Add detergent', 'Press start']),
  ('Take washing out & hang', 'chore', 'bidaily', 15, 1, NULL, NULL,
    ARRAY['Go to the washing machine', 'Get the drying rack or go outside', 'Hang items one by one']),
  ('Take washing in', 'chore', 'bidaily', 10, 1, NULL, NULL,
    ARRAY['Check if clothes are dry', 'Take them off the line/rack', 'Put in basket']),
  ('Fold and iron laundry', 'chore', 'bidaily', 20, 2, 'urgency', '{"timer_seconds": 600}',
    ARRAY['Set up the ironing board', 'Start with shirts', 'Iron pants', 'Fold everything neatly']),
  ('Put folded clothes away', 'chore', 'bidaily', 10, 1, NULL, NULL,
    ARRAY['Grab the folded clothes', 'Open the wardrobe', 'Put each item in its place']),
  ('Exercise (HIIT workout)', 'chore', 'bidaily', 40, 3, 'urgency', '{"timer_seconds": 1200}',
    ARRAY['Put on workout clothes', 'Clear a space', 'Start with warm-up', 'Do the workout', 'Cool down and stretch']),
  ('Going for a walk', 'chore', 'bidaily', 20, 1, NULL, NULL,
    ARRAY['Put on shoes', 'Step outside', 'Walk for at least 15 minutes']),
  ('Vacuum stairs', 'chore', 'bidaily', 15, 2, 'urgency', '{"timer_seconds": 300}',
    ARRAY['Get the vacuum', 'Start at the top', 'Work your way down']);

  -- =====================
  -- WEEKLY CHORES (shared) — 35-80 XP
  -- =====================
  INSERT INTO tasks (title, category, recurring, xp_reward, difficulty, icnu_type, icnu_config, micro_steps) VALUES
  ('Change bed sheets and vacuum bed', 'chore', 'weekly', 75, 2, 'urgency', '{"timer_seconds": 600}',
    ARRAY['Strip the bed', 'Vacuum the mattress', 'Put on fresh sheets', 'Make the bed']),
  ('Clean shower', 'chore', 'weekly', 65, 2, 'urgency', '{"timer_seconds": 600}',
    ARRAY['Spray the shower', 'Scrub the walls', 'Clean the floor', 'Rinse everything']),
  ('Clean bathroom', 'chore', 'weekly', 80, 3, 'urgency', '{"timer_seconds": 900}',
    ARRAY['Clean the sink', 'Scrub the toilet', 'Mop the floor', 'Empty the trash bin']),
  ('Dust bedroom', 'chore', 'weekly', 40, 1, 'urgency', '{"timer_seconds": 300}',
    ARRAY['Get the duster', 'Start with shelves', 'Do the nightstands', 'Wipe windowsills']),
  ('Dust altar', 'chore', 'weekly', 45, 1, NULL, NULL,
    ARRAY['Carefully move the deities', 'Dust the altar surface', 'Wipe the frames', 'Replace everything respectfully']),
  ('Send invoices', 'chore', 'weekly', 60, 2, NULL, NULL,
    ARRAY['Open your invoicing tool', 'Check what needs billing', 'Create and send each invoice']),
  ('Vacuum under bed', 'chore', 'weekly', 35, 1, NULL, NULL,
    ARRAY['Move items from under the bed', 'Vacuum thoroughly', 'Replace items']);

  -- ========================
  -- BIWEEKLY CHORES (shared) — 100-130 XP
  -- ========================
  INSERT INTO tasks (title, category, recurring, xp_reward, difficulty, micro_steps) VALUES
  ('Change duvet cover', 'chore', 'biweekly', 120, 2,
    ARRAY['Remove the old cover', 'Turn new cover inside out', 'Grab corners and flip', 'Button up']),
  ('Clean fridge', 'chore', 'biweekly', 130, 3,
    ARRAY['Take everything out', 'Throw away expired items', 'Wipe shelves', 'Put everything back organized']);

  -- ======================
  -- MONTHLY CHORES (shared) — 200-250 XP
  -- ======================
  INSERT INTO tasks (title, category, recurring, xp_reward, difficulty, micro_steps) VALUES
  ('Vacuum couch', 'chore', 'monthly', 200, 2,
    ARRAY['Remove cushions', 'Vacuum crevices', 'Vacuum cushions', 'Replace cushions']),
  ('Reorganize pantry section', 'chore', 'monthly', 250, 3,
    ARRAY['Pick one section', 'Take everything out', 'Wipe down shelf', 'Check dates', 'Reorganize']),
  ('Clean car', 'chore', 'monthly', 250, 3,
    ARRAY['Remove trash', 'Vacuum interior', 'Wipe dashboard', 'Clean windows']);

  -- ========================
  -- BIMONTHLY CHORES (shared) — 350-450 XP
  -- ========================
  INSERT INTO tasks (title, category, recurring, xp_reward, difficulty, micro_steps) VALUES
  ('Clean windows', 'chore', 'bimonthly', 400, 3,
    ARRAY['Get glass cleaner and cloth', 'Start inside', 'Then outside', 'Wipe frames']),
  ('Clean AC filter', 'chore', 'bimonthly', 350, 1,
    ARRAY['Turn off AC', 'Remove filter', 'Wash or vacuum', 'Replace']),
  ('Mow the lawn', 'chore', 'bimonthly', 450, 3,
    ARRAY['Get the mower out', 'Check fuel/charge', 'Mow in rows', 'Edge the borders']);

  -- ========================
  -- ANYTIME CHORES (shared)
  -- ========================
  INSERT INTO tasks (title, category, recurring, xp_reward, difficulty) VALUES
  ('Empty trash bin', 'chore', 'anytime', 10, 1),
  ('Compost', 'chore', 'anytime', 10, 1),
  ('Recycling', 'chore', 'anytime', 10, 1);

  -- =============================
  -- HABITS — Shakti only (daily)
  -- =============================
  INSERT INTO tasks (title, category, recurring, xp_reward, difficulty, assigned_to) VALUES
  ('Scrape tongue morning', 'habit', 'daily', 5, 1, shakti_id),
  ('Scrape tongue night', 'habit', 'daily', 5, 1, shakti_id),
  ('Brush teeth night', 'habit', 'daily', 5, 1, shakti_id),
  ('Floss night', 'habit', 'daily', 5, 1, shakti_id),
  ('Write journal', 'habit', 'daily', 15, 1, shakti_id),
  ('Night skincare (moisturizer)', 'habit', 'daily', 5, 1, shakti_id),
  ('Morning skincare (moisturizer + sunscreen)', 'habit', 'daily', 5, 1, shakti_id),
  ('Drink water', 'habit', 'daily', 5, 1, shakti_id);

  INSERT INTO tasks (title, category, recurring, xp_reward, difficulty, assigned_to) VALUES
  ('Wash hair', 'habit', 'bidaily', 10, 1, shakti_id);

  INSERT INTO tasks (title, category, recurring, xp_reward, difficulty, assigned_to) VALUES
  ('Face mask', 'habit', 'weekly', 40, 1, shakti_id);

END $$;
