# Smallest additional scope if embedded Webex joining is required

NOT ACTIVATED / NOT REQUIRED FOR THE LOCAL WINDOW-CAPTURE ADAPTER.

Current scope permits isolated local recording, not production provider/auth mutations. Original browser-stage joining invokes host/guest token endpoints that may refresh credentials, and its default bootstrap couples to DrJ room state. Source reuse alone does not authorize these operations.

If Founder requires in-page Webex joining instead of the currently selected desktop-window adapter, proposed bounded amendment is:
- Read and independently verify only the existing Webex widget adapter and host-token endpoint behavior for a named test meeting.
- Add an IVPrep-owned bootstrap/adapter under its dedicated extension, with no DrJ stateUrl/polling or getUserMedia global patch.
- Permit only existing authenticated instructor token/host-join operations for that explicitly selected test meeting, including an explicitly approved normal OAuth refresh if required. No credential values in source/logs, no new OAuth client/scopes/provider configuration.
- Preserve original Webex/DrJ files; allow only a reviewed new adapter filename and exact renewed PATH lease. Any required original protected endpoint change needs a separately enumerated amendment.
- Verify two-party joined media, existing conversation integrity and local recording; keep desktop-window capture fallback.

No such provider calls, refreshes, participant actions or original file modifications were performed by this correction. The existing local capture workflow can be reviewed and released separately without this amendment.
