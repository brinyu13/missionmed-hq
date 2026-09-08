=== MissionMed Hub ===
Contributors: missionmedinstitute
Tags: dashboard, student hub, task management, file upload, mentorship
Requires at least: 6.0
Tested up to: 6.7
Requires PHP: 7.4
Stable tag: 1.5.0
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Multi-division student command center for MissionMed Institute with LearnDash dashboards for Mission Residency, USMLE Exam Prep, and Clinicals.

== Description ==

MissionMed Hub is a private WordPress plugin built exclusively for MissionMed Institute. It provides a student-facing dashboard ("Hub") that integrates with LearnDash LMS and WooCommerce to automate onboarding, progress tracking, and task management across three dashboard divisions:

* **Mission Residency** — mentorship, applications, and match strategy
* **USMLE Exam Prep** — course-based exam readiness and progress visibility
* **Clinicals** — onboarding, compliance, and placement readiness

**Features:**

* Custom Post Type for tasks with full admin management
* Secure AJAX file upload with MIME validation and rate limiting
* Automatic task creation on enrollment (WooCommerce order or manual trigger)
* Multi-division student command center with master HUD and cockpit-style switcher
* Email notifications for uploads, approvals, and revision requests
* Placement-ready auto-detection for USCE students
* Settings page for Calendly URL, reviewer assignments, and LearnDash mapping
* Access audit screen for WooCommerce purchase vs LearnDash enrollment mismatches

== Installation ==

1. Upload the `missionmed-hub` folder to `/wp-content/plugins/`
2. Activate the plugin through the 'Plugins' menu in WordPress
3. Go to Settings > MissionMed Hub to configure:
   - Calendly booking URL
   - Support email addresses
   - Default reviewers for each division
   - WooCommerce product IDs for 360 Elite and USCE
   - LearnDash course and group IDs
4. Review Settings > MissionMed Access Audit to verify purchases, unlocked courses, and mismatch alerts
5. Create a WordPress page and assign the "MissionMed Hub" template, or use the `[mmed_hub]` shortcode

== Frequently Asked Questions ==

= Does this require LearnDash? =
LearnDash is recommended for full course progress integration but not strictly required. The Hub will function for task management without it.

= Does this require WooCommerce? =
WooCommerce is used for automatic enrollment on purchase. Without it, you can trigger enrollment manually via the user profile re-run button.

== Changelog ==

= 1.4.0 =
* Added MissionMed Access Audit admin screen for purchase-to-course visibility
* Shows per-user purchased products, unlocked courses, and missing access alerts
* Detects purchase without enrollment and enrollment without product mismatches
* Added configurable WooCommerce product IDs for 360 Elite and USCE mappings
* Updated fallback enrollment to read shared mapping settings and avoid blocking second-program enrollments

= 1.0.0 =
* Initial release
* Task CPT with 12 meta fields and full admin UI
* 360 Elite (12 tasks) and USCE Onboarding (7 tasks) templates
* Student Hub page template and shortcode
* Secure file upload system with rate limiting
* Email notification system
* Placement-ready auto-detection
* Settings page with LearnDash mapping
* Session card integration for LearnDash courses
