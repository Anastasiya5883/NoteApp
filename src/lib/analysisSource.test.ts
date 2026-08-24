import assert from 'node:assert/strict'
import test from 'node:test'
import { composeAnalysisSource } from './analysisSource'

test('keeps additional information separate while including it in analysis', () => {
  assert.equal(
    composeAnalysisSource('Текст из файла', 'Дополнительные сведения'),
    'Текст из файла\n\nДополнительные сведения',
  )
})

test('uses either source when the other one is empty', () => {
  assert.equal(composeAnalysisSource('Текст из файла', ''), 'Текст из файла')
  assert.equal(composeAnalysisSource('', 'Дополнительные сведения'), 'Дополнительные сведения')
})
