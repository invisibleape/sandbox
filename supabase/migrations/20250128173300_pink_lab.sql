/*
  # Add chain ID to wallets table

  1. Changes
    - Add `chain_id` column to `wallets` table
    - Create index on `chain_id` for better query performance
    - Update existing records with chain IDs based on network
    - Add NOT NULL constraint after data migration

  2. Notes
    - Safe migration that preserves existing data
    - Adds chain ID for better network identification
    - Improves WalletConnect compatibility
*/

-- Add chain_id column
ALTER TABLE wallets ADD COLUMN IF NOT EXISTS chain_id bigint;

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_wallets_chain_id ON wallets(chain_id);

-- Update existing records with chain IDs based on network
DO $$ 
BEGIN
  -- Ethereum Mainnet
  UPDATE wallets SET chain_id = 1 WHERE network = 'ethereum';
  
  -- BNB Chain
  UPDATE wallets SET chain_id = 56 WHERE network = 'bnb';
  
  -- Polygon
  UPDATE wallets SET chain_id = 137 WHERE network = 'polygon';
  
  -- Arbitrum
  UPDATE wallets SET chain_id = 42161 WHERE network = 'arbitrum';
  
  -- Base
  UPDATE wallets SET chain_id = 8453 WHERE network = 'base';
  
  -- Avalanche
  UPDATE wallets SET chain_id = 43114 WHERE network = 'avalanche';
  
  -- Celo
  UPDATE wallets SET chain_id = 42220 WHERE network = 'celo';
  
  -- Linea
  UPDATE wallets SET chain_id = 59144 WHERE network = 'linea';
  
  -- Blast
  UPDATE wallets SET chain_id = 81457 WHERE network = 'blast';
  
  -- SKALE
  UPDATE wallets SET chain_id = 1273227453 WHERE network = 'skale';
END $$;

-- Add NOT NULL constraint after data migration
ALTER TABLE wallets ALTER COLUMN chain_id SET NOT NULL;