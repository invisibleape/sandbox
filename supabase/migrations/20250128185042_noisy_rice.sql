/*
  # Add wallet activity tracking

  1. New Columns
    - `first_transaction_at` (timestamptz, nullable) - Timestamp of the first transaction
    - `last_transaction_at` (timestamptz, nullable) - Timestamp of the most recent transaction
    - `transaction_count` (integer) - Total number of transactions made by the wallet

  2. Changes
    - Add new columns to track wallet activity
    - Add indexes for performance optimization
    - Add trigger to update last_transaction_at automatically
*/

-- Add new columns for tracking wallet activity
ALTER TABLE wallets 
  ADD COLUMN IF NOT EXISTS first_transaction_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_transaction_at timestamptz,
  ADD COLUMN IF NOT EXISTS transaction_count integer DEFAULT 0;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_wallets_first_transaction_at ON wallets(first_transaction_at);
CREATE INDEX IF NOT EXISTS idx_wallets_last_transaction_at ON wallets(last_transaction_at);
CREATE INDEX IF NOT EXISTS idx_wallets_transaction_count ON wallets(transaction_count);

-- Create function to update transaction timestamps
CREATE OR REPLACE FUNCTION update_wallet_transaction_timestamps()
RETURNS TRIGGER AS $$
BEGIN
  -- Set first_transaction_at if this is the first transaction
  IF NEW.transaction_count = 1 THEN
    NEW.first_transaction_at = CURRENT_TIMESTAMP;
  END IF;
  
  -- Always update last_transaction_at when transaction_count changes
  IF NEW.transaction_count != OLD.transaction_count THEN
    NEW.last_transaction_at = CURRENT_TIMESTAMP;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic timestamp updates
DROP TRIGGER IF EXISTS update_wallet_transaction_timestamps_trigger ON wallets;
CREATE TRIGGER update_wallet_transaction_timestamps_trigger
  BEFORE UPDATE OF transaction_count ON wallets
  FOR EACH ROW
  EXECUTE FUNCTION update_wallet_transaction_timestamps();