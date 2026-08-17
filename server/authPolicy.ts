export const MAX_USERNAME_BYTES = 64
export const MAX_PASSWORD_BYTES = 256

export type CredentialParseResult =
  | { ok: true; credentials: { username: string; password: string } }
  | { ok: false; error: string }

export function parseCredentials(body: unknown): CredentialParseResult {
  const input = body as { username?: unknown; password?: unknown }
  const username = typeof input?.username === 'string' ? input.username.trim() : ''
  const password = typeof input?.password === 'string' ? input.password : ''
  if (!username || !password.trim()) return { ok: false, error: 'Введите логин и пароль' }
  if (Buffer.byteLength(username, 'utf8') > MAX_USERNAME_BYTES) {
    return { ok: false, error: `Логин не должен превышать ${MAX_USERNAME_BYTES} байт` }
  }
  if (Buffer.byteLength(password, 'utf8') > MAX_PASSWORD_BYTES) {
    return { ok: false, error: `Пароль не должен превышать ${MAX_PASSWORD_BYTES} байт` }
  }
  return { ok: true, credentials: { username, password } }
}

export interface AuthRateLimiterOptions {
  maxAttempts: number
  windowMs: number
  maxEntries: number
}

interface AttemptBucket {
  attempts: number
  resetAt: number
}

export type AuthRateLimitResult =
  | { allowed: true; retryAfterMs: 0 }
  | { allowed: false; retryAfterMs: number }

export class AuthRateLimiter {
  private readonly options: AuthRateLimiterOptions
  private readonly buckets = new Map<string, AttemptBucket>()

  constructor(options: Partial<AuthRateLimiterOptions> = {}) {
    this.options = {
      maxAttempts: options.maxAttempts ?? 5,
      windowMs: options.windowMs ?? 15 * 60 * 1_000,
      maxEntries: options.maxEntries ?? 10_000,
    }
    if (
      !Number.isInteger(this.options.maxAttempts)
      || this.options.maxAttempts < 1
      || !Number.isFinite(this.options.windowMs)
      || this.options.windowMs < 1
      || !Number.isInteger(this.options.maxEntries)
      || this.options.maxEntries < 2
    ) {
      throw new Error('Invalid authentication rate-limiter options')
    }
  }

  attempt(ip: string, username: string, now = Date.now()): AuthRateLimitResult {
    this.pruneExpired(now)
    const keys = [this.ipKey(ip), this.accountKey(username)]
    let retryAfterMs = 0

    for (const key of keys) {
      const bucket = this.buckets.get(key)
      if (bucket && bucket.attempts >= this.options.maxAttempts) {
        retryAfterMs = Math.max(retryAfterMs, bucket.resetAt - now)
      }
    }
    if (retryAfterMs > 0) return { allowed: false, retryAfterMs }

    const missingBucketCount = keys.filter((key) => !this.buckets.has(key)).length
    if (this.buckets.size + missingBucketCount > this.options.maxEntries) {
      const earliestResetAt = Math.min(...Array.from(this.buckets.values(), (bucket) => bucket.resetAt))
      return { allowed: false, retryAfterMs: Math.max(1, earliestResetAt - now) }
    }

    for (const key of keys) {
      let bucket = this.buckets.get(key)
      if (!bucket) {
        bucket = { attempts: 0, resetAt: now + this.options.windowMs }
        this.buckets.set(key, bucket)
      }
      bucket.attempts += 1
    }

    return { allowed: true, retryAfterMs: 0 }
  }

  resetAccount(username: string): void {
    this.buckets.delete(this.accountKey(username))
  }

  private pruneExpired(now: number): void {
    for (const [key, bucket] of this.buckets) {
      if (bucket.resetAt <= now) this.buckets.delete(key)
    }
  }

  private ipKey(ip: string): string {
    return `ip:${ip}`
  }

  private accountKey(username: string): string {
    return `account:${username.trim().toLocaleLowerCase('ru-RU')}`
  }
}
