# MMOS MODE PATTERN

**Version:** 1.0 | **Date:** 2026-04-22 | **Authority:** D3-Arena-MMOS-Playbook
**Status:** CANONICAL (LOCKED)
**Purpose:** The single authoritative document for adding a new mode to the MissionMed Operating System (MMOS). Any future Arena mode author (human or AI) follows this document to plug in a new mode in approximately 30 lines of glue code, with zero MMOS core changes.
**Source material:** arena_v1.html PASS-004 MMOS block, (D3)-DRILLS_ARCH_DECISION_v1_DRAFT.md, (D4)-DRILLS_ARCH_DECISION_v1.1_AMENDMENT.md, stat_latest.html MMOS registration block, drills_v1.html post-Phase E.

---

## 1. WHAT IS AN ARENA MODE

A mode is a self-contained experience that runs inside the Arena shell under MMOS governance. Modes do not own page-level navigation, fullscreen, audio persistence, or loader/error overlays. MMOS owns those. A mode owns its internal DOM, its internal state, and its init/teardown lifecycle. The separation is absolute: MMOS is the operating system; a mode is an application running on it. MMOS never reaches into a mode's internals. A mode never bypasses MMOS for navigation, fullscreen, or cross-mode state. The MMOS core script (identified by `id="mmos-core-script"` and bounded by `START/END MARENA-OS-MMOS-READINESS-GATE-004` HTML comments) is identical across all host files (arena_v1.html, drills_v1.html, stat_latest.html) and is NEVER modified when adding a mode. All mode-specific code lives in a separate bindings script block that runs after the MMOS core.

---

## 2. LIFECYCLE (WALLCHART)

```
ARENA LOBBY (or any host page)
      |
      v
MMOS.navigate(modeId, opts)
      |
      +-- mode.type === 'external'?
      |       YES --> sessionStorage['mm.arena.entered'] = '1'
      |               window.location.href = mode.url
      |               (destination page owns its own MMOS instance)
      |               DONE
      |
      NO (internal mode)
      |
      v
Call current mode's onExit() if one is active
      |
      v
Set body[data-mmos-scene] = modeId
Set MMOS.state.currentScene = modeId
      |
      +-- mode.init defined?
      |       NO --> MMOS.state.modeStatus = 'ready'
      |              Call mode.onEnter(opts)
      |              Emit 'scene' event
      |              DONE (legacy PASS-003 path)
      |
      YES
      |
      v
MMOS.state.modeStatus = 'loading'
Show loader overlay (mode.loaderLabel)
Emit 'mode:loading'
      |
      v
result = await mode.init(opts)
      |
      +-- threw or result.status === 'error'?
      |       YES --> Hide loader
      |               Show error overlay (result.message)
      |               Emit 'mode:error'
      |               [Retry] --> MMOS.navigate(modeId, { retry: true })
      |               [Back]  --> MMOS.returnToArena()
      |               DONE (error state)
      |
      NO (result.status === 'ready' or undefined)
      |
      v
Hide loader
MMOS.state.modeStatus = 'ready'
Call mode.onEnter(opts)
Emit 'mode:ready'
Emit 'scene'
      |
      v
MODE IS ACTIVE (scene runs)
      |
      v
User triggers exit (button click, etc.)
      |
      v
mode.onExit() called (by MMOS, not by mode)
      |
      v
MMOS.navigate(targetModeId)
      |
      v
RETURN TO LOBBY (or redirect to external mode)
```

Key invariant: the loader overlay, error overlay, scene attribute, and status transitions are all owned by MMOS. The mode never shows or hides these itself.

---

## 3. MODE REGISTRATION CONTRACT (CANONICAL)

