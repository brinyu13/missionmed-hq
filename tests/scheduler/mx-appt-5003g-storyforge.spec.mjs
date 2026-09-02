import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { JSDOM, VirtualConsole } from "jsdom";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const bundlePath = path.join(root, "LIVE/scheduler/scheduler_v1.html");
const adapterPath = path.join(root, "wp-content/plugins/missionmed-hub/assets/scheduler-mount.js");
const bundle = fs.readFileSync(bundlePath, "utf8");
const adapter = fs.readFileSync(adapterPath, "utf8");

function response(payload, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => payload
  };
}

function waitFor(predicate, label, timeout = 2500) {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    function poll() {
      if (predicate()) return resolve();
      if (Date.now() - started > timeout) return reject(new Error("Timed out: " + label));
      setTimeout(poll, 10);
    }
    poll();
  });
}

function isoSlot(hoursAhead) {
  const start = new Date(Date.now() + hoursAhead * 60 * 60 * 1000);
  start.setUTCMinutes(0, 0, 0);
  const end = new Date(start.getTime() + 30 * 60 * 1000);
  return { start_at: start.toISOString(), end_at: end.toISOString() };
}

function fixture() {
  const open = isoSlot(2);
  return {
    calls: [],
    types: [
      {
        id: "eligible-type",
        slug: "consult-non-member",
        name: "Admissions consultation",
        description: "Plan the next application step.",
        duration_minutes: 30,
        division: "non-member",
        entitlement: { status: "eligible", locked: false }
      },
      {
        id: "missing-rule",
        slug: "dr-brian-strategy",
        name: "Dr. Brian Strategy Call",
        description: "Requires a configured entitlement rule.",
        duration_minutes: 45,
        division: null,
        entitlement: { status: "rule_missing", locked: false, message: "Not configured for booking." }
      }
    ],
    provider: { id: "provider-1", display_name: "MissionMed Mentor" },
    slot: {
      ...open,
      provider_id: "provider-1",
      appointment_type_id: "eligible-type",
      available: true
    },
    upcoming: {
      id: "appt-1",
      appointment_type_id: "eligible-type",
      provider_id: "provider-1",
      appointment_type_name: "Admissions consultation",
      provider_name: "MissionMed Mentor",
      start_at: open.start_at,
      meeting_url: "https://meet.example.invalid/authorized",
      status: "booked"
    },
    history: {
      id: "appt-history",
      appointment_type_name: "Mock interview",
      provider_name: "MissionMed Mentor",
      start_at: new Date(Date.now() - 86400000).toISOString(),
      status: "completed"
    }
  };
}

function bootDom(data) {
  const virtualConsole = new VirtualConsole();
  const errors = [];
  virtualConsole.on("jsdomError", error => errors.push(String(error && error.message || error)));
  virtualConsole.on("error", (...args) => errors.push(args.join(" ")));

  const dom = new JSDOM(bundle, {
    url: "https://candidate.example.invalid/#home",
    runScripts: "dangerously",
    pretendToBeVisual: true,
    virtualConsole,
    beforeParse(window) {
      window.matchMedia = () => ({ matches: false, addListener() {}, removeListener() {} });
      window.confirm = () => false;
      window.fetch = async (input, init = {}) => {
        const url = String(input);
        const parsed = new URL(url, window.location.href);
        data.calls.push({ path: parsed.pathname + parsed.search, method: init.method || "GET", body: init.body || "" });
        if (parsed.pathname === "/api/auth/session") {
          return response({
            authenticated: true,
            csrfToken: "test-csrf",
            accessToken: "test-access",
            user: { id: "student-1", displayName: "Avery Student", roles: ["student"] }
          });
        }
        if (parsed.pathname.endsWith("/bootstrap")) {
          return response({
            ok: true,
            data: {
              status: "ready",
              user: { id: "student-1", display_name: "Avery Student", roles: ["student"] },
              config: { entitlements: { available_divisions: ["non-member"] } },
              features: { can_book: true, can_reschedule: true, can_cancel: true }
            }
          });
        }
        if (parsed.pathname.endsWith("/appointment-types")) {
          return response({ ok: true, data: { types: data.types, entitlements: { available_divisions: ["non-member"] } } });
        }
        if (parsed.pathname.endsWith("/providers")) {
          return response({ ok: true, data: { providers: [data.provider] } });
        }
        if (parsed.pathname.endsWith("/availability")) {
          return response({ ok: true, data: { slots: [data.slot] } });
        }
        if (parsed.pathname.endsWith("/my-appointments")) {
          return response({ ok: true, data: { appointments: [data.upcoming] } });
        }
        if (parsed.pathname.endsWith("/my-appointment-history")) {
          return response({ ok: true, data: { appointments: [data.history] } });
        }
        if (parsed.pathname.endsWith("/book")) {
          return response({ ok: true, data: { appointment: data.upcoming, integrations: { meeting: {} } } });
        }
        if (parsed.pathname.endsWith("/reschedule")) {
          return response({ ok: true, data: { appointment: data.upcoming } });
        }
        if (parsed.pathname.endsWith("/cancel")) {
          return response({ ok: true, data: { appointment: { ...data.upcoming, status: "cancelled" } } });
        }
        return response({ ok: false, error: "not_found", message: "Test route missing" }, 404);
      };
      if (window.HTMLDialogElement) {
        window.HTMLDialogElement.prototype.showModal = function () {
          this.open = true;
          this.setAttribute("open", "");
        };
        window.HTMLDialogElement.prototype.close = function () {
          this.open = false;
          this.removeAttribute("open");
          this.dispatchEvent(new window.Event("close"));
        };
      }
    }
  });
  return { dom, errors };
}

