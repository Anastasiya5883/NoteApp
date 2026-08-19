import assert from 'node:assert/strict'
import test from 'node:test'
import { analyzeText } from './analyzer'
import { buildMarkdown } from './exporter'

test('contradiction report contains conflicts and omits 1C attribute sections', () => {
  const markdown = buildMarkdown(analyzeText(
    'Поле «Код» нужно показывать. Поле «Код» не показывать.',
    'contradictions',
  ))

  assert.match(markdown, /# Проверка ТЗ на противоречия/)
  assert.match(markdown, /Противоречия в требованиях/)
  assert.doesNotMatch(markdown, /Предполагаемые реквизиты/)
})

test('attribute report keeps the 1C structure and omits contradiction section', () => {
  const markdown = buildMarkdown(analyzeText(
    'В справочнике «Номенклатура» добавить реквизит «Вес».',
    'attributes',
  ))

  assert.match(markdown, /# Подбор объектов и реквизитов 1С/)
  assert.match(markdown, /Предполагаемые реквизиты/)
  assert.doesNotMatch(markdown, /Противоречия в требованиях/)
})

