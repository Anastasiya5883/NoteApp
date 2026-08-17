import assert from 'node:assert/strict'
import test from 'node:test'
import type { AnalysisResult } from './analyzer'
import { normalizeHistoryResult } from './history'

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
