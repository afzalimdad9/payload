import type { CollectionConfig, Field, PayloadRequest } from 'payload'

import {
  convertHTMLToLexical,
  defaultEditorConfig,
  sanitizeServerEditorConfig,
} from '@payloadcms/richtext-lexical'

import type { ImportExportPluginConfig } from '../types.js'

type TransformContext = {
  collectionConfig: CollectionConfig
  pluginConfig: ImportExportPluginConfig
  req: PayloadRequest
}

/**
 * Transforms import data by converting HTML to Lexical and URLs to media relationships
 */
export const transformImportData = async ({
  collectionConfig,
  data,
  pluginConfig,
  req,
}: {
  collectionConfig: CollectionConfig
  data: Record<string, unknown>[]
  pluginConfig: ImportExportPluginConfig
  req: PayloadRequest
}): Promise<Record<string, unknown>[]> => {
  const transformedData = []

  for (const record of data) {
    const transformedRecord = await transformRecord({
      context: { collectionConfig, pluginConfig, req },
      fields: collectionConfig.fields,
      record,
    })
    transformedData.push(transformedRecord)
  }

  return transformedData
}

/**
 * Recursively transforms a record based on field definitions
 */
const transformRecord = async ({
  context,
  fields,
  record,
}: {
  context: TransformContext
  fields: Field[]
  record: Record<string, unknown>
}): Promise<Record<string, unknown>> => {
  const transformedRecord = { ...record }

  for (const field of fields) {
    // Handle fields with names (most field types)
    if ('name' in field && field.name && transformedRecord[field.name] !== undefined) {
      transformedRecord[field.name] = await transformFieldValue({
        context,
        field,
        value: transformedRecord[field.name],
      })
    }
    // Handle tabs field type - process nested fields within tabs
    else if (field.type === 'tabs' && 'tabs' in field && field.tabs) {
      for (const tab of field.tabs) {
        if ('fields' in tab && tab.fields) {
          // Process fields within this tab
          const tabTransformed = await transformRecord({
            context,
            fields: tab.fields,
            record: transformedRecord,
          })
          // Merge the transformed fields back into the main record
          Object.assign(transformedRecord, tabTransformed)
        }
      }
    }
    // Handle collapsible field type - process nested fields within collapsible
    else if (field.type === 'collapsible' && 'fields' in field && field.fields) {
      // Process fields within the collapsible
      const collapsibleTransformed = await transformRecord({
        context,
        fields: field.fields,
        record: transformedRecord,
      })
      // Merge the transformed fields back into the main record
      Object.assign(transformedRecord, collapsibleTransformed)
    }
    // Handle row field type - process nested fields within row columns
    else if (field.type === 'row' && 'fields' in field && field.fields) {
      // Process fields within the row
      const rowTransformed = await transformRecord({
        context,
        fields: field.fields,
        record: transformedRecord,
      })
      // Merge the transformed fields back into the main record
      Object.assign(transformedRecord, rowTransformed)
    }
  }

  return transformedRecord
}

/**
 * Transforms a field value based on its type
 */
