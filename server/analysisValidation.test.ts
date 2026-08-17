import assert from 'node:assert/strict'
import test from 'node:test'
import { isAnalysisResult } from './analysisValidation.js'

const validResult = {
  words: 1,
  entities: [],
  attributes: [],
  sections: [],
  contradictions: [],
  gaps: [],
  recommendations: [],
}

test('accepts current analysis results with contradictions', () => {
  assert.equal(isAnalysisResult(validResult), true)
})

test('rejects new history submissions without contradictions', () => {
  const { contradictions: _contradictions, ...legacyResult } = validResult
  assert.equal(isAnalysisResult(legacyResult), false)
})
