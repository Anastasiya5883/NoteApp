import assert from 'node:assert/strict'
import test from 'node:test'
import { parseConfigurationXml } from './configurationXml.js'
import {
  catalogXml,
  configurationXml,
  documentXml,
  registerXml,
  simpleObjectXml,
} from './testFixtures/configurationXml.js'

function xmlFiles(entries: Record<string, string>): Map<string, Buffer> {
  return new Map(Object.entries(entries).map(([path, xml]) => [path, Buffer.from(xml)]))
}

test('parses configuration properties, catalog attributes, table parts, and document metadata', () => {
  const catalog = parseConfigurationXml(xmlFiles({
    'Configuration.xml': configurationXml,
    'Catalogs/Номенклатура.xml': catalogXml,
    'Documents/ЗаказКлиента.xml': documentXml,
    'Catalogs/Номенклатура/Ext/ManagerModule.bsl.xml': '<not-metadata/>',
  }), 'trade.zip')

  assert.equal(catalog.catalogKind, 'local')
  assert.equal(catalog.configurationName, 'TradeManagement')
  assert.equal(catalog.configurationSynonym, 'Управление торговлей')
  assert.equal(catalog.configurationVersion, '11.5.20.100')
  assert.equal(catalog.sourceFileName, 'trade.zip')
  assert.equal(typeof catalog.uploadedAt, 'number')
  assert.deepEqual(catalog.objects, [
    {
      kind: 'Catalog',
      name: 'Номенклатура',
      synonym: 'Номенклатура',
      attributes: [{
        name: 'Артикул',
        synonym: 'Артикул',
        typeDescription: 'xs:string',
        role: 'attribute',
      }],
      tableParts: [{
        name: 'Единицы',
        synonym: 'Единицы измерения',
        attributes: [{
          name: 'Коэффициент',
          synonym: 'Коэффициент',
          typeDescription: 'xs:decimal',
          role: 'attribute',
        }],
      }],
    },
    {
      kind: 'Document',
      name: 'ЗаказКлиента',
      synonym: 'Заказ клиента',
      attributes: [{
        name: 'Комментарий',
        synonym: 'Комментарий',
        typeDescription: 'xs:string',
        role: 'attribute',
      }],
      tableParts: [],
    },
  ])
})

test('maps dimensions, resources, and attributes for every supported register kind', () => {
  const files: Record<string, string> = { 'Configuration.xml': configurationXml }
  for (const [kind, xml] of Object.entries(registerXml)) files[`${kind}s/item.xml`] = xml

  const catalog = parseConfigurationXml(xmlFiles(files), 'registers.zip')

  assert.deepEqual(catalog.objects.map((object) => ({
    kind: object.kind,
    roles: object.attributes.map((attribute) => attribute.role),
  })), [
    { kind: 'InformationRegister', roles: ['attribute', 'dimension', 'resource'] },
    { kind: 'AccumulationRegister', roles: ['attribute', 'dimension', 'resource'] },
    { kind: 'AccountingRegister', roles: ['attribute', 'dimension', 'resource'] },
    { kind: 'CalculationRegister', roles: ['attribute', 'dimension', 'resource'] },
  ])
})

test('maps report, data processor, enum, constant, and business process metadata', () => {
  const files: Record<string, string> = { 'Configuration.xml': configurationXml }
  for (const [kind, xml] of Object.entries(simpleObjectXml)) files[`${kind}s/item.xml`] = xml

  const catalog = parseConfigurationXml(xmlFiles(files), 'simple.zip')

  assert.deepEqual(catalog.objects.map(({ kind, name }) => [kind, name]), [
    ['Report', 'ВаловаяПрибыль'],
    ['DataProcessor', 'ЗагрузкаЦен'],
    ['Enum', 'СтатусыЗаказов'],
    ['Constant', 'ОсновнаяВалюта'],
    ['BusinessProcess', 'СогласованиеЗаказа'],
  ])
})

test('throws invalid-xml for malformed metadata XML', () => {
  assert.throws(
    () => parseConfigurationXml(xmlFiles({
      'Configuration.xml': configurationXml,
      'Catalogs/Broken.xml': '<MetaDataObject><Catalog>',
    }), 'broken.zip'),
    (error: unknown) => error instanceof Error && 'code' in error && error.code === 'invalid-xml',
  )
})

test('rejects DTD and entity declarations instead of resolving them', () => {
  const xmlWithEntity = `<?xml version="1.0"?>
<!DOCTYPE MetaDataObject [<!ENTITY configurationName "Injected">]>
<MetaDataObject><Configuration><Properties><Name>&configurationName;</Name></Properties></Configuration></MetaDataObject>`

  assert.throws(
    () => parseConfigurationXml(xmlFiles({ 'Configuration.xml': xmlWithEntity }), 'entity.zip'),
    (error: unknown) => error instanceof Error && 'code' in error && error.code === 'invalid-xml',
  )
})
