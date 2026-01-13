# Payload Import/Export Plugin

A comprehensive plugin for [Payload](https://github.com/payloadcms/payload) to easily import and export collection data in CSV and JSON formats.

## Features

### Export Functionality

- Export collection data as CSV or JSON
- Download exports directly or save as file uploads
- Selective field and document export
- Support for nested objects and relationships
- Jobs queue integration for large exports
- Customizable CSV output formatting

### Import Functionality

- Import data from CSV or JSON files
- Data preview and validation before processing
- Support for creating new documents and updating existing ones
- Comprehensive error handling and reporting
- Progress tracking and status updates
- Automatic type conversion and nested object handling

## Quick Start

```bash
pnpm add @afzalimdad9/payload-import-export
```

```ts
import { buildConfig } from 'payload'
import { importExportPlugin } from '@afzalimdad9/payload-import-export'

export default buildConfig({
  plugins: [
    importExportPlugin({
      collections: ['users', 'posts'], // Optional: specify collections
    }),
  ],
  // ... rest of config
})
```

## Documentation

- [Full Documentation](https://payloadcms.com/docs/plugins/import-export)
- [Source Code](https://github.com/payloadcms/payload/tree/main/packages/plugin-import-export)

## Configuration Options

| Option                     | Type              | Description                                            |
| -------------------------- | ----------------- | ------------------------------------------------------ |
| `collections`              | `string[]`        | Collections to enable import/export for (default: all) |
| `disableImport`            | `boolean`         | Disable import functionality                           |
| `disableDownload`          | `boolean`         | Disable direct download of exports                     |
| `format`                   | `'csv' \| 'json'` | Force specific format and hide format selector         |
| `overrideImportCollection` | `function`        | Customize the import collection configuration          |
| `overrideExportCollection` | `function`        | Customize the export collection configuration          |

## Usage

### Exporting Data

1. Navigate to any collection list view
2. Use the "Export" option in the list controls
3. Configure export settings (format, fields, filters)
4. Download directly or save as file upload

### Importing Data

1. Navigate to any collection list view
2. Use the "Import" option in the list controls
3. Paste CSV or JSON data into the import form
4. Preview and validate the data
5. Process the import with progress tracking

## CSV Format Support

The plugin handles complex data structures in CSV format:

- **Nested objects**: `user.profile.name` → `{ user: { profile: { name: "value" } } }`
- **Arrays**: `tags.0`, `tags.1` → `{ tags: ["value1", "value2"] }`
- **Relationships**: Supports ID references and basic validation

## API Endpoints

- `POST /api/exports/download` - Direct export download
- `POST /api/imports/preview` - Preview import data
- `POST /api/imports/process` - Process import

## License

MIT - see [license.md](./license.md)
