// Using Web Crypto API for encryption/decryption
const encoder = new TextEncoder();
const decoder = new TextDecoder();

async function getKey(password: string): Promise<CryptoKey> {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits', 'deriveKey']
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: encoder.encode('salt-for-wallet-encryption'),
      iterations: 100000,
      hash: 'SHA-256'
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

function arrayBufferToHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

function hexToArrayBuffer(hex: string): ArrayBuffer {
  const matches = hex.match(/.{1,2}/g) || [];
  return new Uint8Array(matches.map(byte => parseInt(byte, 16))).buffer;
}

export async function encryptPrivateKey(privateKey: string): Promise<string> {
  const key = await getKey(import.meta.env.VITE_ENCRYPTION_KEY || 'default-key-please-change-in-production');
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encryptedData = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv
    },
    key,
    encoder.encode(privateKey)
  );

  // Combine IV and encrypted data
  const combined = new Uint8Array(iv.length + new Uint8Array(encryptedData).length);
  combined.set(iv);
  combined.set(new Uint8Array(encryptedData), iv.length);
  
  return arrayBufferToHex(combined);
}

export async function decryptPrivateKey(encryptedHex: string): Promise<string> {
  const key = await getKey(import.meta.env.VITE_ENCRYPTION_KEY || 'default-key-please-change-in-production');
  const encryptedBytes = hexToArrayBuffer(encryptedHex);
  const iv = encryptedBytes.slice(0, 12);
  const data = encryptedBytes.slice(12);

  const decryptedData = await crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: new Uint8Array(iv)
    },
    key,
    data
  );

  return decoder.decode(decryptedData);
}