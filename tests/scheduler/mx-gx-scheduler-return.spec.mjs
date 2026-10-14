import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { JSDOM, VirtualConsole } from "jsdom";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const bundle = fs.readFileSync(path.join(root, "LIVE/scheduler/scheduler_v1.html"), "utf8");
const matrixUrl = "https://missionmedinstitute.com/member-dashboard/#dashboard";

function response(payload, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => payload };
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

function bootDom() {
  const virtualConsole = new VirtualConsole();
  const errors = [];
  virtualConsole.on("jsdomError", error => errors.push(String(error && error.message || error)));
  const confirms = [];
  let confirmResult = false;
  const dom = new JSDOM(bundle, {
    url: "https://candidate.example.invalid/#home",
    runScripts: "dangerously",
    pretendToBeVisual: true,
    virtualConsole,
    beforeParse(window) {
      window.matchMedia = () => ({ matches: false, addListener() {}, removeListener() {} });
      window.confirm = message => {
        confirms.push(message);
        return confirmResult;
      };
      window.mmedStudentOsFeatureFlags = { feature_flags: { appointments_force_classic: false } };
      window.MMED_OS = {
        api: {
          get: async endpoint => {
            if (endpoint === "/me/appointments-experience") {
              return { preference: "storyforge", effective_experience: "storyforge", forced: false };
            }
            throw new Error("Unexpected Matrix route: " + endpoint);
          },
          post: async () => ({ preference: "storyforge", effective_experience: "storyforge", forced: false })
        }
      };
      window.fetch = async input => {
        const pathname = new URL(String(input), window.location.href).pathname;
        if (pathname === "/api/auth/session") {
          return response({
            authenticated: true,
            csrfToken: "test-csrf",
            accessToken: "test-access",
            user: { id: "student-1", displayName: "Avery Student", roles: ["student"] }
          });
        }
        if (pathname.endsWith("/bootstrap")) {
          return response({ ok: true, data: {
            status: "ready",
            user: { id: "student-1", display_name: "Avery Student", roles: ["student"] },
            config: { entitlements: { available_divisions: ["non-member"] } },
            features: { can_book: true, can_reschedule: true, can_cancel: true }
          } });
        }
        if (pathname.endsWith("/appointment-types")) {
          return response({ ok: true, data: { types: [], entitlements: { available_divisions: ["non-member"] } } });
        }
        if (pathname.endsWith("/my-appointments") || pathname.endsWith("/my-appointment-history")) {
          return response({ ok: true, data: { appointments: [] } });
        }
        return response({ ok: true, data: { providers: [], slots: [] } });
      };
    }
  });
  return {
    dom,
    errors,
    confirms,
    setConfirmResult(value) { confirmResult = value; }
  };
}

function clickWithoutNavigating(window, link) {
  let appPrevented = null;
  link.addEventListener("click", event => {
    appPrevented = event.defaultPrevented;
    event.preventDefault();
  }, { once: true });
  link.dispatchEvent(new window.MouseEvent("click", { bubbles: true, cancelable: true }));
  return appPrevented;
}

test("DR-427 exposes a visible, exact Return to Matrix contract on desktop and mobile", () => {
  assert.match(bundle, /var MATRIX_DASHBOARD_URL = "https:\/\/missionmedinstitute\.com\/member-dashboard\/#dashboard"/);
  assert.match(bundle, /class="sf-back" data-matrix-return[^>]*><b aria-hidden="true">←<\/b><span>Return to Matrix<\/span>/);
  assert.doesNotMatch(bundle, /class="sf-back" href="#dashboard"/);
  assert.doesNotMatch(bundle, /\.sf-back span\{display:none\}/);
  assert.match(bundle, /@media\(max-width:640px\)[\s\S]*?\.sf-back\{width:auto;min-width:0;justify-content:center;padding:0 9px;letter-spacing:\.08em;white-space:nowrap\}[\s\S]*?\.sf-back span\{display:inline\}/);
  assert.match(bundle, /#schedule-root \.sf-app :focus-visible\s*\{\s*outline: 3px solid var\(--sf-cyan\); outline-offset: 3px;\s*\}/);
});

test("DR-427 keeps draft state on canceled return and blocks in-flight mutations", async () => {
  const harness = bootDom();
  const { dom, errors, confirms } = harness;
  const { window } = dom;
  const document = window.document;
  await waitFor(() => window.MMEDScheduler &&
    window.MMEDScheduler.state.loading === false &&
    document.querySelector(".sf-back"), "StoryForge return control");

  const scheduler = window.MMEDScheduler;
  let link = document.querySelector(".sf-back");
  assert.equal(link.href, matrixUrl);
  assert.match(link.textContent, /Return to Matrix/);
  assert.equal(clickWithoutNavigating(window, link), false, "clean state navigates without an app warning");
  assert.equal(confirms.length, 0);

  scheduler.state.division = "non-member";
  scheduler.state.appointmentTypeId = "type-1";
  scheduler.state.providerId = "provider-1";
  scheduler.state.intake = "Keep this draft";
  const preserved = {
    division: scheduler.state.division,
    appointmentTypeId: scheduler.state.appointmentTypeId,
    providerId: scheduler.state.providerId,
    intake: scheduler.state.intake
  };
  link = document.querySelector(".sf-back");
  assert.equal(clickWithoutNavigating(window, link), true, "canceled warning stays in Appointments");
  assert.deepEqual({
    division: scheduler.state.division,
    appointmentTypeId: scheduler.state.appointmentTypeId,
    providerId: scheduler.state.providerId,
    intake: scheduler.state.intake
  }, preserved, "canceled warning preserves the draft");
  assert.equal(confirms.length, 1);
  assert.match(confirms[0], /unfinished appointment selections will not be saved/i);

  harness.setConfirmResult(true);
  link = document.querySelector(".sf-back");
  assert.equal(clickWithoutNavigating(window, link), false, "confirmed warning allows navigation");

  scheduler.state.appointmentMutationPending = true;
  const confirmCount = confirms.length;
  link = document.querySelector(".sf-back");
  assert.equal(clickWithoutNavigating(window, link), true, "in-flight cancellation blocks navigation");
  assert.equal(confirms.length, confirmCount, "in-flight mutation never offers an unsafe override");
  assert.deepEqual({
    division: scheduler.state.division,
    appointmentTypeId: scheduler.state.appointmentTypeId,
    providerId: scheduler.state.providerId,
    intake: scheduler.state.intake
  }, preserved, "in-flight guard preserves the draft");
  assert.equal(errors.length, 0, errors.join("\n"));
  dom.window.close();
});

test("DR-427 normalizes every existing StoryForge return control without adding a second header control", async () => {
  const harness = bootDom();
  const { dom, errors } = harness;
  const { window } = dom;
  const document = window.document;
  await waitFor(() => document.querySelector(".sf-back"), "StoryForge Home");
  assert.equal(document.querySelectorAll(".sf-hdr .sf-back").length, 1);
  assert.equal(document.querySelectorAll('[data-matrix-return][href="' + matrixUrl + '"]').length, 2);

  window.MMEDScheduler.router.go("settings");
  await waitFor(() => document.querySelector(".sf-setting-row [data-matrix-return]"), "StoryForge Settings");
  assert.equal(document.querySelectorAll(".sf-hdr .sf-back").length, 1);
  assert.equal(document.querySelectorAll('[data-matrix-return][href="' + matrixUrl + '"]').length, 3);
  assert.equal(errors.length, 0, errors.join("\n"));
  dom.window.close();
});
