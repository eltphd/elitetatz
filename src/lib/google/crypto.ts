import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

// AES-256-GCM for Google refresh tokens at rest.
//
// GOOGLE_TOKEN_KEY is 32 random bytes, base64-encoded:
//   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
// It lives only in the server environment. Losing or rotating it means every
// artist reconnects once; it never means a token can be read without it.
//
// Stored format: v1.<iv>.<tag>.<ciphertext>, each part base64url.

const VERSION = 'v1'

function key(): Buffer | null {
  const raw = process.env.GOOGLE_TOKEN_KEY?.trim()
  if (!raw) return null
  const k = Buffer.from(raw, 'base64')
  return k.length === 32 ? k : null
}

export function tokenCryptoConfigured(): boolean {
  return key() !== null
}

export function encryptToken(plain: string): string {
  const k = key()
  if (!k) throw new Error('GOOGLE_TOKEN_KEY is missing or not 32 bytes')
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', k, iv)
  const ct = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return [VERSION, iv.toString('base64url'), tag.toString('base64url'), ct.toString('base64url')].join('.')
}

export function decryptToken(stored: string): string {
  const k = key()
  if (!k) throw new Error('GOOGLE_TOKEN_KEY is missing or not 32 bytes')
  const [v, iv, tag, ct] = stored.split('.')
  if (v !== VERSION || !iv || !tag || !ct) throw new Error('Unrecognized token format')
  const decipher = createDecipheriv('aes-256-gcm', k, Buffer.from(iv, 'base64url'))
  decipher.setAuthTag(Buffer.from(tag, 'base64url'))
  return Buffer.concat([decipher.update(Buffer.from(ct, 'base64url')), decipher.final()]).toString('utf8')
}
