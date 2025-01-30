/*
  # Add temporary email support

  1. New Columns
    - `email` (text, nullable) - Generated temporary email address
    - `email_hash` (text, nullable) - MD5 hash of the email address
    - `email_domain` (text, nullable) - Domain used for the temporary email
    - `email_created_at` (timestamptz, nullable) - When the email was generated

  2. Changes
    - Add indexes for email-related columns
    - Add function to generate MD5 hash
*/

-- Add email-related columns
ALTER TABLE wallets 
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS email_hash text,
  ADD COLUMN IF NOT EXISTS email_domain text,
  ADD COLUMN IF NOT EXISTS email_created_at timestamptz;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_wallets_email ON wallets(email);
CREATE INDEX IF NOT EXISTS idx_wallets_email_hash ON wallets(email_hash);

-- Create function to generate MD5 hash
CREATE OR REPLACE FUNCTION generate_email_hash(email text)
RETURNS text AS $$
BEGIN
  RETURN encode(digest(email, 'md5'), 'hex');
END;
$$ LANGUAGE plpgsql;