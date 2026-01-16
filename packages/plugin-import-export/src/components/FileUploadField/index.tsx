'use client'

import { getTranslation } from '@payloadcms/translations'
import { FieldDescription, FieldLabel, useField, useTranslation } from '@payloadcms/ui'
import React from 'react'

import type {
  PluginImportExportTranslationKeys,
  PluginImportExportTranslations,
} from '../../translations/index.js'

const baseClass = 'import-file-upload-field'

export const FileUploadField: React.FC = () => {
  const { value: format } = useField<string>({ path: 'format' })
  const { setValue: setFileContent, value: fileContent } = useField<string>({ path: 'file' })

  const { i18n, t } = useTranslation<
    PluginImportExportTranslations,
    PluginImportExportTranslationKeys
  >()

  const [fileName, setFileName] = React.useState<null | string>(null)

  const handleChange: React.ChangeEventHandler<HTMLInputElement> = (event) => {
    const file = event.target.files?.[0]

    if (!file) {
      setFileName(null)
      setFileContent('')
      return
    }

    setFileName(file.name)

    file
      .text()
      .then(setFileContent)
      .catch(() => setFileContent(''))
  }

  const accept =
    format === 'json'
      ? '.json,application/json'
      : '.csv,text/csv,application/vnd.ms-excel,text/plain'

  const label = getTranslation(t('plugin-import-export:field-file-label'), i18n)

  return (
    <div className={baseClass}>
      <FieldLabel label={label} path="file" />
      <input
        accept={accept}
        id="import-file-input"
        name="import-file"
        onChange={handleChange}
        type="file"
      />
      <FieldDescription
        description={`${
          fileName
            ? `${getTranslation(t('plugin-import-export:selectedFile'), i18n)}: ${fileName}`
            : getTranslation(t('plugin-import-export:field-file-description'), i18n)
        }
          ${
            typeof fileContent === 'string' && fileContent?.length
              ? ` (${fileContent.length.toLocaleString()} characters)`
              : null
          }`}
        path="file"
      ></FieldDescription>
    </div>
  )
}
