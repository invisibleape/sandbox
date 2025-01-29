/*
  # Add WalletConnect Project ID to API Keys

  1. Changes
    - Add WalletConnect Project ID to api_keys table
    - Add validation for WalletConnect Project ID format
    - Add migration for existing Project ID from environment variable

  2. Security
    - Ensure only authenticated users can read active API keys
    - Maintain existing RLS policies
*/

-- First, check if the WalletConnect Project ID exists in api_keys
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM api_keys 
    WHERE provider = 'walletconnect'
  ) THEN
    -- Insert the WalletConnect Project ID from environment variable
    INSERT INTO api_keys (
      provider,
      key,
      created_at,
      updated_at,
      is_active
    ) VALUES (
      'walletconnect',
      current_setting('app.settings.walletconnect_project_id', true),
      now(),
      now(),
      true
    );
  END IF;
END $$;

-- Create a function to validate WalletConnect Project ID format
CREATE OR REPLACE FUNCTION validate_walletconnect_project_id()
RETURNS TRIGGER AS $$
BEGIN
  -- WalletConnect Project IDs are typically 32-character hexadecimal strings
  IF NEW.provider = 'walletconnect' AND NOT NEW.key ~ '^[a-f0-9]{32}$' THEN
    RAISE EXCEPTION 'Invalid WalletConnect Project ID format';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for WalletConnect Project ID validation
DROP TRIGGER IF EXISTS validate_walletconnect_project_id_trigger ON api_keys;
CREATE TRIGGER validate_walletconnect_project_id_trigger
  BEFORE INSERT OR UPDATE ON api_keys
  FOR EACH ROW
  WHEN (NEW.provider = 'walletconnect')
  EXECUTE FUNCTION validate_walletconnect_project_id();

-- Add comment to explain the WalletConnect provider
COMMENT ON COLUMN api_keys.provider IS 'API key provider (e.g., infura, blastapi, walletconnect)';