/*
  # Create API keys table for Infura integration

  1. New Tables
    - `api_keys`
      - `id` (uuid, primary key)
      - `provider` (text) - e.g., 'infura'
      - `key` (text) - encrypted API key
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
      - `is_active` (boolean)

  2. Security
    - Enable RLS on `api_keys` table
    - Add policy for authenticated users to read active keys
*/

CREATE TABLE IF NOT EXISTS api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL,
  key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  is_active boolean NOT NULL DEFAULT true
);

ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated users to read active api keys"
  ON api_keys
  FOR SELECT
  TO authenticated
  USING (is_active = true);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for updated_at
CREATE TRIGGER update_api_keys_updated_at
  BEFORE UPDATE ON api_keys
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();