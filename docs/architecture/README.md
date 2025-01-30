# Architecture Overview

## Core Components

The WalletConnect integration is built around several key components:

1. **WalletKit**: Core interface for WalletConnect operations
2. **Session Manager**: Handles session tracking and topic mapping
3. **Connection Logger**: Real-time logging and debugging interface
4. **Signing Service**: Message signing and transaction handling

## Flow Diagram

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

## Key Technologies

- **@reown/walletkit**: WalletConnect v2 client implementation
- **ethers.js**: Ethereum wallet and signing functionality
- **Supabase**: Secure wallet storage and management
- **React**: UI components and state management