```javascript
window.MMOS.registerMode({

  // REQUIRED. Unique string identifier for this mode.
  // Convention: lowercase, hyphenated. Examples: 'drill', 'stat', 'flashcards'.
  // This is the value passed to MMOS.navigate(id).
  id: 'my-mode',

  // REQUIRED. 'internal' or 'external'.
  // 'internal': mode runs inside the current page. MMOS manages its lifecycle.
  // 'external': mode is a different page. MMOS redirects via window.location.href.
  type: 'internal',

  // EXTERNAL ONLY. The URL to redirect to.
  // Only used when type === 'external'. Ignored for internal modes.
  // The destination page owns its own MMOS instance and readiness gate.
  url: 'https://example.com/page',

  // OPTIONAL. Text shown in the loader overlay while init() runs.
  // Default: 'Loading <id>...'
  loaderLabel: 'Preparing flashcards...',

  // OPTIONAL. Async function called by MMOS.navigate() before the mode activates.
  // If present, MMOS shows the loader overlay, awaits this function, then
  // branches on the result. If absent, MMOS activates the mode synchronously.
  // See Section 4 for detailed rules.
  init: async function(opts) {
    // ... bootstrap logic ...
    return { status: 'ready' };
  },

  // OPTIONAL. Called after init() resolves successfully (or immediately if no init).
  // Use this to bind event listeners, start timers, wire DOM surfaces.
  // opts is the same object passed to MMOS.navigate(id, opts).
  onEnter: function(opts) {
    // ... activate mode ...
  },

  // OPTIONAL. Called when MMOS is about to leave this mode (navigate away).
  // Use this to unbind listeners, clear intervals, detach video, save state.
  // MUST be idempotent (safe to call multiple times).
  onExit: function() {
    // ... teardown ...
  }

  // ---------------------------------------------------------------
  // HOOKS NOT YET IN MMOS-004 (reserved for future versions):
  // beforeInit: function(opts) {}  -- pre-init gate (not implemented)
  // afterInit: function(result) {} -- post-init hook (not implemented)
  // These are documented here for forward compatibility.
  // Do NOT define them on a mode today; they will be silently ignored.
  // ---------------------------------------------------------------
});
```

External mode registration is minimal:

```javascript
window.MMOS.registerMode({
  id: 'lobby',
  type: 'external',
  url: 'https://missionmedinstitute.com/arena'
});
```

---

## 4. INIT FUNCTION RULES

### What init MUST do

1. Return a Promise (use `async function` or return a Promise explicitly).
2. Resolve with `{ status: 'ready' }` on success. Additional properties (e.g., `{ status: 'ready', initialScene: 'entry' }`) are allowed and passed through to onEnter via opts.
3. On failure, EITHER reject with an Error whose `.message` is a student-safe sentence, OR resolve with `{ status: 'error', message: 'Student-safe explanation' }`. Both paths produce the same MMOS error overlay behavior.
4. Be safe to call more than once (retry scenario). If MMOS calls init a second time after a prior failure, init must not assume clean state. Call teardown internally as a first step if needed.
5. Complete in a reasonable time. There is no built-in timeout in mmos-004, but the loader overlay is visible to the student the entire time init runs. Keep it under 5 seconds for UX.

### What init MUST NOT do

1. Never touch the MMOS loader or error overlays. MMOS shows/hides them.
2. Never set `body[data-mmos-scene]` or `body[data-mmos-status]`. MMOS owns those attributes.
3. Never call `MMOS.navigate()` from inside init. Navigation during init creates a reentrant loop.
4. Never start persistent timers or bind persistent event listeners. Those belong in onEnter. Init is for bootstrapping (fetching data, validating state, preparing DOM). Activation belongs in onEnter.
5. Never throw internal stack traces across the MMOS boundary. Catch errors and return student-safe messages.

### Allowed return shapes

```javascript
// Success (default if init returns nothing):
{ status: 'ready' }

// Success with extra context for onEnter:
{ status: 'ready', initialScene: 'entry', data: { ... } }

// Failure:
{ status: 'error', message: 'Unable to load flashcards. Please try again.' }

// Also valid failure (throw):
throw new Error('Unable to load flashcards. Please try again.');
```

### Error shape

MMOS extracts the message from either `result.message` or `err.message` and displays it in the error overlay. The message MUST be student-safe (no stack traces, no internal variable names, no technical jargon). The error overlay provides a Retry button (re-calls `MMOS.navigate(modeId, { retry: true })`) and a Back to Arena button (calls `MMOS.returnToArena()`).

---

## 5. STATE RULES

### Where state lives

| State type | Owner | Storage | Example |
|---|---|---|---|
| Cross-mode session flags | MMOS | sessionStorage | `mm.arena.entered` |
| Audio level (runtime + persistence) | MMOS | sessionStorage | `mmos.audio.level` (values: `low`, `med`, `high`) |
| Mode-internal persistent data | Mode | localStorage | `drill_state`, `vdrl_notes`, `mm_drill_best_streak` |
| Mode-internal runtime data | Mode | IIFE closure variables | Flow state, timer handles, scoring accumulators |
| Scene tracking | MMOS | `MMOS.state.currentScene` | `'drill'`, `'lobby'`, `'flashcards'` |
| Mode readiness status | MMOS | `MMOS.state.modeStatus` | `'loading'`, `'ready'`, `'error'` |

