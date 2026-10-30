// @vitest-environment node
import { describe, expect, it } from 'vitest'
import {
  decryptEnvelope,
  encryptEnvelope,
  envelopeKeyFromEnvironment,
} from '../src/security/envelope.js'

describe('AES-256-GCM job envelope', () => {
  const key = Buffer.alloc(32, 7)
  it('roundtrips authenticated plaintext with a random nonce and key version', () => {
    const encrypted = encryptEnvelope('private payload', { key, keyVersion: 3 })
    expect(encrypted.nonce).toHaveLength(12)
    expect(encrypted.authTag).toHaveLength(16)
    expect(encrypted.keyVersion).toBe(3)
    expect(decryptEnvelope(encrypted, { key, keyVersion: 3 }).toString()).toBe('private payload')
  })
  it('fails closed when ciphertext or tag is tampered with', () => {
    const encrypted = encryptEnvelope('payload', { key })
    const ciphertext = Buffer.from(encrypted.ciphertext)
    ciphertext[0] = ciphertext[0]! ^ 1
    expect(() => decryptEnvelope({ ...encrypted, ciphertext }, { key })).toThrow()
    const tag = Buffer.from(encrypted.authTag)
    tag[0] = tag[0]! ^ 1
    expect(() => decryptEnvelope({ ...encrypted, authTag: tag }, { key })).toThrow()
  })
  it('rejects invalid key lengths, noncanonical base64, and invalid versions', () => {
    expect(() => encryptEnvelope('x', { key: Buffer.alloc(31) })).toThrow(/32 bytes/)
    expect(() => envelopeKeyFromEnvironment(Buffer.alloc(31).toString('base64'))).toThrow(
      /32 bytes/,
    )
    expect(() => envelopeKeyFromEnvironment('not base64')).toThrow(/base64/)
    expect(() => encryptEnvelope('x', { key, keyVersion: 0 })).toThrow(/version/)
  })
})
