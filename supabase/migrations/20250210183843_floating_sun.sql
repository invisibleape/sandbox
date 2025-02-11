/*
  # Add email hash column
  
  1. Changes
    - Add email_hash column to wallets table
    - Create index for better query performance
    - Add comment explaining the column usage
*/

-- Add email_hash column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'wallets' AND column_name = 'email_hash'
  ) THEN
    ALTER TABLE wallets ADD COLUMN email_hash text;
    CREATE INDEX idx_wallets_email_hash ON wallets(email_hash);
    COMMENT ON COLUMN wallets.email_hash IS 'MD5 hash of the email address for temp-mail.org API lookups';
  END IF;
END $$;