const transformFieldValue = async ({
  context,
  field,
  value,
}: {
  context: TransformContext
  field: Field
  value: unknown
}): Promise<unknown> => {
  if (value === null || value === undefined) {
    return value
  }

  switch (field.type) {
    case 'array': {
      if (Array.isArray(value) && field.fields) {
        const transformedArray = []
        for (const item of value) {
          if (typeof item === 'object' && item !== null) {
            const transformedItem = await transformRecord({
              context,
              fields: field.fields,
              record: item as Record<string, unknown>,
            })
            transformedArray.push(transformedItem)
          } else {
            transformedArray.push(item)
          }
        }
        return transformedArray
      }
      return value
    }

    case 'blocks': {
      if (Array.isArray(value) && field.blocks) {
        const transformedBlocks = []
        for (const block of value) {
          if (typeof block === 'object' && block !== null && 'blockType' in block) {
            const blockConfig = field.blocks.find((b) => b.slug === block.blockType)
            if (blockConfig) {
              const transformedBlock = await transformRecord({
                context,
                fields: blockConfig.fields,
                record: block as Record<string, unknown>,
              })
              transformedBlocks.push(transformedBlock)
            } else {
              transformedBlocks.push(block)
            }
          } else {
            transformedBlocks.push(block)
          }
        }
        return transformedBlocks
      }
      return value
    }

    case 'collapsible': {
      // Handle collapsible field type - this shouldn't typically have a value since collapsible are layout fields
      // But if there's nested data, we should process it
      if (typeof value === 'object' && value !== null && 'fields' in field && field.fields) {
        return await transformRecord({
          context,
          fields: field.fields,
          record: value as Record<string, unknown>,
        })
      }
      return value
    }

    case 'group': {
      if (typeof value === 'object' && value !== null && field.fields) {
        return await transformRecord({
          context,
          fields: field.fields,
          record: value as Record<string, unknown>,
        })
      }
      return value
    }

    case 'relationship': {
      // Handle relationship fields that might contain media URLs
      if (
        typeof value === 'string' &&
        (value.startsWith('http') || value.startsWith('/')) &&
        field.relationTo
      ) {
        // Check if the relationship is to a media collection
        const relationTo = Array.isArray(field.relationTo) ? field.relationTo : [field.relationTo]
        const mediaCollections = relationTo.filter((slug) => {
          const collection = context.req.payload.collections[slug]?.config
          return collection?.upload !== undefined
        })

        if (mediaCollections.length > 0) {
          return await convertUrlToMediaRelationship({
            context,
            targetCollection: mediaCollections[0],
            url: value,
          })
        }
      }
      return value
    }

    case 'richText': {
      // Check if value is HTML string that needs conversion
      if (typeof value === 'string' && value.includes('<')) {
        try {
          const lexicalResult = await convertHtmlToLexical(value, context.req)
          return lexicalResult
        } catch (error) {
          context.req.payload.logger.warn({
            err: error,
            msg: `Failed to convert HTML to Lexical for field: ${field.name || 'unknown'}`,
          })
          return value // Return original value if conversion fails
        }
      }
      return value
    }

    case 'row': {
      // Handle row field type - this shouldn't typically have a value since rows are layout fields
      // But if there's nested data, we should process it
      if (typeof value === 'object' && value !== null && 'fields' in field && field.fields) {
        return await transformRecord({
          context,
          fields: field.fields,
          record: value as Record<string, unknown>,
        })
      }
      return value
    }

    case 'tabs': {
      // Handle tabs field type - this shouldn't typically have a value since tabs are layout fields
      // But if there's nested data, we should process it
      if (typeof value === 'object' && value !== null && 'tabs' in field && field.tabs) {
        const transformedValue = { ...value } as Record<string, unknown>
        for (const tab of field.tabs) {
          if ('fields' in tab && tab.fields) {
            const tabTransformed = await transformRecord({
              context,
              fields: tab.fields,
              record: transformedValue,
            })
            Object.assign(transformedValue, tabTransformed)
          }
        }
        return transformedValue
      }
      return value
    }

    case 'upload': {
      // Convert URL string to media relationship
      if (typeof value === 'string' && (value.startsWith('http') || value.startsWith('/'))) {
        return await convertUrlToMediaRelationship({ context, url: value })
      }
      return value
    }

    default:
      return value
  }
}

/**
 * Converts HTML string to Lexical editor state using Payload's built-in converter
 */
