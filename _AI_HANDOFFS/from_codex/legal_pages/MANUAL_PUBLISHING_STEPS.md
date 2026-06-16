# Manual Publishing Steps

Use these steps only if the team wants WordPress database pages instead of the source-controlled MU-plugin virtual pages.

1. In WordPress admin, create or edit these pages:
   - `/terms-of-agreement/`
   - `/refund-cancellation-policy/`
   - `/privacy-policy/`
2. Paste the corresponding Markdown file content into the editor and convert headings to WordPress heading blocks if needed.
3. Confirm each page is published, public, and indexable.
4. Confirm footer links resolve to:
   - Refund Policy -> `/refund-cancellation-policy/`
   - Privacy Policy -> `/privacy-policy/`
   - Terms of Agreement -> `/terms-of-agreement/`
5. Confirm the My Account registration privacy link points to `/privacy-policy/`, not `/?page_id=3`.
6. Clear WordPress, Elementor, Autoptimize, CDN, and browser caches.
7. Validate the three URLs return HTTP 200 and contain "Last updated: June 15, 2026" plus `info@missionmedinstitute.com`.
