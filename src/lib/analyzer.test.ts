import assert from 'node:assert/strict'
import test from 'node:test'
import { analyzeText } from './analyzer'

test('counts each repeated quoted entity mention once', () => {
  const result = analyzeText(
    [
      'Документ «Особая сущность» создаётся.',
      'Документ «Особая сущность» проводится.',
      'Документ «Особая сущность» печатается.',
    ].join(' '),
  )

  const entity = result.entities.find((item) => item.name === 'Особая сущность')
  assert.equal(entity?.count, 3)
  assert.equal(entity?.type, 'Документ')
})

test('keeps repeated CamelCase extraction linear for a large document', () => {
  const mentions = 2_000
  const result = analyzeText(Array.from({ length: mentions }, () => 'SpecialEntityName').join(' '))

  const entity = result.entities.find((item) => item.name === 'SpecialEntityName')
  assert.equal(entity?.count, mentions)
})
