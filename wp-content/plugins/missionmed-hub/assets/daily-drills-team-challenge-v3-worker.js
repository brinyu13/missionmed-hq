(function () {
  "use strict";

  var settings = {
    url: "",
    viewerTicket: "",
    intervalMs: 450
  };
  var timer = null;
  var stopped = true;
  var inFlight = false;
  var etag = "";
  var requestId = 0;

  function clampInterval(value) {
    var parsed = Number(value || 450);
    if (!Number.isFinite(parsed)) return 450;
    return Math.max(300, Math.min(900, Math.floor(parsed)));
  }

  function schedule(delay) {
    if (stopped) return;
    clearTimeout(timer);
    timer = setTimeout(poll, typeof delay === "number" ? delay : settings.intervalMs + Math.floor(Math.random() * 31));
  }

  function headerNumber(response, name) {
    var value = Number(response.headers.get(name) || 0);
    return Number.isFinite(value) ? value : 0;
  }

  function timing(response, startedAtMs, receivedAtMs) {
    return {
      requestStartedAtMs: startedAtMs,
      clientReceivedAtMs: receivedAtMs,
      serverNowMs: headerNumber(response, "X-MMED-Server-Now-Ms"),
      eventSeq: headerNumber(response, "X-MMED-Event-Seq"),
      snapshotAgeMs: headerNumber(response, "X-MMED-Snapshot-Age-Ms"),
      lifecycle: String(response.headers.get("X-MMED-Lifecycle") || "idle"),
      readerMode: String(response.headers.get("X-MMED-Reader-Mode") || "worker"),
      roundTripMs: Math.max(0, receivedAtMs - startedAtMs)
    };
  }

  function poll() {
    var startedAtMs;
    var headers;
    var currentRequestId;

    if (stopped || inFlight || !settings.url) {
      schedule();
      return;
    }

    inFlight = true;
    startedAtMs = Date.now();
    currentRequestId = ++requestId;
    headers = { "Accept": "application/json" };
    if (etag) headers["If-None-Match"] = etag;
    if (settings.viewerTicket) headers["X-MMED-Viewer-Ticket"] = settings.viewerTicket;

    fetch(settings.url, {
      method: "GET",
      credentials: "include",
      cache: "no-store",
      headers: headers
    }).then(function (response) {
      var receivedAtMs = Date.now();
      var nextEtag = response.headers.get("ETag");
      if (nextEtag) etag = nextEtag;

      if (response.status === 304) {
        self.postMessage({
          type: "unchanged",
          requestId: currentRequestId,
          etag: etag,
          timing: timing(response, startedAtMs, receivedAtMs)
        });
        return null;
      }

      return response.json().catch(function () {
        return {};
      }).then(function (payload) {
        if (!response.ok) {
          var error = new Error(payload.message || "The live room could not refresh.");
          error.status = response.status;
          throw error;
        }
        self.postMessage({
          type: "state",
          requestId: currentRequestId,
          etag: etag,
          state: payload,
          timing: timing(response, startedAtMs, receivedAtMs)
        });
        return payload;
      });
    }).catch(function (error) {
      self.postMessage({
        type: error && error.status === 401 ? "authorization-expired" : "read-error",
        requestId: currentRequestId,
        status: Number(error && error.status || 0),
        message: String(error && error.message || "The live room could not refresh."),
        timing: {
          requestStartedAtMs: startedAtMs,
          clientReceivedAtMs: Date.now(),
          roundTripMs: Math.max(0, Date.now() - startedAtMs),
          readerMode: "worker"
        }
      });
    }).then(function () {
      inFlight = false;
      schedule();
    });
  }

  self.onmessage = function (event) {
    var message = event && event.data && typeof event.data === "object" ? event.data : {};
    if (message.type === "start") {
      settings.url = String(message.url || settings.url || "");
      settings.viewerTicket = String(message.viewerTicket || "");
      settings.intervalMs = clampInterval(message.intervalMs);
      etag = String(message.etag || "");
      stopped = false;
      schedule(0);
      return;
    }
    if (message.type === "update-viewer") {
      settings.viewerTicket = String(message.viewerTicket || "");
      etag = "";
      schedule(0);
      return;
    }
    if (message.type === "poll-now") {
      schedule(0);
      return;
    }
    if (message.type === "stop") {
      stopped = true;
      clearTimeout(timer);
    }
  };
})();
