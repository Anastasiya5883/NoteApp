import assert from 'node:assert/strict'
import test from 'node:test'
import { analyzeText } from './analyzer'

test('attribute mode suggests 1C attributes from the requirements context', () => {
  const result = analyzeText(
    'Добавить в справочник «Номенклатура» реквизит «Артикул».',
    'attributes',
  )

  assert.equal(result.mode, 'attributes')
  assert.deepEqual(result.attributes.map((attribute) => attribute.name), ['Артикул'])
  assert.deepEqual(result.contradictions, [])
  assert.equal(result.catalogContext.erpReferenceVersion, '2.6.1.16')
  assert.equal(result.metadataChecks[0].status, 'erp-reference-exact')
})

test('contradiction mode detects opposite requirements for the same subject', () => {
  const result = analyzeText(
    'Поле «Комментарий» обязательно для заполнения. Поле «Комментарий» необязательно.',
    'contradictions',
  )

  assert.equal(result.mode, 'contradictions')
  assert.equal(result.contradictions.length, 1)
  assert.equal(result.contradictions[0].category, 'logical')
  assert.deepEqual(result.metadataChecks, [])
  assert.deepEqual(result.contradictions[0].quotes, [
    'Поле «Комментарий» обязательно для заполнения.',
    'Поле «Комментарий» необязательно.',
  ])
})

test('contradiction mode detects different numeric limits for the same subject', () => {
  const result = analyzeText(
    'Хранить журнал 30 дней. Хранить журнал 60 дней.',
    'contradictions',
  )

  assert.equal(result.contradictions.length, 1)
  assert.equal(result.contradictions[0].category, 'numeric')
})

test('contradiction mode does not compare numeric values for different subjects', () => {
  const result = analyzeText(
    'Хранить журнал 30 дней. Хранить резервную копию 60 дней.',
    'contradictions',
  )

  assert.deepEqual(result.contradictions, [])
})

test('contradiction mode keeps requirements for different UI locations separate', () => {
  const result = analyzeText(
    'Показывать поле «Код» в форме списка. Не показывать поле «Код» в карточке.',
    'contradictions',
  )

  assert.deepEqual(result.contradictions, [])
})
