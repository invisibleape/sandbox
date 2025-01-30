/*
  # Add wallet logs table

  1. New Tables
    - `wallet_logs`
      - `id` (uuid, primary key)
      - `wallet_id` (uuid, foreign key to wallets)
      - `type` (enum: info, success, error, pending)
      - `message` (text)
      - `created_at` (timestamp)
      - `details` (jsonb, optional)

  2. Security
    - Enable RLS on `wallet_logs` table
    - Add policy for authenticated users to read logs
    - Add policy for authenticated users to insert logs

  3. Indexes
    - Index on wallet_id and created_at for efficient queries
*/

-- Create enum for log types
CREATE TYPE log_type AS ENUM ('info', 'success', 'error', 'pending');

-- Create wallet_logs table
CREATE TABLE IF NOT EXISTS wallet_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id uuid NOT NULL REFERENCES wallets(id) ON DELETE CASCADE,
  type log_type NOT NULL,
  message text NOT NULL,
  details jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_wallet_logs_wallet_id ON wallet_logs(wallet_id);
CREATE INDEX IF NOT EXISTS idx_wallet_logs_created_at ON wallet_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_wallet_logs_wallet_created ON wallet_logs(wallet_id, created_at);

-- Enable RLS
ALTER TABLE wallet_logs ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Allow authenticated users to read wallet logs"
  ON wallet_logs
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated users to insert wallet logs"
  ON wallet_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (true);