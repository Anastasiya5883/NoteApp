import { XMLParser, XMLValidator } from 'fast-xml-parser'
import {
  ConfigurationImportError,
  type ConfigurationAttribute,
  type ConfigurationCatalog,
  type ConfigurationObject,
  type ConfigurationTablePart,
  type MetadataObjectKind,
} from './configurationCatalogTypes.js'

type XmlNode = Record<string, unknown>

const metadataKinds: readonly MetadataObjectKind[] = [
  'Catalog',
  'Document',
  'InformationRegister',
  'AccumulationRegister',
  'AccountingRegister',
  'CalculationRegister',
  'Report',
  'DataProcessor',
  'Enum',
  'Constant',
  'BusinessProcess',
]

const parser = new XMLParser({
  ignoreAttributes: false,
  removeNSPrefix: true,
  parseTagValue: false,
  trimValues: true,
})

export function asArray<T>(value: T | T[] | null | undefined): T[] {
  if (value == null) return []
  return Array.isArray(value) ? value : [value]
}

export function readText(value: unknown): string | null {
  if (typeof value === 'string') return value.trim() || null
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (!value || typeof value !== 'object') return null

  const node = value as XmlNode
  return readText(node['#text'] ?? node.content ?? node.Type)
}

export function readSynonym(value: unknown): string | null {
  if (!value || typeof value !== 'object') return readText(value)
  const node = value as XmlNode
  const items = asArray(node.item)
  const russian = items.find((item) => {
    if (!item || typeof item !== 'object') return false
    return readText((item as XmlNode).lang)?.toLowerCase() === 'ru'
  })
  const selected = russian ?? items[0]
  if (selected && typeof selected === 'object') return readText((selected as XmlNode).content)
  return readText(node.content)
}

function readProperties(value: unknown): XmlNode | null {
  if (!value || typeof value !== 'object') return null
  const properties = (value as XmlNode).Properties
  return properties && typeof properties === 'object' ? properties as XmlNode : null
}

function readTypeDescription(properties: XmlNode): string | null {
  const typeNode = properties.Type
  if (!typeNode || typeof typeNode !== 'object') return readText(typeNode)
  const types = asArray((typeNode as XmlNode).Type)
    .map(readText)
    .filter((value): value is string => value !== null)
  return types.length > 0 ? types.join(' | ') : readText(typeNode)
}

function readField(value: unknown, role: ConfigurationAttribute['role']): ConfigurationAttribute | null {
  const properties = readProperties(value)
  if (!properties) return null
  const name = readText(properties.Name)
  if (!name) return null
  return {
    name,
    synonym: readSynonym(properties.Synonym),
    typeDescription: readTypeDescription(properties),
    role,
  }
}

export function readAttributes(childObjects: unknown): ConfigurationAttribute[] {
  if (!childObjects || typeof childObjects !== 'object') return []
  const children = childObjects as XmlNode
  const fields: ConfigurationAttribute[] = []
  for (const [tag, role] of [
    ['Attribute', 'attribute'],
    ['Dimension', 'dimension'],
    ['Resource', 'resource'],
  ] as const) {
    for (const value of asArray(children[tag])) {
      const field = readField(value, role)
      if (field) fields.push(field)
    }
  }
  return fields
}

export function readTableParts(childObjects: unknown): ConfigurationTablePart[] {
  if (!childObjects || typeof childObjects !== 'object') return []
  return asArray((childObjects as XmlNode).TabularSection).flatMap((value) => {
    const properties = readProperties(value)
    if (!properties) return []
    const name = readText(properties.Name)
    if (!name) return []
    const node = value as XmlNode
    return [{
      name,
      synonym: readSynonym(properties.Synonym),
      attributes: readAttributes(node.ChildObjects),
    }]
  })
}

function parseXml(buffer: Buffer, path: string): XmlNode {
  const xml = buffer.toString('utf8')
  if (/<!DOCTYPE|<!ENTITY/i.test(xml)) {
    throw new ConfigurationImportError('invalid-xml', `DTD and entity declarations are not allowed in ${path}`)
  }
  const validation = XMLValidator.validate(xml)
  if (validation !== true) {
    throw new ConfigurationImportError('invalid-xml', `Malformed XML in ${path}`)
  }
  try {
    const result: unknown = parser.parse(xml)
    if (!result || typeof result !== 'object') {
      throw new Error('XML document has no root element')
    }
    return result as XmlNode
  } catch (error) {
    if (error instanceof ConfigurationImportError) throw error
    throw new ConfigurationImportError('invalid-xml', `Unable to parse XML in ${path}`, { cause: error })
  }
}

function readMetadataObject(document: XmlNode): ConfigurationObject | null {
  const metadata = document.MetaDataObject
  if (!metadata || typeof metadata !== 'object') return null
  const root = metadata as XmlNode
  for (const kind of metadataKinds) {
    const value = root[kind]
    if (!value || typeof value !== 'object') continue
    const node = value as XmlNode
    const properties = readProperties(node)
    const name = properties ? readText(properties.Name) : null
    if (!properties || !name) return null
    return {
      kind,
      name,
      synonym: readSynonym(properties.Synonym),
      attributes: readAttributes(node.ChildObjects),
      tableParts: readTableParts(node.ChildObjects),
    }
  }
  return null
}

export function parseConfigurationXml(
  files: ReadonlyMap<string, Buffer>,
  sourceFileName: string,
): ConfigurationCatalog {
  let configuration: XmlNode | null = null
  const objects: ConfigurationObject[] = []

  for (const [path, buffer] of files) {
    const document = parseXml(buffer, path)
    if (path === 'Configuration.xml') {
      const metadata = document.MetaDataObject
      const root = metadata && typeof metadata === 'object' ? (metadata as XmlNode).Configuration : null
      configuration = root && typeof root === 'object' ? root as XmlNode : null
      continue
    }
    const object = readMetadataObject(document)
    if (object) objects.push(object)
  }

  const properties = readProperties(configuration)
  const configurationName = properties ? readText(properties.Name) : null
  if (!properties || !configurationName) {
    throw new ConfigurationImportError('invalid-xml', 'Configuration.xml does not contain configuration metadata')
  }

  return {
    catalogKind: 'local',
    configurationName,
    configurationSynonym: readSynonym(properties.Synonym),
    configurationVersion: readText(properties.Version),
    sourceFileName,
    uploadedAt: Date.now(),
    sourceNote: null,
    objects,
  }
}
