import type { PayloadRequest, TypedUser } from 'payload'

import { parse } from 'csv-parse/sync'
import { APIError } from 'payload'

import type { ImportExportPluginConfig } from '../types.js'

import { removeNestedIds } from './removeNestedIds.js'
import { transformImportData } from './transformImportData.js'
import { unflattenObject } from './unflattenObject.js'
import { validateImportData } from './validateImportData.js'

type ImportError = {
  field?: string
  message: string
  path?: string
  row: number
  value?: unknown
}

type ImportResults = {
  created: number
  errors: ImportError[]
  updated: number
}

export type Import = {
  collectionSlug: string
  /**
   * If true, enables debug logging
   */
  debug?: boolean
  file: File | string
  format: 'csv' | 'json'
  locale?: string
  overwriteExisting?: boolean
}

export type CreateImportArgs = {
  input: Import
  pluginConfig: ImportExportPluginConfig
  req: PayloadRequest
  user?: null | TypedUser
}

const formatPayloadError = (error: unknown, rowIndex: number): ImportError => {
  const baseError: ImportError = {
    message: 'Unknown error occurred',
    row: rowIndex + 1,
  }

  try {
    if (error && typeof error === 'object') {
      // Handle ValidationError with data.errors structure
      if ('data' in error && error.data && typeof error.data === 'object') {
        const errorData = error.data as Record<string, unknown>
        if (errorData.errors && Array.isArray(errorData.errors) && errorData.errors.length > 0) {
          const firstError = errorData.errors[0]
          return {
            field: firstError.path || firstError.field || 'unknown',
            message: firstError.message || firstError.label || 'validation error',
            path: firstError.path,
            row: rowIndex + 1,
            value: firstError.value,
          }
        } else if (errorData.message && typeof errorData.message === 'string') {
          baseError.message = errorData.message
        }
      }
      // Check for direct message property
      else if ('message' in error && typeof error.message === 'string') {
        baseError.message = error.message
      }
    } else if (typeof error === 'string') {
      baseError.message = error
    }
  } catch (_ignoreError) {
    // If error formatting fails, use a safe fallback
    baseError.message = 'Error occurred during import'
  }

  return baseError
}

export const createImport = async (args: CreateImportArgs): Promise<ImportResults> => {
  const {
    input: {
      collectionSlug,
      debug = false,
      file,
      format,
      locale: localeInput,
      overwriteExisting = false,
    },
    pluginConfig,
    req: { locale: localeArg, payload },
    req,
    user,
  } = args

  if (!user) {
    throw new APIError('User authentication is required to create imports')
  }

  if (debug) {
    req.payload.logger.debug({
      collectionSlug,
      format,
      msg: 'Starting import process with args',
      overwriteExisting,
    })
  }

  const locale =
    localeInput ||
    localeArg ||
    (payload.config.localization && payload.config.localization.defaultLocale) ||
    'en'

  const collectionConfig = payload.collections[collectionSlug]?.config

  if (!collectionConfig) {
    throw new APIError(`Collection with slug "${collectionSlug}" not found`)
  }

  let data: Record<string, unknown>[]

  if (format === 'csv') {
    const csvContent = typeof file === 'string' ? file : await file.text()
    const records = parse(csvContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    }) as Record<string, unknown>[]

    // Unflatten CSV data back to nested objects
    data = records.map((record: Record<string, unknown>) => unflattenObject(record))
  } else {
    const jsonContent = typeof file === 'string' ? file : await file.text()
    data = JSON.parse(jsonContent)

    if (!Array.isArray(data)) {
      throw new APIError('JSON import data must be an array')
    }
  }

  if (debug) {
    req.payload.logger.debug({
      msg: `Parsed ${data.length} records for import`,
    })
  }

  // Validate import data
  const validationResult = validateImportData({
    collectionConfig,
    data,
    req,
  })

  if (!validationResult.isValid) {
    throw new APIError(`Import validation failed: ${validationResult.errors.join(', ')}`)
  }

  // Transform import data (HTML to Lexical, URLs to media relationships)
  const transformedData = await transformImportData({
    collectionConfig,
    data,
    pluginConfig,
    req,
  })

  // Process imports
  const results: ImportResults = {
    created: 0,
    errors: [],
    updated: 0,
  }

  for (const [index, record] of transformedData.entries()) {
    try {
      // Clean the record by removing nested id fields
      const cleanedRecord = removeNestedIds(record)

      // Check if document exists (for updates)
      let existingDoc = null
      if (
        overwriteExisting &&
        cleanedRecord.id &&
        (typeof cleanedRecord.id === 'string' || typeof cleanedRecord.id === 'number')
      ) {
        try {
          existingDoc = await payload.findByID({
            id: cleanedRecord.id,
            collection: collectionSlug,
            locale,
            req,
          })
        } catch {
          // Document doesn't exist, will create new one
        }
      }

      if (
        existingDoc &&
        overwriteExisting &&
        (typeof cleanedRecord.id === 'string' || typeof cleanedRecord.id === 'number')
      ) {
        // Update existing document
        await payload.update({
          id: cleanedRecord.id,
          collection: collectionSlug,
          data: cleanedRecord,
          locale,
          req,
        })
        results.updated++
      } else {
        // Create new document (remove id field for creation)
        const { id: _recordId, ...dataWithoutId } = cleanedRecord
        await payload.create({
          collection: collectionSlug,
          data: dataWithoutId,
          locale,
          req,
        })
        results.created++
      }

      if (debug && (index + 1) % 100 === 0) {
        req.payload.logger.debug({
          msg: `Processed ${index + 1} of ${transformedData.length} records`,
        })
      }
    } catch (error) {
      const structuredError = formatPayloadError(error, index)
      results.errors.push(structuredError)

      if (debug) {
        req.payload.logger.error({
          err: error,
          msg: `Row ${structuredError.row}: ${structuredError.field ? `${structuredError.field}: ` : ''}${structuredError.message}`,
          record,
          rowIndex: index + 1,
          structuredError,
        })
      }
    }
  }

  if (debug) {
    req.payload.logger.debug({
      msg: 'Import completed',
      results,
    })
  }

  return results
}
