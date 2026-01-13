/**
 * Recursively removes all 'id' fields from nested objects and arrays,
 * while preserving the root-level 'id' field if it exists.
 */
export const removeNestedIds = (data: Record<string, unknown>): Record<string, unknown> => {
  const cleanData = { ...data }

  // Helper function to recursively clean nested objects
  const cleanObject = (obj: unknown): unknown => {
    if (obj === null || obj === undefined) {
      return obj
    }

    if (Array.isArray(obj)) {
      return obj.map((item) => cleanObject(item))
    }

    if (typeof obj === 'object') {
      const cleanedObj: Record<string, unknown> = {}

      for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
        // Skip 'id' fields in nested objects (but not at root level)
        if (key === 'id') {
          continue
        }

        cleanedObj[key] = cleanObject(value)
      }

      return cleanedObj
    }

    return obj
  }

  // Clean all fields except the root-level 'id'
  for (const [key, value] of Object.entries(cleanData)) {
    if (key !== 'id') {
      cleanData[key] = cleanObject(value)
    }
  }

  return cleanData
}
