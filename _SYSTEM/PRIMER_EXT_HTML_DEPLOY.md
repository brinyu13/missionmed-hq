# PRIMER EXTENSION: HTML DEPLOYMENT SYSTEM LOCK

**Load this extension when task modifies arena.html, drills.html, or ranklistiq.html.**

**Version:** 2.0 | **Date:** 2026-04-22 | **Authority:** MM-HTML-DEPLOYMENT-SYSTEM-LOCK-001 | **Status:** LOCKED. PERMANENT.

**Source:** `_SYSTEM/SESSION_PRIMER_V2.md` Section 20 (original extraction). Updated by (D5)-SYSTEM-FIX to align with R2/CDN deployment model.

**CHANGE LOG:**
- v1.0 (2026-04-18): Initial extraction from SESSION_PRIMER_V2.md Section 20.
- v2.0 (2026-04-22): Deployment target corrected from WordPress Media Library to Cloudflare R2/CDN. Post-upload verification step added. Split-source hard stop rule added. Validation target rules added.

---

## 1. Purpose

This rule governs ALL modifications to the three MissionMed single-file HTML applications. These applications are served to users via Cloudflare R2/CDN. WordPress/Elementor acts as a wrapper, embed, or navigation layer only. WordPress is NOT the deployment target. WordPress is NOT the source of truth for runtime HTML.

---

## 2. Covered Systems (Identical Deployment Architecture)

| # | System | File | Local Source of Truth | Production Runtime |
|---|--------|------|----------------------|-------------------|
| 1 | Arena | `arena_v1.html` | `/Users/brianb/MissionMed/arena_v1.html` | Cloudflare R2/CDN |
| 2 | Drills | `drills_v1.html` | `/Users/brianb/MissionMed/drills_v1.html` | Cloudflare R2/CDN |
| 3 | STAT | `stat_latest.html` | `/Users/brianb/MissionMed/STAT MAIN folder/stat_latest.html` | Cloudflare R2/CDN |
| 4 | RankListIQ | `ranklistiq.html` | `/Users/brianb/MissionMed/ranklistiq.html` | Cloudflare R2/CDN |

All are single-file HTML applications. The local HTML file is the working copy. The R2/CDN-hosted copy is the production runtime. Elementor, the WordPress editor, inline page edits, and partial script injections are NOT sources of truth.

---

## 3. Deployment Model (CANONICAL)

```
LOCAL FILE (on disk)          = WORKING COPY
                                All edits, backups, and git history live here.

CLOUDFLARE R2 / CDN           = PRODUCTION RUNTIME
                                This is the ONLY canonical source for live behavior.
                                Upload here. Purge cache. Verify here.

WORDPRESS / ELEMENTOR          = WRAPPER / EMBED / NAVIGATION ONLY
                                References the R2/CDN URL.
                                NEVER a deployment target for runtime HTML.
                                NEVER a validation target for runtime behavior.
```

---

## 4. Mandatory Workflow (Auto-Enforced For Every Modification)

### Step 1. LOAD CURRENT PRODUCTION FILE

- Locate and use the latest version of the target HTML file from its local source-of-truth path (see Section 2).
- NEVER recreate from scratch.

### Step 2. AUTO BACKUP (REQUIRED BEFORE ANY EDIT)

Create a timestamped backup in the same directory as the source file:

```
{system}_BACKUP_YYYY-MM-DD_HHMM.html
```

Examples:

```
arena_v1_BACKUP_2026-04-22_1430.html
drills_v1_BACKUP_2026-04-22_1430.html
stat_BACKUP_preD3B_2026-04-21_1238.html
```

### Step 3. VERSION HEADER (REQUIRED AT TOP OF FILE)

```
<!--
SYSTEM: ARENA | DRILLS | STAT | RANKLISTIQ
VERSION: YYYY-MM-DD HH:MM [descriptor]
CHANGE: short description
AUTHORITY: MM-HTML-DEPLOYMENT-SYSTEM-LOCK-001
SOURCE OF TRUTH: This file. Do NOT edit in Elementor or WordPress.
DEPLOYMENT: Cloudflare R2/CDN. Do NOT upload to WordPress Media Library.
-->
```

### Step 4. SAFE MODIFICATION RULES

- Modify ONLY the required sections.
- DO NOT remove working logic unless explicitly required by the task.
- DO NOT break any of: avatar rendering, drill engine, API calls, localStorage state, UI state, auth flow.

