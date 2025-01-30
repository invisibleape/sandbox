/*
  # Add Reown API key support

  1. Changes
    - Add 'reown' as a valid provider in api_keys table
    - Add validation for Reown project ID format
    - Add comment explaining Reown provider

  2. Security
    - Maintain existing RLS policies
    - Add validation for Reown project ID format
*/

-- Add comment for Reown provider
COMMENT ON COLUMN api_keys.provider IS 'API key provider (e.g., infura, blastapi, reown)';

-- Create function to validate Reown project ID format
CREATE OR REPLACE FUNCTION validate_reown_project_id()
RETURNS TRIGGER AS $$
BEGIN
  -- Reown Project IDs are 32-character hexadecimal strings
  IF NEW.provider = 'reown' AND NOT NEW.key ~ '^[a-f0-9]{32}$' THEN
    RAISE EXCEPTION 'Invalid Reown Project ID format';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for Reown Project ID validation
DROP TRIGGER IF EXISTS validate_reown_project_id_trigger ON api_keys;
CREATE TRIGGER validate_reown_project_id_trigger
  BEFORE INSERT OR UPDATE ON api_keys
  FOR EACH ROW
  WHEN (NEW.provider = 'reown')
  EXECUTE FUNCTION validate_reown_project_id();