const convertHtmlToLexical = async (html: string, req: PayloadRequest): Promise<object> => {
  try {
    // Create a sanitized editor config using Payload's default config
    const editorConfig = await sanitizeServerEditorConfig(
      defaultEditorConfig,
      req.payload.config,
      false, // parentIsLocalized
    )

    // Use JSDOM for HTML parsing
    const { JSDOM } = await import('jsdom')

    // Use Payload's built-in HTML to Lexical converter
    const lexicalState = convertHTMLToLexical({
      editorConfig,
      html,
      JSDOM,
    })

    return lexicalState
  } catch (error) {
    // Log the error for debugging
    req.payload.logger.warn({
      err: error,
      msg: `Failed to convert HTML to Lexical, falling back to basic structure: ${html.substring(0, 100)}...`,
    })

    // If conversion fails, return the original HTML wrapped in a paragraph
    return {
      root: {
        type: 'root',
        children: [
          {
            type: 'paragraph',
            children: [
              {
                type: 'text',
                detail: 0,
                format: 0,
                mode: 'normal',
                style: '',
                text: html.replace(/<[^>]*>/g, '').trim() || html,
                version: 1,
              },
            ],
            direction: 'ltr',
            format: '',
            indent: 0,
            version: 1,
          },
        ],
        direction: 'ltr',
        format: '',
        indent: 0,
        version: 1,
      },
    }
  }
}

/**
 * Converts a URL to a media relationship by creating or finding the media record
 */
const convertUrlToMediaRelationship = async ({
  context,
  targetCollection,
  url,
}: {
  context: TransformContext
  targetCollection?: string
  url: string
}): Promise<null | string> => {
  try {
    const { pluginConfig, req } = context

    // Find a collection that supports uploads
    const uploadCollections = Object.values(req.payload.collections)
      .map((collection) => collection.config)
      .filter((config) => config.upload !== undefined)

    if (uploadCollections.length === 0) {
      return null
    }

    // Use the plugin config media collection, target collection, or the first upload collection
    const collectionSlug =
      pluginConfig.media?.collection || targetCollection || uploadCollections[0]?.slug

    if (!collectionSlug) {
      return null
    }

    // Check MIME type if allowed types are configured
    const mimeType = getMimeTypeFromUrl(url)
    if (
      pluginConfig.media?.allowedMimeTypes &&
      pluginConfig.media.allowedMimeTypes.length > 0 &&
      !pluginConfig.media.allowedMimeTypes.includes(mimeType)
    ) {
      // MIME type not allowed, return null
      context.req.payload.logger.warn({
        msg: `MIME type ${mimeType} not allowed for URL: ${url}`,
      })
      return null
    }

    // Check if media already exists with this URL
    const existingMedia = await req.payload.find({
      collection: collectionSlug,
      limit: 1,
      req,
      where: {
        or: [{ url: { equals: url } }, { filename: { equals: extractFilenameFromUrl(url) } }],
      },
    })

    if (existingMedia.docs.length > 0 && existingMedia.docs[0]?.id) {
      return String(existingMedia.docs[0].id)
    }

    // Try to create new media record from URL
    const filename = extractFilenameFromUrl(url)

    // For now, we'll create a placeholder media record
    // In a real implementation, you might want to download the file
    const mediaRecord = await req.payload.create({
      collection: collectionSlug,
      data: {
        filename,
        mimeType,
        url, // Store original URL for reference
        // You might want to add more fields based on your media collection schema
      },
      req,
    })

    return String(mediaRecord.id)
  } catch (_error) {
    // If media creation fails, return null
    context.req.payload.logger.warn({
      msg: `Failed to convert URL to media relationship: ${url}`,
    })
    return null
  }
}

/**
 * Extracts filename from URL
 */
const extractFilenameFromUrl = (url: string): string => {
  try {
    const urlObj = new URL(url)
    const pathname = urlObj.pathname
    const filename = pathname.split('/').pop() || 'unknown'
    return filename
  } catch {
    return 'unknown'
  }
}

/**
 * Gets MIME type from URL extension
 */
const getMimeTypeFromUrl = (url: string): string => {
  const filename = extractFilenameFromUrl(url)
  const extension = filename.split('.').pop()?.toLowerCase()

  const mimeTypes: Record<string, string> = {
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    gif: 'image/gif',
    jpeg: 'image/jpeg',
    jpg: 'image/jpeg',
    mp3: 'audio/mpeg',
    mp4: 'video/mp4',
    pdf: 'application/pdf',
    png: 'image/png',
    svg: 'image/svg+xml',
    webp: 'image/webp',
  }

  return mimeTypes[extension || ''] || 'application/octet-stream'
}
