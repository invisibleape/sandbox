/*
  # Add WalletConnect Project ID Validation

  1. Changes
    - Add validation for WalletConnect Project ID format
    - Add trigger to enforce validation on insert/update

  2. Security
    - Maintain existing RLS policies
    - Ensure Project ID format is valid (32-character hex string)
*/

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