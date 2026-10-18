# Gym Tracker backup format

The full backup is UTF-8 JSON with this envelope:

- `format`: `gym-tracker-backup`
- `backupVersion`: `1` (the serialization and validation contract)
- `schemaVersion`: the current Dexie schema version (`1`)
- `appVersion`: the version from `package.json`
- `exportedAt`: ISO 8601 timestamp
- `data`: arrays for `workoutSessions`, `exercises`, `workoutExercises`,
  `exerciseSets`, `savedMeals`, and `mealLogs`

All six tables are read in one Dexie read transaction. Every record is
preserved, including UUIDs, foreign keys, timestamps, soft-deletion markers,
completion state, and historical workout and nutrition snapshots. `localDate`
and nutrition snapshots are restored as stored; they are not recalculated for
the importing device's time zone.

The importer accepts only backup format version 1 and the current database
schema version. There is no version migration yet. Files are limited to 25 MiB
and 100,000 total records. Validation checks record shapes, UUIDs, enums,
numbers, timestamps, duplicate IDs and active duplicate relationships, and
foreign-key references before opening a write transaction. Soft-deleted
parents remain valid references when their records are included.

Merge inserts new IDs, counts structurally identical records as already
present, and aborts the entire operation on any same-ID/different-content
conflict. Replace clears and repopulates all six tables in one Dexie
read-write transaction; the object store schema and indexes are not dropped or
recreated. A failed transaction is rolled back.

CSV downloads are reports rather than backups. They omit soft-deleted rows.
Untrusted text cells that begin with optional whitespace followed by `=`, `+`,
`-`, or `@` are prefixed with an apostrophe to reduce spreadsheet formula
injection risk; numeric values are not modified.
