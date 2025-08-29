/**
 * Utility functions for encryption and decryption
 * Uses AES-GCM algorithm with the Web Crypto API
 */

/**
 * Encrypts data using AES-GCM algorithm
 * @param plaintext The data to encrypt
 * @param key The encryption key (should come from env)
 * @returns Base64 encoded encrypted data with IV prepended
 */
export async function encryptData(plaintext: string, key: string): Promise<string> {
  // Convert the encryption key to a proper format
  const encodedKey = await createKey(key);

  // Create a random initialization vector
  const iv = crypto.getRandomValues(new Uint8Array(12));

  // Encode the data
  const encodedData = new TextEncoder().encode(plaintext);

  // Encrypt the data
  const encryptedData = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv
    },
    encodedKey,
    encodedData
  );

  // Combine IV and encrypted data
  const combined = new Uint8Array(iv.length + new Uint8Array(encryptedData).length);
  combined.set(iv);
  combined.set(new Uint8Array(encryptedData), iv.length);

  // Convert to Base64 for storage
  return btoa(String.fromCharCode(...combined));
}

/**
 * Decrypts data using AES-GCM algorithm
 * @param encryptedData Base64 encoded encrypted data with IV prepended
 * @param key The encryption key (should come from env)
 * @returns Decrypted data as string
 */
export async function decryptData(encryptedData: string, key: string): Promise<string> {
  try {
    // Convert the encryption key to a proper format
    const encodedKey = await createKey(key);

    // Decode from Base64
    const combined = new Uint8Array(
      atob(encryptedData)
        .split('')
        .map(c => c.charCodeAt(0))
    );

    // Extract IV and data
    const iv = combined.slice(0, 12);
    const data = combined.slice(12);

    // Decrypt the data
    const decryptedData = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv
      },
      encodedKey,
      data
    );

    // Decode the result
    return new TextDecoder().decode(decryptedData);
  } catch (error) {
    console.error('Decryption error:', error);
    console.log('Encrypted data:', encryptedData);
    //return encryptedData;
    throw new Error('Failed to decrypt data');
  }
}

/**
 * Creates a CryptoKey from a string key
 * @param key The string key
 * @returns CryptoKey object
 */
async function createKey(key: string): Promise<CryptoKey> {
  // Hash the key to ensure it's the right length
  const encoder = new TextEncoder();
  const keyData = encoder.encode(key);
  const hashBuffer = await crypto.subtle.digest('SHA-256', keyData);

  // Import the key
  return await crypto.subtle.importKey(
    'raw',
    hashBuffer,
    { name: 'AES-GCM' },
    false,
    ['encrypt', 'decrypt']
  );
}