test("MX-APPT-5003G source and production-safety contract", () => {
  const checks = [
    ["source revision", /MMED_SCHEDULER_SOURCE_REV = "MX-APPT-5003G"/],
    ["StoryForge installer", /function installStoryForgeExperience\(\)/],
    ["one Scheduler state", /var classicPage = scheduler\.render\.page/],
    ["one Scheduler API", /scheduler\.api\.get\("\/appointment-types"\)/],
    ["real providers", /scheduler\.api\.get\("\/providers\?"/],
    ["real availability", /scheduler\.api\.get\("\/availability\?"/],
    ["real booking", /scheduler\.api\.post\("\/book"/],
    ["real reschedule", /scheduler\.api\.post\("\/reschedule"/],
    ["real cancel", /scheduler\.api\.post\("\/cancel"/],
    ["real upcoming", /scheduler\.api\.get\("\/my-appointments"\)/],
    ["real history", /scheduler\.api\.get\("\/my-appointment-history"\)/],
    ["no localStorage", /\blocalStorage\s*\./],
    ["no sessionStorage", /\bsessionStorage\s*\./],
    ["no synthetic Webex", /webex\.com\/meet/],
    ["no Maya fixture", /Maya Student/],
    ["no simulate control", />Simulate</],
    ["no reset demo", />Reset demo</],
    ["no fake progress timer", /setInterval\(function \(\) \{\s*scheduler\.state\.loadingProgress/],
    ["Eastern timezone", /America\/New_York/],
    ["combobox", /role="combobox"/],
    ["listbox", /role="listbox"/],
    ["options", /role="option"/],
    ["ArrowDown", /event\.key === "ArrowDown"/],
    ["ArrowUp", /event\.key === "ArrowUp"/],
    ["Home", /event\.key === "Home"/],
    ["End", /event\.key === "End"/],
    ["Enter", /event\.key === "Enter"/],
    ["Escape", /event\.key === "Escape"/],
    ["Tab", /event\.key === "Tab"/],
    ["visible focus", /:focus-visible/],
    ["dialog", /<dialog class="sf-dialog"/],
    ["dialog keep default", /data-sf-dialog-action="keep" autofocus/],
    ["offline truth", /window\.addEventListener\("offline"/],
    ["online recovery", /window\.addEventListener\("online"/],
    ["network timeout", /request_timeout/],
    ["bounded timeout", /10000/],
    ["one retry", /return attempt\(1\)/],
    ["idempotency book", /student-" \+ Date\.now/],
    ["idempotency reschedule", /student-reschedule-/],
    ["idempotency cancel", /student-cancel-/],
    ["rule missing fail closed", /status === "rule_missing"/],
    ["null division fail closed", /if \(!type \|\| !type\.division\) return true/],
    ["meeting link conditional", /meetingUrl \?/],
    ["no meeting synthesis", /Details after confirmation/],
    ["shared state switch", /scheduler\.state\.experience = "classic"/],
    ["Classic return switch", /scheduler\.state\.experience = "storyforge"/],
    ["honest preference gap", /No localStorage or browser-only preference has been substituted/],
    ["Home route", /\["home", "Home"\]/],
    ["Book route", /\["book", "Book"\]/],
    ["Upcoming route", /\["upcoming", "Upcoming"\]/],
    ["History route", /\["history", "History"\]/],
    ["Settings route", /\["settings", "Settings"\]/],
    ["duration", /function storyDuration/],
    ["morning greeting", /Good " \+ period/],
    ["next appointment", /Next appointment/],
    ["also upcoming", /Also upcoming/],
    ["recent history", /Recent history/],
    ["three steps", /var labels = \["Details", "Time", "Confirm"\]/],
    ["day picker", /class="sf-days"/],
    ["time groups", /\["Morning"/],
    ["review", /Review and confirm/],
    ["conflict keeps original", /original time stays booked until you confirm/],
    ["error distinct", /scheduler\.state\.upcomingError/],
    ["loading distinct", /scheduler\.state\.availabilityLoading/],
    ["empty distinct", /No openings this day/],
    ["unavailable distinct", /Not configured/],
    ["responsive tablet", /@media \(max-width: 900px\)/],
    ["responsive mobile", /@media \(max-width: 640px\)/],
    ["reduced motion", /prefers-reduced-motion: reduce/],
    ["min target", /min-height: 44px/],
    ["no StoryForge parallax", /data-sf-action="parallax"/],
    ["known adapter profile", /SCHEDULER_PATCH_PROFILES\["MX-APPT-5003G"\]/]
  ];
  let count = 0;
  for (const [label, pattern] of checks) {
    const text = label === "known adapter profile" ? adapter : bundle;
    const matched = pattern.test(text);
    const prohibited = ["no localStorage", "no sessionStorage", "no synthetic Webex", "no Maya fixture", "no simulate control", "no reset demo", "no fake progress timer", "no StoryForge parallax"].includes(label);
    assert.equal(prohibited ? !matched : matched, true, label);
    count += 1;
  }
  assert.ok(count >= 71, "at least 71 explicit source checks");
});

test("MX-APPT-5003G shared-state interaction contract", async () => {
  const data = fixture();
  const { dom, errors } = bootDom(data);
  const { window } = dom;
  await waitFor(() => window.MMEDScheduler && window.MMEDScheduler.state.loading === false &&
    window.MMEDScheduler.state.catalogLoading === false &&
    window.document.querySelector(".sf-app h1"), "Scheduler bootstrap and StoryForge Home");

  const scheduler = window.MMEDScheduler;
  const document = window.document;
  assert.equal(scheduler.state.experience, "storyforge");
  assert.equal(scheduler.state.route, "home");
  assert.match(document.querySelector("h1").textContent, /Good (morning|afternoon|evening), Avery/);
  document.querySelector("#sf-discovery-input").focus();
  await waitFor(() => document.querySelectorAll('[role="option"]').length === 2, "browse discovery");
  assert.equal(document.querySelectorAll('[role="option"]').length, 2);
  document.querySelector("#sf-discovery-input").dispatchEvent(new window.KeyboardEvent("keydown", {
    key: "Escape",
    bubbles: true
  }));
  assert.equal(document.querySelector("#sf-discovery-input").getAttribute("aria-expanded"), "false");
  document.querySelector("#sf-discovery-input").click();
  await waitFor(() => document.querySelectorAll('[role="option"]').length === 2, "reopen discovery");
  assert.match(document.body.textContent, /30 min/);
  assert.match(document.body.textContent, /45 min/);
  assert.match(document.body.textContent, /Not configured/);
  assert.match(document.body.textContent, /Also upcoming/);
  assert.match(document.body.textContent, /Recent history/);
  assert.equal(document.querySelectorAll('a[href="https://meet.example.invalid/authorized"]').length >= 1, true);

  const missing = document.querySelector('[data-type-id="missing-rule"]');
  assert.equal(missing.getAttribute("aria-disabled"), "true");
  missing.click();
  assert.equal(scheduler.state.route, "home");
  assert.equal(scheduler.state.appointmentTypeId, "");
  assert.equal(scheduler.state.noticeError, true);

  const input = document.querySelector("#sf-discovery-input");
  input.value = "admissions";
  input.dispatchEvent(new window.Event("input", { bubbles: true }));
  await waitFor(() => document.querySelectorAll('[role="option"]').length === 1, "filtered discovery");
  assert.equal(document.querySelector('[role="option"]').getAttribute("data-type-id"), "eligible-type");
  document.querySelector('[role="option"]').click();
  await waitFor(() => scheduler.state.route === "book" && scheduler.state.providers.length === 1, "prefilled Book flow");
  assert.equal(scheduler.state.division, "non-member");
  assert.equal(scheduler.state.appointmentTypeId, "eligible-type");
  assert.equal(document.querySelector('[data-sf-action="provider"]') !== null, true);

  document.querySelector('[data-sf-action="provider"]').click();
  const continueButton = document.querySelector('[data-sf-action="next-step"]');
  assert.equal(continueButton.disabled, false);
  continueButton.click();
  await waitFor(() => scheduler.state.bookingStep === 2 && scheduler.state.availabilityLoading === false, "live availability");
  assert.equal(data.calls.some(call => call.path.includes("/api/scheduler/availability?")), true);
  assert.equal(document.querySelectorAll('[data-sf-action="slot"]').length, 1,
    JSON.stringify({
      date: scheduler.state.date,
      selectedDay: scheduler.state.selectedDay,
      slots: scheduler.state.slots,
      text: document.body.textContent.replace(/\s+/g, " ").slice(-500),
      errors
    }));

  document.querySelector('[data-sf-action="slot"]').click();
  document.querySelector('[data-sf-action="next-step"]').click();
  assert.equal(scheduler.state.bookingStep, 3);
  assert.match(document.body.textContent, /Review and confirm/);
  const stateIdentity = scheduler.state;
  const selectedType = scheduler.state.appointmentTypeId;
  const selectedProvider = scheduler.state.providerId;
  document.querySelector('[data-sf-action="experience"][data-value="classic"]').click();
  assert.equal(scheduler.state, stateIdentity);
  assert.equal(scheduler.state.experience, "classic");
  assert.equal(scheduler.state.appointmentTypeId, selectedType);
  assert.equal(scheduler.state.providerId, selectedProvider);
  assert.equal(document.querySelector('[data-classic-action="storyforge"]') !== null, true);
  document.querySelector('[data-classic-action="storyforge"]').click();
  assert.equal(scheduler.state, stateIdentity);
  assert.equal(scheduler.state.experience, "storyforge");

  scheduler.router.go("upcoming");
  await waitFor(() => scheduler.state.route === "upcoming" &&
    document.querySelector('[data-sf-action="reschedule"]'), "Upcoming actions");
  assert.equal(document.querySelector('[data-sf-action="reschedule"]') !== null, true);
  assert.equal(document.querySelector('[data-sf-action="cancel"]') !== null, true);
  document.querySelector('[data-sf-action="cancel"]').click();
  const dialog = document.querySelector("[data-sf-dialog]");
  assert.equal(dialog.open, true);
  assert.equal(dialog.querySelector("[autofocus]").getAttribute("data-sf-dialog-action"), "keep");
  dialog.querySelector('[data-sf-dialog-action="keep"]').click();
  assert.equal(dialog.open, false);
  assert.equal(data.calls.some(call => call.path.endsWith("/cancel") && call.method === "POST"), false);

  scheduler.state.boot.features.can_cancel = false;
  scheduler.state.boot.features.can_reschedule = false;
  scheduler.render.page("upcoming");
  assert.equal(document.querySelector('[data-sf-action="reschedule"]'), null);
  assert.equal(document.querySelector('[data-sf-action="cancel"]'), null);
  assert.equal(document.querySelector('a[href="https://meet.example.invalid/authorized"]') !== null, true);

  assert.equal(errors.length, 0, errors.join("\n"));
  dom.window.close();
});
