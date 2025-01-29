/*
  # Add mnemonic column to wallets table

  1. Changes
    - Add `mnemonic` column to store encrypted mnemonic phrases
    - Update RLS policies to include the new column
  
  2. Security
    - Maintain existing RLS policies
    - Ensure mnemonic is protected like private_key
*/

-- Add mnemonic column if it doesn't exist
DO $$ 
BEGIN 
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'wallets' AND column_name = 'mnemonic'
  ) THEN
    ALTER TABLE wallets ADD COLUMN mnemonic TEXT;
  END IF;
END $$;