### How modes should read state

- Read MMOS state via `window.MMOS.state.*` (read-only from mode perspective).
- Read audio level via `sessionStorage.getItem('mmos.audio.level')` or subscribe to `mmos:audiochange`.
- Read mode-internal state from your own localStorage keys or closure variables.

### How modes should write state

- Never write to `MMOS.state.*` directly. Use MMOS APIs: `MMOS.setScene()`, `MMOS.navigate()`.
- Write audio level via `MMOS.audio.setLevel(level)`. Never write `mmos.audio.level` to sessionStorage directly.
- Write mode-internal state to your own namespaced localStorage keys.

### What NEVER goes in localStorage

- Session-scoped flags (`mm.arena.entered`). These are sessionStorage.
- Audio level (`mmos.audio.level`). This is sessionStorage, owned by MMOS.
- Anything that should not survive a browser restart. Use sessionStorage or in-memory state.
- Secrets, tokens, or PII. Never store these client-side.

---

## 6. EVENT CONTRACT

### Events MMOS emits (mode can listen)

All events are dispatched both on the internal MMOS event bus (`MMOS.on(evt, cb)`) and as `CustomEvent` on `document` with the prefix `mmos:` (e.g., `document.addEventListener('mmos:scene', cb)`).

| Event name | Bus form | DOM form | Payload | When fired |
|---|---|---|---|---|
| `scene` | `MMOS.on('scene', cb)` | `mmos:scene` | `{ scene, prev }` | After navigate completes OR after setScene |
| `fullscreenchange` | `MMOS.on('fullscreenchange', cb)` | `mmos:fullscreenchange` | `{ active: boolean }` | After fullscreen state changes |
| `audiochange` | `MMOS.on('audiochange', cb)` | `mmos:audiochange` | `{ level: 'low'|'med'|'high' }` | After audio level changes |
| `mode:loading` | `MMOS.on('mode:loading', cb)` | `mmos:mode:loading` | `{ scene }` | When navigate starts init for an internal mode |
| `mode:ready` | `MMOS.on('mode:ready', cb)` | `mmos:mode:ready` | `{ scene }` | When init resolves successfully |
| `mode:error` | `MMOS.on('mode:error', cb)` | `mmos:mode:error` | `{ scene, message }` | When init fails |

### Intended subscription order

1. Register mode via `registerMode()`.
2. Subscribe to events in `onEnter()`, not in `init()`.
3. Unsubscribe in `onExit()`.

### Off-limits events (modes MUST NOT emit these)

Modes must never call `MMOS.emit()` directly. The event bus is MMOS-internal. Modes interact with MMOS exclusively through its public API methods (`navigate`, `setScene`, `returnToArena`, `fullscreen.*`, `audio.*`). These methods emit the appropriate events internally.

---

## 7. FULLSCREEN RULES

Always use the MMOS fullscreen API. The MMOS topbar provides the sole user-facing fullscreen button (`#mmosFsBtn`).

```javascript
// Enter fullscreen
MMOS.fullscreen.enter();

// Exit fullscreen
MMOS.fullscreen.exit();

// Toggle
MMOS.fullscreen.toggle();

// Check state
MMOS.fullscreen.isActive();
```

### Absolute prohibitions

- Never call `element.requestFullscreen()` directly.
- Never call `document.exitFullscreen()` directly.
- Never create your own fullscreen button. The MMOS topbar button is the only user-facing fullscreen control.
- Never auto-enter fullscreen on mode init or navigate. Fullscreen is always user-initiated via the MMOS topbar button.

### Listening for fullscreen changes

```javascript
document.addEventListener('mmos:fullscreenchange', function(ev) {
  var active = ev.detail.active;
  // React to fullscreen state change
});
```

---

## 8. RETURN-TO-LOBBY RULES

There is one canonical exit path: `MMOS.returnToArena()`.

This is a shortcut for `MMOS.navigate('lobby')`. The `lobby` mode must be registered as an external mode pointing to the Arena URL.

