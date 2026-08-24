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

export type ConfigurationImportErrorCode =
  | 'invalid-archive'
  | 'archive-too-large'
  | 'expanded-too-large'
  | 'too-many-files'
  | 'unsafe-path'
  | 'configuration-not-found'
  | 'ambiguous-root'
  | 'invalid-xml'

export class ConfigurationImportError extends Error {
  readonly code: ConfigurationImportErrorCode

  constructor(code: ConfigurationImportErrorCode, message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = 'ConfigurationImportError'
    this.code = code
  }
}
