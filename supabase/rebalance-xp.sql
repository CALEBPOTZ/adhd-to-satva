-- XP Rebalance: Weight tasks appropriately by frequency
-- Principle: less frequent tasks should give MORE XP per completion
-- so weekly/monthly tasks feel equally rewarding as daily grind

-- WEEKLY TASKS: Should earn roughly what 5-7 daily tasks earn (~75-100 XP)
UPDATE tasks SET xp_reward = 75 WHERE title = 'Change bed sheets and vacuum bed';
UPDATE tasks SET xp_reward = 65 WHERE title = 'Clean shower';
UPDATE tasks SET xp_reward = 80 WHERE title = 'Clean bathroom';
UPDATE tasks SET xp_reward = 40 WHERE title = 'Dust bedroom';
UPDATE tasks SET xp_reward = 45 WHERE title = 'Dust altar';
UPDATE tasks SET xp_reward = 60 WHERE title = 'Send invoices';
UPDATE tasks SET xp_reward = 35 WHERE title = 'Vacuum under bed';
UPDATE tasks SET xp_reward = 40 WHERE title = 'Face mask';

-- BIWEEKLY TASKS: ~100-150 XP (2 weeks of effort to remember)
UPDATE tasks SET xp_reward = 120 WHERE title = 'Change duvet cover';
UPDATE tasks SET xp_reward = 130 WHERE title = 'Clean fridge';

-- MONTHLY TASKS: ~200-300 XP (big payoff for monthly chores)
UPDATE tasks SET xp_reward = 200 WHERE title = 'Vacuum couch';
UPDATE tasks SET xp_reward = 250 WHERE title = 'Reorganize pantry section';
UPDATE tasks SET xp_reward = 250 WHERE title = 'Clean car';

-- BIMONTHLY TASKS: ~350-500 XP (rare but very rewarding)
UPDATE tasks SET xp_reward = 400 WHERE title = 'Clean windows';
UPDATE tasks SET xp_reward = 350 WHERE title = 'Clean AC filter';
UPDATE tasks SET xp_reward = 450 WHERE title = 'Mow the lawn';

-- Also bump difficulty on bigger tasks
UPDATE tasks SET difficulty = 3 WHERE title = 'Clean bathroom';
UPDATE tasks SET difficulty = 3 WHERE title = 'Clean fridge';
UPDATE tasks SET difficulty = 3 WHERE title = 'Reorganize pantry section';
UPDATE tasks SET difficulty = 3 WHERE title = 'Clean car';
UPDATE tasks SET difficulty = 3 WHERE title = 'Clean windows';
UPDATE tasks SET difficulty = 3 WHERE title = 'Mow the lawn';
