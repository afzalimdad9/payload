import type { Config, Field, SelectField } from 'payload'

import type { ImportExportPluginConfig } from '../types.js'

export const getImportFields = (
  config: Config,
  pluginConfig?: ImportExportPluginConfig,
): Field[] => {
  let localeField: SelectField | undefined
  if (config.localization) {
    localeField = {
      name: 'locale',
      type: 'select',
      admin: {
        width: '50%',
      },
      defaultValue: 'all',
      // @ts-expect-error - this is not correctly typed in plugins right now
      label: ({ t }) => t('plugin-import-export:field-locale-label'),
      options: [
        {
          label: ({ t }) => t('general:allLocales'),
          value: 'all',
        },
        ...config.localization.locales.map((locale) => ({
          label: typeof locale === 'string' ? locale : locale.label,
          value: typeof locale === 'string' ? locale : locale.code,
        })),
      ],
    }
  }

  return [
    {
      type: 'collapsible',
      fields: [
        {
          name: 'name',
          type: 'text',
          // @ts-expect-error - this is not correctly typed in plugins right now
          label: ({ t }) => t('plugin-import-export:field-name-label'),
          required: true,
        },
        {
          type: 'row',
          fields: [
            {
              name: 'format',
              type: 'select',
              admin: {
                condition: () => !pluginConfig?.format,
                width: '50%',
              },
              defaultValue: pluginConfig?.format ?? 'csv',
              // @ts-expect-error - this is not correctly typed in plugins right now
              label: ({ t }) => t('plugin-import-export:field-format-label'),
              options: [
                {
                  label: 'CSV',
                  value: 'csv',
                },
                {
                  label: 'JSON',
                  value: 'json',
                },
              ],
              required: true,
            },
            ...(localeField ? [localeField] : []),
          ],
        },
        {
          name: 'collection',
          type: 'select',
          admin: {
            components: {
              Field: '@afzalimdad9/payload-import-export/rsc#CollectionField',
            },
          },
          // @ts-expect-error - this is not correctly typed in plugins right now
          label: ({ t }) => t('plugin-import-export:field-collection-label'),
          options:
            config.collections
              ?.filter((collection) => {
                if (pluginConfig?.collections && pluginConfig.collections.length > 0) {
                  return pluginConfig.collections.includes(collection.slug)
                }
                return true
              })
              .map((collection) => ({
                label: collection.labels?.plural || collection.slug,
                value: collection.slug,
              })) || [],
          required: true,
          validate: (value: unknown) => {
            if (!value) {
              return 'Collection is required'
            }
            return true
          },
        },
        {
          name: 'overwriteExisting',
          type: 'checkbox',
          defaultValue: false,
          // @ts-expect-error - this is not correctly typed in plugins right now
          label: ({ t }) => t('plugin-import-export:field-overwrite-existing-label'),
        },
      ],
      // @ts-expect-error - this is not correctly typed in plugins right now
      label: ({ t }) => t('plugin-import-export:import-settings'),
    },
    {
      type: 'collapsible',
      fields: [
        {
          name: 'file',
          type: 'textarea',
          admin: {
            rows: 10,
          },
          // @ts-expect-error - this is not correctly typed in plugins right now
          label: ({ t }) => t('plugin-import-export:field-file-label'),
          required: true,
          validate: (value: unknown) => {
            if (!value) {
              return 'Import file content is required'
            }
            if (typeof value === 'string' && value.length > 2000000) {
              return 'File content is too large. Please use a smaller file or split your data.'
            }
            return true
          },
        },
        {
          name: 'preview',
          type: 'ui',
          admin: {
            components: {
              Field: '@afzalimdad9/payload-import-export/rsc#ImportPreview',
            },
          },
        },
      ],
      // @ts-expect-error - this is not correctly typed in plugins right now
      label: ({ t }) => t('plugin-import-export:import-data'),
    },
    {
      type: 'collapsible',
      fields: [
        {
          name: 'status',
          type: 'select',
          admin: {
            readOnly: true,
          },
          defaultValue: 'pending',
          // @ts-expect-error - this is not correctly typed in plugins right now
          label: ({ t }) => t('plugin-import-export:field-status-label'),
          options: [
            {
              // @ts-expect-error - this is not correctly typed in plugins right now
              label: ({ t }) => t('plugin-import-export:status-pending'),
              value: 'pending',
            },
            {
              // @ts-expect-error - this is not correctly typed in plugins right now
              label: ({ t }) => t('plugin-import-export:status-processing'),
              value: 'processing',
            },
            {
              // @ts-expect-error - this is not correctly typed in plugins right now
              label: ({ t }) => t('plugin-import-export:status-completed'),
              value: 'completed',
            },
            {
              // @ts-expect-error - this is not correctly typed in plugins right now
              label: ({ t }) => t('plugin-import-export:status-completed-with-errors'),
              value: 'completed_with_errors',
            },
            {
              // @ts-expect-error - this is not correctly typed in plugins right now
              label: ({ t }) => t('plugin-import-export:status-failed'),
              value: 'failed',
            },
          ],
        },
        {
          name: 'results',
          type: 'group',
          admin: {
            condition: ({ status }) => ['completed', 'completed_with_errors'].includes(status),
            readOnly: true,
          },
          fields: [
            {
              name: 'total',
              type: 'number',
              // @ts-expect-error - this is not correctly typed in plugins right now
              label: ({ t }) => t('plugin-import-export:results-total'),
            },
            {
              name: 'created',
              type: 'number',
              // @ts-expect-error - this is not correctly typed in plugins right now
              label: ({ t }) => t('plugin-import-export:results-created'),
            },
            {
              name: 'updated',
              type: 'number',
              // @ts-expect-error - this is not correctly typed in plugins right now
              label: ({ t }) => t('plugin-import-export:results-updated'),
            },
            {
              name: 'errors',
              type: 'array',
              fields: [
                {
                  name: 'row',
                  type: 'number',
                },
                {
                  name: 'field',
                  type: 'text',
                },
                {
                  name: 'message',
                  type: 'text',
                },
                {
                  name: 'path',
                  type: 'text',
                },
                {
                  name: 'value',
                  type: 'text',
                },
              ],
              // @ts-expect-error - this is not correctly typed in plugins right now
              label: ({ t }) => t('plugin-import-export:results-errors'),
            },
          ],
          // @ts-expect-error - this is not correctly typed in plugins right now
          label: ({ t }) => t('plugin-import-export:import-results'),
        },
        {
          name: 'error',
          type: 'textarea',
          admin: {
            condition: ({ status }) => status === 'failed',
            readOnly: true,
          },
          // @ts-expect-error - this is not correctly typed in plugins right now
          label: ({ t }) => t('plugin-import-export:field-error-label'),
        },
      ],
      // @ts-expect-error - this is not correctly typed in plugins right now
      label: ({ t }) => t('plugin-import-export:import-status'),
    },
  ]
}
