import type {
  CollectionAfterChangeHook,
  CollectionBeforeOperationHook,
  CollectionConfig,
  Config,
} from 'payload'

import type { CollectionOverride, ImportExportPluginConfig } from './types.js'

import { createImport } from './import/createImport.js'
import { getImportFields } from './import/getImportFields.js'

export const getImportCollection = ({
  config,
  pluginConfig,
}: {
  config: Config
  pluginConfig: ImportExportPluginConfig
}): CollectionConfig => {
  const { overrideImportCollection } = pluginConfig

  const beforeOperation: CollectionBeforeOperationHook[] = []
  const afterChange: CollectionAfterChangeHook[] = []

  let collection: CollectionConfig = {
    slug: 'imports',
    access: {
      update: () => false,
    },
    admin: {
      components: {
        edit: {
          SaveButton: '@afzalimdad9/payload-import-export/rsc#ImportSaveButton',
        },
      },
      custom: {
        disableImport: pluginConfig.disableImport ?? false,
      },
      group: false,
      useAsTitle: 'name',
    },
    disableDuplicate: true,
    endpoints: [
      {
        handler: async (req) => {
          const body = req.json ? await req.json() : req.body
          const { name, collectionSlug, file, format, locale, overwriteExisting } = body || {}

          if (!file) {
            return Response.json({ error: 'No file provided' }, { status: 400 })
          }

          if (!collectionSlug) {
            return Response.json({ error: 'Collection slug is required' }, { status: 400 })
          }

          try {
            // First create the import record
            const importDoc = await req.payload.create({
              collection: 'imports',
              data: {
                name: name || `Import ${new Date().toISOString()}`,
                collection: collectionSlug,
                file: file.substring(0, 1000) + (file.length > 1000 ? '...' : ''), // Truncate file content for storage
                format: format || 'csv',
                locale: locale || 'en',
                overwriteExisting: overwriteExisting || false,
                status: 'processing',
              },
              req,
            })

            // Then process the import
            const result = await createImport({
              input: {
                collectionSlug,
                file,
                format: format || 'csv',
                locale: locale || 'en',
                overwriteExisting: overwriteExisting || false,
              },
              pluginConfig,
              req,
              user: req.user,
            })

            // Update the import record with results
            await req.payload.update({
              id: importDoc.id,
              collection: 'imports',
              data: {
                results: {
                  created: result.created,
                  errors: result.errors,
                  total: result.created + result.updated,
                  updated: result.updated,
                },
                status: result.errors.length > 0 ? 'completed_with_errors' : 'completed',
              },
              req,
            })

            return Response.json({ importId: importDoc.id, result, success: true })
          } catch (err) {
            req.payload.logger.error({
              err,
              msg: 'Import failed',
            })

            // Try to create a failed import record
            try {
              await req.payload.create({
                collection: 'imports',
                data: {
                  name: name || `Import ${new Date().toISOString()}`,
                  collection: collectionSlug,
                  error: err instanceof Error ? err.message : 'Import failed',
                  file: file.substring(0, 1000) + (file.length > 1000 ? '...' : ''),
                  format: format || 'csv',
                  locale: locale || 'en',
                  overwriteExisting: overwriteExisting || false,
                  status: 'failed',
                },
                req,
              })
            } catch (recordError) {
              // If we can't create the record, just log it
              req.payload.logger.error({
                err: recordError,
                msg: 'Failed to create import record',
              })
            }

            return Response.json(
              {
                error: err instanceof Error ? err.message : 'Import failed',
                success: false,
              },
              { status: 500 },
            )
          }
        },
        method: 'post',
        path: '/process',
      },
      {
        handler: async (req) => {
          const body = req.json ? await req.json() : req.body
          const { file, format } = body || {}

          try {
            if (!file) {
              return Response.json({ error: 'No file provided' }, { status: 400 })
            }

            let data: Record<string, unknown>[]

            if (format === 'csv') {
              const { parse } = await import('csv-parse/sync')
              const csvContent = typeof file === 'string' ? file : await file.text()
              const records = parse(csvContent, {
                columns: true,
                skip_empty_lines: true,
                trim: true,
              })
              data = records.slice(0, 10) // Preview first 10 rows
            } else {
              const jsonContent = typeof file === 'string' ? file : await file.text()
              const parsed = JSON.parse(jsonContent)
              data = Array.isArray(parsed) ? parsed.slice(0, 10) : [parsed]
            }

            return Response.json({
              preview: data,
              success: true,
              totalRows: data.length,
            })
          } catch (err) {
            return Response.json(
              {
                error: err instanceof Error ? err.message : 'Preview failed',
                success: false,
              },
              { status: 500 },
            )
          }
        },
        method: 'post',
        path: '/preview',
      },
    ],
    fields: getImportFields(config, pluginConfig),
    hooks: {
      afterChange,
      beforeOperation,
    },
  }

  if (overrideImportCollection) {
    collection = overrideImportCollection(collection as CollectionOverride)
  }

  return collection
}
