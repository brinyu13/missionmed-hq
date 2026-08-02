const headers = { "content-type": "application/json", "x-priq-role": "founder", "x-priq-user": "local-founder" };

async function request(path, options = {}) {
  const response = await fetch(path, { ...options, headers: { ...headers, ...(options.headers || {}) } });
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
};
