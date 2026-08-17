import assert from 'node:assert/strict'
import test from 'node:test'
import { analyzeText } from './analyzer'

test('includes contradictions in the complete analysis result', () => {
  const result = analyzeText(
    'Поле «Скидка» обязательное. Поле «Скидка» необязательное.',
  )

  assert.equal(result.contradictions.length, 1)
  assert.equal(result.contradictions[0].category, 'logical')
})
