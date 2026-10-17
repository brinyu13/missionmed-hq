## MissionMed Hub V1 — Changelog

### [2026-03-25] v1.5.0 — Prompt 43A Multi-Division Dashboard Navigation
- Rebuilt the student hub as a multi-division LearnDash command center with:
  - Mission Residency
  - USMLE Exam Prep
  - Clinicals
- Added a master dashboard HUD with:
  - active enrollments
  - progress summary
  - alerts and deadlines
  - recent activity
- Added a horizontal cockpit-style division switcher with state persistence
- Made dashboard, milestones, sessions, courses, and documents division-aware
- Added Elementor-safe shortcode asset fallback for `[mmed_hub]` and `[mmed_command_center]`
- Added USMLE support settings:
  - support email
  - reviewer
  - LearnDash course ID
  - LearnDash group ID
- Extended admin task/user metadata labels to recognize the new USMLE division

### [2026-03-25] v1.4.0 — Prompt 43C Course Access + Permission Visualization
- Added `MMED_Access_Audit` service for shared WooCommerce product to LearnDash course mapping
- Added Settings > MissionMed Access Audit admin screen with:
  - logic structure panel
  - mapping visualization table
  - user access matrix
  - summary cards and filters
- User access matrix now shows purchased products, unlocked courses, and missing access states
- Added mismatch detection for:
  - purchase but no enrollment
  - enrollment but no matching product
- Added WooCommerce product ID settings for 360 Elite and USCE so the audit uses configurable mappings
- Updated fallback order enrollment to use shared settings instead of hardcoded IDs
- Fixed fallback enrollment so users can receive a second program without being skipped because they already had tasks from another template

### [2026-03-23] M5 — Plugin Scaffold
- Created plugin directory structure
- Main plugin file with activation/deactivation hooks
- All include files scaffolded
- CHANGELOG.md initialized

### [2026-03-23] M6 — Task CPT + Admin
- Registered mmed_task custom post type
- Registered 12 meta fields with types and validation
- Admin columns: Student, Division, Tier, Status, Due Date, File, Last Updated
- Admin filters: Division, Status, Program Tier
- Bulk actions: Approve, Needs Revision
- Quick-edit inline status change via AJAX
- Meta boxes: Student Assignment, Task Details, Instructions, Staff Note, File, Reviewer

### [2026-03-23] M7 — Task Templates
- 360elite_onboarding template (12 tasks with due offsets)
- usce_onboarding template (7 tasks with due offsets)
- mmed_create_task_set() function
- Hook listener for mmed_enrollment_complete

### [2026-03-23] M8 — Hub Page + Frontend
- Page template registration via theme_page_templates filter
- [mmed_hub] shortcode fallback for Elementor compatibility
- 6-section Hub rendering: Welcome Bar, Next Action, Next Session, Task Progress, Quick Links, Course Progress
- hub.css: MissionMed design system (Navy #0F2A44, Gold #C9A84C, Inter/Arial)
- hub.js: File upload AJAX, task expand/collapse, timezone localization
- Mobile-first: single column, max-width 720px, 44px touch targets
- 4 fallback states implemented

### [2026-03-23] M9 — File Upload System
- AJAX upload via wp_handle_upload()
- MIME validation: PDF, DOC, DOCX, JPG, JPEG, PNG
- 10MB size limit enforced
- Rate limiting: 5 uploads/hour/user via transients
- Auto-status change to pending_review on upload
- Capability-checked download endpoint
- File re-upload (deletes old, attaches new)

### [2026-03-23] M10 — Notifications
- wp_mail on file upload to reviewer
- wp_mail on status change (approved/revision_needed) to student
- Plain text only, from noreply@missionmedinstitute.com

### [2026-03-23] M11 — User Meta + Placement Ready
- 4 custom user meta fields registered
- placement_ready auto-flag when all USCE tasks approved
- wp_mail to Phil on placement_ready
- Admin user list columns: Program, Tasks X/Y, Placement Ready
- Manual Re-run Enrollment button on user profile

### [2026-03-23] M12 — Admin Polish + Settings
- Settings page: Calendly URL, Support Emails, Default Reviewers
- Quick-edit inline status via AJAX
- Bulk actions with notification triggers

### [2026-03-23] M13 — Security Hardening
- Nonce verification on all AJAX
- Capability checks on all actions
- Task scoping: students see only own tasks
- Server-side MIME + extension validation
- Rate limiting enforced
- XSS output escaping throughout
- Admin save hooks with nonce verification

### [2026-03-23] M14 — Session Card
- Custom meta box on LearnDash course edit screen
- JSON data model for _mmed_next_session
- Hub rendering with timezone localization
- Stale session filtering
- Calendly fallback

### [2026-03-23] M15-M16 — QA + Package
- PHP syntax validation on all files
- Plugin packaged as installable ZIP

### [2026-03-23] v1.1.0 — MR-LD-10 Command Center UX Rebuild
- COMPLETE frontend redesign: task list → premium command center dashboard
- Sidebar navigation: fixed navy sidebar with SVG icons, 6 sections, active glow, mobile hamburger
- Global command bar: sticky top bar with phase indicator, SVG progress ring, health status
- Hero panel: full-width gradient "YOUR NEXT STEP" with urgency indicators and gold CTA
- Phase intelligence engine: 4-phase (360elite) / 3-phase (USCE) with locked/active/complete states
- View-based routing: Dashboard, Tasks, Sessions, Courses, Documents with hash navigation
- Phase-grouped tasks: "Why this matters," "Note from your team," "What happens next" context
- Drag-and-drop file upload with improved feedback and file type hints
- Dedicated Documents view for submitted files
- Full mobile experience: hamburger sidebar, overlay, condensed command bar
- Inter font (Google Fonts), Stripe/Tesla/Linear design language
- Version bump to 1.1.0 for cache invalidation
- Backend fully preserved: no changes to CPT, AJAX, enrollment, notifications, or admin
