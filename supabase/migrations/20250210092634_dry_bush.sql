-- Export schema and data for public schema
-- Generated for Token Gating Dashboard

-- Disable triggers temporarily
SET session_replication_role = replica;

-- Drop existing tables if they exist
DROP TABLE IF EXISTS wallet_logs;
DROP TABLE IF EXISTS wallets;
DROP TABLE IF EXISTS api_keys;

-- Drop existing types if they exist
DROP TYPE IF EXISTS wallet_status;
DROP TYPE IF EXISTS log_type;

-- Recreate types
CREATE TYPE wallet_status AS ENUM ('created', 'connected', 'minting', 'completed', 'failed', 'pending');
CREATE TYPE log_type AS ENUM ('info', 'success', 'error', 'pending');

-- Create tables with their original structure
CREATE TABLE wallets (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    address text UNIQUE NOT NULL,
    private_key text NOT NULL,
    mnemonic text,
    status wallet_status NOT NULL DEFAULT 'created',
    network text,
    chain_id bigint NOT NULL,
    tag text,
    created_at timestamptz NOT NULL DEFAULT now(),
    first_transaction_at timestamptz,
    last_transaction_at timestamptz,
    transaction_count integer DEFAULT 0,
    email text,
    email_hash text,
    email_domain text,
    email_created_at timestamptz
);

CREATE TABLE api_keys (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    provider text NOT NULL,
    key text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    is_active boolean NOT NULL DEFAULT true
);

CREATE TABLE wallet_logs (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    wallet_id uuid NOT NULL REFERENCES wallets(id) ON DELETE CASCADE,
    type log_type NOT NULL,
    message text NOT NULL,
    details jsonb,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- Create indexes
CREATE INDEX idx_wallets_network ON wallets(network);
CREATE INDEX idx_wallets_chain_id ON wallets(chain_id);
CREATE INDEX idx_wallets_first_transaction_at ON wallets(first_transaction_at);
CREATE INDEX idx_wallets_last_transaction_at ON wallets(last_transaction_at);
CREATE INDEX idx_wallets_transaction_count ON wallets(transaction_count);
CREATE INDEX idx_wallets_email ON wallets(email);
CREATE INDEX idx_wallets_email_hash ON wallets(email_hash);
CREATE INDEX idx_wallets_email_domain ON wallets(email_domain);
CREATE INDEX idx_wallets_email_created_at ON wallets(email_created_at);

CREATE INDEX idx_wallet_logs_wallet_id ON wallet_logs(wallet_id);
CREATE INDEX idx_wallet_logs_created_at ON wallet_logs(created_at);
CREATE INDEX idx_wallet_logs_wallet_created ON wallet_logs(wallet_id, created_at);

-- Enable RLS
ALTER TABLE wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallet_logs ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Allow authenticated users to read wallets"
    ON wallets FOR SELECT TO authenticated
    USING (true);

CREATE POLICY "Allow authenticated users to insert wallets"
    ON wallets FOR INSERT TO authenticated
    WITH CHECK (true);

CREATE POLICY "Allow authenticated users to read active api keys"
    ON api_keys FOR SELECT TO authenticated
    USING (is_active = true);

CREATE POLICY "Allow authenticated users to read wallet logs"
    ON wallet_logs FOR SELECT TO authenticated
    USING (true);

CREATE POLICY "Allow authenticated users to insert wallet logs"
    ON wallet_logs FOR INSERT TO authenticated
    WITH CHECK (true);

-- Create functions
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE OR REPLACE FUNCTION update_wallet_transaction_timestamps()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.transaction_count = 1 THEN
        NEW.first_transaction_at = CURRENT_TIMESTAMP;
    END IF;
    
    IF NEW.transaction_count != OLD.transaction_count THEN
        NEW.last_transaction_at = CURRENT_TIMESTAMP;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION increment_wallet_transaction_count(wallet_id uuid)
RETURNS void AS $$
BEGIN
    UPDATE wallets
    SET transaction_count = COALESCE(transaction_count, 0) + 1
    WHERE id = wallet_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION generate_email_hash(email text)
RETURNS text AS $$
BEGIN
    RETURN encode(digest(email, 'md5'), 'hex');
END;
$$ LANGUAGE plpgsql;

-- Create triggers
CREATE TRIGGER update_api_keys_updated_at
    BEFORE UPDATE ON api_keys
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_wallet_transaction_timestamps_trigger
    BEFORE UPDATE OF transaction_count ON wallets
    FOR EACH ROW
    EXECUTE FUNCTION update_wallet_transaction_timestamps();

-- Add comments
COMMENT ON COLUMN api_keys.provider IS 'API key provider (e.g., infura, blastapi, reown)';
COMMENT ON COLUMN wallets.email IS 'Temporary email address for the wallet';
COMMENT ON COLUMN wallets.email_hash IS 'MD5 hash of the email address for API lookups';
COMMENT ON COLUMN wallets.email_domain IS 'Domain part of the temporary email';
COMMENT ON COLUMN wallets.email_created_at IS 'Timestamp when the temporary email was created';

-- Copy data from existing tables (if they exist)
INSERT INTO wallets SELECT * FROM public.wallets;
INSERT INTO api_keys SELECT * FROM public.api_keys;
INSERT INTO wallet_logs SELECT * FROM public.wallet_logs;

-- Re-enable triggers
SET session_replication_role = default;