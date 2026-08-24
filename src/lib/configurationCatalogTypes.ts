export type MetadataObjectKind =
  | 'Catalog'
  | 'Document'
  | 'InformationRegister'
  | 'AccumulationRegister'
  | 'AccountingRegister'
  | 'CalculationRegister'
  | 'Report'
  | 'DataProcessor'
  | 'Enum'
  | 'Constant'
  | 'BusinessProcess'

export interface ConfigurationAttribute {
  name: string
  synonym: string | null
  typeDescription: string | null
  role: 'attribute' | 'dimension' | 'resource'
}

export interface ConfigurationTablePart {
  name: string
  synonym: string | null
  attributes: ConfigurationAttribute[]
}

export interface ConfigurationObject {
  kind: MetadataObjectKind
  name: string
  synonym: string | null
  attributes: ConfigurationAttribute[]
  tableParts: ConfigurationTablePart[]
}

export interface ConfigurationCatalog {
  catalogKind: 'local' | 'erp-reference'
  configurationName: string
  configurationSynonym: string | null
  configurationVersion: string | null
  sourceFileName: string
  uploadedAt: number
  sourceNote?: string | null
  objects: ConfigurationObject[]
}

export interface CatalogSummary {
  objectCount: number
  attributeCount: number
  tablePartCount: number
}

export type MatchStatus =
  | 'local-exact'
  | 'local-similar'
  | 'erp-reference-exact'
  | 'erp-reference-similar'
  | 'missing'

export interface MetadataCheck {
  requestedObject: string
  requestedAttribute: string | null
  status: MatchStatus
  matchedObject: string | null
  matchedAttribute: string | null
  source: 'local' | 'erp-reference' | null
  note: string
}
