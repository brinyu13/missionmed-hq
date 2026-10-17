# 401A Change Report: Reactive Timeline Demo Upgrade

**Ticket:** D1-TIMELINE-401A
**Date:** 2026-07-08
**Author:** Claude Opus 4.6


## Summary

Upgraded the app_demo_401 from a polished static app shell into a reactive timeline builder demo where user inputs visibly modify the timeline preview. All 11 requested features implemented. Zero console errors. No files touched outside app_demo_401/.


## Features Implemented

### 1. Save / Preview / Save-as-version CTAs
- Wizard: "Save draft" button in nav bar
- Editor toolbar: "Save draft" and "Save as new version" buttons
- Saves snapshot of events and wizard data to in-memory draft history
- Version chip in top bar updates on save (v1, v2, ...)

### 2. Calendar / month date pickers
- All date inputs use `<input type="month">` with native browser calendar picker
- Wizard steps 2-6: month pickers for start/end dates
- Inspector panel: month pickers for selected event start/end
- Direct-edit popover: month pickers

### 3. Media library drawer
- Right-side slide-in drawer via "Media" toolbar button
- Photo grid (3/4/5-photo layout selector)
- Program logo slot
- File upload via `<input type="file">` → `URL.createObjectURL()`
- Per-image remove buttons
- Local object URLs persist until page refresh

### 4. Direct timeline editing via double-click popover
- Double-click any board hotspot or overlay bar → popover appears at cursor
- Popover has: title input, start/end month pickers, visibility dropdown
- Apply saves changes; Cancel dismisses; outside-click dismisses

### 5. Draft version history with save, preview, restore
- Draft History panel (right-side slide-in, via nav footer or top bar chip)
- Lists all saved versions in reverse chronological order
- Active version highlighted with gold border
- "Restore" button per version → replaces current events + wizard data
- "Save as new version" button in panel
- Toast confirmation on save/restore

### 6. Breadcrumb navigation and clickable brand logo
- Top bar breadcrumb: "Dashboard / [Current Section]"
- "Dashboard" link navigates back to Dashboard
- Brand logo in nav rail ("MISSION RESIDENCY") clickable → Dashboard
- Section label updates on every navigation

### 7. Comprehensive country list (75 countries)
- `<datalist>` with 75 countries injected on init
- Used in wizard step 1 (Home country) and step 2 (Med school country)
- Native browser autocomplete/filtering via `list` attribute

### 8. Wizard inputs update board overlay preview in real time
- Every wizard field change triggers `updateWizardPreview()`
- Draft chip tray shows colored chips for each wizard-entered event
- Semi-transparent overlay bars appear on the board preview, positioned by computed date range
- Pulse ring animates at the position of the most recent entry

### 9. Dynamic year axis computed from event date ranges
- `computeYearRange()` scans all visible events for min/max year
- Year axis renders tick marks with labels (2014, 2015, ... 2024)
- Axis updates when events are added, removed, or dates change
- Used in both editor dynamic overlay and wizard preview

### 10. Draggable event bars that snap to month positions
- Overlay bars have left/right drag handles (resize)
- Full bar is draggable (reposition)
- `snapToMonth()` snaps to nearest month boundary during drag
- Drag updates event data in real time → event list and inspector reflect changes
- Undo stack captures state before each drag

### 11. Add-elements drawer
- Left-side drawer in editor, toggled via "+ Add" toolbar button
- Seven event type cards: Work Experience, Personal/Life, USMLE Step, USCE Hospital, USCE Clinic, Research, Milestone
- Each card has category color dot, label, description
- Click adds a new event with current month as dates, selects it, opens inspector
- Editor layout expands to 4-column grid when drawer is open


## Files Modified

| File | Lines | Change |
|------|-------|--------|
| index.html | ~300 → ~300 | Added: breadcrumb, CTA groups, dynamic overlay containers, media drawer, draft panel, add-elements drawer, direct-edit popover, country datalist reference |
| styles.css | 1715 → ~2050 | Added: breadcrumb, unsaved indicator, draft chip, CTA groups, dynamic overlay (year axis, bars, drag handles), media drawer, draft panel, add-elements drawer, direct-edit popover, editor 4-col layout |
| app.js | 1213 → ~1850 | Complete rewrite: enhanced data model with ISO dates, date utilities (parseYM, computeYearRange, monthToPercent, snapToMonth), draft system, dynamic overlay rendering, drag/drop, media library, add-elements, direct-edit popover, country datalist, wizard live preview |


## What's Still Mocked

- CV/ERAS parsing (staged animation, no real file processing)
- Export file creation (toast confirms mock)
- Persistence (in-memory only, resets on refresh)
- Login/auth (View-as dropdown)
- Advisor notifications/email
- Media uploads use local object URLs (no server upload)
- Snap-to-dates and auto-arrange are toast-only mocks


## Design Preservation

- All design tokens unchanged (--ink, --paper, --card, --hairline, --slate, --gold, --warn)
- Typography unchanged (Fraunces, Inter, Special Elite)
- Gold restraint rule maintained: gold only for active nav bar, board selection outlines, Approve button, heading rules
- Category colors from 400g board preserved
- 400g board image used as hero preview on all screens
- Body/app height: 100vh with overflow: hidden (scroll bug fix preserved)


## Testing Notes

- Tested all 7 screens: Dashboard, Wizard, Editor, Upload, Advisor, Export, Story Lens
- Tested breadcrumb navigation (Dashboard link)
- Tested brand logo click → Dashboard
- Tested wizard live preview with date inputs
- Tested dynamic overlay toggle with year axis and event bars
- Tested draft save (v1→v2) and draft history panel
- Tested add-elements drawer toggle and layout shift
- Zero console errors across all screens
- All network requests: localhost + Google Fonts only
