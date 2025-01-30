# Message Signing

## Overview

The Token Gating Dashboard supports secure message signing through WalletConnect integration. This document covers the implementation details, security considerations, and usage patterns.

## Signing Modes

### 1. Auto-Signing

When enabled, signature requests are automatically approved without user intervention. This mode is useful for automated testing or trusted environments.

```typescript
// Auto-signing is controlled by the session's autoSign flag
const session = {
  autoSign: true,  // Enable auto-signing
  // ... other session properties
};
```

### 2. Manual Signing

When auto-signing is disabled, each signature request requires explicit user approval through a modal interface.

Features:
- Clear request visualization
- Request timeout (3 minutes)
- Approve/Reject options
- Request details display

## Supported Methods

1. **Personal Sign** (`personal_sign`)
   ```typescript
   // Format: personal_sign(message, address)
   const signature = await wallet.signMessage(message);
   ```

2. **Typed Data** (`eth_signTypedData`, `eth_signTypedData_v4`)
   ```typescript
   // Format: eth_signTypedData(address, typedData)
   const signature = await wallet.signTypedData(
     domain,
     types,
     value
   );
   ```

## Security Considerations

1. **Request Validation**
   - Method verification
   - Parameter validation
   - Chain ID checks
   - Session validation

2. **Timeouts**
   - 3-minute timeout for manual signing
   - Automatic rejection on timeout
   - Clean session handling

3. **User Interface**
   - Clear request visualization
   - Explicit approve/reject actions
   - Request details display
   - Auto-sign status indicator

## Implementation Details

### 1. Request Flow

```
1. Receive signature request
2. Validate session and parameters
3. Check auto-sign setting
4. If auto-sign enabled:
   - Process signature immediately
5. If manual signing:
   - Display request modal
   - Wait for user action (approve/reject)
   - Process or reject based on user choice
6. Send response
```

### 2. Event Handling

The system uses custom events for communication:

1. **Signature Request**
   ```typescript
   window.dispatchEvent(
     new CustomEvent('reown:request', {
       detail: {
         id: requestId,
         method: method,
         params: params,
         timestamp: Date.now(),
         pending: !autoSign
       }
     })
   );
   ```

2. **User Response**
   ```typescript
   window.dispatchEvent(
     new CustomEvent('reown:signature', {
       detail: { 
         id: requestId, 
         approve: true/false 
       }
     })
   );
   ```

3. **Result**
   ```typescript
   window.dispatchEvent(
     new CustomEvent('reown:response', {
       detail: {
         id: requestId,
         success: true/false,
         error?: string
       }
     })
   );
   ```

### 3. Error Handling

```typescript
try {
  // Process signature request
} catch (error) {
  // Emit error response
  window.dispatchEvent(
    new CustomEvent('reown:response', {
      detail: {
        id: requestId,
        success: false,
        error: error.message
      }
    })
  );
  
  // Send error response to WalletConnect
  await kit.respondSessionRequest({
    topic: request.topic,
    response: {
      id: Number(request.id),
      jsonrpc: '2.0',
      error: {
        code: 4001,
        message: error.message
      }
    }
  });
}
```

## Best Practices

1. **Auto-Sign Usage**
   - Enable only in trusted environments
   - Document auto-sign status clearly
   - Provide easy toggle mechanism

2. **Request Handling**
   - Validate all parameters
   - Set appropriate timeouts
   - Clean up resources after completion
   - Log all signing activities

3. **User Interface**
   - Clear request visualization
   - Explicit user actions
   - Timeout indicators
   - Error handling

4. **Security**
   - Session validation
   - Request origin verification
   - Parameter sanitization
   - Proper error handling

## Example Usage

```typescript
// Handle signature request
kit.on('session_request', async (request) => {
  try {
    // Emit request event
    window.dispatchEvent(
      new CustomEvent('reown:request', {
        detail: {
          id: request.id,
          method: request.params.request.method,
          params: request.params.request.params,
          timestamp: Date.now(),
          pending: !session.autoSign
        }
      })
    );

    // Handle based on auto-sign setting
    if (!session.autoSign) {
      const approved = await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Request timed out'));
        }, 180000); // 3 minute timeout

        const handleResponse = (event) => {
          if (event.detail.id === request.id) {
            clearTimeout(timeout);
            window.removeEventListener('reown:signature', handleResponse);
            resolve(event.detail.approve);
          }
        };

        window.addEventListener('reown:signature', handleResponse);
      });

      if (!approved) {
        throw new Error('User rejected request');
      }
    }

    // Process signature
    const result = await processSignature(request);

    // Emit success response
    window.dispatchEvent(
      new CustomEvent('reown:response', {
        detail: {
          id: request.id,
          success: true
        }
      })
    );

    // Send response
    await kit.respondSessionRequest({
      topic: request.topic,
      response: {
        id: Number(request.id),
        jsonrpc: '2.0',
        result
      }
    });

  } catch (error) {
    // Handle errors...
  }
});
```