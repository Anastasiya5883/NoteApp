import assert from 'node:assert/strict'
import test from 'node:test'
import { resolveServerHost } from './runtimeConfig.js'

test('binds to all interfaces by default inside a container', () => {
  assert.equal(resolveServerHost(undefined), '0.0.0.0')
})

test('honours an explicitly configured host', () => {
  assert.equal(resolveServerHost('127.0.0.1'), '127.0.0.1')
})
