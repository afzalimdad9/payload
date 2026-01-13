'use client'

import { getTranslation } from '@payloadcms/translations'
import { PopupList, useConfig, useDocumentDrawer, useTranslation } from '@payloadcms/ui'
import React from 'react'

import type {
  PluginImportExportTranslationKeys,
  PluginImportExportTranslations,
} from '../../translations/index.js'

import { useImportExport } from '../ImportExportProvider/index.js'

export const ImportListMenuItem = () => {
  const { collection } = useImportExport()
  const { config } = useConfig()
  const { i18n, t } = useTranslation<
    PluginImportExportTranslations,
    PluginImportExportTranslationKeys
  >()

  const collectionSlug = typeof collection === 'string' && collection
  const collectionConfig = config.collections.find(
    (collection) => collection.slug === collectionSlug,
  )

  const importCollectionSlug = 'imports'

  const [DocumentDrawer, DocumentDrawerToggler] = useDocumentDrawer({
    collectionSlug: importCollectionSlug,
  })

  if (!collectionConfig) {
    return null
  }

  return (
    <PopupList.Button>
      <DocumentDrawerToggler>
        {getTranslation(
          t('plugin-import-export:importCollection', {
            label: collectionConfig.labels?.plural || collectionSlug,
          }),
          i18n,
        )}
      </DocumentDrawerToggler>
      <DocumentDrawer
        initialData={{
          collection: collectionSlug,
        }}
      />
    </PopupList.Button>
  )
}
