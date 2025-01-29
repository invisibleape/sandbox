/*
  # Add network column to wallets table

  1. Changes
    - Add `network` column to `wallets` table
      - Type: text
      - Nullable: true (to maintain backward compatibility)
      - Default: null
    - Add index on network column for faster queries

  2. Notes
    - Network column will store the network ID (e.g., 'ethereum', 'polygon')
    - Index added to optimize queries filtering by network
*/

DO $$ 
BEGIN 
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'wallets' AND column_name = 'network'
  ) THEN
    ALTER TABLE wallets ADD COLUMN network text;
    CREATE INDEX idx_wallets_network ON wallets(network);
  END IF;
END $$;