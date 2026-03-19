-- Bump exercise XP and difficulty — it's hard and valuable
UPDATE tasks SET xp_reward = 60, difficulty = 3 WHERE title = 'Exercise (HIIT workout)';

-- Add weights as bidaily task
INSERT INTO tasks (title, category, recurring, xp_reward, difficulty, icnu_type, icnu_config, micro_steps, decay_type, decay_start_hour)
VALUES (
  'Weights',
  'chore',
  'bidaily',
  50,
  3,
  'urgency',
  '{"timer_seconds": 1800}',
  ARRAY['Put on workout clothes', 'Set up the weights', 'Warm up set', 'Working sets', 'Cool down and stretch'],
  'early',
  6
);
