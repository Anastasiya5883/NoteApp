import { stat } from 'node:fs/promises'
import {
  fromBuffer,
  getFileNameLowLevel,
  open,
  type Entry,
  type ZipFile,
} from 'yauzl'
import {
  ConfigurationImportError,
  type ConfigurationCatalog,
} from './configurationCatalogTypes.js'
import { parseConfigurationXml } from './configurationXml.js'

const MIB = 1024 * 1024
const GIB = 1024 * MIB

export interface ConfigurationArchiveLimits {
  maxArchiveBytes: number
  maxExpandedBytes: number
  maxEntries: number
}

export const DEFAULT_CONFIGURATION_ARCHIVE_LIMITS: Readonly<ConfigurationArchiveLimits> = {
  maxArchiveBytes: 5 * GIB,
  maxExpandedBytes: 250 * MIB,
  maxEntries: 50_000,
}

const metadataFolders = new Set([
  'Catalogs',
  'Documents',
  'InformationRegisters',
  'AccumulationRegisters',
  'AccountingRegisters',
  'CalculationRegisters',
  'Reports',
  'DataProcessors',
  'Enums',
  'Constants',
  'BusinessProcesses',
])

function archiveError(error: unknown): ConfigurationImportError {
  if (error instanceof ConfigurationImportError) return error
  return new ConfigurationImportError('invalid-archive', 'Unable to read ZIP archive', {
    cause: error,
  })
}

function decodeEntryPath(entry: Entry): string {
  return getFileNameLowLevel(
    entry.generalPurposeBitFlag,
    entry.fileNameRaw,
    entry.extraFields,
    true,
  )
}

function validateEntryPath(path: string): string {
  if (path.includes('\0') || /^[a-zA-Z]:/.test(path) || /^[\\/]/.test(path)) {
    throw new ConfigurationImportError('unsafe-path', `Unsafe archive path: ${path}`)
  }
  const segments = path.split(/[\\/]/)
  if (segments.includes('..')) {
    throw new ConfigurationImportError('unsafe-path', `Unsafe archive path: ${path}`)
  }
  return segments.join('/')
}

function candidateRoot(path: string): string | null {
  const segments = path.split('/')
  if (segments.length === 1 && segments[0] === 'Configuration.xml') return ''
  if (segments.length === 2 && segments[1] === 'Configuration.xml' && segments[0]) {
    return `${segments[0]}/`
  }
  return null
}

function isPotentialMetadataPath(path: string): boolean {
  const segments = path.split('/')
  const relative = segments.length > 1 && segments[1] === 'Configuration.xml'
    ? segments.slice(1)
    : segments.length > 2
      ? segments.slice(1)
      : segments
  if (relative.length === 1) return relative[0] === 'Configuration.xml'
  return relative.length === 2
    && metadataFolders.has(relative[0])
    && relative[1].toLowerCase().endsWith('.xml')
}

function isAcceptedMetadataPath(path: string): boolean {
  const segments = path.split('/')
  if (segments.length === 1) return segments[0] === 'Configuration.xml'
  return segments.length === 2
    && metadataFolders.has(segments[0])
    && segments[1].toLowerCase().endsWith('.xml')
}

type OpenArchive = (
  callback: (error: Error | null, zipFile?: ZipFile) => void,
) => void

