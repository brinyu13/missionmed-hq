# Y1-Y2-CAM-V6-3494A — TIMELINE BUILDER / FILE VAULT CV ADAPTER SPEC

## 1. CVSourceAdapter (priority chain — student never re-uploads needlessly)

```
CVSourceAdapter.resolve(studentId) →
 1. TimelineBuilderSource   — structured CV already parsed there (preferred; freshest structured data)
 2. FileVaultSource         — stored CV document (parse via Stage 1)
 3. DirectUploadSource      — PDF/docx upload
 4. ManualEntrySource       — fallback form
→ CVSourceDescriptor { source, label, updatedAt, confidence }
```

UI: `CV SOURCE: Timeline Builder · Updated Aug 10 · [USE THIS CV]` (or Vault filename / `[UPLOAD CV]`); student can override the priority pick; chosen source stamped into generation provenance.

## 2. REUSE-FIRST DIRECTIVE (binding on Claude Code)

Before building any parser/generator, **inspect Timeline Builder for an existing CV parser and/or contextual question engine** (CC-00A recon). If usable: ADAPT behind the adapter boundary — do not rebuild a weaker duplicate. If partial: reuse the parser, add only the missing worthiness layer.

## 3. Adapter boundary (anti-coupling law)

IV Prep imports ONLY: `CVContextProvider.getModel(studentId) → NormalizedCV` and `CVSourceAdapter.resolve()`. No Timeline Builder internals, routes, stores, or types cross the boundary; Timeline Builder schema changes must break the adapter only. Contract tests pin the NormalizedCV shape.
