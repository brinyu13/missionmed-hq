# D1-412 rollback plan

1. Disable `matrix.timeline_app_mode.enabled`. Do not clear IndexedDB or service-worker caches containing local recovery code.
2. Restore the prior Matrix route asset manifest. Matrix source authority must be resolved before this step is automated.
3. Pause export workers and FileVault outbox publication. Do not delete immutable artifacts.
4. Roll back the API independently. Existing local drafts remain recoverable and the UI must expose sanitized JSON export.
5. If a database migration was ever applied, take a backup and use the paired down migration only after confirming no retained Timeline data depends on the schema.
6. Reconcile TimelineArtifact IDs and hashes before resuming FileVault publication.

No rollback step in this package has been executed against production.
