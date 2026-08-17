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

test('uses the sentence of the mention that establishes entity confidence', () => {
  const result = analyzeText(
    [
      '«Особая сущность» упоминается без типа.',
      'Документ «Особая сущность» создаётся после согласования.',
    ].join(' '),
  )

  const entity = result.entities.find((item) => item.name === 'Особая сущность')
  assert.equal(entity?.count, 2)
  assert.equal(entity?.confidence, 'высокая')
  assert.equal(entity?.context, 'Документ «Особая сущность» создаётся после согласования.')
})

test('uses the matched sentence when the CamelCase name appears earlier in lowercase', () => {
  const result = analyzeText(
    [
      'specialentityname упоминается строчными буквами.',
      'SpecialEntityName создаётся после согласования.',
    ].join(' '),
  )

  const entity = result.entities.find((item) => item.name === 'SpecialEntityName')
  assert.equal(entity?.count, 1)
  assert.equal(entity?.context, 'SpecialEntityName создаётся после согласования.')
})

test('counts repeated CamelCase entity mentions in a large document', () => {
  const mentions = 2_000
  const result = analyzeText(Array.from({ length: mentions }, () => 'SpecialEntityName').join(' '))

  const entity = result.entities.find((item) => item.name === 'SpecialEntityName')
  assert.equal(entity?.count, mentions)
})
