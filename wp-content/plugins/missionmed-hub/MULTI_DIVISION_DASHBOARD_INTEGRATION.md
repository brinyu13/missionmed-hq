# Multi-Division Dashboard Integration

## Component Files
- HTML/PHP renderer: `missionmed-hub/includes/class-mmed-hub-page.php`
- Frontend styles: `missionmed-hub/assets/hub.css`
- Frontend behavior: `missionmed-hub/assets/hub.js`
- Plugin settings + LearnDash mapping: `missionmed-hub/missionmed-hub.php`

## WordPress Placement
1. Upload the `missionmed-hub` folder to `/wp-content/plugins/`.
2. Activate **MissionMed Hub** in WordPress.
3. Go to **Settings > MissionMed Hub** and configure:
   - Calendly booking URL
   - Support emails for Residency, USMLE, and Clinicals
   - Default reviewers
   - LearnDash course IDs
   - LearnDash group IDs

## How To Render It
- Preferred: assign a page the **MissionMed Hub** template.
- Shortcode: use `[mmed_hub]`.
- Alternate shortcode: use `[mmed_command_center]`.

## Elementor Embed
1. Create a full-width Elementor page.
2. Drop in a **Shortcode** widget.
3. Paste `[mmed_hub]` or `[mmed_command_center]`.
4. Publish.

The shortcode renderer includes an asset fallback so the dashboard still loads when Elementor page detection misses the plugin enqueue hook.

## LearnDash Dependencies
- Required for course progress, enrollment visibility, and session-aware division dashboards.
- Group mapping is optional but recommended for cleaner division detection.
- WooCommerce is optional for order-based automation and does not block dashboard rendering.

## Division Mapping
- Mission Residency: uses `mmed_course_360elite` and `mmed_group_residency`
- USMLE Exam Prep: uses `mmed_course_usmle` and `mmed_group_usmle`
- Clinicals: uses `mmed_course_usce` and `mmed_group_clinicals`

## Notes
- The dashboard is modular and safe to embed in Elementor through shortcode output.
- No external JS dependency is required.
- Existing task upload, session, and document workflows remain active inside the new multi-division shell.
