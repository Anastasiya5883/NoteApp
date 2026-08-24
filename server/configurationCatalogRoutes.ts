import type { Express, NextFunction, Request, RequestHandler, Response } from 'express'
import multer from 'multer'
import { readConfigurationArchive } from './configurationArchive.js'
import { ConfigurationImportError, type ConfigurationCatalog } from './configurationCatalogTypes.js'
import {
  deleteConfigurationCatalog,
  findConfigurationCatalog,
  replaceConfigurationCatalog,
  type ConfigurationCatalogRecord,
} from './database.js'

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
}).single('file')

function acceptCatalogUpload(req: Request, res: Response, next: NextFunction): void {
  upload(req, res, (error: unknown) => {
    if (error instanceof multer.MulterError) {
      if (error.code === 'LIMIT_FILE_SIZE') {
        res.status(413).json({ error: 'Размер ZIP-архива не должен превышать 50 МБ' })
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
  app.get('/api/configuration-catalog', requireAuth, (req, res) => {
    const record = findConfigurationCatalog(req.authUser!.id)
    res.json(record ? catalogResponse(record) : { catalog: null, summary: null })
  })

  app.put(
    '/api/configuration-catalog',
    requireAuth,
    acceptCatalogUpload,
    async (req, res, next) => {
      const file = req.file
      if (!file || file.originalname.length > 255 || !/\.zip$/i.test(file.originalname)) {
        res.status(400).json({ error: 'Выберите ZIP-архив конфигурации с корректным именем' })
        return
      }

      try {
        const catalog = await readConfigurationArchive(file.buffer, file.originalname)
        const counts = countCatalog(catalog)
        const record = replaceConfigurationCatalog(
          req.authUser!.id,
          file.originalname,
          JSON.stringify(catalog),
          counts,
          catalog.uploadedAt,
        )
        res.json(catalogResponse(record))
      } catch (error) {
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
