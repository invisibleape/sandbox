-- Add username column to wallets table
ALTER TABLE wallets ADD COLUMN IF NOT EXISTS username text;
CREATE INDEX IF NOT EXISTS idx_wallets_username ON wallets(username);