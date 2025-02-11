-- Add profile picture column to wallets table
ALTER TABLE wallets ADD COLUMN IF NOT EXISTS profile_picture_url text;
CREATE INDEX IF NOT EXISTS idx_wallets_profile_picture ON wallets(profile_picture_url);

-- Add comment explaining the column
COMMENT ON COLUMN wallets.profile_picture_url IS 'URL to the user''s profile picture';
COMMENT ON COLUMN wallets.username IS 'Unique username for the wallet owner';