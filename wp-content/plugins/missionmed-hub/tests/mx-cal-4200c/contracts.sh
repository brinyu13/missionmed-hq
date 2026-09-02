#!/usr/bin/env bash
set -euo pipefail

plugin_root="$(cd "$(dirname "$0")/../.." && pwd)"
v2_js="$plugin_root/assets/calendar-v2/mmed-calendar-v2.js"
v2_css="$plugin_root/assets/calendar-v2/mmed-calendar-v2.css"
classic_js="$plugin_root/assets/student-os-calendar-v4.js"
student_php="$plugin_root/includes/class-mmed-student-os.php"
experience_php="$plugin_root/includes/class-mmed-calendar-experience.php"

if rg -n 'fetch\(|new Date\(|current_user_can|is_admin' "$v2_js"; then
	echo 'FAIL StoryForge renderer contains data, time, or permission behavior' >&2
	exit 1
fi

rg -q 'application/x-mmed-drill' "$v2_js"
rg -q "'drill_step1'" "$plugin_root/assets/calendar-core/mmed-calendar-core.js"
rg -q "'drill_step23'" "$plugin_root/assets/calendar-core/mmed-calendar-core.js"
rg -q "Step/Level 1.*Micro / Infectious Disease" "$classic_js"
rg -q "Step/Level 2/3.*Surgery" "$classic_js"
rg -q 'scheduleDrillTopicOnDate' "$classic_js"
rg -Fq 'MMEDCalendarCore.create(matrixApp)' "$classic_js"
if rg -Fq "matrixApp.api.get('/events'" "$classic_js" || rg -Fq '/api/scheduler/calendar-feed' "$classic_js"; then
	echo 'FAIL Classic bypasses the shared Calendar core' >&2
	exit 1
fi
rg -q 'activateCalendarDayFromKey' "$classic_js"
rg -Fq 'if (ev.recordingUrl)' "$classic_js"
rg -Fq 'Delete this event? This cannot be undone.' "$classic_js"
rg -q 'server-resolved renderer' "$student_php"
rg -q 'mmed-calendar-runtime.js' "$student_php"
rg -Fq '@media (max-width: 560px)' "$v2_css"
rg -Fq '@media (prefers-reduced-motion: reduce)' "$v2_css"
rg -Fq "event.key === 'Escape'" "$v2_js"
rg -Fq 'drawerNeedsFocus' "$v2_js"
rg -Fq 'triggers[i].focus()' "$v2_js"
rg -Fq "add_options_page( 'Calendar Experience'" "$experience_php"
rg -Fq "'manage_options'" "$experience_php"
rg -Fq "get_option( self::OPTION_DEFAULT, 'classic' )" "$experience_php"
rg -Fq "get_option( self::OPTION_ENABLED, false )" "$experience_php"

selector_count="$(rg -o '^\.mmed-calendar-v2' "$v2_css" | wc -l | tr -d ' ')"
if [[ "$selector_count" -lt 40 ]]; then
	echo "FAIL insufficient V2 selector scoping: $selector_count" >&2
	exit 1
fi

echo 'PASS shared-core renderer boundaries, fail-closed admin fallback, Drills reuse, drawer focus, Classic keyboard/replay/delete safety, single-renderer assets, mobile, and reduced motion'
