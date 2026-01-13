'use client'
import { getTranslation } from '@payloadcms/translations'
import { Button, SaveButton, useDocumentInfo, useField, useTranslation } from '@payloadcms/ui'
import React from 'react'

import type {
  PluginImportExportTranslationKeys,
  PluginImportExportTranslations,
} from '../../translations/index.js'

export const ImportSaveButton = () => {
  const { id } = useDocumentInfo()
  const { value: status } = useField({ path: 'status' })
  const { value: file } = useField({ path: 'file' })
  const { value: collection } = useField({ path: 'collection' })
  const { value: name } = useField({ path: 'name' })
  const { value: format } = useField({ path: 'format' })
  const { value: locale } = useField({ path: 'locale' })
  const { value: overwriteExisting } = useField({ path: 'overwriteExisting' })
  const { i18n, t } = useTranslation<
    PluginImportExportTranslations,
    PluginImportExportTranslationKeys
  >()

  const [isProcessing, setIsProcessing] = React.useState(false)

  const handleImport = React.useCallback(async () => {
    // Debug: log the form values
    const filePreview = typeof file === 'string' && file ? `${file.substring(0, 100)}...` : file
    // eslint-disable-next-line no-console
    console.log('Import form values:', {
      name,
      collection,
      file: filePreview,
      format,
      locale,
      overwriteExisting,
      status,
    })

    if (!file || !collection || status === 'processing') {
      // eslint-disable-next-line no-console
      console.log('Import validation failed:', {
        hasCollection: !!collection,
        hasFile: !!file,
        status,
      })
      return
    }

    setIsProcessing(true)

    try {
      // Then trigger the import process
      const response = await fetch('/api/imports/process', {
        body: JSON.stringify({
          id,
          name: name || `Import ${new Date().toISOString()}`,
          collectionSlug: collection, // collection field value becomes collectionSlug parameter
          file,
          format: format || 'csv',
          locale: locale || 'en',
          overwriteExisting: overwriteExisting || false,
        }),
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        method: 'POST',
      })

      if (!response.ok) {
        const errorData = await response.json()
        // eslint-disable-next-line no-console
        console.error('Import API error:', errorData)
        throw new Error(errorData.error || 'Import failed')
      }

      const result = await response.json()
      // eslint-disable-next-line no-console
      console.log('Import success:', result)

      // Refresh the page to show updated status
      window.location.reload()
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Import error:', error)
      // Handle error (could show toast notification)
      alert(`Import failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setIsProcessing(false)
    }
  }, [file, collection, name, format, locale, overwriteExisting, id, status])

  const canProcess = file && collection && status === 'pending' && !isProcessing
  const isCompleted =
    status && ['completed', 'completed_with_errors', 'failed'].includes(status as string)

  return (
    <div style={{ display: 'flex', gap: '1rem' }}>
      <SaveButton />
      {!isCompleted && (
        <Button buttonStyle="secondary" disabled={!canProcess} onClick={handleImport} size="medium">
          {isProcessing
            ? getTranslation(t('plugin-import-export:processing'), i18n)
            : getTranslation(t('plugin-import-export:startImport'), i18n)}
        </Button>
      )}
    </div>
  )
}
