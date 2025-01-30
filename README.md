# Token Gating Dashboard

A comprehensive dashboard for managing and monitoring wallet operations with support for multiple networks and Reown integration.

## Features

- Multi-network wallet management
- Secure wallet generation and storage
- Reown integration for wallet connections
- Real-time connection monitoring
- Transaction signing and monitoring
- Tag management for wallets
- Comprehensive filtering and search
- Pagination support

## Architecture

The application is built with:

- React + TypeScript for the frontend
- Supabase for database and authentication
- Reown for wallet connections
- Ethers.js for blockchain interactions
- TailwindCSS for styling

### Key Components

1. **Dashboard**
   - Main interface for wallet management
   - Real-time stats and monitoring
   - Wallet generation and connection

2. **Reown Integration**
   - Secure wallet connections
   - Transaction signing
   - Session management

3. **Database Layer**
   - Secure wallet storage
   - API key management
   - Transaction tracking

## Setup

1. Environment Variables

```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_SUPABASE_ROLE=your_supabase_service_role
VITE_REOWN_PROJECT_ID=your_reown_project_id
```

2. Install Dependencies

```bash
npm install
```

3. Start Development Server

```bash
npm run dev
```

## Security

- Private keys are encrypted before storage
- Row Level Security enabled in Supabase
- Secure key management for API providers
- Auto-disconnect protection
- Request signing validation

## Testing

Run the test suite:

```bash
npm test
```

## Best Practices

1. **Wallet Management**
   - Always validate network compatibility
   - Implement proper error handling
   - Monitor connection status
   - Secure private key handling

2. **Database Operations**
   - Use prepared statements
   - Implement row-level security
   - Regular backup procedures
   - Monitor API key usage

3. **Error Handling**
   - Comprehensive error logging
   - User-friendly error messages
   - Automatic retry mechanisms
   - Connection status monitoring

## API Documentation

### Wallet Management

```typescript
interface WalletGenerationOptions {
  count: number;
  network: Network;
}

interface WalletConnectionOptions {
  uri: string;
  walletId: string;
  network: Network;
  autoSign?: boolean;
}
```

### Network Support

The dashboard supports multiple networks including:
- Ethereum
- Polygon
- Arbitrum
- Base
- Linea
- BNB Chain
- Avalanche
- Celo
- Blast
- SKALE

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

MIT License