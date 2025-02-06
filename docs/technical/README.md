# Technical Documentation

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Wallet Management](#wallet-management)
3. [Network Providers](#network-providers)
4. [Authentication & Security](#authentication--security)
5. [Database Schema](#database-schema)

## Architecture Overview

The Token Gating Dashboard is built with the following core technologies:

- Frontend: React + TypeScript
- Database: Supabase (PostgreSQL)
- Blockchain Interaction: ethers.js
- Wallet Connection: WalletConnect v2 via Reown
- RPC Providers: BlastAPI (primary), SKALE (direct)

### Key Components

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   WalletKit  │     │   Session    │     │   Signing    │
│              │◄────►   Manager    │◄────►   Service    │
└──────────────┘     └──────────────┘     └──────────────┘
       ▲                    ▲                    ▲
       │                    │                    │
       ▼                    ▼                    ▼
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  Connection  │     │   Supabase   │     │    Wallet    │
│    Logger    │     │   Database   │     │   Storage    │
└──────────────┘     └──────────────┘     └──────────────┘
```

## Wallet Management

### Wallet Generation

Wallets are generated using ethers.js with the following process:

1. **Creation**:
   ```typescript
   const wallet = ethers.Wallet.createRandom();
   ```

2. **Encryption**:
   - Private keys are encrypted before storage using AES-GCM
   - Encryption key is derived using PBKDF2
   - Salt and IV are stored with encrypted data

3. **Storage**:
   ```typescript
   const walletData = {
     address: wallet.address.toLowerCase(),
     private_key: encryptedPrivateKey,
     mnemonic: encryptedMnemonic,
     network: network.id,
     chain_id: network.chainId,
     status: 'created'
   };
   ```

### Supported Networks

The system supports multiple networks with different configurations:

1. **Primary Networks** (via BlastAPI):
   - Ethereum (Mainnet)
   - BNB Chain
   - Polygon
   - Arbitrum
   - Base
   - Avalanche
   - Celo
   - Linea
   - Blast

2. **Special Networks**:
   - SKALE Calypso (Direct RPC)

## Network Providers

### BlastAPI Integration

BlastAPI is used as the primary RPC provider for most networks:

```typescript
const blastUrl = `https://${network}.blastapi.io/${apiKey}`;
const provider = new ethers.JsonRpcProvider(blastUrl, {
  chainId: network.chainId,
  name: network.name,
  ensAddress: null
});
```

### SKALE Network Configuration

SKALE networks require special configuration:

```typescript
const provider = new ethers.JsonRpcProvider(network.rpcUrl, {
  chainId: network.chainId,
  name: network.name,
  ensAddress: null,
  skipFetchSetup: true,
  staticNetwork: true,
  headers: {
    'Accept': '*/*',
    'Origin': window.location.origin
  }
});
```

## Authentication & Security

### WalletConnect Integration

1. **Session Establishment**:
   ```typescript
   const kit = await WalletKit.init({
     projectId: REOWN_PROJECT_ID,
     metadata: {
       name: 'Token Gating Dashboard',
       description: 'Admin dashboard for wallet management',
       url: window.location.origin,
       icons: ['https://avatars.githubusercontent.com/u/37784886']
     }
   });
   ```

2. **Session Management**:
   - Topics are tracked in a Map structure
   - Multiple references maintained for each session
   - Auto-cleanup for expired sessions

3. **Signing Requests**:
   - Support for multiple signing methods:
     - personal_sign
     - eth_signTypedData
     - eth_signTypedData_v4
     - eth_sendTransaction
   - Auto-signing option for trusted environments
   - Manual approval interface for user control

### Security Measures

1. **Private Key Management**:
   - Keys never stored in plaintext
   - AES-GCM encryption for storage
   - Key derivation using PBKDF2
   - Secure memory cleanup

2. **Request Validation**:
   - Chain ID verification
   - Network compatibility checks
   - Parameter sanitization
   - Timeout handling

3. **Error Handling**:
   - Graceful degradation
   - Automatic retries with backoff
   - Comprehensive error logging
   - User-friendly error messages

## Database Schema

### Core Tables

1. **wallets**:
   ```sql
   CREATE TABLE wallets (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     address TEXT UNIQUE NOT NULL,
     private_key TEXT NOT NULL,
     mnemonic TEXT,
     status wallet_status NOT NULL DEFAULT 'created',
     network TEXT,
     chain_id BIGINT NOT NULL,
     created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
     transaction_count INTEGER DEFAULT 0
   );
   ```

2. **api_keys**:
   ```sql
   CREATE TABLE api_keys (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     provider TEXT NOT NULL,
     key TEXT NOT NULL,
     is_active BOOLEAN NOT NULL DEFAULT true,
     created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
     updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
   );
   ```

### Row Level Security

All tables implement Row Level Security (RLS) with specific policies:

```sql
-- Wallets RLS
ALTER TABLE wallets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated users to read wallets"
  ON wallets FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated users to insert wallets"
  ON wallets FOR INSERT TO authenticated WITH CHECK (true);

-- API Keys RLS
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated users to read active api keys"
  ON api_keys FOR SELECT TO authenticated USING (is_active = true);
```

## Environment Configuration

Required environment variables:

```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_SUPABASE_ROLE=your_supabase_service_role
VITE_REOWN_PROJECT_ID=your_reown_project_id
```

## Best Practices

1. **Wallet Generation**:
   - Generate in batches for efficiency
   - Validate all generated wallets
   - Implement proper error handling
   - Clean up resources after generation

2. **Provider Management**:
   - Implement connection pooling
   - Handle network-specific configurations
   - Retry failed RPC requests
   - Monitor provider health

3. **Security**:
   - Never expose private keys
   - Validate all user input
   - Implement proper session management
   - Regular security audits

4. **Error Handling**:
   - Comprehensive error logging
   - User-friendly error messages
   - Automatic retry mechanisms
   - Graceful degradation