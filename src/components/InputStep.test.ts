import assert from 'node:assert/strict'
import test from 'node:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import InputStep from './InputStep'

test('renders only the prompt when a file is selected', () => {
  const html = renderToStaticMarkup(createElement(InputStep, {
    prompt: 'Найди только критические противоречия',
    setPrompt() {},
    fileName: 'requirements.txt',
    canAnalyze: true,
    onFileLoaded() {},
    onUseSample() {},
    onAnalyze() {},
  }))

  assert.match(html, /Найди только критические противоречия/)
  assert.match(html, /requirements\.txt/)
  assert.doesNotMatch(html, /Текст требований из файла/)
})
