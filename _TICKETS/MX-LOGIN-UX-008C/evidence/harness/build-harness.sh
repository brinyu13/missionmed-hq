#!/bin/bash
# Regenerate the local MX-LOGIN-UX-008C QA harness.
# Serves the real shipped student-os.js/.css plus the production baseline copies,
# so every screenshot is produced from actual source, not a mock-up.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
EV="$(dirname "$HERE")"
WT="$(cd "$EV/../../.." && pwd)"

mkdir -p "$EV/serve/assets" "$EV/serve/baseline/assets"
cp "$WT/wp-content/plugins/missionmed-hub/assets/student-os.js"  "$EV/serve/assets/"
cp "$WT/wp-content/plugins/missionmed-hub/assets/student-os.css" "$EV/serve/assets/"
cp "$EV/../baselines/prod_untouched/student-os.16ca42c53ca2e890.js" "$EV/serve/baseline/assets/student-os.js"
cp "$EV/../baselines/prod_untouched/student-os.css"                 "$EV/serve/baseline/assets/student-os.css"
cp "$HERE/matrix.html" "$EV/serve/index.html"

python3 - "$EV" <<'PY'
import sys, pathlib
ev = pathlib.Path(sys.argv[1]); serve = ev / "serve"
src = (serve / "index.html").read_text(encoding="utf-8")

# chooser already dismissed for this session
(serve / "dashboard.html").write_text(src.replace(
    "/* keep the harness offline",
    'try{sessionStorage.setItem("mmed.matrix.welcomeHome.seen","1");}catch(e){}\n/* keep the harness offline'),
    encoding="utf-8")

dash = (serve / "dashboard.html").read_text(encoding="utf-8")
(serve / "nonenrolled.html").write_text(dash.replace("is_enrolled: true", "is_enrolled: false"), encoding="utf-8")
(serve / "locked.html").write_text(dash.replace("</body>",
    '<script>setTimeout(function(){var e=document.querySelector(\'[data-route="drjlivedrills"]\');if(e){e.click();}},900);</script>\n</body>'),
    encoding="utf-8")

base = dash.replace("/assets/student-os.css", "/baseline/assets/student-os.css") \
           .replace("/assets/student-os.js", "/baseline/assets/student-os.js")
(serve / "baseline" / "index.html").write_text(base, encoding="utf-8")
(serve / "baseline" / "nonenrolled.html").write_text(base.replace("is_enrolled: true", "is_enrolled: false"), encoding="utf-8")

for name, target, h in (("mobile-frame", "/index.html", 844), ("mobile-frame-dash", "/dashboard.html", 1100)):
    (serve / f"{name}.html").write_text(
        '<!doctype html><meta charset="utf-8"><title>390px viewport capture</title>'
        '<style>html,body{margin:0;background:#05101c;display:block}'
        f'iframe{{width:390px;height:{h}px;border:0;display:block}}</style>'
        f'<iframe src="{target}"></iframe>', encoding="utf-8")
PY

php "$HERE/render-myaccount.php" > "$EV/serve/myaccount.html"
echo "harness rebuilt at $EV/serve"
echo "serve with: python3 -m http.server 8899 --directory $EV/serve"
