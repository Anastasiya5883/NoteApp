import assert from 'node:assert/strict'
import test from 'node:test'
import type { AnalysisResult } from './analyzer'
import { getHistoryEntry, normalizeHistoryResult } from './history'

test('adds an empty contradictions array to legacy history results', () => {
  const legacy = {
    words: 1,
    entities: [],
    attributes: [],
    sections: [],
    gaps: [],
    recommendations: [],
  }

  assert.deepEqual(normalizeHistoryResult(legacy).contradictions, [])
})

test('preserves contradictions already stored in history', () => {
  const current: AnalysisResult = {
    words: 1,
    entities: [],
    attributes: [],
    sections: [],
    contradictions: [{
      id: 'contradiction-logical-1',
      category: 'logical',
      severity: 'critical',
      title: 'Взаимоисключающие требования',
      explanation: 'Конфликт.',
      quotes: ['Первое.', 'Второе.'],
    }],
    gaps: [],
    recommendations: [],
  }

  assert.strictEqual(normalizeHistoryResult(current), current)
})

test('normalizes a legacy result returned by getHistoryEntry', async (t) => {
  const originalFetch = globalThis.fetch
  t.after(() => { globalThis.fetch = originalFetch })
  globalThis.fetch = async () => new Response(JSON.stringify({
    entry: {
      id: 7,
      fileName: 'legacy.txt',
      createdAt: 1,
      stats: { words: 1, entities: 0, attributes: 0, sections: 0, gaps: 0 },
      sourceText: 'Старое требование.',
      result: {
        words: 1,
        entities: [],
        attributes: [],
        sections: [],
        gaps: [],
        recommendations: [],
      },
    },
  }), { status: 200, headers: { 'Content-Type': 'application/json' } })

  const entry = await getHistoryEntry(7)

  assert.deepEqual(entry.result.contradictions, [])
})
