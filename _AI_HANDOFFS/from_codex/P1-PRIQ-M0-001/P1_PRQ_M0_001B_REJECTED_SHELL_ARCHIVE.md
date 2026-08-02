# P1-PRIQ-M0-001B rejected shell archive

This is the pre-recovery record required before replacing the unaccepted shell. It is evidence only and must not become the frontend.

- `apps/priq-web/public/index.html` SHA-256: `7db3e6e63584bb6f32c2df1126e4e696f87a2af60e98f0d643797f261a42d0b1`
- `apps/priq-web/public/styles.css` SHA-256: `74ccef3006a34185e9a3a9d5fd21b29fa7b86b50c1a06cd1877f55ded4bdffc7`
- `apps/priq-web/public/app.js` SHA-256: `9ba709eeba77ad10c6570212fe74e663cd9f2d42b4ad4d456db85b9c23c1d931`

## index.html

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>PRIQ — Interview Intelligence</title>
  <link rel="stylesheet" href="/styles.css">
</head>
<body>
  <a class="skip" href="#main">Skip to content</a>
  <header>
    <div><span class="mark">MM</span><strong> PRIQ</strong><small>MISSIONMED INTELLIGENCE RUNTIME</small></div>
    <div class="state"><span></span> FOUNDATION / BLOCKED</div>
  </header>
  <main id="main">
    <section class="hero">
      <p class="eyebrow">P1 · PRODUCTION FOUNDATION</p>
      <h1>DR. BRIAN’S ASSESSMENT,<br>PROFILE &amp; RECOMMENDATIONS</h1>
      <div class="subject"><strong>Ezechiel Fenelon</strong><span>Internal Medicine · One Brooklyn Health / Brookdale</span><span>Interview subject: Dr. Conrad Fischer</span></div>
    </section>
    <nav aria-label="PRIQ rooms">
      <button class="active" data-room="overview">Today</button><button data-room="students">Students</button><button data-room="programs">Programs</button><button data-room="copilot">Live Copilot</button><button data-room="lab">Profile Lab</button>
    </nav>
    <section class="grid" id="room" aria-live="polite">
      <article class="wide"><p class="label">READINESS VERDICT</p><h2>Foundation implemented. Profile generation blocked.</h2><p>No authorized private student packet, no approved audiovisual source, and no <code>MIR_OPENAI_API_KEY</code> were available. PRIQ will not synthesize a personality, compatibility score, or student report from missing evidence.</p></article>
      <article><p class="label">IDENTITY</p><h3>Resolved</h3><p>Primary hospital and educator sources converge on Conrad Fischer at Brookdale.</p><a href="/api/research">Inspect source registry</a></article>
      <article><p class="label">PRIVATE INTAKE</p><h3>Awaiting manifest</h3><p>Upload validation is available; file bytes are never committed by this foundation.</p></article>
      <article><p class="label">PUBLIC COVERAGE</p><h3>4 sources · 3 types</h3><p>Audiovisual coverage remains pending and prevents a complete research verdict.</p></article>
      <article><p class="label">STUDENT VIEW</p><h3>Off by default</h3><p>Requires founder-approved claims plus explicit publication.</p></article>
    </section>
  </main>
  <aside><strong>CONTROL PANEL</strong><p>Provider health and switches are enforced by the API, not just this surface.</p><a href="/health">Runtime health</a></aside>
  <script src="/app.js"></script>
</body>
</html>
```

## app.js

```js
const room = document.querySelector("#room");
const baseline = room.innerHTML;
const messages = {
  students: ["STUDENT INTELLIGENCE", "Private evidence gate is closed.", "Ezechiel's Bird shorthand, communication patterns, StoryForge casting, compatibility, and recommendations remain blank until an authorized packet is present and provider policy permits processing."],
  programs: ["PROGRAM INTELLIGENCE", "Public identity resolved; audiovisual coverage pending.", "Official hospital and educator sources connect Dr. Conrad Fischer with Brookdale. No complete program/interviewer assessment is published without audiovisual and student evidence."],
  copilot: ["LIVE COPILOT", "Deterministic governor ready; session feature off.", "Cue throttling and debrief contracts are tested. Live use remains disabled until session consent, authenticated transport, and canonical CAM/IV Prep integrations exist."],
  lab: ["PROFILE LAB", "Progression ladder scaffolded; student access disabled.", "Research, rehearsal, live cues, and debrief require separate evidence and publication gates."],
};
document.querySelectorAll("nav button").forEach((button) => button.addEventListener("click", () => {
  document.querySelectorAll("nav button").forEach((item) => item.classList.toggle("active", item === button));
  if (button.dataset.room === "overview") { room.innerHTML = baseline; return; }
  const [label, title, copy] = messages[button.dataset.room];
  room.innerHTML = `<article class="wide"><p class="label">${label}</p><h2>${title}</h2><p>${copy}</p></article>`;
}));
```

## styles.css

The rejected stylesheet is preserved by its exact hash above and remains available in the pre-recovery working-tree object recorded by the 001A audit. It was a one-line 2,758-byte dark-green generic card stylesheet; it is intentionally not reproduced as active CSS here.
