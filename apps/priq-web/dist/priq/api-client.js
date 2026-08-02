function authHeaders() {
  return { "content-type": "application/json" };
}

async function request(path, options = {}) {
  const response = await fetch(path, { ...options, headers: { ...authHeaders(), ...(options.headers || {}) } });
  const payload = await response.json().catch(() => ({ error: "INVALID_SERVER_RESPONSE" }));
  if (!response.ok) throw new Error(payload.error || `HTTP_${response.status}`);
  return payload;
}

export const api = {
  state: () => request("/api/ui-state"),
  audit: () => request("/api/control/audit"),
  flag: (key, value) => request("/api/control/flags", { method: "PATCH", body: JSON.stringify({ key, value }) }),
  setting: (key, value) => request("/api/control/settings", { method: "PATCH", body: JSON.stringify({ key, value }) }),
  kill: (state, reason) => request("/api/control/kill-switch", { method: "POST", body: JSON.stringify({ state, reason }) }),
  hydrate: (state, reason) => request("/api/control/hydration", { method: "POST", body: JSON.stringify({ state, reason }) }),
  ask: (question) => request("/api/ai/ask", { method: "POST", body: JSON.stringify({ question }) }),
  research: () => request("/api/ai/research", { method: "POST", body: "{}" }),
  profile: () => request("/api/ai/profile", { method: "POST", body: "{}" }),
  copilot: (transcript, synthetic = false) => request("/api/ai/copilot", { method: "POST", body: JSON.stringify({ transcript, synthetic }) }),
  debrief: (payload) => request("/api/ai/debrief", { method: "POST", body: JSON.stringify(payload) }),
  profileLab: (question) => request("/api/ai/profile-lab", { method: "POST", body: JSON.stringify({ question }) }),
  founderNote: (note) => request("/api/ai/founder-note", { method: "POST", body: JSON.stringify({ note }) }),
};
