import assert from 'node:assert/strict'
import test from 'node:test'
import { buildCatalogViewModel } from './configurationCatalogViewModel'

const summary = {
  sourceFileName: 'erp.zip',
  configurationName: 'ERP',
  configurationSynonym: '1С:ERP',
  configurationVersion: '2.6.1.16',
  uploadedAt: Date.UTC(2026, 7, 24, 8, 30),
  objectCount: 10,
  attributeCount: 42,
  tablePartCount: 5,
}

test('builds empty and loading catalog states', () => {
  assert.deepEqual(buildCatalogViewModel({ status: 'empty', summary: null, error: null }), {
    title: 'Данные не загружены',
    details: [],
    canUpload: true,
    canDelete: false,
    isBusy: false,
    error: null,
  })
  assert.equal(buildCatalogViewModel({ status: 'loading', summary: null, error: null }).title, 'Загрузка и обработка…')
  assert.equal(buildCatalogViewModel({ status: 'loading', summary: null, error: null }).canUpload, false)
})

test('builds loaded state with metadata and actions', () => {
  const view = buildCatalogViewModel({ status: 'loaded', summary, error: null })
  assert.equal(view.title, 'Данные загружены')
  assert.equal(view.canUpload, true)
  assert.equal(view.canDelete, true)
  assert.ok(view.details.some((item) => item.includes('2.6.1.16')))
  assert.ok(view.details.some((item) => item.includes('10 объектов')))
})

test('keeps loaded details visible after a replacement error', () => {
  const view = buildCatalogViewModel({ status: 'loaded', summary, error: 'Не удалось заменить данные' })
  assert.equal(view.title, 'Данные загружены')
  assert.equal(view.error, 'Не удалось заменить данные')
  assert.ok(view.details.length > 0)
})
