# Wallet Generation Service

## Supabase Configuration Best Practices

1. **Authentication**
   - Use service role key for backend operations
   - Never expose service role key in client-side code
   - Keep anon key for public endpoints only

2. **Client Configuration**
   - Keep configuration minimal
   - Disable session persistence for service role usage
   - Use environment variables for all sensitive data

3. **Error Handling**
   - Implement proper error logging
   - Use try-catch blocks for all database operations
   - Log errors with context and timestamps

## Wallet Generation Best Practices

1. **Security**
   - Use cryptographically secure random number generation
   - Encrypt private keys and mnemonics before storage
   - Never log or expose unencrypted sensitive data

2. **Performance**
   - Generate wallets in small batches (10 at a time)
   - Implement proper error handling for each wallet
   - Log success and failure rates

3. **Monitoring**
   - Keep detailed generation logs
   - Track success/failure rates
   - Monitor database connection status

## Environment Variables

Required environment variables:
- `VITE_SUPABASE_URL`: Supabase project URL
- `VITE_SUPABASE_ROLE`: Service role key for authenticated operations

## Error Handling

The application implements comprehensive error handling:
- Connection testing before operations
- Detailed error logging with timestamps
- User-friendly error messages in UI
- Batch operation error recovery