function readZipFile(
  openArchive: OpenArchive,
  limits: ConfigurationArchiveLimits,
): Promise<Map<string, Buffer>> {
  return new Promise((resolve, reject) => {
    let zipFile: ZipFile | null = null
    let settled = false
    let entryCount = 0
    let declaredBytes = 0
    let streamedBytes = 0
    const roots = new Set<string>()
    const retained = new Map<string, Buffer>()

    const fail = (error: unknown): void => {
      if (settled) return
      settled = true
      zipFile?.close()
      reject(archiveError(error))
    }

    openArchive((openError, openedZipFile) => {
      if (openError || !openedZipFile) {
        fail(openError ?? new Error('ZIP archive could not be opened'))
        return
      }
      zipFile = openedZipFile

      zipFile.on('error', fail)
      zipFile.on('entry', (entry: Entry) => {
        if (settled) return
        entryCount += 1
        if (entryCount > limits.maxEntries) {
          fail(new ConfigurationImportError('too-many-files', 'Archive contains too many entries'))
          return
        }

        let path: string
        try {
          path = validateEntryPath(decodeEntryPath(entry))
        } catch (error) {
          fail(error)
          return
        }

        if ((entry.generalPurposeBitFlag & 0x1) !== 0) {
          fail(new ConfigurationImportError('invalid-archive', `Encrypted ZIP entry is not supported: ${path}`))
          return
        }

        const root = candidateRoot(path)
        if (root !== null) roots.add(root)

        if (path.endsWith('/')) {
          if (entry.compressedSize !== 0 || entry.uncompressedSize !== 0) {
            fail(new ConfigurationImportError('invalid-archive', `Directory entry contains data: ${path}`))
            return
          }
          zipFile?.readEntry()
          return
        }

        const retain = isPotentialMetadataPath(path)
        if (!retain) {
          zipFile?.readEntry()
          return
        }

        declaredBytes += entry.uncompressedSize
        if (!Number.isSafeInteger(declaredBytes) || declaredBytes > limits.maxExpandedBytes) {
          fail(new ConfigurationImportError('expanded-too-large', 'Expanded archive is too large'))
          return
        }

        zipFile?.openReadStream(entry, (streamError, stream) => {
          if (streamError) {
            fail(streamError)
            return
          }
          const chunks: Buffer[] = []
          stream.on('error', fail)
          stream.on('data', (chunk: Buffer) => {
            if (settled) return
            streamedBytes += chunk.length
            if (!Number.isSafeInteger(streamedBytes) || streamedBytes > limits.maxExpandedBytes) {
              stream.destroy()
              fail(new ConfigurationImportError('expanded-too-large', 'Expanded archive is too large'))
              return
            }
            if (retain) chunks.push(Buffer.from(chunk))
          })
          stream.on('end', () => {
            if (settled) return
            if (retain) retained.set(path, Buffer.concat(chunks))
            zipFile?.readEntry()
          })
        })
      })

      zipFile.on('end', () => {
        if (settled) return
        if (roots.size === 0) {
          fail(new ConfigurationImportError('configuration-not-found', 'Configuration.xml was not found'))
          return
        }
        if (roots.size > 1) {
          fail(new ConfigurationImportError('ambiguous-root', 'Archive contains multiple Configuration.xml roots'))
          return
        }

        const root = roots.values().next().value as string
        const files = new Map<string, Buffer>()
        for (const [path, contents] of retained) {
          if (!path.startsWith(root)) continue
          const relativePath = path.slice(root.length)
          if (isAcceptedMetadataPath(relativePath)) files.set(relativePath, contents)
        }
        settled = true
        zipFile?.close()
        resolve(files)
      })

      zipFile.readEntry()
    })
  })
}

export async function readConfigurationArchive(
  buffer: Buffer,
  sourceFileName: string,
  overrides: Partial<ConfigurationArchiveLimits> = {},
): Promise<ConfigurationCatalog> {
  const limits = { ...DEFAULT_CONFIGURATION_ARCHIVE_LIMITS, ...overrides }
  if (buffer.length > limits.maxArchiveBytes) {
    throw new ConfigurationImportError('archive-too-large', 'ZIP archive is too large')
  }
  const files = await readZipFile((callback) => fromBuffer(buffer, {
    lazyEntries: true,
    validateEntrySizes: true,
    decodeStrings: false,
    autoClose: false,
  }, callback), limits)
  return parseConfigurationXml(files, sourceFileName)
}

export async function readConfigurationArchiveFile(
  filePath: string,
  sourceFileName: string,
  overrides: Partial<ConfigurationArchiveLimits> = {},
): Promise<ConfigurationCatalog> {
  const limits = { ...DEFAULT_CONFIGURATION_ARCHIVE_LIMITS, ...overrides }
  const file = await stat(filePath)
  if (file.size > limits.maxArchiveBytes) {
    throw new ConfigurationImportError('archive-too-large', 'ZIP archive is too large')
  }
  const files = await readZipFile((callback) => open(filePath, {
    lazyEntries: true,
    validateEntrySizes: true,
    decodeStrings: false,
    autoClose: false,
  }, callback), limits)
  return parseConfigurationXml(files, sourceFileName)
}
