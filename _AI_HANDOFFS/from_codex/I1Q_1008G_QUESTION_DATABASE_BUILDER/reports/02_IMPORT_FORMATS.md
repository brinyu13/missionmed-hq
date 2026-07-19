# Import Formats

The restricted package provides four equivalent database forms:

| Artifact | Purpose | Validation |
|---|---|---|
| `question-database.sqlite` | immediately queryable local database | 16,690 rows and 16,690 primary keys |
| `question-database.import.json` | content-addressed ordered import envelope | schema and content hash verified |
| `question-database.import.csv` | RFC 4180 UTF-8/LF flat import | native parser and spreadsheet artifact runtime passed |
| `question-database.import.sql` | PostgreSQL 15/Supabase-compatible offline import | all 16,690 typed rows parsed and reconciled |

The CSV has 40 fixed columns. Arrays and objects use canonical compact JSON in their cells. Empty nullable cells map to SQL `NULL`; quoted text preserves commas, quotes, apostrophes, line breaks, Unicode, and whitespace.

The SQL is an import artifact, not an applied migration. It deliberately omits silent conflict suppression.
