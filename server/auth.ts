import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'

const scrypt = promisify(scryptCallback)

export async function hashPassword(password: string): Promise<{ hash: string; salt: string }> {
  const salt = randomBytes(16).toString('hex')
  const derivedKey = (await scrypt(password, salt, 64)) as Buffer
  return { hash: derivedKey.toString('hex'), salt }
}

export async function verifyPassword(password: string, salt: string, expectedHash: string): Promise<boolean> {
  const derivedKey = (await scrypt(password, salt, 64)) as Buffer
  const expected = Buffer.from(expectedHash, 'hex')
  return expected.length === derivedKey.length && timingSafeEqual(expected, derivedKey)
}

export function createSessionToken(): string {
  return randomBytes(32).toString('hex')
}

export function hashSessionToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}
