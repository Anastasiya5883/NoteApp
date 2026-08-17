import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createAnalysisInput,
  prepareAnalysisInput,
  setAnalysisFile,
  setAnalysisPrompt,
  setAnalysisSample,
} from './analysisInput'

test('loading a file preserves the prompt and stores file content separately', () => {
  const state = setAnalysisFile(
    setAnalysisPrompt(createAnalysisInput(), 'Найди только критические противоречия'),
    'requirements.txt',
    'Текст требований из файла.',
  )

  assert.deepEqual(state, {
    prompt: 'Найди только критические противоречия',
    fileName: 'requirements.txt',
    fileContent: 'Текст требований из файла.',
  })
})

test('preparing a file detects critical-only mode from the prompt', () => {
  const state = setAnalysisFile(
    setAnalysisPrompt(createAnalysisInput(), 'ТОЛЬКО критические противоречия, пожалуйста'),
    'requirements.txt',
    'Текст требований из файла.',
  )

  assert.deepEqual(prepareAnalysisInput(state), {
    sourceText: 'Текст требований из файла.',
    fileName: 'requirements.txt',
    options: { contradictionSeverity: 'critical' },
  })
})

test('preparing no-file input uses the prompt as source text', () => {
  const state = setAnalysisPrompt(createAnalysisInput(), 'Требуется создать новый отчёт.')

  assert.deepEqual(prepareAnalysisInput(state), {
    sourceText: 'Требуется создать новый отчёт.',
    fileName: null,
    options: {},
  })
})

test('unknown prompt with a file does not set analysis options', () => {
  const state = setAnalysisFile(
    setAnalysisPrompt(createAnalysisInput(), 'Проверь документ внимательно'),
    'requirements.txt',
    'Текст требований из файла.',
  )

  assert.deepEqual(prepareAnalysisInput(state).options, {})
})

test('selecting a sample clears the previously loaded file', () => {
  const state = setAnalysisSample(
    setAnalysisFile(createAnalysisInput(), 'requirements.txt', 'Текст файла.'),
    'Текст примера.',
  )

  assert.deepEqual(state, { prompt: 'Текст примера.', fileName: null, fileContent: null })
})

test('replacing a file preserves the prompt and prepares the replacement', () => {
  const withFirstFile = setAnalysisFile(
    setAnalysisPrompt(createAnalysisInput(), 'Мой запрос'),
    'first.txt',
    'Первый текст.',
  )
  const withSecondFile = setAnalysisFile(withFirstFile, 'second.txt', 'Второй текст.')

  assert.equal(withSecondFile.prompt, 'Мой запрос')
  assert.deepEqual(prepareAnalysisInput(withSecondFile), {
    sourceText: 'Второй текст.',
    fileName: 'second.txt',
    options: {},
  })
})

test('createAnalysisInput returns a fully cleared state', () => {
  assert.deepEqual(createAnalysisInput(), { prompt: '', fileName: null, fileContent: null })
})
