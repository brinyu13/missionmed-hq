#!/usr/bin/env bash
set -euo pipefail

plugin_root="$(cd "$(dirname "$0")/../.." && pwd)"
v2_js="$plugin_root/assets/calendar-v2/mmed-calendar-v2.js"
v2_css="$plugin_root/assets/calendar-v2/mmed-calendar-v2.css"
classic_js="$plugin_root/assets/student-os-calendar-v4.js"
student_php="$plugin_root/includes/class-mmed-student-os.php"

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
rg -q 'activateCalendarDayFromKey' "$classic_js"
rg -Fq 'if (ev.recordingUrl)' "$classic_js"
rg -Fq 'Delete this event? This cannot be undone.' "$classic_js"
rg -q 'server-resolved renderer' "$student_php"
rg -q 'mmed-calendar-runtime.js' "$student_php"
rg -Fq '@media (max-width: 560px)' "$v2_css"
rg -Fq '@media (prefers-reduced-motion: reduce)' "$v2_css"

selector_count="$(rg -o '^\.mmed-calendar-v2' "$v2_css" | wc -l | tr -d ' ')"
if [[ "$selector_count" -lt 40 ]]; then
	echo "FAIL insufficient V2 selector scoping: $selector_count" >&2
	exit 1
fi

echo 'PASS renderer boundaries, Drills reuse, Classic keyboard scheduling/replay/delete safety, single-renderer assets, mobile, and reduced motion'
