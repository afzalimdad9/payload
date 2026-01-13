/**
 * Converts a flattened object back to nested structure
 * Reverses the flattening done by flattenObject for CSV export
 *
 * Example:
 * { 'user_name': 'John', 'user_address_street': '123 Main St' }
 * becomes:
 * { user: { name: 'John', address: { street: '123 Main St' } } }
 */
export const unflattenObject = (obj: Record<string, any>): Record<string, any> => {
  const result: Record<string, any> = {}

  for (const [key, value] of Object.entries(obj)) {
    // Skip empty values
    if (value === '' || value === null || value === undefined) {
      continue
    }

    const keys = key.split('_')
    let current = result

    // Navigate/create nested structure
    for (let i = 0; i < keys.length - 1; i++) {
      const currentKey = keys[i]
      if (!currentKey) {
        continue
      }

      // Check if this is an array index (numeric)
      const nextKey = keys[i + 1]
      if (!nextKey) {
        continue
      }

      const isNextKeyNumeric = /^\d+$/.test(nextKey)

      if (isNextKeyNumeric) {
        // Initialize array if it doesn't exist
        if (!current[currentKey]) {
          current[currentKey] = []
        }

        const arrayIndex = parseInt(nextKey, 10)

        // Ensure array is large enough
        while ((current[currentKey] as any[]).length <= arrayIndex) {
          ;(current[currentKey] as any[]).push({})
        }

        current = (current[currentKey] as any[])[arrayIndex]
        i++ // Skip the numeric index in next iteration
      } else {
        // Regular object property
        if (!current[currentKey]) {
          current[currentKey] = {}
        }
        current = current[currentKey] as Record<string, any>
      }
    }

    // Set the final value
    const finalKey = keys[keys.length - 1]
    if (!finalKey) {
      continue
    }

    // Try to parse JSON values (for arrays/objects stored as strings)
    let parsedValue = value
    if (typeof value === 'string') {
      // Try to parse as JSON for complex values
      if (
        (value.startsWith('[') && value.endsWith(']')) ||
        (value.startsWith('{') && value.endsWith('}'))
      ) {
        try {
          parsedValue = JSON.parse(value)
        } catch {
          // Keep as string if JSON parsing fails
        }
      } else if (value === 'true') {
        parsedValue = true
      } else if (value === 'false') {
        parsedValue = false
      } else if (!isNaN(Number(value)) && value !== '') {
        // Convert numeric strings to numbers
        parsedValue = Number(value)
      }
    }

    current[finalKey] = parsedValue
  }

  return result
}
