/*
  # Create wallets table for token gating test

  1. New Tables
    - `wallets`
      - `id` (uuid, primary key)
      - `address` (text, unique, wallet address)
      - `private_key` (text, encrypted private key)
      - `status` (enum, wallet status)
      - `created_at` (timestamp with timezone)

  2. Security
    - Enable RLS on `wallets` table
    - Add policy for authenticated users to read all wallets
    - Add policy for authenticated users to insert new wallets
*/

-- Create enum for wallet status
CREATE TYPE wallet_status AS ENUM ('created', 'connected', 'minting', 'completed', 'failed');

-- Create wallets table
CREATE TABLE IF NOT EXISTS wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  address TEXT UNIQUE NOT NULL,
  private_key TEXT NOT NULL,
  status wallet_status NOT NULL DEFAULT 'created',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE wallets ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Allow authenticated users to read wallets"
  ON wallets
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated users to insert wallets"
  ON wallets
  FOR INSERT
  TO authenticated
  WITH CHECK (true);