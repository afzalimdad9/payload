import type { CollectionConfig, PayloadRequest } from 'payload'

export type ValidationResult = {
  errors: string[]
  isValid: boolean
  warnings: string[]
}

export type ValidateImportDataArgs = {
  collectionConfig: CollectionConfig
  data: any[]
  req: PayloadRequest
}

export const validateImportData = ({
  collectionConfig,
  data,
  req: _req,
}: ValidateImportDataArgs): ValidationResult => {
  const errors: string[] = []
  const warnings: string[] = []

  if (!Array.isArray(data) || data.length === 0) {
    errors.push('Import data must be a non-empty array')
    return { errors, isValid: false, warnings }
  }

  // Get field names from collection config
  const getFieldNames = (fields: any[], prefix = ''): string[] => {
    const names: string[] = []

    for (const field of fields) {
      if ('name' in field && field.name) {
        const fieldName = prefix ? `${prefix}.${field.name}` : field.name
        names.push(fieldName)

        // Handle nested fields
        if (field.type === 'group' && field.fields) {
          names.push(...getFieldNames(field.fields, fieldName))
        } else if (field.type === 'array' && field.fields) {
          names.push(...getFieldNames(field.fields, fieldName))
        } else if (field.type === 'blocks' && field.blocks) {
          for (const block of field.blocks) {
            if (block.fields) {
              names.push(...getFieldNames(block.fields, `${fieldName}.${block.slug}`))
            }
          }
        }
      } else if (field.type === 'tabs' && field.tabs) {
        for (const tab of field.tabs) {
          if (tab.fields) {
            names.push(...getFieldNames(tab.fields, prefix))
          }
        }
      } else if (field.type === 'collapsible' && field.fields) {
        names.push(...getFieldNames(field.fields, prefix))
      }
    }

    return names
  }

  const validFieldNames = getFieldNames(collectionConfig.fields)
  const requiredFields = collectionConfig.fields
    .filter((field: any) => field.required && field.name)
    .map((field: any) => field.name)

  // Validate each record
  for (const [index, record] of data.entries()) {
    if (!record || typeof record !== 'object') {
      errors.push(`Row ${index + 1}: Record must be an object`)
      continue
    }

    // Check for required fields
    for (const requiredField of requiredFields) {
      if (
        !(requiredField in record) ||
        record[requiredField] === null ||
        record[requiredField] === undefined ||
        record[requiredField] === ''
      ) {
        errors.push(`Row ${index + 1}: Missing required field "${requiredField}"`)
      }
    }

    // Check for unknown fields
    const recordFields = Object.keys(record)
    for (const fieldName of recordFields) {
      // Skip system fields
      if (['createdAt', 'id', 'updatedAt'].includes(fieldName)) {
        continue
      }

      // Check if field exists in collection config
      const isValidField = validFieldNames.some(
        (validName) =>
          validName === fieldName ||
          validName.startsWith(`${fieldName}.`) ||
          fieldName.startsWith(`${validName}.`),
      )

      if (!isValidField) {
        warnings.push(`Row ${index + 1}: Unknown field "${fieldName}" will be ignored`)
      }
    }

    // Basic type validation for common field types
    const validateFieldType = (field: any, value: any, fieldPath: string) => {
      if (value === null || value === undefined || value === '') {
        return // Skip validation for empty values
      }

      switch (field.type) {
        case 'checkbox':
          if (typeof value !== 'boolean' && value !== 'true' && value !== 'false') {
            errors.push(`Row ${index + 1}: Field "${fieldPath}" must be a boolean`)
          }
          break
        case 'date':
          if (typeof value === 'string' && isNaN(Date.parse(value))) {
            errors.push(`Row ${index + 1}: Field "${fieldPath}" must be a valid date`)
          }
          break
        case 'email':
          if (typeof value === 'string' && !value.includes('@')) {
            errors.push(`Row ${index + 1}: Field "${fieldPath}" must be a valid email`)
          }
          break
        case 'number':
          if (isNaN(Number(value))) {
            errors.push(`Row ${index + 1}: Field "${fieldPath}" must be a number`)
          }
          break
        case 'select':
          if (field.options && Array.isArray(field.options)) {
            const validOptions = field.options.map((opt: any) =>
              typeof opt === 'string' ? opt : opt.value,
            )
            if (!validOptions.includes(value)) {
              errors.push(
                `Row ${index + 1}: Field "${fieldPath}" must be one of: ${validOptions.join(', ')}`,
              )
            }
          }
          break
      }
    }

    // Validate field types
    const validateFields = (fields: any[], data: any, prefix = '') => {
      for (const field of fields) {
        if ('name' in field && field.name) {
          const fieldPath = prefix ? `${prefix}.${field.name}` : field.name
          const value = data[field.name]

          if (value !== undefined) {
            validateFieldType(field, value, fieldPath)
          }

          // Handle nested validation
          if (field.type === 'group' && field.fields && typeof value === 'object') {
            validateFields(field.fields, value, fieldPath)
          } else if (field.type === 'array' && field.fields && Array.isArray(value)) {
            for (const [arrayIndex, arrayItem] of value.entries()) {
              if (typeof arrayItem === 'object') {
                validateFields(field.fields, arrayItem, `${fieldPath}[${arrayIndex}]`)
              }
            }
          }
        }
      }
    }

    validateFields(collectionConfig.fields, record)
  }

  return {
    errors,
    isValid: errors.length === 0,
    warnings,
  }
}
