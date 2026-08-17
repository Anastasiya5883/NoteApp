import assert from 'node:assert/strict'
import test from 'node:test'
import {
  AuthRateLimiter,
  MAX_PASSWORD_BYTES,
  MAX_USERNAME_BYTES,
  parseCredentials,
} from './authPolicy.js'

test('accepts credentials exactly at the UTF-8 byte limits', () => {
  const result = parseCredentials({
    username: 'я'.repeat(MAX_USERNAME_BYTES / 2),
    password: 'я'.repeat(MAX_PASSWORD_BYTES / 2),
  })

  assert.equal(result.ok, true)
})

test('rejects a username above the UTF-8 byte limit', () => {
  const result = parseCredentials({
    username: 'я'.repeat(MAX_USERNAME_BYTES / 2 + 1),
    password: 'password',
  })

  assert.deepEqual(result, {
    ok: false,
    error: `Логин не должен превышать ${MAX_USERNAME_BYTES} байт`,
  })
})

test('rejects a password above the UTF-8 byte limit', () => {
  const result = parseCredentials({
    username: 'user',
    password: 'я'.repeat(MAX_PASSWORD_BYTES / 2 + 1),
  })

  assert.deepEqual(result, {
    ok: false,
    error: `Пароль не должен превышать ${MAX_PASSWORD_BYTES} байт`,
  })
})

test('throttles attempts shared by one IP address', () => {
  const limiter = new AuthRateLimiter({ maxAttempts: 2, windowMs: 1_000, maxEntries: 20 })

  assert.equal(limiter.attempt('192.0.2.1', 'first', 0).allowed, true)
  assert.equal(limiter.attempt('192.0.2.1', 'second', 0).allowed, true)
  assert.deepEqual(limiter.attempt('192.0.2.1', 'third', 500), {
    allowed: false,
    retryAfterMs: 500,
  })
})

test('throttles attempts shared by one normalized account', () => {
  const limiter = new AuthRateLimiter({ maxAttempts: 2, windowMs: 1_000, maxEntries: 20 })

  assert.equal(limiter.attempt('192.0.2.1', 'Example', 0).allowed, true)
  assert.equal(limiter.attempt('192.0.2.2', ' example ', 0).allowed, true)
  assert.equal(limiter.attempt('192.0.2.3', 'EXAMPLE', 100).allowed, false)
})

test('allows attempts again after the rate-limit window', () => {
  const limiter = new AuthRateLimiter({ maxAttempts: 1, windowMs: 1_000, maxEntries: 20 })

  assert.equal(limiter.attempt('192.0.2.1', 'example', 0).allowed, true)
  assert.equal(limiter.attempt('192.0.2.1', 'example', 999).allowed, false)
  assert.equal(limiter.attempt('192.0.2.1', 'example', 1_000).allowed, true)
})

test('resetting a successful account clears its account throttle without clearing the IP throttle', () => {
  const limiter = new AuthRateLimiter({ maxAttempts: 2, windowMs: 1_000, maxEntries: 20 })

  assert.equal(limiter.attempt('192.0.2.1', 'example', 0).allowed, true)
  assert.equal(limiter.attempt('192.0.2.2', 'example', 0).allowed, true)
  assert.equal(limiter.attempt('192.0.2.3', 'example', 0).allowed, false)

  limiter.resetAccount(' EXAMPLE ')

  assert.equal(limiter.attempt('192.0.2.3', 'example', 0).allowed, true)
  assert.equal(limiter.attempt('192.0.2.1', 'different', 0).allowed, true)
  assert.equal(limiter.attempt('192.0.2.1', 'another', 0).allowed, false)
})

test('bounds stored identities without evicting live rate limits', () => {
  const limiter = new AuthRateLimiter({ maxAttempts: 1, windowMs: 1_000, maxEntries: 2 })

  assert.equal(limiter.attempt('192.0.2.1', 'first', 0).allowed, true)
  assert.equal(limiter.attempt('192.0.2.1', 'first', 0).allowed, false)
  assert.equal(limiter.attempt('192.0.2.2', 'second', 0).allowed, false)
  assert.equal(limiter.attempt('192.0.2.1', 'first', 0).allowed, false)
  assert.equal(limiter.attempt('192.0.2.2', 'second', 1_000).allowed, true)
})
