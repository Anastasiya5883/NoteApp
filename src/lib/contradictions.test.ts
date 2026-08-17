import assert from 'node:assert/strict'
import test from 'node:test'
import { findContradictions } from './contradictions'

test('finds an explicit logical contradiction for the same subject', () => {
  const result = findContradictions(
    'Поле «Скидка» обязательное. Поле «Скидка» необязательное.',
  )

  assert.equal(result.length, 1)
  assert.equal(result[0].category, 'logical')
  assert.deepEqual(result[0].quotes, [
    'Поле «Скидка» обязательное.',
    'Поле «Скидка» необязательное.',
  ])
})

test('does not compare opposite rules for different subjects', () => {
  const result = findContradictions(
    'Поле «Скидка» обязательное. Поле «Комментарий» необязательное.',
  )

  assert.deepEqual(result, [])
})

test('does not report repeated equivalent requirements', () => {
  const result = findContradictions(
    'Показывать кнопку «Печать». Показывать кнопку «Печать».',
  )

  assert.deepEqual(result, [])
})

test('finds different numeric values for the same parameter and unit', () => {
  const result = findContradictions('Хранить журнал 30 дней. Хранить журнал 60 дней.')
  assert.equal(result.length, 1)
  assert.equal(result[0].category, 'numeric')
  assert.match(result[0].explanation, /30.*60/)
})

test('ignores equal values and different units or parameters', () => {
  assert.deepEqual(findContradictions('Хранить журнал 30 дней. Хранить журнал 30 дней.'), [])
  assert.deepEqual(findContradictions('Хранить журнал 30 дней. Хранить журнал 30 часов.'), [])
  assert.deepEqual(findContradictions('Хранить журнал 30 дней. Блокировать заказ через 60 дней.'), [])
})

test('deduplicates pairs and preserves first-conflict order', () => {
  const result = findContradictions([
    'Хранить журнал 30 дней.', 'Поле «Скидка» обязательное.', 'Хранить журнал 60 дней.',
    'Поле «Скидка» необязательное.', 'Хранить журнал 60 дней.',
  ].join(' '))
  assert.deepEqual(result.map((item) => item.category), ['numeric', 'logical'])
  assert.equal(result.length, 2)
  assert.equal(result[0].id, findContradictions('Хранить журнал 30 дней. Хранить журнал 60 дней.')[0].id)
})
