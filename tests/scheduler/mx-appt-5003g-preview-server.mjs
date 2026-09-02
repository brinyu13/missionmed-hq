import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const html = fs.readFileSync(path.join(root, "LIVE/scheduler/scheduler_v1.html"));
const port = Number(process.env.MX_APPT_PREVIEW_PORT || 8765);
const start = new Date(Date.now() + 2 * 60 * 60 * 1000);
start.setUTCMinutes(0, 0, 0);
const end = new Date(start.getTime() + 30 * 60 * 1000);
const previous = new Date(Date.now() - 3 * 86400000);

const type = {
  id: "candidate-consult",
  slug: "consult-non-member",
  name: "Admissions consultation",
  description: "Plan your next application step with a MissionMed mentor.",
  duration_minutes: 30,
  division: "non-member",
  entitlement: { status: "eligible", locked: false },
  student_config: { web_meetings: { provider: "webex" } }
};
const unavailable = {
  id: "candidate-rule-missing",
  slug: "dr-brian-strategy",
  name: "Dr. Brian Strategy Call",
  description: "This option is awaiting a confirmed entitlement rule.",
  duration_minutes: 45,
  division: null,
  entitlement: { status: "rule_missing", locked: false, message: "Not configured for booking." }
};
const provider = { id: "candidate-provider", display_name: "MissionMed Mentor", role: "Physician mentor" };
const appointment = {
  id: "candidate-appointment",
  appointment_type_id: type.id,
  provider_id: provider.id,
  appointment_type_name: type.name,
  provider_name: provider.display_name,
  start_at: start.toISOString(),
  status: "booked"
};

function send(response, payload, status = 200) {
  const body = Buffer.from(JSON.stringify(payload));
  response.writeHead(status, {
    "Content-Type": "application/json",
    "Content-Length": body.length,
    "Cache-Control": "no-store"
  });
  response.end(body);
}

const server = http.createServer((request, response) => {
  const url = new URL(request.url || "/", "http://127.0.0.1");
  if (url.pathname === "/" || url.pathname === "/scheduler_v1.html") {
    response.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
    response.end(html);
    return;
  }
  if (url.pathname === "/favicon.ico") {
    response.writeHead(204, { "Cache-Control": "no-store" });
    response.end();
    return;
  }
  if (url.pathname === "/api/auth/session") {
    send(response, {
      authenticated: true,
      csrfToken: "candidate-only",
      accessToken: "candidate-only",
      user: { id: "candidate-student", displayName: "Avery Student", roles: ["student"] }
    });
    return;
  }
  if (url.pathname === "/api/scheduler/bootstrap") {
    send(response, {
      ok: true,
      data: {
        status: "ready",
        user: { id: "candidate-student", display_name: "Avery Student", roles: ["student"] },
        config: { entitlements: { available_divisions: ["non-member"] } },
        features: { can_book: true, can_reschedule: true, can_cancel: true }
      }
    });
    return;
  }
  if (url.pathname === "/api/scheduler/appointment-types") {
    send(response, { ok: true, data: { types: [type, unavailable], entitlements: { available_divisions: ["non-member"] } } });
    return;
  }
  if (url.pathname === "/api/scheduler/providers") {
    send(response, { ok: true, data: { providers: [provider] } });
    return;
  }
  if (url.pathname === "/api/scheduler/availability") {
    send(response, {
      ok: true,
      data: { slots: [{ start_at: start.toISOString(), end_at: end.toISOString(), provider_id: provider.id, appointment_type_id: type.id, available: true }] }
    });
    return;
  }
  if (url.pathname === "/api/scheduler/my-appointments") {
    send(response, { ok: true, data: { appointments: [appointment] } });
    return;
  }
  if (url.pathname === "/api/scheduler/my-appointment-history") {
    send(response, {
      ok: true,
      data: { appointments: [{ ...appointment, id: "candidate-history", start_at: previous.toISOString(), status: "completed" }] }
    });
    return;
  }
  send(response, { ok: false, error: "candidate_read_only", message: "Candidate preview does not perform mutations." }, 405);
});

server.listen(port, "127.0.0.1", () => {
  process.stdout.write("MX-APPT-5003G candidate preview http://127.0.0.1:" + port + "/\n");
});
