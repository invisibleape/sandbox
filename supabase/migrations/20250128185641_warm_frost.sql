-- Add 'pending' to wallet_status enum
ALTER TYPE wallet_status ADD VALUE IF NOT EXISTS 'pending';

-- Create function to increment transaction count
CREATE OR REPLACE FUNCTION increment_wallet_transaction_count(wallet_id uuid)
RETURNS void AS $$
BEGIN
  UPDATE wallets
  SET transaction_count = COALESCE(transaction_count, 0) + 1
  WHERE id = wallet_id;
END;
$$ LANGUAGE plpgsql;