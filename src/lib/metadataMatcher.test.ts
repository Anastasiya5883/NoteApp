import assert from 'node:assert/strict'
import test from 'node:test'
import type { ConfigurationCatalog } from './configurationCatalogTypes'
import { matchAnalysisMetadata } from './metadataMatcher'

const localCatalog: ConfigurationCatalog = {
  catalogKind: 'local',
  configurationName: 'Локальная база',
  configurationSynonym: null,
  configurationVersion: '1.0',
  sourceFileName: 'Configuration.xml',
  uploadedAt: 1,
  sourceNote: null,
  objects: [
    {
      kind: 'Catalog',
      name: 'Номенклатура',
      synonym: null,
      attributes: [
        { name: 'Артикул', synonym: null, typeDescription: null, role: 'attribute' },
      ],
      tableParts: [],
    },
  ],
}

const entity = (name: string, context: string) => ({
  name,
  type: 'Справочник' as const,
  confidence: 'высокая' as const,
  context,
  count: 1,
})

const attribute = (name: string, context: string) => ({ name, context, count: 1 })

test('local exact object and attribute match wins over ERP reference', () => {
  const checks = matchAnalysisMetadata(
    [entity('Номенклатура', 'Добавить Артикул в Номенклатуру.')],
    [attribute('Артикул', 'Добавить Артикул в Номенклатуру.')],
    localCatalog,
  )

  assert.equal(checks[0].status, 'local-exact')
  assert.equal(checks[0].matchedAttribute, 'Артикул')
  assert.equal(checks[0].source, 'local')
})

test('missing local attribute is not promoted to exact by ERP reference', () => {
  const catalogWithoutArticle: ConfigurationCatalog = {
    ...localCatalog,
    objects: [{ ...localCatalog.objects[0], attributes: [] }],
  }
  const checks = matchAnalysisMetadata(
    [entity('Номенклатура', 'Добавить Артикул.')],
    [attribute('Артикул', 'Добавить Артикул.')],
    catalogWithoutArticle,
  )

  assert.equal(checks[0].status, 'missing')
  assert.match(checks[0].note, /локальной конфигурации/)
})

test('ERP reference is used when no local catalog is loaded', () => {
  const checks = matchAnalysisMetadata(
    [entity('Номенклатура', 'Добавить Артикул в Номенклатуру.')],
    [attribute('Артикул', 'Добавить Артикул в Номенклатуру.')],
    null,
  )

  assert.equal(checks[0].source, 'erp-reference')
  assert.equal(checks[0].status, 'erp-reference-exact')
})

test('normalizes ё, whitespace, underscores, and hyphens before exact matching', () => {
  const catalog: ConfigurationCatalog = {
    ...localCatalog,
    objects: [{
      ...localCatalog.objects[0],
      name: 'Учёт_Номенклатуры',
      attributes: [{ name: 'Вид-Номенклатуры', synonym: null, typeDescription: null, role: 'attribute' }],
    }],
  }

  const checks = matchAnalysisMetadata(
    [entity('Учет номенклатуры', 'Указать вид номенклатуры.')],
    [attribute('Вид Номенклатуры', 'Указать вид номенклатуры.')],
    catalog,
  )

  assert.equal(checks[0].status, 'local-exact')
  assert.equal(checks[0].matchedObject, 'Учёт_Номенклатуры')
  assert.equal(checks[0].matchedAttribute, 'Вид-Номенклатуры')
})

test('matches object and attribute synonyms exactly', () => {
  const catalog: ConfigurationCatalog = {
    ...localCatalog,
    objects: [{
      ...localCatalog.objects[0],
      name: 'НоменклатураТоваров',
      synonym: 'Товары',
      attributes: [{ name: 'ВнутреннийКод', synonym: 'Код товара', typeDescription: null, role: 'attribute' }],
    }],
  }

  const checks = matchAnalysisMetadata(
    [entity('Товары', 'Добавить код товара в товары.')],
    [attribute('Код товара', 'Добавить код товара в товары.')],
    catalog,
  )

  assert.equal(checks[0].status, 'local-exact')
  assert.equal(checks[0].matchedObject, 'НоменклатураТоваров')
  assert.equal(checks[0].matchedAttribute, 'ВнутреннийКод')
})

test('reports high-threshold similar object matches as similar', () => {
  const checks = matchAnalysisMetadata(
    [entity('Номенклатурра', 'Проверить номенклатурра.')],
    [],
    localCatalog,
  )

  assert.equal(checks[0].status, 'local-similar')
  assert.equal(checks[0].matchedObject, 'Номенклатура')
  assert.equal(checks[0].requestedAttribute, null)
})

test('matches attributes inside table parts and returns their path', () => {
  const checks = matchAnalysisMetadata(
    [entity('ЗаказКлиента', 'В табличной части Товары указать Номенклатуру.')],
    [attribute('Товары.Номенклатура', 'В табличной части Товары указать Номенклатуру.')],
    null,
  )

  assert.equal(checks[0].status, 'erp-reference-exact')
  assert.equal(checks[0].matchedAttribute, 'ЗаказКлиента.Товары.Номенклатура')
})

test('associates all attributes with the only detected entity', () => {
  const checks = matchAnalysisMetadata(
    [entity('Номенклатура', 'Добавить справочник номенклатуры.')],
    [attribute('Артикул', 'Поле артикул обязательно.')],
    localCatalog,
  )

  assert.equal(checks.length, 1)
  assert.equal(checks[0].requestedAttribute, 'Артикул')
  assert.equal(checks[0].status, 'local-exact')
})

test('associates attributes with entities from the same sentence when several entities exist', () => {
  const checks = matchAnalysisMetadata(
    [
      entity('Номенклатура', 'Для номенклатуры добавить артикул.'),
      entity('Контрагенты', 'Для контрагентов добавить ИНН.'),
    ],
    [
      attribute('Артикул', 'Для номенклатуры добавить артикул.'),
      attribute('ИНН', 'Для контрагентов добавить ИНН.'),
    ],
    null,
  )

  assert.deepEqual(checks.map((check) => [check.requestedObject, check.requestedAttribute]), [
    ['Номенклатура', 'Артикул'],
    ['Контрагенты', 'ИНН'],
  ])
})
