# WalletConnect Troubleshooting Guide

## Common Issues

### 1. Chain ID Mismatch

**Symptom**: Error message about chain ID mismatch or unsupported network.

**Solution**:
1. Verify the network configuration in `networks.ts`
2. Check if the network requires `useEthereumWallet` flag
3. Ensure chain ID is in the correct format (decimal)

### 2. Session Connection Failures

**Symptom**: Unable to establish WalletConnect session.

**Checks**:
1. Verify URI format (should start with `wc:` or `reown:`)
2. Check network connectivity
3. Validate project ID configuration
4. Review session logs for specific errors

### 3. Signing Request Timeouts

**Symptom**: Transaction or message signing requests timeout.

**Solutions**:
1. Check auto-sign configuration
2. Verify wallet status in database
3. Ensure provider connection is stable
4. Review gas settings for transactions

### 4. Topic Mapping Issues

**Symptom**: Session requests fail with topic not found.

**Debug Steps**:
1. Check session storage for topic
2. Verify topic mapping in active sessions
3. Review session proposal flow
4. Check for expired sessions

## Error Messages

### Network Related

1. "Network mismatch"
   - Cause: Wallet network doesn't match requested network
   - Solution: Update wallet network or use correct network

2. "Failed to connect to provider"
   - Cause: RPC connection issues
   - Solution: Check provider configuration and fallback URLs

### Session Related

1. "Session not found"
   - Cause: Invalid or expired session
   - Solution: Re-establish connection

2. "Invalid URI format"
   - Cause: Malformed WalletConnect URI
   - Solution: Verify URI format and encoding

### Signing Related

1. "User rejected request"
   - Cause: Manual rejection or auto-sign disabled
   - Solution: Check auto-sign settings

2. "Transaction failed"
   - Cause: Gas issues or network congestion
   - Solution: Review gas settings and retry mechanism

## Debugging Tools

### 1. Connection Logs

Use the ConnectionLogs component to view:
- Session events
- Request/response flow
- Error details
- Network status

### 2. Network Inspector

Check network configuration:
```typescript
console.log(networks.find(n => n.id === networkId));
```

### 3. Session Inspector

Debug active sessions:
```typescript
console.log(Array.from(activeSessions.entries()));
```

## Best Practices

1. **Error Handling**
   - Always use try-catch blocks
   - Log detailed error information
   - Provide user-friendly error messages

2. **Session Management**
   - Clean up expired sessions
   - Validate topics before use
   - Handle disconnections gracefully

3. **Network Configuration**
   - Use fallback RPC URLs
   - Handle chain switching properly
   - Validate chain IDs

4. **Security**
   - Never log private keys
   - Validate all user input
   - Use proper encryption

## Support Resources

1. WalletConnect Documentation
   - [WalletConnect v2 Docs](https://docs.walletconnect.com/2.0)
   - [Sign API Reference](https://docs.walletconnect.com/2.0/api/sign)

2. Reown Documentation
   - [WalletKit Guide](https://docs.reown.com/walletkit)
   - [Integration Examples](https://docs.reown.com/examples)