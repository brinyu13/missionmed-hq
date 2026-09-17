(function () {
  "use strict";

  var __MMED_V3_BUILD = "WEBEX-107A.606a 2026-07-08 55577a7";
  var config = normalizeEmbedConfig(window.MMEDLiveDrillsWebexPreview || {});
  window.MMEDLiveDrillsWebexPreview = config;
  var activeWidget = null;
  var tokenPromises = {};
  var widgetReadinessObserver = null;
  var widgetReadinessTimer = null;
  var widgetAutoJoinTimer = null;
		  var activeRuntimeStage = null;
		  var activeRuntimeTokenMode = "guest";
		  var activeRuntimeAutoClickJoin = false;
		  var activeRuntimeJoinClicked = false;
  var activeRuntimeJoinClickAttempts = 0;
  var activeRuntimeLastJoinClickAt = 0;
  var consoleRuntimeErrorWatchInstalled = false;
  var lastRuntimeErrorMessage = "";
  var lastRuntimeErrorAt = 0;
  var selectedVideoDeviceId = loadStoredVideoDeviceId();
  var cameraListInFlight = false;
  var nativeGetUserMedia = null;
  var cameraPatchInstalled = false;
  var nonceRefreshPromise = null;
  var widgetScriptPromise = null;

  function attr(value) {
    return String(value || "").replace(/[&<>"']/g, function (char) {
      return {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
      }[char];
    });
  }

  function defaultRestUrl() {
    return window.location.origin.replace(/\/$/, "") + "/wp-json/mmed/v1";
  }

  function normalizeEmbedConfig(rawConfig) {
    var next = rawConfig && typeof rawConfig === "object" ? rawConfig : {};
    next.restUrl = next.restUrl || defaultRestUrl();
    next.widgetLayout = next.widgetLayout || "Grid";
    next.widgetScriptUrl = next.widgetScriptUrl || "";
    next.meeting = next.meeting && typeof next.meeting === "object" ? next.meeting : {};
    next.viewerTicket = String(next.viewerTicket || "");
    return next;
  }

  function status(stage, message, state) {
    var node = stage && stage.querySelector("[data-webex-embed-status]");
    if (!node) return;
    node.textContent = message || "";
    node.setAttribute("data-state", state || "idle");
  }

  function getMeeting() {
    return (config && config.meeting) || {};
  }

  function getDestination() {
    var meeting = getMeeting();
    return meeting.joinUrl || meeting.sipAddress || "";
  }

  function getDestinationType() {
    var meeting = getMeeting();
    if (meeting.joinUrl) return "uri";
    if (meeting.sipAddress) return "sip";
    return "uri";
  }

  function studentSafeErrorMessage(message) {
    var text = String(message || "");
    if (/authenticate|token|guest token|join token|rest_cookie_invalid_nonce|nonce|webex|embedded|bundle|sdk|widget/i.test(text)) {
      return "The live room could not confirm your entry. Stay on the roster, retry the in-page join, or use the external join link and message the host.";
    }
    if (/app fallback|desktop|native/i.test(text)) {
      return "The in-page video join did not complete. Retry inside Dr J Drills LIVE or use the external join link.";
    }
    return text || "The video room could not start. Retry inside Dr J Drills LIVE or use the external join link and message the host.";
  }

  function runtimeRoleCopy(hostCopy, studentCopy) {
    return activeRuntimeTokenMode === "host" ? hostCopy : studentCopy;
  }

  // Compatibility marker retained from the merged feature family: Copy student Webex link.
  function fallbackActionMarkup(isAdmin, joinUrl) {
    if (!joinUrl) return "";
    if (isAdmin) {
      return '<a class="mmed-webex-fallback-link" data-webex-app-fallback href="' + attr(joinUrl) + '" target="_blank" rel="noopener noreferrer">Open Webex host app fallback</a>';
    }
    return '<button class="mmed-webex-fallback-link" type="button" data-webex-copy-join>Copy external join link</button>';
  }

  function copyStudentJoinLink(stage) {
    var joinUrl = String((getMeeting() && getMeeting().joinUrl) || "").trim();
    var copyPromise;
    if (!joinUrl) {
      status(stage, "The host has not opened the video room yet. Keep this page open and try again when the room is live.", "error");
      return;
    }
    if (window.navigator && window.navigator.clipboard && typeof window.navigator.clipboard.writeText === "function") {
      copyPromise = window.navigator.clipboard.writeText(joinUrl);
    } else {
      copyPromise = Promise.reject(new Error("Clipboard unavailable."));
    }
    copyPromise.then(function () {
      status(stage, "External join link copied. Open it in a guest or private browser if the in-page join still fails, and message the host.", "ready");
    }).catch(function () {
      status(stage, "Copy failed. Ask the host for the external student join link.", "error");
    });
  }

  function isAdminControlMode() {
    var teamConfig = window.MMEDLiveDrillsTeamChallengePreview || {};
    return !!(
      teamConfig.isAdmin ||
      teamConfig.mode === "admin" ||
      document.body.classList.contains("mmed-team-challenge-admin")
    );
  }

  function isNonceError(error) {
    var message = String(error && error.message ? error.message : error || "");
    return /cookie check failed|rest_cookie_invalid_nonce|nonce/i.test(message);
  }

  function refreshConfigNonce() {
    if (nonceRefreshPromise) {
      return nonceRefreshPromise;
    }

    var refreshUrl = window.location.pathname + window.location.search;
    refreshUrl += (refreshUrl.indexOf("?") === -1 ? "?" : "&") + "mmed_nonce_refresh=" + Date.now();

    nonceRefreshPromise = window.fetch(refreshUrl, {
      method: "GET",
      credentials: "same-origin",
      cache: "no-store"
    }).then(function (response) {
      if (!response.ok) {
        throw new Error("Could not refresh page session.");
      }
      return response.text();
    }).then(function (html) {
      var marker = "window.MMEDLiveDrillsWebexPreview = ";
      var start = html.indexOf(marker);
      var end;
      var nextConfig;

      if (start === -1) {
        throw new Error("Could not refresh page session.");
      }

      start += marker.length;
      end = html.indexOf(";</script>", start);
      if (end === -1) {
        throw new Error("Could not refresh page session.");
      }

      nextConfig = JSON.parse(html.slice(start, end));
      if (!nextConfig || !nextConfig.nonce) {
        throw new Error("Could not refresh page session.");
      }

      config.nonce = nextConfig.nonce;
      if (window.MMEDLiveDrillsWebexPreview) {
        window.MMEDLiveDrillsWebexPreview.nonce = nextConfig.nonce;
      }

      return nextConfig.nonce;
    }).then(function (nonce) {
      nonceRefreshPromise = null;
      return nonce;
    }, function (error) {
      nonceRefreshPromise = null;
      throw error;
    });

    return nonceRefreshPromise;
  }

  function fetchWidgetToken(mode) {
    var tokenMode = mode === "host" ? "host" : "guest";
    var tokenUrl;
    var guestIdentity;

    if (tokenMode === "host") {
      return fetchHostToken();
    }

    tokenUrl = String(config.restUrl || "").replace(/\/$/, "") + "/webex/guest-token";
    guestIdentity = currentGuestIdentity();
    if (guestIdentity.displayName || guestIdentity.guestId) {
      tokenUrl += "?" + new URLSearchParams(guestIdentity).toString();
    }

    return fetch(tokenUrl, {
      method: "GET",
      credentials: "same-origin",
      headers: {
        "X-WP-Nonce": config.nonce || "",
        "Accept": "application/json"
      }
    }).then(function (response) {
      return response.json().catch(function () {
        return {};
      }).then(function (payload) {
        if (!response.ok || !payload.token) {
          throw new Error(payload.message || "Could not create a Webex guest token.");
        }
        return payload.token;
      });
    });
  }

  function currentGuestIdentity() {
    var raw;
    var profile;
    var firstName;
    var lastName;
    var displayName;

    try {
      raw = window.localStorage && window.localStorage.getItem("mmedLiveTeamChallengeGuest");
      profile = raw ? JSON.parse(raw) : {};
    } catch (error) {
      profile = {};
    }

    firstName = String(profile && profile.firstName ? profile.firstName : "").trim();
    lastName = String(profile && profile.lastName ? profile.lastName : "").trim();
    displayName = [firstName, lastName].filter(Boolean).join(" ").replace(/\s+/g, " ").trim();

    return {
      displayName: displayName.slice(0, 80),
      guestId: String(profile && profile.id ? profile.id : "").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 80)
    };
  }

  function fetchHostToken() {
    var meeting = getMeeting();
    var body = {};
    if (meeting.id) body.meeting_id = meeting.id;
    if (meeting.joinUrl) body.join_url = meeting.joinUrl;

    return fetch(String(config.restUrl || "").replace(/\/$/, "") + "/webex/start-meeting", {
      method: "POST",
      credentials: "same-origin",
      headers: {
        "X-WP-Nonce": config.nonce || "",
        "Accept": "application/json",
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    }).then(function (response) {
      return response.json().catch(function () {
        return {};
      }).then(function (payload) {
        if (!response.ok || !payload.token) {
          throw new Error(payload.message || "Could not authenticate Webex host token source.");
        }
        return payload.token;
      });
    });
  }

  function ensureWidgetBundle(stage) {
    var script;

    if (window.MmedWebexWidget && typeof window.MmedWebexWidget.init === "function") {
      return Promise.resolve();
    }

    if (widgetScriptPromise) {
      return widgetScriptPromise;
    }

    if (!config.widgetScriptUrl) {
      return Promise.reject(new Error("Embedded Webex fallback bundle is unavailable."));
    }

    status(stage, runtimeRoleCopy("Loading Webex fallback bundle...", "Preparing the video room..."), "loading");
    widgetScriptPromise = new Promise(function (resolve, reject) {
      script = document.createElement("script");
      script.src = config.widgetScriptUrl;
      script.async = true;
      script.onload = function () {
        if (window.MmedWebexWidget && typeof window.MmedWebexWidget.init === "function") {
          resolve();
          return;
        }
        reject(new Error("Embedded Webex fallback bundle did not initialize."));
      };
      script.onerror = function () {
        reject(new Error("Embedded Webex fallback bundle failed to load."));
      };
      document.head.appendChild(script);
    }).catch(function (error) {
      widgetScriptPromise = null;
      throw error;
    });

    return widgetScriptPromise;
  }

  function getWidgetToken(mode) {
    var tokenMode = mode === "host" ? "host" : "guest";
    if (tokenPromises[tokenMode]) return tokenPromises[tokenMode];

    tokenPromises[tokenMode] = fetchWidgetToken(tokenMode).catch(function (error) {
      if (!isNonceError(error)) {
        throw error;
      }

      return refreshConfigNonce().then(function () {
        return fetchWidgetToken(tokenMode);
      });
    }).catch(function (error) {
      tokenPromises[tokenMode] = null;
      throw error;
    });

    return tokenPromises[tokenMode];
  }

  function clearWidgetToken(mode) {
    tokenPromises[mode === "host" ? "host" : "guest"] = null;
  }

  function hydrateMeetingFromTeamState() {
    var teamConfig = window.MMEDLiveDrillsTeamChallengePreview || {};
    var sdkConfig = window.MMEDLiveDrillsSDKV3Config || {};
    var stateUrl = String(teamConfig.fastStateActionUrl || teamConfig.stateUrl || sdkConfig.stateEndpoint || "");
    var viewerTicket = String(teamConfig.viewerTicket || sdkConfig.viewerTicket || config.viewerTicket || "");
    var headers = {
      "Accept": "application/json"
    };
    if (!stateUrl) {
      return Promise.reject(new Error("The video room state endpoint is unavailable."));
    }
    if (config.nonce) {
      headers["X-WP-Nonce"] = config.nonce;
    }
    if (viewerTicket) {
      headers["X-MMED-Viewer-Ticket"] = viewerTicket;
    }

    return window.fetch(stateUrl, {
      method: "GET",
      credentials: "same-origin",
      cache: "no-store",
      headers: headers
    }).then(function (response) {
      return response.json().catch(function () {
        return {};
      }).then(function (payload) {
        if (!response.ok) {
          throw new Error(payload.message || "Could not load the selected video room.");
        }
        if (payload && payload.meeting && (payload.meeting.joinUrl || payload.meeting.sipAddress)) {
          config.meeting = Object.assign({}, config.meeting || {}, payload.meeting);
          if (window.MMEDLiveDrillsWebexPreview) {
            window.MMEDLiveDrillsWebexPreview.meeting = config.meeting;
          }
        }
        return config.meeting || {};
      });
    });
  }

  function stopExistingWidget() {
    clearWidgetReadinessWatch();

    if (activeWidget) {
      try {
        if (typeof activeWidget.leave === "function") activeWidget.leave();
        if (typeof activeWidget.close === "function") activeWidget.close();
        if (typeof activeWidget.destroy === "function") activeWidget.destroy();
      } catch (error) {
        // A failed widget teardown should not break the Daily Drills shell.
      }
      activeWidget = null;
    }
  }

  function showWidgetFallbackError(stage, message) {
    var mount = stage && stage.querySelector("[data-webex-widget-mount]");

    stopExistingWidget();

    if (mount) {
      mount.hidden = true;
      mount.innerHTML = "";
    }

    if (stage) {
      stage.classList.remove("is-webex-embedding");
      stage.classList.remove("is-webex-embedded");
    }

    status(stage, activeRuntimeTokenMode === "host"
      ? (message || "Embedded Webex could not start. Use the Webex host app fallback.")
      : studentSafeErrorMessage(message), "error");
  }

  function clearWidgetReadinessWatch() {
    if (widgetReadinessObserver) {
      try {
        widgetReadinessObserver.disconnect();
      } catch (error) {}
      widgetReadinessObserver = null;
    }

    if (widgetReadinessTimer) {
      window.clearTimeout(widgetReadinessTimer);
      widgetReadinessTimer = null;
    }
    if (widgetAutoJoinTimer) {
      window.clearInterval(widgetAutoJoinTimer);
      widgetAutoJoinTimer = null;
    }
  }

  function widgetText(mount) {
    return String((mount && (mount.innerText || mount.textContent)) || "").replace(/\s+/g, " ").trim();
  }

	  function widgetJoinButton(mount) {
	    var direct;
	    var buttons;
	    if (!mount) return null;
	    direct = mount.querySelector('button[aria-label="Join meeting"],button[title="Join meeting"]');
	    if (direct) return direct;
	    buttons = Array.prototype.slice.call(mount.querySelectorAll("button"));
	    return buttons.find(function (button) {
	      var label = [
	        button.getAttribute("aria-label") || "",
	        button.getAttribute("title") || "",
	        button.innerText || button.textContent || ""
	      ].join(" ");
	      return /join meeting/i.test(label);
	    }) || null;
	  }

	  function hasWidgetJoinControl(mount) {
	    var button = widgetJoinButton(mount);
	    return !!(button && !button.disabled);
	  }

		  function clickWidgetJoinControl(mount) {
		    var button = widgetJoinButton(mount);
		    if (!button || button.disabled) {
		      return false;
		    }
    try {
      button.scrollIntoView({ block: "center", inline: "center" });
    } catch (error) {}
    try {
      button.focus({ preventScroll: true });
    } catch (error) {
      try {
        button.focus();
      } catch (focusError) {}
    }
    ["pointerdown", "mousedown", "pointerup", "mouseup", "click"].forEach(function (type) {
      try {
        button.dispatchEvent(new MouseEvent(type, {
          bubbles: true,
          cancelable: true,
          view: window
        }));
      } catch (error) {}
    });
    try {
      button.click();
    } catch (error) {}
		    return true;
		  }

  function hasWidgetMeetingMedia(mount) {
    var text = widgetText(mount);
	    if (/join meeting/i.test(text)) {
	      return false;
	    }

    if (/start sharing|show participants|leave meeting|waiting for others to join|participants\s*\(/i.test(text)) {
      return true;
    }

    return !!(mount && !hasWidgetJoinControl(mount) && mount.querySelector([
      '.wxc-in-meeting',
      '.wxc-in-meeting__media-container',
      '.wxc-meeting-control-bar__controls'
    ].join(",")));
  }

  function hasWidgetErrorText(mount) {
    var text = widgetText(mount);
    return /HTTP Status 403|Forbidden|could not|unable|failed|permission denied|not authorized/i.test(text);
  }

  function textFromRuntimeErrorValue(value) {
    if (!value) return "";
    if (typeof value === "string") return value;
    if (value.message) return String(value.message || "");
    return String(value || "");
  }

  function textFromConsoleArgs(args) {
    return Array.prototype.slice.call(args || []).map(textFromRuntimeErrorValue).join(" ");
  }

  function isConcurrentMeetingLimitText(message) {
    return /concurrent active meeting limit exceeded/i.test(String(message || ""));
  }

  function runtimeWebexErrorMessage(error) {
    var message = textFromRuntimeErrorValue(error);
    if (!message) return "";
    if (isConcurrentMeetingLimitText(message)) {
      return activeRuntimeTokenMode === "host"
        ? "Webex blocked this host join because the host account is already in another active meeting. End or leave every other Webex desktop/browser session for this account, then click Join host again."
        : "Webex says the meeting owner is already in another active meeting. Ask the host to end the other meeting, then try joining again.";
    }
    if (/JoinMeetingError/i.test(message) && activeRuntimeTokenMode === "host") {
      return "Webex could not complete host join inside this browser. Confirm this room is owned or cohosted by the connected Webex account, then try Join host again or use the Webex app fallback.";
    }
    if (/wdm\/api\/v1\/devices|HTTP Status 403|Forbidden|webex-js-sdk/i.test(message)) {
      return activeRuntimeTokenMode === "host"
        ? "Webex rejected the in-browser host device registration. Use the Webex app fallback for this meeting, then reconnect the Webex OAuth host account before live browser-host use."
        : "Webex rejected the in-browser student device registration. Retry inside Daily Drills or copy the student Webex link and message the host.";
    }
    return "";
  }

  function handleRuntimeWebexError(error) {
    var message = runtimeWebexErrorMessage(error);
    if (!message || !activeRuntimeStage) return;
    if (message === lastRuntimeErrorMessage && Date.now() - lastRuntimeErrorAt < 1500) return;
    lastRuntimeErrorMessage = message;
    lastRuntimeErrorAt = Date.now();
    showWidgetFallbackError(activeRuntimeStage, message);
  }

  function installConsoleRuntimeErrorWatch() {
    if (consoleRuntimeErrorWatchInstalled || !window.console) return;
    consoleRuntimeErrorWatchInstalled = true;

    ["error", "warn"].forEach(function (method) {
      var original = window.console[method];
      if (typeof original !== "function") return;
      window.console[method] = function () {
        var result;
        try {
          result = original.apply(window.console, arguments);
        } finally {
          var message = runtimeWebexErrorMessage(textFromConsoleArgs(arguments));
          if (message && activeRuntimeStage) {
            window.setTimeout(function () {
              handleRuntimeWebexError(message);
            }, 0);
          }
        }
        return result;
      };
    });

    window.addEventListener("error", function (event) {
      var message = runtimeWebexErrorMessage(event && (event.error || event.message));
      if (message) {
        handleRuntimeWebexError(message);
      }
    });

    window.addEventListener("unhandledrejection", function (event) {
      var message = runtimeWebexErrorMessage(event && event.reason);
      if (message) {
        handleRuntimeWebexError(message);
      }
    });
  }

  function watchWidgetReadiness(stage, tokenMode) {
    var mount = stage && stage.querySelector("[data-webex-widget-mount]");
    clearWidgetReadinessWatch();
    activeRuntimeStage = stage;
    activeRuntimeTokenMode = tokenMode === "host" ? "host" : "guest";

    function check() {
      if (!stage || !mount || mount.hidden) return;

      if (hasWidgetMeetingMedia(mount)) {
        clearWidgetReadinessWatch();
        status(stage, activeRuntimeTokenMode === "host"
          ? "Host Webex video is active inside this Daily Drills stage. Keep desktop Webex muted or closed to avoid echo."
          : "The live video room is active.", "ready");
        return;
      }

		      if (hasWidgetJoinControl(mount)) {
		        if (activeRuntimeAutoClickJoin && activeRuntimeJoinClickAttempts < 10 && Date.now() - activeRuntimeLastJoinClickAt > 2400 && clickWidgetJoinControl(mount)) {
		          activeRuntimeJoinClicked = true;
              activeRuntimeJoinClickAttempts += 1;
              activeRuntimeLastJoinClickAt = Date.now();
		          status(stage, runtimeRoleCopy("Webex join screen loaded. Entering the room now...", "The video room is ready. Entering now..."), "loading");
		          return;
		        }
		        status(stage, activeRuntimeTokenMode === "host"
		          ? "Webex host join screen loaded. Click Join meeting in the Webex panel to start host video."
		          : "Webex needs one final browser media confirmation. If it does not continue automatically, click Join meeting once in the Webex panel.", "ready");
	        return;
	      }

      if (hasWidgetErrorText(mount)) {
        showWidgetFallbackError(stage, activeRuntimeTokenMode === "host"
          ? "Webex could not finish host browser join. Use the Webex app fallback for this meeting, then reconnect the Webex OAuth host account before live browser-host use."
          : "Webex could not finish the student browser join. Retry inside Daily Drills or copy the student Webex link and message the host.");
      }
    }

    if (window.MutationObserver && mount) {
      widgetReadinessObserver = new window.MutationObserver(check);
      widgetReadinessObserver.observe(mount, {
        childList: true,
        subtree: true,
        characterData: true
      });
    }

    widgetReadinessTimer = window.setTimeout(function () {
      if (!stage || !mount || mount.hidden || hasWidgetMeetingMedia(mount) || hasWidgetJoinControl(mount)) {
        return;
      }
      showWidgetFallbackError(stage, activeRuntimeTokenMode === "host"
        ? "Webex did not reach the host video screen in this browser. Use Open Webex app fallback for this meeting; browser-host mode needs a host-capable Webex OAuth account for the selected meeting."
        : "Webex did not reach the student join screen in this browser. Retry inside Daily Drills or copy the student Webex link and message the host.");
    }, 18000);

	    window.setTimeout(check, 800);
	    window.setTimeout(check, 3000);
    if (activeRuntimeAutoClickJoin) {
      widgetAutoJoinTimer = window.setInterval(function () {
        if (!stage || !mount || mount.hidden || hasWidgetMeetingMedia(mount)) {
          clearWidgetReadinessWatch();
          return;
        }
        check();
      }, 1200);
      window.setTimeout(function () {
        if (widgetAutoJoinTimer) {
          window.clearInterval(widgetAutoJoinTimer);
          widgetAutoJoinTimer = null;
        }
      }, 65000);
    }
	  }

  function loadStoredVideoDeviceId() {
    try {
      return window.localStorage.getItem("mmedWebexPreviewVideoDeviceId") || "";
    } catch (error) {
      return "";
    }
  }

  function storeVideoDeviceId(deviceId) {
    selectedVideoDeviceId = deviceId || "";
    try {
      if (selectedVideoDeviceId) {
        window.localStorage.setItem("mmedWebexPreviewVideoDeviceId", selectedVideoDeviceId);
      } else {
        window.localStorage.removeItem("mmedWebexPreviewVideoDeviceId");
      }
    } catch (error) {
      // Camera choice is a convenience preference; storage failure should not block the join path.
    }
    syncSelectedCameraPatch();
  }

  function getVideoConstraints() {
    if (!selectedVideoDeviceId) {
      return { video: true };
    }
    return { video: { deviceId: { exact: selectedVideoDeviceId } } };
  }

  function applySelectedCameraConstraint(constraints) {
    if (!selectedVideoDeviceId || !constraints || typeof constraints !== "object") {
      return constraints;
    }

    var next = {};
    Object.keys(constraints).forEach(function (key) {
      next[key] = constraints[key];
    });

    if (next.video === false) {
      return constraints;
    }

    if (next.video === true || typeof next.video === "undefined") {
      next.video = { deviceId: { exact: selectedVideoDeviceId } };
      return next;
    }

    if (next.video && typeof next.video === "object") {
      var video = {};
      Object.keys(next.video).forEach(function (key) {
        video[key] = next.video[key];
      });
      video.deviceId = { exact: selectedVideoDeviceId };
      next.video = video;
    }

    return next;
  }

  function syncSelectedCameraPatch() {
    if (!navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== "function") {
      return;
    }

    if (!nativeGetUserMedia) {
      nativeGetUserMedia = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    }

    if (!selectedVideoDeviceId) {
      if (cameraPatchInstalled) {
        navigator.mediaDevices.getUserMedia = nativeGetUserMedia;
        cameraPatchInstalled = false;
      }
      return;
    }

    if (cameraPatchInstalled) {
      return;
    }

    navigator.mediaDevices.getUserMedia = function (constraints) {
      return nativeGetUserMedia(applySelectedCameraConstraint(constraints));
    };
    cameraPatchInstalled = true;
  }

  function stopMediaStream(stream) {
    if (!stream || typeof stream.getTracks !== "function") return;
    stream.getTracks().forEach(function (track) {
      track.stop();
    });
  }

  function ensureCameraStyles() {
    if (document.getElementById("mmed-webex-camera-tools-style")) return;

    var style = document.createElement("style");
    style.id = "mmed-webex-camera-tools-style";
    style.textContent = [
      ".mmed-webex-camera-tools{display:grid;grid-template-columns:minmax(180px,1fr) auto;gap:8px;align-items:end;margin:12px auto 0;max-width:620px;padding:9px;border:1px solid rgba(127,149,197,.26);border-radius:12px;background:rgba(4,8,20,.72);box-shadow:inset 0 1px 0 rgba(255,255,255,.08)}",
      ".mmed-webex-camera-tools label{display:grid;gap:4px;min-width:0;color:#c8d4f4;font-size:10px;font-weight:900;letter-spacing:.12em;text-transform:uppercase;text-align:left}",
      ".mmed-webex-camera-tools select{width:100%;min-height:38px;border:1px solid rgba(127,149,197,.35);border-radius:10px;background:#0b1226;color:#fff;padding:0 10px;font-size:13px;font-weight:800}",
      ".mmed-webex-camera-tools button{min-height:38px;border:1px solid rgba(250,204,21,.46);border-radius:10px;background:linear-gradient(180deg,#facc15,#c2410c);color:#111827;padding:0 12px;font-size:11px;font-weight:1000;letter-spacing:.08em;text-transform:uppercase}",
      ".mmed-webex-camera-note{grid-column:1/-1;margin:0;color:#9ba8c8;font-size:11px;line-height:1.3;text-align:left}",
      ".mmed-team-challenge-enabled .live-stage.is-webex-embedded,.mmed-team-challenge-enabled [data-live-stage].is-webex-embedded{overflow:hidden!important}",
      ".mmed-team-challenge-enabled .player-shell:has(.live-stage.is-webex-embedded),.mmed-team-challenge-enabled .player-shell:has([data-live-stage].is-webex-embedded){overflow:hidden!important}",
      ".mmed-team-challenge-enabled .mmed-webex-widget-frame,.mmed-team-challenge-enabled .mmed-webex-widget-mount{height:100%;min-height:0;overflow:hidden!important;isolation:isolate}",
      ".mmed-team-challenge-enabled .webex-meetings-widget,.mmed-team-challenge-enabled .webex-meetings-widget__content,.mmed-team-challenge-enabled .wxc-meeting{height:100%!important;min-height:0!important;max-height:100%!important}",
      ".mmed-team-challenge-enabled .wxc-interstitial-meeting__media-container,.mmed-team-challenge-enabled .wxc-in-meeting__media-container{min-height:0!important}",
      ".mmed-webex-host-drawer{position:absolute!important;left:0;top:64px;bottom:16px;z-index:2147483600!important;width:min(330px,82vw);display:grid;grid-template-columns:42px minmax(0,1fr);pointer-events:none}",
      ".mmed-webex-host-drawer-tab{pointer-events:auto;align-self:start;min-height:142px;border:1px solid rgba(250,204,21,.72);border-left:0;border-radius:0 14px 14px 0;background:linear-gradient(180deg,#facc15,#b45309);color:#111827;writing-mode:vertical-rl;text-orientation:mixed;font-size:12px;font-weight:1000;letter-spacing:.1em;text-transform:uppercase;box-shadow:0 16px 42px rgba(0,0,0,.36);cursor:pointer;list-style:none;display:grid;place-items:center;padding:10px 0}",
      ".mmed-webex-host-drawer-tab::-webkit-details-marker{display:none}",
      ".mmed-webex-host-drawer-tab::marker{content:''}",
      ".mmed-webex-host-drawer-panel{pointer-events:none;display:grid;align-content:start;gap:10px;padding:14px;border:1px solid rgba(250,204,21,.42);border-left:0;border-radius:0 16px 16px 0;background:linear-gradient(180deg,rgba(6,10,24,.97),rgba(3,6,18,.94));box-shadow:22px 0 70px rgba(0,0,0,.5);color:#fff;overflow:auto;opacity:0;transform:translateX(-100%);transition:transform .18s ease,opacity .18s ease}",
      ".mmed-webex-host-drawer[open] .mmed-webex-host-drawer-panel,.mmed-webex-host-drawer.is-open .mmed-webex-host-drawer-panel,.mmed-webex-host-drawer:hover .mmed-webex-host-drawer-panel,.mmed-webex-host-drawer:focus-within .mmed-webex-host-drawer-panel{pointer-events:auto;opacity:1;transform:translateX(0)}",
      ".mmed-webex-host-drawer-panel h3{margin:0;color:#fde68a;font-size:14px;font-weight:1000;letter-spacing:.12em;text-transform:uppercase}",
      ".mmed-webex-host-drawer-panel p{margin:0;color:#cbd5e1;font-size:12px;line-height:1.32}",
      ".mmed-webex-host-drawer-panel button{min-height:38px;border:1px solid rgba(127,149,197,.34);border-radius:10px;background:#111a36;color:#fff;padding:8px 10px;font-size:11px;font-weight:1000;letter-spacing:.06em;text-transform:uppercase}",
      ".mmed-webex-host-drawer-panel [data-webex-mute-all]{border-color:rgba(248,113,113,.7);background:linear-gradient(180deg,#ef4444,#7f1d1d)}",
      ".mmed-webex-host-drawer-panel [data-webex-record]{border-color:rgba(250,204,21,.72);background:linear-gradient(180deg,#2f3a55,#111827);color:#fef3c7}",
      ".mmed-webex-host-drawer-status{min-height:34px;border-top:1px solid rgba(127,149,197,.2);padding-top:8px;color:#fef3c7!important}",
      ".mmed-webex-settings-rescue{position:absolute;top:8px;right:8px;z-index:2147483647;min-height:36px;border:1px solid rgba(255,255,255,.38);border-radius:999px;background:linear-gradient(180deg,rgba(15,23,42,.96),rgba(3,7,18,.96));box-shadow:0 14px 36px rgba(0,0,0,.42),0 0 0 2px rgba(250,204,21,.18);color:#fff;padding:0 14px;font-size:11px;font-weight:1000;letter-spacing:.08em;text-transform:uppercase}",
      ".mmed-webex-settings-rescue[hidden]{display:none!important}",
      "@media(max-width:760px){.mmed-webex-camera-tools{grid-template-columns:1fr}.mmed-webex-camera-tools button{width:100%}}"
    ].join("");
    document.head.appendChild(style);
  }

  function closeWebexSettings(stage) {
    var candidates = Array.prototype.slice.call((stage || document).querySelectorAll("button,[role='button']"));
    var closeButton = candidates.find(function (button) {
      var label = String(button.getAttribute("aria-label") || button.getAttribute("title") || button.textContent || "").toLowerCase();
      return label.indexOf("close") !== -1 || label.indexOf("dismiss") !== -1;
    });
    var target = document.activeElement || document.body;

    if (closeButton && typeof closeButton.click === "function") {
      closeButton.click();
    }

    ["keydown", "keyup"].forEach(function (type) {
      var event = new KeyboardEvent(type, {
        key: "Escape",
        code: "Escape",
        keyCode: 27,
        which: 27,
        bubbles: true,
        cancelable: true
      });

      try {
        target.dispatchEvent(event);
      } catch (error) {}

      try {
        document.dispatchEvent(event);
      } catch (error) {}

      try {
        window.dispatchEvent(event);
      } catch (error) {}
    });
  }

  function showSettingsRescue(stage) {
    var button;
    if (!stage) return;

    button = stage.querySelector("[data-webex-settings-rescue]");
    if (!button) {
      button = document.createElement("button");
      button.type = "button";
      button.className = "mmed-webex-settings-rescue";
      button.setAttribute("data-webex-settings-rescue", "1");
      button.textContent = "Close settings";
      button.addEventListener("click", function (event) {
        event.preventDefault();
        closeWebexSettings(stage);
        button.hidden = true;
      });
      stage.appendChild(button);
    }

    button.hidden = false;
  }

  function setupSettingsRescue(stage) {
    if (!stage || stage.getAttribute("data-webex-settings-rescue-bound") === "1") {
      return;
    }

    stage.setAttribute("data-webex-settings-rescue-bound", "1");
    stage.addEventListener("click", function (event) {
      var control = event.target && event.target.closest("button,[role='button']");
      var label = String(control && (control.getAttribute("aria-label") || control.getAttribute("title") || control.textContent) || "").toLowerCase();

      if (label.indexOf("settings") === -1) {
        return;
      }

      window.setTimeout(function () {
        showSettingsRescue(stage);
      }, 120);
    }, true);

    stage.addEventListener("keydown", function (event) {
      var button = stage.querySelector("[data-webex-settings-rescue]");
      if (event.key === "Escape" && button) {
        button.hidden = true;
      }
    }, true);
  }

  function setHostDrawerStatus(stage, message) {
    var node = stage && stage.querySelector("[data-webex-host-drawer-status]");
    if (node) {
      node.textContent = message || "";
    }
  }

  function widgetButtons(stage) {
    var mount = stage && stage.querySelector("[data-webex-widget-mount]");
    return Array.prototype.slice.call(mount ? mount.querySelectorAll("button,[role='button']") : []);
  }

  function buttonLabel(button) {
    return String(
      (button && (
        button.getAttribute("aria-label") ||
        button.getAttribute("title") ||
        button.innerText ||
        button.textContent
      )) || ""
    ).replace(/\s+/g, " ").trim();
  }

  function findWidgetButton(stage, patterns) {
    return widgetButtons(stage).find(function (button) {
      var label = buttonLabel(button);
      return patterns.some(function (pattern) {
        return pattern.test(label);
      });
    });
  }

  function clickWidgetButton(stage, patterns, successMessage, fallbackMessage) {
    var button = findWidgetButton(stage, patterns);
    if (button && typeof button.click === "function") {
      button.click();
      setHostDrawerStatus(stage, successMessage);
      return true;
    }
    setHostDrawerStatus(stage, fallbackMessage);
    return false;
  }

  function openWidgetParticipants(stage) {
    var alreadyOpen = findWidgetButton(stage, [/hide participants/i, /close participants panel/i]);
    if (alreadyOpen) {
      setHostDrawerStatus(stage, "Webex participant panel is open. Use the mute icon beside a noisy student if Webex shows it.");
      return true;
    }
    return clickWidgetButton(
      stage,
      [/show participants/i, /^participants$/i],
      "Opened the native Webex participant panel. Use the mute icon beside a noisy student.",
      "Join the Webex room first; the participant panel is not available before the meeting starts."
    );
  }

  function tryMuteAllParticipants(stage) {
    openWidgetParticipants(stage);
    window.setTimeout(function () {
      clickWidgetButton(
        stage,
        [/^mute all$/i, /mute all attendees/i, /mute everyone/i],
        "Sent Webex Mute All.",
        "Webex did not expose Mute All in this embedded widget state. Use the participant panel mute icon beside the noisy student, or use the desktop app fallback for full host controls."
      );
    }, 450);
  }

  function tryStartRecording(stage) {
    clickWidgetButton(
      stage,
      [/^record$/i, /start recording/i, /record meeting/i],
      "Sent Webex Record.",
      "Record is not exposed by this embedded Webex widget. Use desktop Webex to record today; an in-app Record button would require custom SDK engineering and a host account with recording enabled."
    );
  }

  function setupHostControlDrawer(stage) {
    var drawer;
    if (!stage) return;
    if (!isAdminControlMode()) {
      drawer = stage.querySelector("[data-webex-host-drawer]");
      if (drawer) drawer.remove();
      return;
    }
    drawer = stage.querySelector("[data-webex-host-drawer]");
    if (!drawer) {
      stage.insertAdjacentHTML("beforeend", [
        '<details class="mmed-webex-host-drawer" data-webex-host-drawer>',
          '<summary class="mmed-webex-host-drawer-tab" data-webex-host-drawer-toggle>Participants</summary>',
          '<div class="mmed-webex-host-drawer-panel">',
            '<h3>Webex Host Controls</h3>',
            '<p>Open the native Webex roster here. If Webex only shows names, this widget is not exposing host mute controls in this meeting state.</p>',
            '<button type="button" data-webex-open-participants>Open participant list</button>',
            '<button type="button" data-webex-mute-all>Mute all if available</button>',
            '<button type="button" data-webex-record>Record if available</button>',
            '<p class="mmed-webex-host-drawer-status" data-webex-host-drawer-status>Join the room, then open this drawer for host controls.</p>',
          '</div>',
        '</details>'
      ].join(""));
      drawer = stage.querySelector("[data-webex-host-drawer]");
    }

    bindHostDrawerControls(stage, drawer);

    if (drawer.getAttribute("data-webex-host-drawer-bound") === "1") return;
    drawer.setAttribute("data-webex-host-drawer-bound", "1");
    drawer.addEventListener("click", function (event) {
      if (event.target.closest("[data-webex-host-drawer-toggle]")) {
        if (String(drawer.tagName || "").toLowerCase() === "details") {
          window.setTimeout(function () {
            drawer.classList.toggle("is-open", !!drawer.open);
          }, 0);
          return;
        }
        event.preventDefault();
        drawer.classList.toggle("is-open");
        return;
      }
      if (event.target.closest("[data-webex-open-participants]")) {
        event.preventDefault();
        drawer.classList.add("is-open");
        openWidgetParticipants(stage);
        return;
      }
      if (event.target.closest("[data-webex-mute-all]")) {
        event.preventDefault();
        drawer.classList.add("is-open");
        tryMuteAllParticipants(stage);
        return;
      }
      if (event.target.closest("[data-webex-record]")) {
        event.preventDefault();
        drawer.classList.add("is-open");
        tryStartRecording(stage);
      }
    });
  }

  function bindHostDrawerControls(stage, drawer) {
    var openParticipants;
    var muteAll;
    var record;

    if (!stage || !drawer) return;

    openParticipants = drawer.querySelector("[data-webex-open-participants]");
    muteAll = drawer.querySelector("[data-webex-mute-all]");
    record = drawer.querySelector("[data-webex-record]");

    if (openParticipants) {
      openParticipants.onclick = function (event) {
        event.preventDefault();
        if ("open" in drawer) drawer.open = true;
        drawer.classList.add("is-open");
        openWidgetParticipants(stage);
      };
    }

    if (muteAll) {
      muteAll.onclick = function (event) {
        event.preventDefault();
        if ("open" in drawer) drawer.open = true;
        drawer.classList.add("is-open");
        tryMuteAllParticipants(stage);
      };
    }

    if (record) {
      record.onclick = function (event) {
        event.preventDefault();
        if ("open" in drawer) drawer.open = true;
        drawer.classList.add("is-open");
        tryStartRecording(stage);
      };
    }
  }

  function handleHostDrawerClick(event) {
    var target = event.target;
    var control = target && target.closest("[data-webex-host-drawer-toggle],[data-webex-open-participants],[data-webex-mute-all],[data-webex-record]");
    var drawer;
    var stage;

    if (!control) return;

    drawer = control.closest("[data-webex-host-drawer]");
    stage = control.closest("[data-live-stage]");
    if (!drawer || !stage) return;

    if (control.hasAttribute("data-webex-host-drawer-toggle")) {
      if (String(drawer.tagName || "").toLowerCase() === "details") {
        window.setTimeout(function () {
          drawer.classList.toggle("is-open", !!drawer.open);
        }, 0);
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      drawer.classList.toggle("is-open");
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    drawer.classList.add("is-open");
    if ("open" in drawer) drawer.open = true;

    if (control.hasAttribute("data-webex-open-participants")) {
      openWidgetParticipants(stage);
      return;
    }

    if (control.hasAttribute("data-webex-mute-all")) {
      tryMuteAllParticipants(stage);
      return;
    }

    if (control.hasAttribute("data-webex-record")) {
      tryStartRecording(stage);
    }
  }

  function primeCameraPermission(stage) {
    if (!navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== "function") {
      return Promise.resolve();
    }

    syncSelectedCameraPatch();
    status(stage, runtimeRoleCopy("Checking camera permission before Webex starts...", "Checking camera permission before the video room starts..."), "loading");
    return navigator.mediaDevices.getUserMedia(getVideoConstraints()).then(function (stream) {
      stopMediaStream(stream);
      return refreshCameraList(stage);
    }).catch(function () {
      if (selectedVideoDeviceId) {
        storeVideoDeviceId("");
        return navigator.mediaDevices.getUserMedia({ video: true }).then(function (stream) {
          stopMediaStream(stream);
          return refreshCameraList(stage);
        }).catch(function () {
          // The Webex widget owns the final camera choice. A failed preflight should not block join.
        });
      }
    });
  }

  function refreshCameraList(stage) {
    var select = stage && stage.querySelector("[data-webex-camera-select]");
    if (!select || cameraListInFlight || !navigator.mediaDevices || typeof navigator.mediaDevices.enumerateDevices !== "function") {
      return Promise.resolve();
    }

    cameraListInFlight = true;
    return navigator.mediaDevices.enumerateDevices().then(function (devices) {
      var cameras = devices.filter(function (device) {
        return device.kind === "videoinput";
      });
      var current = selectedVideoDeviceId || select.value || "";

      select.innerHTML = '<option value="">Default camera</option>' + cameras.map(function (device, index) {
        var label = device.label || "Camera " + (index + 1);
        return '<option value="' + attr(device.deviceId) + '">' + attr(label) + '</option>';
      }).join("");

      if (current) {
        select.value = current;
      }
    }).catch(function () {
      // Device enumeration is helpful, not required.
    }).finally(function () {
      cameraListInFlight = false;
    });
  }

  function applySelectedCamera(stage, restartWidget) {
    var select = stage && stage.querySelector("[data-webex-camera-select]");
    var nextDeviceId = select ? select.value : "";
    storeVideoDeviceId(nextDeviceId);

    if (!navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== "function") {
      status(stage, "This browser does not expose camera device switching to the page.", "error");
      return;
    }

    status(stage, nextDeviceId ? "Applying selected camera..." : "Switching back to the default camera...", "loading");
    syncSelectedCameraPatch();
    navigator.mediaDevices.getUserMedia(getVideoConstraints()).then(function (stream) {
      stopMediaStream(stream);
      return refreshCameraList(stage);
    }).then(function () {
      if (!restartWidget || !stage.classList.contains("is-webex-embedded")) {
        status(stage, runtimeRoleCopy(
          "Camera preference saved. Webex controls the final device selection; if it still shows the old camera, choose it inside Webex settings or Chrome site permissions.",
          "Camera preference saved. If the video room still shows the old camera, choose it in the room settings or your browser site permissions."
        ), "ready");
        return;
      }

      status(stage, runtimeRoleCopy("Camera saved. Restarting embedded Webex with that camera...", "Camera saved. Restarting the video room with that camera..."), "loading");
      stopExistingWidget();
      stage.classList.remove("is-webex-embedded");
      startEmbedded(stage, { skipCameraPrime: true });
    }).catch(function () {
      storeVideoDeviceId("");
      if (select) select.value = "";
      status(stage, "That camera could not be opened. Reverted to default camera.", "error");
    });
  }

  function setupCameraTools(stage) {
    if (!stage || stage.getAttribute("data-camera-tools-bound") === "1") return;
    stage.setAttribute("data-camera-tools-bound", "1");
    syncSelectedCameraPatch();
    refreshCameraList(stage);
    setupSettingsRescue(stage);

    stage.addEventListener("change", function (event) {
      if (!event.target || !event.target.closest("[data-webex-camera-select]")) return;
      storeVideoDeviceId(event.target.value || "");
      status(stage, runtimeRoleCopy("Camera choice saved. Use Apply camera to restart embedded Webex with it.", "Camera choice saved. Use Apply camera to restart the video room with it."), "ready");
    });

    stage.addEventListener("click", function (event) {
      var button = event.target && event.target.closest("[data-webex-apply-camera]");
      if (!button) return;
      event.preventDefault();
      applySelectedCamera(stage, true);
    });
  }

  function installWidgetDeviceHint(stage, mount) {
    if (!mount || mount.getAttribute("data-device-hint-installed") === "1") {
      return;
    }

    mount.setAttribute("data-device-hint-installed", "1");
    mount.addEventListener("change", function (event) {
      var target = event.target;
      var label = String((target && (target.getAttribute("aria-label") || target.name || target.id || target.textContent)) || "").toLowerCase();
      if (label.indexOf("camera") === -1 && label.indexOf("video") === -1) {
        return;
      }
      status(stage, runtimeRoleCopy(
        "Webex camera setting changed. If the live camera does not switch, use Apply camera above to restart the embedded room with that device.",
        "Camera setting changed. If the live camera does not switch, use Apply camera above to restart the video room with that device."
      ), "ready");
    }, true);
  }

  function startEmbedded(stage, options) {
    options = options || {};
    var mount = stage && stage.querySelector("[data-webex-widget-mount]");
    var destination = getDestination();
	    var isAdmin = isAdminControlMode();
	    var tokenMode = isAdmin && options.hostMode ? "host" : "guest";
		    activeRuntimeTokenMode = tokenMode;
		    activeRuntimeAutoClickJoin = !!options.autoClickJoin && tokenMode !== "host";
		    activeRuntimeJoinClicked = false;
    activeRuntimeJoinClickAttempts = 0;
    activeRuntimeLastJoinClickAt = 0;

    if (isAdmin && !options.allowAdmin) {
      status(stage, "Admin mode is not auto-joined. Select or paste the Webex meeting, then use Start Live Webex Session to open the host stage in this browser.", "ready");
      return;
    }

    if (!mount || !destination) {
      if (mount && !destination && !options.hydratedMeeting) {
        status(stage, isAdmin ? "Syncing the selected Webex room..." : "Syncing the live video room...", "loading");
        return hydrateMeetingFromTeamState().then(function () {
          startEmbedded(stage, Object.assign({}, options, { hydratedMeeting: true }));
        }).catch(function (error) {
          status(stage, isAdmin
            ? (error && error.message ? error.message : "The host has not selected a Webex meeting yet.")
            : studentSafeErrorMessage(error && error.message), "error");
        });
      }
      status(stage, isAdmin ? "Choose or paste the Webex meeting first, then join the in-app host stage." : "The host has not opened the video room yet. Keep this page open and try again when Dr J starts the room.", "error");
      return;
    }

    stopExistingWidget();
    if (tokenMode === "host" || options.forceTokenRefresh) {
      clearWidgetToken(tokenMode);
    }
    syncSelectedCameraPatch();
    stage.classList.add("is-webex-embedding");

    status(stage, tokenMode === "host"
      ? "Preparing Webex host session via OAuth token..."
      : "Starting the live video room...", "loading");

    var cameraReady = options.skipCameraPrime ? Promise.resolve() : primeCameraPermission(stage);
    cameraReady.then(function () {
      return ensureWidgetBundle(stage);
    }).then(function () {
      return getWidgetToken(tokenMode);
    }).then(function (token) {
      mount.hidden = false;
      installWidgetDeviceHint(stage, mount);
		      activeWidget = window.MmedWebexWidget.init(mount, token, destination, {
		        destinationType: getDestinationType(),
		        layout: config.widgetLayout || "Grid"
		      });
      stage.classList.remove("is-webex-embedding");
      stage.classList.add("is-webex-embedded");
      status(stage, tokenMode === "host" ? "Embedded Webex is loading its join screen..." : "The video room is loading its join screen...", "loading");
      watchWidgetReadiness(stage, tokenMode);
    }).catch(function (error) {
      showWidgetFallbackError(stage, runtimeWebexErrorMessage(error) || (error && error.message ? error.message : "Embedded Webex could not start."));
    });
  }

  function enhanceStage(stage) {
    var main = stage && stage.querySelector(".legacy-live-main, .v3-live-main");
    if (!main || main.getAttribute("data-webex-enhanced") === "1") return;

    var meeting = getMeeting();
    var joinUrl = meeting.joinUrl || "";
    var title = meeting.title || "No Webex room selected";
    var isAdmin = isAdminControlMode();
    var introCopy = isAdmin
      ? "Admin mode: select or paste the Webex meeting below, then join as host inside this browser stage. This page cannot detect an unrelated desktop-only meeting unless its link is selected or pasted."
      : "Join Dr J inside the live video stage. If the in-page room does not open, use the external join link and message the host.";
    var primaryAction = isAdmin
      ? '<button class="open-webex-btn" type="button" data-start-embedded-webex data-admin-browser-join>Start Live Webex Session</button>'
      : '<button class="open-webex-btn" type="button" data-start-embedded-webex>Enter video room</button>';
    var initialStatus = isAdmin
      ? "No Webex room has been verified by this page. Select or paste the meeting, then join the in-app video stage or open Webex as fallback."
      : "Ready when the live room opens.";

    main.setAttribute("data-webex-enhanced", "1");
    ensureCameraStyles();
	    main.innerHTML = [
      '<div class="live-lockup mmed-webex-embed-intro">',
        '<div class="live-pill"><span class="live-pulse"></span> ' + (isAdmin ? "Live Webex room" : "Dr J live room") + '</div>',
	        '<h1 class="live-headline">Dr J Drills LIVE</h1>',
        '<p class="live-copy">' + attr(introCopy) + "</p>",
        '<div class="mmed-webex-embed-actions">',
          primaryAction,
          fallbackActionMarkup(isAdmin, joinUrl),
        "</div>",
        isAdmin ? '<p class="preview-meeting-copy">' + attr(title) + "</p>" : "",
        '<p class="mmed-webex-embed-status" data-webex-embed-status data-state="idle">' + attr(initialStatus) + "</p>",
      "</div>",
      '<div class="mmed-webex-widget-frame" data-webex-widget-frame>',
        '<div class="mmed-webex-widget-mount" data-webex-widget-mount hidden></div>',
	      "</div>"
	    ].join("");
	    setupHostControlDrawer(stage);
	  }

  function init() {
    var stages = Array.prototype.slice.call(document.querySelectorAll("[data-live-stage]"));
    installConsoleRuntimeErrorWatch();
    stages.forEach(enhanceStage);

    document.addEventListener("click", function (event) {
      var copyButton = event.target && event.target.closest("[data-webex-copy-join]");
      if (copyButton) {
        event.preventDefault();
        copyStudentJoinLink(copyButton.closest("[data-live-stage]"));
        return;
      }

      var button = event.target && event.target.closest("[data-start-embedded-webex]");
      if (!button) return;
      event.preventDefault();
      var stage = button.closest("[data-live-stage]");
      if (stage) {
        startEmbedded(stage, {
          allowAdmin: button.hasAttribute("data-admin-browser-join"),
          hostMode: button.hasAttribute("data-admin-browser-join")
        });
      }
    });

    document.addEventListener("click", handleHostDrawerClick, true);

    window.addEventListener("error", function (event) {
      handleRuntimeWebexError(event && (event.error || event.message));
    });

    window.addEventListener("unhandledrejection", function (event) {
      handleRuntimeWebexError(event && event.reason);
    });

    window.MMEDLiveDrillsEmbeddedWebex = {
      start: function (options) {
        var stage = document.querySelector(".shell.is-active [data-live-stage]");
        if (!options && isAdminControlMode()) {
          options = { allowAdmin: true, hostMode: true };
        }
        if (stage) startEmbedded(stage, options || {});
      },
      applyCamera: function () {
        var stage = document.querySelector(".shell.is-active [data-live-stage]");
        if (stage) applySelectedCamera(stage, true);
      },
      hasBundle: !!(window.MmedWebexWidget && typeof window.MmedWebexWidget.init === "function"),
      hasMeetingDestination: !!getDestination()
    };
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
