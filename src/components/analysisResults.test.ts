import assert from 'node:assert/strict'
import test from 'node:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import type { AnalysisResult } from '../lib/analyzer'
import AnalyzingStep from './AnalyzingStep'
import ResultsStep from './ResultsStep'

const result: AnalysisResult = {
  words: 10,
  entities: [],
  attributes: [],
  sections: [],
  contradictions: [{
    id: 'contradiction-logical-1',
    category: 'logical',
    severity: 'critical',
    title: 'Взаимоисключающие требования',
    explanation: 'Для одного предмета заданы противоположные требования.',
    quotes: ['Поле обязательно.', 'Поле необязательно.'],
  }],
  gaps: [],
  recommendations: [],
}

test('renders contradiction count, explanation and both quotes', () => {
  const html = renderToStaticMarkup(createElement(ResultsStep, { result, onReset() {} }))
  assert.match(html, /Противоречий/)
  assert.match(html, /Взаимоисключающие требования/)
  assert.match(html, /Поле обязательно\./)
  assert.match(html, /Поле необязательно\./)
})

test('shows contradiction checking as an analysis stage', () => {
  const html = renderToStaticMarkup(createElement(AnalyzingStep))
  assert.match(html, /Проверка противоречий/)
})
