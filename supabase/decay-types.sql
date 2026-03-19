-- Add decay_type to tasks
-- 'early' = more XP earlier in the period, decays toward end
-- 'evening' = meant to be done at night, no time decay
-- 'flexible' = full XP anytime within the period
-- 'delayed' = decay starts at a specific hour (e.g. dishes after 7pm)
-- decay_start_hour = hour (0-23) when decay begins (for 'early' and 'delayed' types)

ALTER TABLE tasks ADD COLUMN IF NOT EXISTS decay_type text DEFAULT 'early'
  CHECK (decay_type IN ('early', 'evening', 'flexible', 'delayed'));
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS decay_start_hour int DEFAULT 6;

-- DAILY: early tasks (decay from morning)
UPDATE tasks SET decay_type = 'early', decay_start_hour = 6
WHERE title IN (
  'Clean kitchen counter',
  'Put all dishes away',
  'Vacuum downstairs and upstairs',
  'Clean up workspace',
  'Scrape tongue morning',
  'Morning skincare (moisturizer + sunscreen)',
  'Drink water'
);

-- DAILY: delayed tasks (dishes — decay starts at 7pm)
UPDATE tasks SET decay_type = 'delayed', decay_start_hour = 19
WHERE title = 'Dishes (muci & suci)';

-- DAILY: evening tasks (no time decay)
UPDATE tasks SET decay_type = 'evening'
WHERE title IN (
  'Write journal',
  'Night skincare (moisturizer)',
  'Scrape tongue night',
  'Brush teeth night',
  'Floss night'
);

-- DAILY: flexible (no time preference)
UPDATE tasks SET decay_type = 'flexible'
WHERE title IN (
  'Empty trash bin',
  'Compost',
  'Recycling',
  'Wash hair',
  'Face mask',
  'Listen to a class'
);

-- Sadhana: early (except reading which is also early)
UPDATE tasks SET decay_type = 'early', decay_start_hour = 4
WHERE category = 'sadhana' AND title != 'Listen to a class';

-- Bidaily tasks: early, decay from 6am
UPDATE tasks SET decay_type = 'early', decay_start_hour = 6
WHERE recurring = 'bidaily';

-- Reading: early (moved from flexible)
-- (Reading is sadhana so already covered above)

-- Weekly/biweekly/monthly/bimonthly: early (do it early in the period)
UPDATE tasks SET decay_type = 'early'
WHERE recurring IN ('weekly', 'biweekly', 'monthly', 'bimonthly');
