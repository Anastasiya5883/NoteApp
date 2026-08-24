import assert from 'node:assert/strict'
import test from 'node:test'
import { normalizeHistoryResult } from './history'

test('old history results open in attribute mode without contradictions', () => {
  const result = normalizeHistoryResult({
    words: 3,
    entities: [],
    attributes: [],
    sections: [],
    gaps: [],
    recommendations: [],
  })

  assert.equal(result.mode, 'attributes')
  assert.deepEqual(result.contradictions, [])
  assert.deepEqual(result.metadataChecks, [])
  assert.deepEqual(result.catalogContext, {
    localUploadedAt: null,
    erpReferenceVersion: '2.6.1.16',
  })
})

test('malformed contradiction entries are removed when history opens', () => {
  const result = normalizeHistoryResult({
    mode: 'contradictions',
    words: 3,
    entities: [],
    attributes: [],
    sections: [],
    gaps: [],
    recommendations: [],
    contradictions: [{ id: 'broken' }] as never,
  })

  assert.deepEqual(result.contradictions, [])
})
