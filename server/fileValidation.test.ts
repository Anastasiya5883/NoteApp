import assert from 'node:assert/strict'
import test from 'node:test'
import { isSupportedHistoryFileName } from './fileValidation.js'

test('accepts every file format supported by the client', () => {
  for (const name of ['requirements.txt', 'requirements.md', 'requirements.markdown', 'requirements.pdf', 'requirements.docx']) {
    assert.equal(isSupportedHistoryFileName(name), true, name)
  }
})

test('rejects legacy Word and unrelated file formats', () => {
  for (const name of ['requirements.doc', 'requirements.rtf', 'requirements.exe', 'requirements']) {
    assert.equal(isSupportedHistoryFileName(name), false, name)
  }
})
