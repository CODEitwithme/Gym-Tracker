export function hexToBytes(hex: string): Uint8Array {
  if (hex.length % 2 !== 0) {
    throw new Error('Invalid hex string: odd length')
  }
  const bytes = new Uint8Array(hex.length / 2)
  for (let i = 0; i < hex.length; i += 2) {
    const byte = parseInt(hex.substring(i, i + 2), 16)
    if (isNaN(byte)) {
      throw new Error(`Invalid hex byte at index ${i}`)
    }
    bytes[i / 2] = byte
  }
  return bytes
}

export function bytesToHex(bytes: Uint8Array): string {
  let hex = ''
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, '0')
  }
  return hex
}

function toArrayBuffer(uint8: Uint8Array): ArrayBuffer {
  return uint8.buffer.slice(
    uint8.byteOffset,
    uint8.byteOffset + uint8.byteLength
  ) as ArrayBuffer
}

export async function importMasterKey(masterKeyHex: string): Promise<CryptoKey> {
  const keyBytes = hexToBytes(masterKeyHex)
  if (keyBytes.length !== 32) {
    throw new Error('Master encryption key must be 32 bytes (64 hex characters)')
  }
  const buffer = toArrayBuffer(keyBytes)
  return await crypto.subtle.importKey(
    'raw',
    buffer,
    { name: 'AES-GCM' },
    false,
    ['encrypt', 'decrypt']
  )
}

export async function encrypt(
  masterKeyHex: string,
  plaintext: string
): Promise<{ iv: string; tag: string; ciphertext: string }> {
  const key = await importMasterKey(masterKeyHex)
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const encoded = new TextEncoder().encode(plaintext)
  const ivBuffer = toArrayBuffer(iv)
  const dataBuffer = toArrayBuffer(encoded)

  const encryptedBuffer = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: ivBuffer },
    key,
    dataBuffer
  )
  const encryptedBytes = new Uint8Array(encryptedBuffer)
  const tagBytes = encryptedBytes.slice(encryptedBytes.length - 16)

  return {
    iv: bytesToHex(iv),
    tag: bytesToHex(tagBytes),
    ciphertext: bytesToHex(encryptedBytes),
  }
}

export async function decrypt(
  masterKeyHex: string,
  stored: { iv: string; ciphertext: string; tag?: string }
): Promise<string> {
  const key = await importMasterKey(masterKeyHex)
  const ivBytes = hexToBytes(stored.iv)

  let combinedHex = stored.ciphertext
  if (stored.tag && !stored.ciphertext.toLowerCase().endsWith(stored.tag.toLowerCase())) {
    combinedHex = stored.ciphertext + stored.tag
  }

  const combinedBytes = hexToBytes(combinedHex)
  const ivBuffer = toArrayBuffer(ivBytes)
  const dataBuffer = toArrayBuffer(combinedBytes)

  const decryptedBuffer = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: ivBuffer },
    key,
    dataBuffer
  )

  return new TextDecoder().decode(decryptedBuffer)
}
