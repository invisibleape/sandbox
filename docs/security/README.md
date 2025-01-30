# Security Considerations

## Private Key Management

1. **Encryption**
   - Keys stored encrypted in Supabase
   - Decrypted only when needed
   - Secure key derivation

2. **Access Control**
   - Row Level Security in Supabase
   - Authentication required
   - Role-based permissions

## Session Security

1. **Topic Management**
   - Unique session identifiers
   - Topic validation
   - Session timeouts

2. **Request Validation**
   - Method verification
   - Parameter validation
   - Chain ID checks

## Best Practices

1. **Logging**
   - No sensitive data in logs
   - Masked URIs and keys
   - Audit trail

2. **Error Handling**
   - No leaked information
   - Generic error messages
   - Proper cleanup

3. **User Interaction**
   - Clear confirmations
   - Timeout handling
   - Action reversibility