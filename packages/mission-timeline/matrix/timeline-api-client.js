export class TimelineApiError extends Error {
  constructor(code, message, status, details = {}) {
    super(message);
    this.name = "TimelineApiError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export class TimelineApiClient {
  constructor({ apiBase = "/timeline/api/v1", fetchImpl = globalThis.fetch.bind(globalThis), token = null } = {}) {
    this.apiBase = apiBase.replace(/\/$/, "");
    this.fetchImpl = fetchImpl;
    this.token = token;
  }

  get configured() {
    return Boolean(this.apiBase && this.token);
  }

  setToken(token) {
    this.token = token;
  }

  async request(path, { method = "GET", body, headers = {} } = {}) {
    if (!this.token) throw new TimelineApiError("SESSION_REQUIRED", "Timeline session is not available.", 401);
    const response = await this.fetchImpl(`${this.apiBase}${path}`, {
      method,
      credentials: "same-origin",
      headers: {
        accept: "application/json",
        authorization: `Bearer ${this.token}`,
        ...(body === undefined ? {} : { "content-type": "application/json" }),
        ...headers,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new TimelineApiError(
        payload?.error?.code ?? "TIMELINE_API_ERROR",
        payload?.error?.message ?? "Timeline request failed.",
        response.status,
        payload?.error?.details ?? {},
      );
    }
    return payload;
  }

  createDocument(document, programId) {
    return this.request("/documents", {
      method: "POST",
      body: { id: document.id, programId, title: document.title, theme: document.theme, document },
    });
  }

  checkpoint(documentId, deviceId, baseRevision, snapshot) {
    return this.request(`/documents/${encodeURIComponent(documentId)}/checkpoints/${encodeURIComponent(deviceId)}`, {
      method: "PUT",
      body: { baseRevision, snapshot },
    });
  }

  createVersion(documentId, baseRevision, snapshot, label) {
    return this.request(`/documents/${encodeURIComponent(documentId)}/versions`, {
      method: "POST",
      body: { baseRevision, snapshot, label },
    });
  }
}
