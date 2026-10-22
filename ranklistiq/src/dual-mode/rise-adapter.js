(function riseAdapterModule(root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.RLQ_RISE = api;
})(typeof window !== "undefined" ? window : null, function buildRiseAdapter() {
  "use strict";

  var BIND_URL = "/wp-admin/admin-post.php?action=mmed_rise_auth_redirect&final=/rise/";
  var LIST_URL = "/api/rise/v1/me/programs";
  var IDENTITY_URL = "/api/rise/v1/program-specialties/";

  function riseError(code, status, detail) {
    var error = new Error(code);
    error.code = code;
    error.status = status || 0;
    error.detail = detail || null;
    return error;
  }

  async function jsonOrNull(response) {
    try {
      return await response.json();
    } catch (_error) {
      return null;
    }
  }

  function requestOptions() {
    return { method: "GET", credentials: "include", headers: { Accept: "application/json" } };
  }

  function createAdapter(fetchImpl) {
    if (typeof fetchImpl !== "function") throw new TypeError("fetch implementation required");

    async function bindSession() {
      var response;
      try {
        response = await fetchImpl(BIND_URL, { method: "GET", credentials: "include", redirect: "manual" });
      } catch (error) {
        throw riseError("RISE_UNAVAILABLE", 0, error);
      }
      if (!response || response.type !== "opaqueredirect") {
        throw riseError("RISE_UNAVAILABLE", response && response.status, null);
      }
      return { ok: true };
    }

    async function listMyPrograms() {
      var response = await fetchImpl(LIST_URL, requestOptions());
      var payload = await jsonOrNull(response);
      if (!response || !response.ok) {
        if (response && response.status === 401) throw riseError("RISE_UNAVAILABLE", response.status, payload);
        throw riseError("RISE_REQUEST_FAILED", response && response.status, payload);
      }
      var records = Array.isArray(payload && payload.records) ? payload.records.slice() : [];
      records.sort(function byPriority(left, right) {
        return Number(left.priorityPosition || 0) - Number(right.priorityPosition || 0);
      });
      return { records: records, persistence: payload && payload.persistence ? payload.persistence : null };
    }

    async function resolveIdentity(programSpecialtyId) {
      var id = String(programSpecialtyId || "");
      if (!id) throw riseError("PROGRAM_ID_REQUIRED", 0, null);
      var response = await fetchImpl(IDENTITY_URL + encodeURIComponent(id), requestOptions());
      var payload = await jsonOrNull(response);
      if (!response || !response.ok) {
        if (response && response.status === 401) throw riseError("RISE_UNAVAILABLE", response.status, payload);
        if (response && response.status === 404) throw riseError("PROGRAM_NOT_FOUND", response.status, payload);
        throw riseError("RISE_REQUEST_FAILED", response && response.status, payload);
      }
      return payload;
    }

    async function importBatch(ids, options) {
      var list = Array.isArray(ids) ? ids.map(String) : [];
      var opts = options || {};
      var requested = Number(opts.concurrency || 4);
      var concurrency = Math.max(1, Math.min(4, Number.isFinite(requested) ? Math.floor(requested) : 4));
      var results = new Array(list.length);
      var failures = [];
      var cursor = 0;
      var completed = 0;

      async function worker() {
        while (cursor < list.length) {
          var index = cursor;
          cursor += 1;
          var id = list[index];
          try {
            results[index] = { id: id, ok: true, identity: await resolveIdentity(id) };
          } catch (error) {
            var failure = { id: id, ok: false, code: error && error.code ? error.code : "RISE_REQUEST_FAILED", status: error && error.status ? error.status : 0 };
            results[index] = failure;
            failures.push(failure);
          }
          completed += 1;
          if (typeof opts.onProgress === "function") opts.onProgress({ completed: completed, total: list.length, id: id, ok: results[index].ok });
        }
      }

      var workers = [];
      for (var index = 0; index < Math.min(concurrency, list.length); index += 1) workers.push(worker());
      await Promise.all(workers);
      return { results: results, failures: failures };
    }

    return {
      bindSession: bindSession,
      listMyPrograms: listMyPrograms,
      resolveIdentity: resolveIdentity,
      importBatch: importBatch
    };
  }

  function knownTrue(value) {
    if (value === true) return true;
    if (value && value.knowledge && value.knowledge.state === "known") return value.knowledge.value === true;
    return false;
  }

  function identifierValue(identifiers, namespace) {
    var list = Array.isArray(identifiers) ? identifiers : [];
    var found = list.find(function matchIdentifier(identifier) { return identifier && identifier.namespace === namespace; });
    return found && found.value ? String(found.value) : null;
  }

  function mapToProgramPayload(record, response, importedAt) {
    var program = response && response.program ? response.program : response || {};
    var display = program.display || {};
    var fields = program.fields || {};
    var location = [display.city, display.state].filter(Boolean).join(", ");
    var programSpecialtyId = String(record && record.programSpecialtyId || program.programSpecialtyId || "");
    return {
      programPayload: {
        name: String(display.programName || ""),
        location: location,
        specialty: String(program.designation || ""),
        programType: "categorical",
        supplementalRequired: false,
        supplementalListId: null,
        includeInMain: true,
        visaSupport: knownTrue(fields.J1) || knownTrue(fields.H1B) ? "yes" : "unknown",
        inHouseFellowship: "unknown",
        settingType: "unknown",
        tag: "RISE #" + String(record && record.priorityPosition || "")
      },
      link: {
        programSpecialtyId: programSpecialtyId,
        acgmeId: identifierValue(program.identifiers, "ACGME_PROGRAM"),
        designation: String(program.designation || ""),
        riseOrder: Number(record && record.priorityPosition || 0),
        goldStarred: !!(record && record.goldStarred),
        riseState: record && record.state ? String(record.state) : null,
        registryReleaseId: response && response.registryReleaseId ? String(response.registryReleaseId) : null,
        importedAt: importedAt || new Date().toISOString()
      }
    };
  }

  return {
    createAdapter: createAdapter,
    mapToProgramPayload: mapToProgramPayload,
    constants: { BIND_URL: BIND_URL, LIST_URL: LIST_URL, IDENTITY_URL: IDENTITY_URL }
  };
});

