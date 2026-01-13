import type { Config, TaskConfig } from 'payload'

import type { ImportExportPluginConfig } from '../types.js'

import { createImport } from './createImport.js'

export const getCreateCollectionImportTask = (
  config: Config,
  pluginConfig: ImportExportPluginConfig,
): TaskConfig => ({
  slug: 'createCollectionImport',
  handler: async ({ input, req }) => {
    const result = await createImport({
      input: input as any,
      pluginConfig,
      req,
      user: req.user,
    })

    return {
      output: result,
    }
  },
  inputSchema: [
    {
      name: 'collectionSlug',
      type: 'text',
      required: true,
    },
    {
      name: 'file',
      type: 'text',
      required: true,
    },
    {
      name: 'format',
      type: 'select',
      options: [
        { label: 'CSV', value: 'csv' },
        { label: 'JSON', value: 'json' },
      ],
      required: true,
    },
    {
      name: 'locale',
      type: 'text',
    },
    {
      name: 'overwriteExisting',
      type: 'checkbox',
      defaultValue: false,
    },
    {
      name: 'importsCollection',
      type: 'text',
      defaultValue: 'imports',
    },
    {
      name: 'id',
      type: 'text',
      required: true,
    },
    {
      name: 'name',
      type: 'text',
      required: true,
    },
    {
      name: 'slug',
      type: 'text',
      required: true,
    },
    {
      name: 'debug',
      type: 'checkbox',
      defaultValue: pluginConfig.debug ?? false,
    },
  ],
  interfaceName: 'CreateCollectionImportTask',
  retries: 0,
})
