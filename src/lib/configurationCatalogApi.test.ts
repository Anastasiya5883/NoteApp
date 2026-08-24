import assert from 'node:assert/strict'
import test from 'node:test'
import {
  deleteConfigurationCatalog,
  getConfigurationCatalog,
  uploadConfigurationCatalog,
} from './configurationCatalogApi'

const emptyResponse = { catalog: null, summary: null }

test('gets the current catalog with same-origin credentials', async () => {
  let requestInput: string | URL | Request | undefined
  let requestInit: RequestInit | undefined
  const originalFetch = globalThis.fetch
  globalThis.fetch = async (input, init) => {
    requestInput = input
    requestInit = init
    return new Response(JSON.stringify(emptyResponse), { status: 200 })
  }
  try {
    assert.deepEqual(await getConfigurationCatalog(), emptyResponse)
    assert.equal(requestInput, '/api/configuration-catalog')
    assert.equal(requestInit?.credentials, 'same-origin')
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('uploads a ZIP as FormData without overriding its content type', async () => {
  let init: RequestInit | undefined
  const originalFetch = globalThis.fetch
  globalThis.fetch = async (_input, requestInit) => {
    init = requestInit
    return new Response(JSON.stringify(emptyResponse), { status: 200 })
  }
  try {
    await uploadConfigurationCatalog(new File(['zip'], 'configuration.zip'))
    assert.equal(init?.method, 'PUT')
    assert.ok(init?.body instanceof FormData)
    assert.equal(init?.headers, undefined)
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('preserves a Russian server error and deletes with DELETE', async () => {
  const originalFetch = globalThis.fetch
  const calls: RequestInit[] = []
  globalThis.fetch = async (_input, init) => {
    calls.push(init ?? {})
    if (calls.length === 1) {
      return new Response(JSON.stringify({ error: 'Некорректный ZIP-архив' }), { status: 400 })
    }
    return new Response(null, { status: 204 })
  }
  try {
    await assert.rejects(getConfigurationCatalog(), /Некорректный ZIP-архив/)
    await deleteConfigurationCatalog()
    assert.equal(calls[1].method, 'DELETE')
  } finally {
    globalThis.fetch = originalFetch
  }
})