### Rules

1. Every host page that registers internal modes MUST also register `lobby` as an external mode:
   ```javascript
   MMOS.registerMode({ id: 'lobby', type: 'external', url: ARENA_URL });
   ```
2. All "back to arena" or "return home" buttons must call `MMOS.returnToArena()` or route through a centralized navigation shim that calls it (e.g., `routeViaMMOS('lobby')`).
3. No raw `window.location.href = ARENA_URL` writes anywhere outside the MMOS core. The only surviving raw navigation assignment in the entire file is inside MMOS core's `navigate()` function for external modes.
4. When `MMOS.navigate()` is called to leave an internal mode, MMOS calls the current mode's `onExit()` first, then redirects. The mode does not need to manage the redirect itself.
5. For modes that distinguish between "exit to parent" and "exit to lobby" (e.g., drills exits to daily-rounds, not lobby), register the parent as a separate external mode and route exit buttons to `MMOS.navigate('parent-mode-id')`.

---

## 9. FORBIDDEN PATTERNS (HARD)

These patterns are banned in any mode code. Violations are caught by structural regression tests and block deployment.

| Pattern | Why it is banned |
|---|---|
| `history.back()` | Creates unpredictable navigation. MMOS owns all navigation via registered modes. |
| `new MutationObserver(...)` inside MMOS block | MMOS is event-driven. MutationObservers inside MMOS create hidden coupling. (Mode-internal MutationObservers inside the mode's own IIFE are allowed but must be disconnected in onExit.) |
| `setInterval(...)` inside MMOS block | MMOS does not poll. All state changes are event-driven. (Mode-internal intervals are allowed but must be cleared in onExit.) |
| DOM click simulation (`element.click()`, `dispatchEvent(new MouseEvent(...))`) | Creates untraceable side effects. Use direct function calls or MMOS API methods. |
| `window.MMUX` or any reference to MMUX | MMUX is a deprecated parallel nav system. It was removed. Any reference reintroduces it. |
| `window.location.href = ...` outside MMOS core | All navigation goes through `MMOS.navigate()` or `MMOS.returnToArena()`. |
| `location.assign()`, `location.replace()` | Same as above. MMOS owns all page-level navigation. |
| Direct `element.requestFullscreen()` or `document.exitFullscreen()` | Use `MMOS.fullscreen.*` exclusively. |
| `MMOS.emit(...)` from mode code | The event bus is MMOS-internal. Modes use API methods that emit events as a side effect. |
| Writing to `MMOS.state.*` directly | Use MMOS API methods (`setScene`, `navigate`). |

---

## 10. MINIMUM VIABLE MODE EXAMPLE

A complete, copy-pasteable example for a fictional "Flashcards" mode. This registers the mode and provides all required lifecycle hooks. Place this in a `<script>` block after the MMOS core script.

```javascript
(function() {
  'use strict';
  if (!window.MMOS) return;

  var ARENA_URL = 'https://missionmedinstitute.com/arena';
  var state = { deck: null, ready: false };

  window.MMOS.registerMode({
    id: 'flashcards',
    type: 'internal',
    loaderLabel: 'Shuffling the deck...',

    init: async function(opts) {
      try {
        var res = await fetch('/api/flashcards/deck');
        if (!res.ok) throw new Error('Could not load deck');
        state.deck = await res.json();
        state.ready = true;
        return { status: 'ready' };
      } catch (err) {
        return { status: 'error', message: err.message };
      }
    },

    onEnter: function(opts) {
      document.getElementById('fc-root').classList.add('visible');
      // bind listeners, start session
    },

    onExit: function() {
      document.getElementById('fc-root').classList.remove('visible');
      state.deck = null;
      state.ready = false;
      // clear intervals, unbind listeners
    }
  });

  window.MMOS.registerMode({ id: 'lobby', type: 'external', url: ARENA_URL });
  window.MMOS.init();
  window.MMOS.navigate('flashcards');
})();
```

That is 30 lines of glue code. The mode's internal DOM, styles, and business logic live elsewhere in the file. This block is purely the MMOS integration contract.

---

## 11. FAILURE MODES + DEBUGGING

### What goes wrong most often

| Failure | Symptom | Fix |
|---|---|---|
| Mode not registered before navigate | Console: `[MMOS] unknown mode <id>`. Loader never appears. | Ensure `registerMode()` is called before `MMOS.navigate()`. Check script execution order. |
| init() never resolves | Loader overlay stays visible indefinitely. | Add a timeout or catch inside init. Check network requests in DevTools Network tab. Console: look for unhandled promise rejections. |
| init() throws without a student-safe message | Error overlay shows raw JS error text (e.g., `TypeError: Cannot read...`). | Wrap init body in try/catch. Return `{ status: 'error', message: '...' }` with a human-readable string. |
| onExit not idempotent | Console errors on second teardown call. Orphaned intervals or video elements. | Guard every cleanup action: `if (handle) { clearInterval(handle); handle = null; }`. |
| Mode writes to `body[data-mmos-scene]` directly | Scene attribute and `MMOS.state.currentScene` diverge. Overlays and CSS selectors break. | Use `MMOS.setScene()` exclusively. |
| Raw `location.href` redirect bypasses onExit | Intervals, observers, and video elements survive the redirect. Memory leak on the destination page (browser-dependent). | Route all navigation through `MMOS.navigate()` or `MMOS.returnToArena()`. |
| Fullscreen called directly | Two fullscreen state trackers diverge. MMOS topbar button shows wrong label. `mmos:fullscreenchange` never fires. | Use `MMOS.fullscreen.*` exclusively. |
| MMOS.emit called from mode | Fake events confuse other modes or MMOS internals. | Never call `MMOS.emit()`. Use API methods. |

### Browser console recipes

```javascript
// Check current scene and mode status
console.log(MMOS.state);

// List all registered modes
// (requires access to MMOS internals; use this debug snippet)
// In mmos-004, modes are in the _modes closure. Inspect via:
console.log(document.body.getAttribute('data-mmos-scene'));
console.log(document.body.getAttribute('data-mmos-status'));

// Check if loader or error overlay is active
console.log(document.getElementById('mmosLoader')?.getAttribute('data-active'));
console.log(document.getElementById('mmosError')?.getAttribute('data-active'));

// Check fullscreen state
console.log(MMOS.fullscreen.isActive());

// Check audio level
console.log(sessionStorage.getItem('mmos.audio.level'));

// Force-retry a mode init
MMOS.navigate('my-mode', { retry: true });

// Force return to arena
MMOS.returnToArena();
```

---

## 12. CHECKLIST FOR ADDING A NEW MODE

Follow this numbered list when plugging in a new mode. Every item must be verified before the mode is considered integrated.

1. `registerMode()` call added with `id`, `type`, and all applicable lifecycle hooks (`init`, `onEnter`, `onExit`).
2. `lobby` registered as an external mode (if not already present on this page).
3. `MMOS.init()` called after all `registerMode()` calls.
4. `MMOS.navigate('my-mode')` called after `MMOS.init()`.
5. `init()` handles both success (`{ status: 'ready' }`) and failure (`{ status: 'error', message }` or thrown Error with student-safe message).
6. `init()` is safe to call twice (retry path). Calls teardown internally if needed.
7. `onEnter()` binds all event listeners, starts timers, and activates DOM surfaces.
8. `onExit()` unbinds all listeners, clears all intervals, detaches video/media, saves state. Is idempotent.
9. No forbidden patterns present (grep for: `history.back`, `MMUX`, `setInterval` in MMOS block, `new MutationObserver` in MMOS block, `.click()` simulation, `location.href =` outside MMOS core, `requestFullscreen`, `exitFullscreen`, `MMOS.emit`).
10. All navigation goes through `MMOS.navigate()` or `MMOS.returnToArena()`. Zero raw redirects in mode code.
11. All fullscreen operations go through `MMOS.fullscreen.*`. Zero direct Fullscreen API calls.
12. Audio level reads/writes go through `MMOS.audio.*` or `mmos:audiochange` subscription. No direct sessionStorage writes to `mmos.audio.level`.
13. Structural integrity check passes: MMOS core script block is byte-identical to the canonical version (compare against arena_v1.html MMOS core).
14. `node --check` passes on extracted MMOS core script and mode IIFE script.
15. No em-dashes (U+2014) introduced.
16. No AI cliche tells introduced.
17. Runtime stress pass clean: fresh page load, mode init, mode run, mode exit, return to lobby, retry from error overlay. All paths complete without console errors.

---

## END OF DOCUMENT
