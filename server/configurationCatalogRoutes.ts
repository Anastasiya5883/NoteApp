import { unlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Express, NextFunction, Request, RequestHandler, Response } from 'express'
import multer from 'multer'
import { readConfigurationArchiveFile } from './configurationArchive.js'
import { ConfigurationImportError, type ConfigurationCatalog } from './configurationCatalogTypes.js'
import {
  deleteConfigurationCatalog,
  findConfigurationCatalog,
  replaceConfigurationCatalog,
  type ConfigurationCatalogRecord,
} from './database.js'

const GIB = 1024 * 1024 * 1024
const MAX_ARCHIVE_BYTES = 5 * GIB

export function createCatalogUploadHandler(options: {
  maxArchiveBytes?: number
  uploadDirectory?: string
} = {}): RequestHandler {
  const upload = multer({
    dest: options.uploadDirectory ?? process.env.UPLOAD_TMP_DIR ?? join(tmpdir(), 'lovarus-config-uploads'),
    limits: { fileSize: options.maxArchiveBytes ?? MAX_ARCHIVE_BYTES },
  }).single('file')

  return (req: Request, res: Response, next: NextFunction): void => {
    upload(req, res, (error: unknown) => {
      if (error instanceof multer.MulterError) {
        if (error.code === 'LIMIT_FILE_SIZE') {
          res.status(413).json({ error: 'Размер ZIP-архива не должен превышать 5 ГиБ' })
          return
        }
        res.status(400).json({ error: 'Некорректный файл ZIP-архива конфигурации' })
        return
      }
      if (error) {
        next(error)
        return
      }
      next()
    })
  }
}

async function removeTemporaryUpload(filePath: string | undefined): Promise<void> {
  if (!filePath) return
  try {
    await unlink(filePath)
  } catch (error) {
    if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error
  }
}

function createActiveUploadGuard(): RequestHandler {
  let uploadActive = false
  return (_req, res, next) => {
    if (uploadActive) {
      res.status(429).json({ error: 'Загрузка ZIP-архива уже выполняется' })
      return
    }
    uploadActive = true
    const release = (): void => {
      uploadActive = false
    }
    res.once('finish', release)
    res.once('close', release)
    next()
  }
}

function countCatalog(catalog: ConfigurationCatalog) {
  let attributeCount = 0
  let tablePartCount = 0
  for (const object of catalog.objects) {
    attributeCount += object.attributes.length
    tablePartCount += object.tableParts.length
    for (const tablePart of object.tableParts) {
      attributeCount += tablePart.attributes.length
    }
  }
  return {
    objects: catalog.objects.length,
    attributes: attributeCount,
    tableParts: tablePartCount,
  }
}

function catalogResponse(record: ConfigurationCatalogRecord) {
  return {
    catalog: JSON.parse(record.catalog_json) as ConfigurationCatalog,
    summary: {
      sourceFileName: record.source_file_name,
      configurationName: record.configuration_name,
      configurationSynonym: record.configuration_synonym,
      configurationVersion: record.configuration_version,
      uploadedAt: record.uploaded_at,
      objectCount: record.object_count,
      attributeCount: record.attribute_count,
      tablePartCount: record.table_part_count,
    },
  }
}

export function registerConfigurationCatalogRoutes(
  app: Express,
  requireAuth: RequestHandler,
): void {
  const acceptCatalogUpload = createCatalogUploadHandler()
  const limitActiveUploads = createActiveUploadGuard()

  app.get('/api/configuration-catalog', requireAuth, (req, res) => {
    const record = findConfigurationCatalog(req.authUser!.id)
    res.json(record ? catalogResponse(record) : { catalog: null, summary: null })
  })

  app.put(
    '/api/configuration-catalog',
    requireAuth,
    limitActiveUploads,
    acceptCatalogUpload,
    async (req, res, next) => {
      const file = req.file
      if (!file || file.originalname.length > 255 || !/\.zip$/i.test(file.originalname)) {
        await removeTemporaryUpload(file?.path)
        res.status(400).json({ error: 'Выберите ZIP-архив конфигурации с корректным именем' })
        return
      }

      try {
        const catalog = await readConfigurationArchiveFile(file.path, file.originalname)
        const counts = countCatalog(catalog)
        const record = replaceConfigurationCatalog(
          req.authUser!.id,
          file.originalname,
          JSON.stringify(catalog),
          counts,
          catalog.uploadedAt,
        )
        await removeTemporaryUpload(file.path)
        res.json(catalogResponse(record))
      } catch (error) {
        await removeTemporaryUpload(file.path)
        if (error instanceof ConfigurationImportError) {
          res.status(400).json({ error: 'Не удалось прочитать ZIP-архив конфигурации' })
          return
        }
        next(error)
      }
    },
  )

  app.delete('/api/configuration-catalog', requireAuth, (req, res) => {
    deleteConfigurationCatalog(req.authUser!.id)
    res.status(204).end()
  })
}
