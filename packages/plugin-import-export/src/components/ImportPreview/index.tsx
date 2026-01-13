'use client'
import type { Column } from '@payloadcms/ui'

import { getTranslation } from '@payloadcms/translations'
import { CodeEditorLazy, Table, useConfig, useField, useTranslation } from '@payloadcms/ui'
import React from 'react'

import type {
  PluginImportExportTranslationKeys,
  PluginImportExportTranslations,
} from '../../translations/index.js'

import './index.scss'

const baseClass = 'import-preview'

export const ImportPreview = () => {
  const { config } = useConfig()
  const { value: file } = useField({ path: 'file' })
  const { value: format } = useField({ path: 'format' })
  const { value: collection } = useField({ path: 'collection' })
  const [previewData, setPreviewData] = React.useState<any[]>([])
  const [columns, setColumns] = React.useState<Column[]>([])
  const [isLoading, setIsLoading] = React.useState(false)
  const [error, setError] = React.useState<null | string>(null)
  const { i18n, t } = useTranslation<
    PluginImportExportTranslations,
    PluginImportExportTranslationKeys
  >()

  const collectionConfig = config.collections.find((coll) => coll.slug === collection)

  const isCSV = format === 'csv'

  React.useEffect(() => {
    const fetchPreview = async () => {
      if (!file || !format) {
        setPreviewData([])
        setColumns([])
        return
      }

      setIsLoading(true)
      setError(null)

      try {
        // Get file content from textarea
        const fileContent = typeof file === 'string' ? file : ''

        if (!fileContent.trim()) {
          setPreviewData([])
          setColumns([])
          return
        }

        const response = await fetch('/api/imports/preview', {
          body: JSON.stringify({
            file: fileContent,
            format,
          }),
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
          method: 'POST',
        })

        if (!response.ok) {
          throw new Error('Preview failed')
        }

        const result = await response.json()

        if (result.success) {
          setPreviewData(result.preview || [])

          // Generate columns for CSV table view
          if (isCSV && result.preview && result.preview.length > 0) {
            const firstRow = result.preview[0]
            const cols: Column[] = Object.keys(firstRow).map((key) => ({
              accessor: key,
              active: true,
              field: { name: key } as any,
              Heading: key,
              renderedCells: result.preview.map((row: any) => {
                const val = row[key]
                return val === undefined || val === null ? null : String(val)
              }),
            }))
            setColumns(cols)
          }
        } else {
          setError(result.error || 'Preview failed')
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Preview failed')
      } finally {
        setIsLoading(false)
      }
    }

    void fetchPreview()
  }, [file, format, isCSV])

  if (isLoading) {
    return (
      <div className={baseClass}>
        <p>{getTranslation(t('plugin-import-export:loadingPreview'), i18n)}</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className={baseClass}>
        <p style={{ color: 'red' }}>
          {getTranslation(t('plugin-import-export:previewError'), i18n)}: {error}
        </p>
      </div>
    )
  }

  if (!previewData || previewData.length === 0) {
    return (
      <div className={baseClass}>
        <p>{getTranslation(t('plugin-import-export:noPreviewData'), i18n)}</p>
      </div>
    )
  }

  return (
    <div className={baseClass}>
      <h4>
        {getTranslation(t('plugin-import-export:previewTitle'), i18n)} ({previewData.length}{' '}
        {getTranslation(t('plugin-import-export:rows'), i18n)})
      </h4>

      {isCSV ? (
        <Table columns={columns} data={previewData} />
      ) : (
        <CodeEditorLazy
          defaultLanguage="json"
          options={{
            minimap: { enabled: false },
            readOnly: true,
            wordWrap: 'on',
          }}
          value={JSON.stringify(previewData, null, 2)}
        />
      )}
    </div>
  )
}
