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

test('finds an allow/forbid contradiction', () => {
  const result = findContradictions(
    'Разрешить выгрузку отчёта. Запретить выгрузку отчёта.',
  )

  assert.equal(result.length, 1)
  assert.equal(result[0].category, 'logical')
})

test('finds a show/not-show contradiction', () => {
  const result = findContradictions(
    'Показывать кнопку «Печать». Не показывать кнопку «Печать».',
  )

  assert.equal(result.length, 1)
  assert.equal(result[0].category, 'logical')
})

test('finds a create/not-create contradiction', () => {
  const result = findContradictions(
    'Создавать резервную копию. Не создавать резервную копию.',
  )

  assert.equal(result.length, 1)
  assert.equal(result[0].category, 'logical')
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

test('deduplicates a logical quote pair regardless of encounter order', () => {
  const forward = findContradictions(
    'Поле «Скидка» обязательное. Поле «Скидка» необязательное. Поле «Скидка» обязательное.',
  )
  const reverse = findContradictions(
    'Поле «Скидка» необязательное. Поле «Скидка» обязательное.',
  )

  assert.equal(forward.length, 1)
  assert.equal(forward[0].id, reverse[0].id)
  assert.deepEqual(reverse[0].quotes, [
    'Поле «Скидка» необязательное.',
    'Поле «Скидка» обязательное.',
  ])
})

test('deduplicates a numeric quote pair regardless of encounter order', () => {
  const forward = findContradictions(
    'Хранить журнал 30 дней. Хранить журнал 60 дней. Хранить журнал 30 дней.',
  )
  const reverse = findContradictions(
    'Хранить журнал 60 дней. Хранить журнал 30 дней.',
  )

  assert.equal(forward.length, 1)
  assert.equal(forward[0].id, reverse[0].id)
  assert.deepEqual(reverse[0].quotes, [
    'Хранить журнал 60 дней.',
    'Хранить журнал 30 дней.',
  ])
})

test('deduplicates semantically equivalent assertions before comparing conflicts', () => {
  const requirements = Array.from({ length: 120 }, (_, index) => [
    `Хранить${' '.repeat(index + 1)}журнал 30 дней.`,
    `Хранить${' '.repeat(index + 1)}журнал 60 дней.`,
  ]).flat().join(' ')

  const result = findContradictions(requirements)

  assert.equal(result.length, 1)
  assert.deepEqual(result[0].quotes, [
    'Хранить журнал 30 дней.',
    'Хранить журнал 60 дней.',
  ])
})

test('keeps qualifiers after recognized ruble and piece abbreviations', () => {
  assert.deepEqual(findContradictions(
    'Стоимость доставки 100 руб. для Москвы. Стоимость доставки 200 руб. для Новосибирска.',
  ), [])
  assert.deepEqual(findContradictions(
    'Комплект содержит 10 шт. для офиса. Комплект содержит 20 шт. для склада.',
  ), [])
})

test('skips numeric bounds and ranges without full interval semantics', () => {
  assert.deepEqual(findContradictions(
    'Хранить журнал не более 30 дней. Хранить журнал не более 60 дней.',
  ), [])
  assert.deepEqual(findContradictions(
    'Хранить журнал не менее 30 дней. Хранить журнал не менее 60 дней.',
  ), [])
  assert.deepEqual(findContradictions(
    'Хранить журнал от 30 дней. Хранить журнал до 60 дней.',
  ), [])
  assert.deepEqual(findContradictions(
    'Хранить журнал минимум 30 дней. Хранить журнал максимум 60 дней.',
  ), [])
  assert.deepEqual(findContradictions(
    'Хранить журнал 30–60 дней. Хранить журнал 60–90 дней.',
  ), [])
})

test('does not double punctuation after abbreviated numeric values', () => {
  const result = findContradictions(
    'Стоимость заказа 100 руб. Стоимость заказа 200 руб.',
  )

  assert.equal(result.length, 1)
  assert.equal(
    result[0].explanation,
    'Для одного параметра указаны разные значения: 100 руб. и 200 руб.',
  )
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
