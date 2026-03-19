-- Rebalance reward costs
-- Daily XP potential: ~100-200 XP on a good day
-- Rewards should feel achievable but require real effort

UPDATE rewards SET cost = 50 WHERE name = 'Ice Cream (home)';     -- Quick win, ~half a day
UPDATE rewards SET cost = 100 WHERE name = 'Bag of Chips';        -- ~1 good day
UPDATE rewards SET cost = 200 WHERE name = 'Ice Cream (shop)';    -- ~1-2 days
UPDATE rewards SET cost = 250 WHERE name = 'Durian';              -- ~2 days
UPDATE rewards SET cost = 300 WHERE name = 'Gaming 1hr';          -- ~2 days solid
UPDATE rewards SET cost = 400 WHERE name = 'Cheat Meal';          -- ~2-3 days
UPDATE rewards SET cost = 500 WHERE name = 'Movie';               -- ~3 days
