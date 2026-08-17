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

const mixedContradictionsText = [
  'Поле «Скидка» обязательное.',
  'Поле «Скидка» необязательное.',
  'Срок хранения архива 30 дней.',
  'Срок хранения архива 90 дней.',
].join(' ')

test('filters contradictions by requested severity', () => {
  const result = analyzeText(mixedContradictionsText, { contradictionSeverity: 'critical' })

  assert.deepEqual(result.contradictions.map((contradiction) => contradiction.severity), ['critical'])
})

test('keeps all contradiction severities by default', () => {
  const result = analyzeText(mixedContradictionsText)

  assert.deepEqual(result.contradictions.map((contradiction) => contradiction.severity), ['critical', 'warning'])
})