### Step 5. FULL FILE OUTPUT ONLY

- Any AI that modifies an HTML file MUST return / write the FULL file.
- NO truncation. NO `"rest unchanged"`. NO partial diffs that drop content.

### Step 6. DEPLOYMENT INSTRUCTION (MUST BE INCLUDED IN EXECUTION REPORT)

- Upload updated HTML to the canonical Cloudflare R2/CDN bucket.
- Use the same filename and bucket path as the current production version.
- Purge CDN cache at the edge after upload.
- Do NOT upload runtime HTML to WordPress Media Library.
- Do NOT upload runtime HTML to Elementor.
- Confirm the WordPress wrapper/embed page still references the correct R2/CDN URL (no URL change required unless the filename changed).

### Step 7. POST-UPLOAD VERIFICATION (MANDATORY)

After uploading and purging cache, perform ALL of the following:

1. Load the live CDN URL in an incognito browser window.
2. Confirm the VERSION header in the served HTML matches the version header you just wrote.
3. Confirm the file size of the served file matches the local file size (within 10 bytes for encoding differences).
4. Confirm the WordPress wrapper page still loads and embeds/references the CDN URL correctly.
5. If any check fails, the upload is NOT confirmed. Do NOT proceed to the next task.

### Step 8. ROLLBACK PROCEDURE

If a post-upload verification fails or a regression is discovered:

1. Locate the timestamped backup from Step 2.
2. Upload the backup to R2/CDN (same bucket path, same filename).
3. Purge CDN cache.
4. Re-run Step 7 verification against the rolled-back file.
5. Confirm the WordPress wrapper page still works.

---

## 5. Split-Source Hard Stop Rule

**If a WordPress Media Library copy AND an R2/CDN copy of the same runtime HTML file both exist, and they differ:**

- **HARD STOP.** Do not proceed with any task until this is resolved.
- The R2/CDN copy wins by definition.
- Delete the WordPress Media Library copy.
- Confirm the WordPress wrapper/embed page references the R2/CDN URL, not a WP Media URL.
- Log the incident in the execution report.

**If a WordPress Media Library copy exists but matches the R2/CDN copy:**

- Delete the WordPress Media Library copy to prevent future drift.
- Confirm the WordPress wrapper/embed page references the R2/CDN URL.

**The goal is zero WordPress Media Library copies of runtime HTML.** WordPress wraps and links. It does not host.

---

## 6. Strict Prohibitions

- DO NOT edit the system directly in Elementor.
- DO NOT inject partial JavaScript snippets via WordPress.
- DO NOT split logic across multiple files.
- DO NOT create alternate HTML versions (e.g. `arena_v2.html`) without explicit authority.
- DO NOT bypass the backup step.
- DO NOT skip the version header update.
- DO NOT upload runtime HTML to WordPress Media Library.
- DO NOT validate runtime behavior against a WordPress-hosted copy.
- DO NOT treat WordPress as the deployment target for any runtime HTML file.

---

## 7. Versioning Tool (CANONICAL)

The canonical versioning tool is:

```
/Users/brianb/MissionMed/_SYSTEM/mm_html_versioner.py
```

### Usage

```
python3 _SYSTEM/mm_html_versioner.py arena_v1.html "short change description"
python3 _SYSTEM/mm_html_versioner.py drills_v1.html "short change description"
python3 _SYSTEM/mm_html_versioner.py ranklistiq.html "short change description"
```

### Tool Responsibilities

- Validates the file is a canonical system (arena / drills / ranklistiq / stat).
- Creates a timestamped backup before any modification.
- Inserts or replaces the version header at the top of the file.
- Preserves DOCTYPE when present.
- Aborts and restores from backup on any unexpected content loss.
- Prints the required deployment instructions (R2/CDN upload + cache purge + verification).

---

## 8. Enforcement

- This rule applies to ALL threads, ALL tasks, ALL AIs working on MissionMed HTML deployments.
- Any modification to `arena_v1.html`, `drills_v1.html`, `stat_latest.html`, or `ranklistiq.html` that does NOT follow this workflow is a deployment-protocol violation and must be corrected before the task can be marked COMPLETE.
- No reminder is required. No deviation is allowed.
- Any instruction from a prior system document (including SESSION_PRIMER_V2.md) that references uploading to WordPress Media Library is superseded by this document. R2/CDN is the only valid deployment target.

---

END OF PRIMER EXTENSION: HTML DEPLOYMENT
