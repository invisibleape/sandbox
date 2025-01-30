-- Add email-related columns
ALTER TABLE wallets 
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS email_hash text,
  ADD COLUMN IF NOT EXISTS email_domain text,
  ADD COLUMN IF NOT EXISTS email_created_at timestamptz;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_wallets_email ON wallets(email);
CREATE INDEX IF NOT EXISTS idx_wallets_email_hash ON wallets(email_hash);
CREATE INDEX IF NOT EXISTS idx_wallets_email_domain ON wallets(email_domain);
CREATE INDEX IF NOT EXISTS idx_wallets_email_created_at ON wallets(email_created_at);

-- Create function to generate MD5 hash
CREATE OR REPLACE FUNCTION generate_email_hash(email text)
RETURNS text AS $$
BEGIN
  RETURN encode(digest(email, 'md5'), 'hex');
END;
$$ LANGUAGE plpgsql;

-- Add RLS policies for email columns
CREATE POLICY "Allow authenticated users to read email data"
  ON wallets
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated users to update email data"
  ON wallets
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Add comment explaining email columns
COMMENT ON COLUMN wallets.email IS 'Temporary email address for the wallet';
COMMENT ON COLUMN wallets.email_hash IS 'MD5 hash of the email address for API lookups';
COMMENT ON COLUMN wallets.email_domain IS 'Domain part of the temporary email';
COMMENT ON COLUMN wallets.email_created_at IS 'Timestamp when the temporary email was created';