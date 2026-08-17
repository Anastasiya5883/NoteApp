import assert from 'node:assert/strict'
import test from 'node:test'
import type { AnalysisResult } from './analyzer'
import { buildMarkdown } from './exporter'

const baseResult = (): AnalysisResult => ({
  words: 12,
  entities: [],
  attributes: [],
  sections: [],
  contradictions: [],
  gaps: [],
  recommendations: [],
})

test('exports contradiction explanation and both source quotes', () => {
  const result = baseResult()
  result.contradictions.push({
    id: 'contradiction-logical-1',
    category: 'logical',
    severity: 'critical',
    title: 'Взаимоисключающие требования',
    explanation: 'Для одного предмета заданы противоположные требования.',
    quotes: ['Поле «Скидка» обязательное.', 'Поле «Скидка» необязательное.'],
  })

  const markdown = buildMarkdown(result)
  assert.match(markdown, /## Противоречия в требованиях/)
  assert.match(markdown, /Поле «Скидка» обязательное\./)
  assert.match(markdown, /Поле «Скидка» необязательное\./)
})

test('exports an explicit empty state when no contradictions exist', () => {
  assert.match(buildMarkdown(baseResult()), /Явных противоречий не выявлено/)
})
