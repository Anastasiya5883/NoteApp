import assert from 'node:assert/strict'
import { test } from 'node:test'
import request from 'supertest'
import { createApp } from './app.js'

test('createApp serves API middleware without opening a listener', async () => {
  const app = createApp()

  const unauthenticated = await request(app).get('/api/history')
  assert.equal(unauthenticated.status, 401)

  const notFound = await request(app).get('/api/not-found')
  assert.equal(notFound.status, 404)
})
