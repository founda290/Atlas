import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'

export interface EncryptedEnvelope {
  ciphertext: Buffer
  nonce: Buffer
  authTag: Buffer
  keyVersion: number
}

export interface EnvelopeKey {
  key: Buffer
  keyVersion: number
}

function validateKey(key: Buffer, keyVersion: number): EnvelopeKey {
  if (!Buffer.isBuffer(key) || key.length !== 32)
    throw new Error('Encryption key must be exactly 32 bytes')
  if (!Number.isSafeInteger(keyVersion) || keyVersion < 1)
    throw new Error('Invalid encryption key version')
  return { key, keyVersion }
}

export function envelopeKeyFromEnvironment(
  envValue = process.env.ATLAS_JOB_ENCRYPTION_KEY,
  keyVersion = 1,
): EnvelopeKey {
  if (typeof envValue !== 'string' || envValue.length === 0)
    throw new Error('ATLAS_JOB_ENCRYPTION_KEY is required')
  const key = Buffer.from(envValue, 'base64')
  if (key.toString('base64') !== envValue)
    throw new Error('Encryption key must be canonical base64')
  return validateKey(key, keyVersion)
}

export function encryptEnvelope(
  plaintext: string | Buffer,
  options: { key?: Buffer; keyVersion?: number } = {},
): EncryptedEnvelope {
  const configured = options.key
    ? validateKey(options.key, options.keyVersion ?? 1)
    : envelopeKeyFromEnvironment()
  const nonce = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', configured.key, nonce)
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()])
  return { ciphertext, nonce, authTag: cipher.getAuthTag(), keyVersion: configured.keyVersion }
}

export function decryptEnvelope(
  envelope: EncryptedEnvelope,
  options: { key?: Buffer; keyVersion?: number } = {},
): Buffer {
  const keyVersion = options.keyVersion ?? envelope.keyVersion
  const configured = options.key
    ? validateKey(options.key, keyVersion)
    : envelopeKeyFromEnvironment(undefined, keyVersion)
  if (configured.keyVersion !== envelope.keyVersion)
    throw new Error('Encryption key version mismatch')
  if (
    !Buffer.isBuffer(envelope.nonce) ||
    envelope.nonce.length !== 12 ||
    !Buffer.isBuffer(envelope.authTag) ||
    envelope.authTag.length !== 16 ||
    !Buffer.isBuffer(envelope.ciphertext)
  ) {
    throw new Error('Invalid encrypted envelope')
  }
  const decipher = createDecipheriv('aes-256-gcm', configured.key, envelope.nonce)
  decipher.setAuthTag(envelope.authTag)
  return Buffer.concat([decipher.update(envelope.ciphertext), decipher.final()])
}
