-- Migration: Fix existing avatar URLs to use correct R2.dev subdomain
-- Old format: https://pub-1ed3976077de985fd1e4771609069703.r2.dev/...
-- New format: https://pub-a89b1c48c94f4548bb1ae2e59dc57973.r2.dev/...

-- Update all avatar URLs to use the correct R2.dev subdomain
UPDATE players
SET avatar_url = REPLACE(
    avatar_url,
    'https://pub-1ed3976077de985fd1e4771609069703.r2.dev/',
    'https://pub-a89b1c48c94f4548bb1ae2e59dc57973.r2.dev/'
)
WHERE avatar_url LIKE 'https://pub-1ed3976077de985fd1e4771609069703.r2.dev/%';

-- Show updated records
SELECT player_id, username, avatar_url 
FROM players 
WHERE avatar_url IS NOT NULL;
