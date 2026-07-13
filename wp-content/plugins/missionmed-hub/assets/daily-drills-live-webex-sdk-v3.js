(function () {
  "use strict";

  var __MMED_V3_BUILD = "WEBEX-107A.606a 2026-07-08 55577a7";
  var config = normalizeConfig(window.MMEDLiveDrillsSDKV3Config || {});
  var SDK_BUNDLE_URL = "https://cdn.jsdelivr.net/npm/webex@3.12.0/umd/webex.min.js";
  var V3_CAMERA_STORAGE_KEY = "mmedWebexSdkV3CameraDeviceId";
  var V3_MIC_STORAGE_KEY = "mmedWebexSdkV3MicDeviceId";
  var V3_AUTO_ADMIT_STORAGE_KEY = "mmedWebexSdkV3AutoAdmit";
  var V3_HIDE_NO_VIDEO_STORAGE_KEY = "mmedWebexSdkV3HideNoVideo";
  var V3_SELF_VIEW_HIDDEN_STORAGE_KEY = "mmedWebexSdkV3SelfViewHidden";
  var LEGACY_CAMERA_STORAGE_KEY = "mmedWebexPreviewVideoDeviceId";
  var sdkLoadPromise = null;
  var active = {
    webex: null,
    meeting: null,
    cameraStream: null,
    microphoneStream: null,
    sourceMediaStream: null,
    mediaPath: "",
    stage: null,
    state: "idle",
    role: "unknown",
    error: ""
  };
  var preflight = {
    stream: null,
    audioContext: null,
    analyser: null,
    meterAnimation: 0,
    devices: [],
    permissionGranted: false,
    status: "idle"
  };
  var mediaDiagnostics = {
    selectedCameraLabel: "not selected",
    selectedMicLabel: "not selected",
    activeVideoTrackLabel: "not attached",
    activeAudioTrackLabel: "not attached",
    mediaPath: "idle"
  };
  var hostControls = {
    status: "Start the Webex session to use host controls.",
    capabilities: {},
    participants: [],
    recordingState: "unknown",
    recordingIssue: "",
    autoAdmit: loadAutoAdmitPreference(),
    hideNoVideo: loadHideNoVideoPreference()
  };
  var autoAdmitAttempts = {};
  var autoAdmitInFlight = {};
  var hostRosterPollTimer = 0;
  var hostRosterFallbackPollInFlight = false;
  var teamRosterFallbackParticipants = [];
	  var remoteMedia = {
	    status: "Waiting for remote students to join Webex.",
	    videos: [],
	    audios: [],
	    lastLayoutId: "",
	    lastLayout: null,
	    videoSourceCount: ""
	  };
	  var remoteVideoRescanTimer = 0;
	  var remoteVideoRescanUntil = 0;
	  var remoteMediaSourceBindings = {};
		  var speakerAudioPrefs = {
		    volume: 1,
		    muted: false
		  };
		  var hostSelfViewHidden = loadSelfViewHiddenPreference();
	  var preflightObserver = null;
	  var nonceRefreshPromise = null;

  document.documentElement.classList.add("mmed-live-drills-sdk-v3-route");

  function normalizeConfig(rawConfig) {
    var next = rawConfig && typeof rawConfig === "object" ? rawConfig : {};
    next.enabled = next.enabled === true;
    next.route = next.route || "daily-drills-live-webex-v3";
    next.runtimeMode = next.runtimeMode || "sdk-v3-isolated";
    next.stateEndpoint = next.stateEndpoint || "";
    next.viewerTicket = String(next.viewerTicket || "");
    return next;
  }

  function loadAutoAdmitPreference() {
    try {
      return window.localStorage ? window.localStorage.getItem(V3_AUTO_ADMIT_STORAGE_KEY) !== "off" : true;
    } catch (error) {
      return true;
    }
  }

  function saveAutoAdmitPreference(value) {
    hostControls.autoAdmit = value !== false;
    try {
      if (window.localStorage) {
        window.localStorage.setItem(V3_AUTO_ADMIT_STORAGE_KEY, hostControls.autoAdmit ? "on" : "off");
      }
    } catch (error) {}
  }

  function loadHideNoVideoPreference() {
    try {
      return window.localStorage ? window.localStorage.getItem(V3_HIDE_NO_VIDEO_STORAGE_KEY) === "on" : false;
    } catch (error) {
      return false;
    }
  }

  function saveHideNoVideoPreference(value) {
    hostControls.hideNoVideo = value === true;
    try {
      if (window.localStorage) {
        window.localStorage.setItem(V3_HIDE_NO_VIDEO_STORAGE_KEY, hostControls.hideNoVideo ? "on" : "off");
      }
    } catch (error) {}
  }

		  function loadSelfViewHiddenPreference() {
		    try {
		      return window.localStorage ? window.localStorage.getItem(V3_SELF_VIEW_HIDDEN_STORAGE_KEY) === "on" : false;
		    } catch (error) {
		      return false;
		    }
		  }

		  function saveSelfViewHiddenPreference(value) {
		    hostSelfViewHidden = value === true;
		    try {
		      if (window.localStorage) {
		        window.localStorage.setItem(V3_SELF_VIEW_HIDDEN_STORAGE_KEY, hostSelfViewHidden ? "on" : "off");
		      }
		    } catch (error) {}
		    applyHostSelfViewState();
		  }

  function embedConfig() {
    return window.MMEDLiveDrillsWebexPreview || {};
  }

  function teamConfig() {
    return window.MMEDLiveDrillsTeamChallengePreview || {};
  }

  function isV3Route() {
    return /\/daily-drills-live-webex-v3\/?$/i.test(window.location.pathname || "");
  }

  function isAdminMode() {
    var team = teamConfig();
    return !!(
      team.isAdmin ||
      team.mode === "admin" ||
      document.body.classList.contains("mmed-team-challenge-admin")
    );
  }

  function isDebugMode() {
    return isAdminMode() && /(?:^|[?&])(?:debug|sdk_debug|webex_debug)=1(?:&|$)/i.test(window.location.search || "");
  }

  function stateLabel(value) {
    var state = String(value || active.state || "idle").toLowerCase();
    if (state === "connected") return "Live";
    if (state === "loading") return "Connecting";
    if (state === "failed") return "Needs attention";
    return "Ready";
  }

  function readyMessage() {
    return isAdminMode()
      ? "Ready. Choose the Webex room, then click Start Live Webex Session."
      : "Ready. Choose Play or Watch to enter the live room.";
  }

  function restBaseUrl() {
    var embed = embedConfig();
    return String(embed.restUrl || (window.location.origin.replace(/\/$/, "") + "/wp-json/mmed/v1")).replace(/\/$/, "");
  }

  function restNonce() {
    return String(embedConfig().nonce || teamConfig().nonce || "");
  }

  function viewerTicket() {
    return String(teamConfig().viewerTicket || config.viewerTicket || "");
  }

  function isNonceError(error) {
    var message = String(error && error.message ? error.message : error || "");
    return /cookie check failed|rest_cookie_invalid_nonce|nonce/i.test(message);
  }

  function refreshRestNonce() {
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
      if (!window.MMEDLiveDrillsWebexPreview) {
        window.MMEDLiveDrillsWebexPreview = {};
      }
      window.MMEDLiveDrillsWebexPreview.nonce = nextConfig.nonce;
      if (window.MMEDLiveDrillsTeamChallengePreview) {
        window.MMEDLiveDrillsTeamChallengePreview.nonce = nextConfig.nonce;
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

  function collectErrorText(value, depth, seen) {
    var fields = ["message", "name", "code", "errorCode", "serviceErrorCode", "statusCode", "status", "rawErrorMessage", "errorDescription", "reason"];
    var nested = ["body", "error", "errors", "data", "response", "cause"];
    var parts = [];
    if (!value || depth > 3) return "";
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      return String(value);
    }
    if (typeof value !== "object") {
      return String(value || "");
    }
    if (seen.indexOf(value) !== -1) return "";
    seen.push(value);
    fields.forEach(function (field) {
      if (value[field] !== undefined && value[field] !== null) {
        parts.push(collectErrorText(value[field], depth + 1, seen));
      }
    });
    nested.forEach(function (field) {
      if (value[field] !== undefined && value[field] !== null) {
        parts.push(collectErrorText(value[field], depth + 1, seen));
      }
    });
    try {
      parts.push(JSON.stringify(value));
    } catch (error) {}
    return parts.filter(Boolean).join(" ");
  }

  function safeMessage(value) {
    return collectErrorText(value, 0, [])
      .replace(/<[^>]+>/g, " ")
      .replace(/Bearer\s+[A-Za-z0-9._~+/-]+/gi, "Bearer [redacted]")
      .replace(/(["']?access[_-]?token["']?\s*[:=]\s*["']?)[^"',}\s]+/gi, "$1[redacted]")
      .replace(/(["']?refresh[_-]?token["']?\s*[:=]\s*["']?)[^"',}\s]+/gi, "$1[redacted]")
      .replace(/(["']?(?:client_secret|api[_-]?key|host[_-]?key)["']?\s*[:=]\s*["']?)[^"',}\s]+/gi, "$1[redacted]")
      .replace(/nonce["']?\s*(?:content=|[:=])\s*["'][^"']+/gi, "nonce [redacted]")
      .replace(/https?:\/\/[^\s"'<>]+/gi, "https:[url-redacted]")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 800);
  }

  function currentMeeting() {
    var embedMeeting = embedConfig().meeting && typeof embedConfig().meeting === "object" ? embedConfig().meeting : {};
    var teamMeeting = teamConfig().meeting && typeof teamConfig().meeting === "object" ? teamConfig().meeting : {};
    return Object.assign({}, teamMeeting, embedMeeting);
  }

  function currentGuestIdentity() {
    var raw;
    var profile;
    var firstName;
    var lastName;
    var displayName;
    var team = teamConfig();

    try {
      raw = window.localStorage && window.localStorage.getItem("mmedLiveTeamChallengeGuest");
      profile = raw ? JSON.parse(raw) : {};
    } catch (error) {
      profile = {};
    }

    firstName = String(profile && profile.firstName ? profile.firstName : "").trim();
    lastName = String(profile && profile.lastName ? profile.lastName : "").trim();
    displayName = [firstName, lastName].filter(Boolean).join(" ").replace(/\s+/g, " ").trim();

    if (!displayName) {
      displayName = String(team.currentUserName || team.displayName || team.userName || "").replace(/\s+/g, " ").trim();
    }

    return {
      displayName: displayName.slice(0, 80),
      guestId: String(profile && profile.id ? profile.id : "").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 80)
    };
  }

  function destinationFromMeeting(meeting) {
    meeting = meeting || currentMeeting();
    return String(meeting.joinUrl || meeting.sipAddress || "").trim();
  }

  function readStoredValue(key) {
    try {
      return window.localStorage.getItem(key) || "";
    } catch (error) {
      return "";
    }
  }

  function writeStoredValue(key, value) {
    try {
      if (value) {
        window.localStorage.setItem(key, value);
      } else {
        window.localStorage.removeItem(key);
      }
    } catch (error) {}
  }

  function selectedValue(selector, fallbackKey) {
    var select = document.querySelector(selector);
    return String((select && select.value) || readStoredValue(fallbackKey) || "").trim();
  }

  function preferredVideoDeviceId() {
    return selectedValue("[data-sdk-v3-camera-select]", V3_CAMERA_STORAGE_KEY) || readStoredValue(LEGACY_CAMERA_STORAGE_KEY);
  }

  function preferredAudioDeviceId() {
    return selectedValue("[data-sdk-v3-mic-select]", V3_MIC_STORAGE_KEY);
  }

  function selectedOptionLabel(selector, emptyLabel) {
    var select = document.querySelector(selector);
    var option = select && select.options ? select.options[select.selectedIndex] : null;
    return String((option && option.textContent) || emptyLabel || "").trim();
  }

  function updateMeetingConfig(meeting) {
    if (!meeting || typeof meeting !== "object") return meeting || {};
    if (window.MMEDLiveDrillsWebexPreview) {
      window.MMEDLiveDrillsWebexPreview.meeting = Object.assign({}, window.MMEDLiveDrillsWebexPreview.meeting || {}, meeting);
    }
    if (window.MMEDLiveDrillsTeamChallengePreview) {
      window.MMEDLiveDrillsTeamChallengePreview.meeting = Object.assign({}, window.MMEDLiveDrillsTeamChallengePreview.meeting || {}, meeting);
    }
    return meeting;
  }

  function hostLaunchButtonText() {
    if (active.state === "loading") return "Starting Webex...";
    if (active.state === "connected") return active.role === "host" ? "Connected as Host" : "Connected";
    if (active.state === "failed") return "Failed, retry";
    return "Start Live Webex Session";
  }

  function updateHostLaunchButtons() {
    Array.prototype.slice.call(document.querySelectorAll("[data-sdk-v3-host-join]")).forEach(function (button) {
      button.disabled = active.state === "loading" || active.state === "connected";
      button.textContent = hostLaunchButtonText();
    });
  }

  function setState(nextState, role, message) {
    active.state = nextState || active.state || "idle";
    active.role = role || active.role || "unknown";
    active.error = message || "";

    Array.prototype.slice.call(document.querySelectorAll("[data-sdk-v3-state]")).forEach(function (node) {
      node.textContent = stateLabel(active.state);
      node.setAttribute("data-state", active.state);
    });

    Array.prototype.slice.call(document.querySelectorAll("[data-sdk-v3-role]")).forEach(function (node) {
      node.textContent = isDebugMode() ? "Role: " + active.role : "";
    });

    Array.prototype.slice.call(document.querySelectorAll("[data-sdk-v3-message]")).forEach(function (node) {
      node.textContent = message || "";
      node.setAttribute("data-state", active.state);
    });

    updateHostLaunchButtons();
    renderHostControls();
	  }

  function setEmbedStatus(stage, message, state) {
    var node = stage && stage.querySelector("[data-webex-embed-status]");
    if (!node) return;
    node.textContent = message || "";
    node.setAttribute("data-state", state || "idle");
  }

  function ensureStyles() {
    var style;
    if (document.getElementById("mmed-sdk-v3-poc-style")) return;
    style = document.createElement("style");
    style.id = "mmed-sdk-v3-poc-style";
    style.textContent = [
      ".mmed-sdk-v3-status{display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:8px;margin:0 auto 6px;color:#dbeafe;font-size:11px;font-weight:900;letter-spacing:.08em;text-transform:uppercase}",
      ".mmed-live-drills-sdk-v3-route .mmed-webex-host-drawer{display:none!important}",
      ".mmed-sdk-v3-status span{display:inline-flex;align-items:center;justify-content:center;min-height:26px;border:1px solid rgba(127,149,197,.34);border-radius:999px;background:rgba(5,10,26,.7);padding:0 10px}",
      ".mmed-sdk-v3-status [data-state='connected']{border-color:rgba(34,197,94,.72);color:#bbf7d0}",
      ".mmed-sdk-v3-status [data-state='failed']{border-color:rgba(248,113,113,.72);color:#fecaca}",
      ".mmed-sdk-v3-status [data-state='loading']{border-color:rgba(34,211,238,.72);color:#cffafe}",
      ".mmed-sdk-v3-button{border-color:rgba(34,211,238,.65)!important;background:linear-gradient(180deg,#0ea5e9,#155e75)!important;color:#ecfeff!important}",
      ".team-meeting-controls .mmed-sdk-v3-button{min-width:0}",
      ".mmed-sdk-v3-surface{position:absolute;inset:0;z-index:4;display:none;grid-template-rows:minmax(0,1fr) minmax(46px,auto);min-height:0;container-type:inline-size;background:radial-gradient(circle at 50% 16%,rgba(34,211,238,.13),transparent 34%),#030712;color:#fff}",
      ".live-stage.is-sdk-v3-active>.mmed-sdk-v3-surface{position:absolute!important;inset:0!important;width:100%!important;height:100%!important;display:grid!important;grid-template-rows:minmax(0,1fr) minmax(46px,auto)!important;min-height:0!important;max-height:none!important}",
      ".live-stage.is-sdk-v3-active .mmed-sdk-v3-surface{display:grid}",
      ".live-stage.is-sdk-v3-active .mmed-webex-embed-intro,.live-stage.is-sdk-v3-active .participant-strip{display:none!important}",
      ".mmed-sdk-v3-video-wrap{min-height:0;height:100%;display:grid;align-items:stretch;justify-items:center;padding:4px 8px;transition:padding .18s ease}",
      ".mmed-sdk-v3-surface.has-host-drawer-open .mmed-sdk-v3-video-wrap{padding-right:min(386px,38%)}",
      ".mmed-sdk-v3-video-stack{position:relative;width:min(1180px,99%);height:100%;display:grid;grid-template-rows:minmax(0,1fr);gap:8px;min-width:0;min-height:0}",
      ".mmed-sdk-v3-video-stack.has-remote-students{grid-template-rows:minmax(0,1fr) minmax(84px,18%)}",
      ".mmed-sdk-v3-remote-strip{display:none;position:relative;z-index:9;gap:8px;min-height:0;overflow-x:auto;overflow-y:hidden;padding:5px;border:1px solid rgba(34,211,238,.32);border-radius:13px;background:rgba(2,6,23,.82);box-shadow:0 14px 42px rgba(0,0,0,.34);scrollbar-width:thin}",
      ".mmed-sdk-v3-remote-strip[data-has-media='yes']{display:flex}",
      ".mmed-sdk-v3-remote-strip[data-has-media='no']{display:none}",
      ".mmed-sdk-v3-remote-strip[data-has-media='fallback']{display:flex}",
      ".mmed-sdk-v3-remote-tile{position:relative;flex:0 0 150px;aspect-ratio:16/9;overflow:hidden;border:1px solid rgba(127,149,197,.32);border-radius:10px;background:#020617}",
      ".mmed-sdk-v3-remote-stage{position:relative;display:none;min-width:0;min-height:0;border:1px solid rgba(34,211,238,.36);border-radius:16px;background:radial-gradient(circle at 50% 20%,rgba(34,211,238,.12),transparent 34%),#020617;box-shadow:0 24px 80px rgba(0,0,0,.5);overflow:hidden}",
      ".mmed-sdk-v3-video-stack.has-remote-students .mmed-sdk-v3-remote-stage{display:grid}",
      ".mmed-sdk-v3-remote-stage[data-layout='gallery']{grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:8px;padding:8px;align-content:center}",
      ".mmed-sdk-v3-remote-stage[data-layout='speaker']{grid-template-columns:minmax(0,1fr);padding:0}",
      ".mmed-sdk-v3-remote-main{position:relative;min-width:0;min-height:0;overflow:hidden;border:1px solid rgba(127,149,197,.28);border-radius:12px;background:#020617}",
      ".mmed-sdk-v3-remote-stage[data-layout='speaker'] .mmed-sdk-v3-remote-main{border:0;border-radius:0}",
      ".mmed-sdk-v3-remote-main video{width:100%;height:100%;display:block;object-fit:cover;background:#020617}",
      ".mmed-sdk-v3-remote-main span{position:absolute;left:12px;top:12px;max-width:calc(100% - 24px);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;border:1px solid rgba(255,255,255,.18);border-radius:999px;background:rgba(3,7,18,.76);padding:6px 9px;color:#fff;font-size:10px;font-weight:1000;letter-spacing:.08em;text-transform:uppercase}",
	      ".mmed-sdk-v3-remote-tile video{width:100%;height:100%;display:block;object-fit:cover;background:#020617}",
      ".mmed-sdk-v3-remote-tile span{position:absolute;left:6px;right:6px;bottom:5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;border-radius:999px;background:rgba(3,7,18,.76);padding:3px 6px;color:#dbeafe;font-size:8px;font-weight:1000;letter-spacing:.04em;text-transform:uppercase}",
      ".mmed-sdk-v3-remote-card{flex:0 0 148px;min-height:78px;display:grid;grid-template-columns:34px minmax(0,1fr);gap:8px;align-items:center;border:1px solid rgba(127,149,197,.28);border-radius:11px;background:linear-gradient(180deg,rgba(15,23,42,.88),rgba(2,6,23,.92));padding:8px;color:#fff}",
      ".mmed-sdk-v3-remote-card[data-video='on']{border-color:rgba(34,197,94,.52);box-shadow:0 0 24px rgba(34,197,94,.14)}",
      ".mmed-sdk-v3-remote-card-avatar{display:grid;place-items:center;width:34px;height:34px;border-radius:50%;background:linear-gradient(180deg,#1d4ed8,#111827);font-size:12px;font-weight:1000;letter-spacing:.04em}",
      ".mmed-sdk-v3-remote-card-main{min-width:0;display:grid;gap:4px}",
      ".mmed-sdk-v3-remote-card b{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:11px;font-weight:1000}",
      ".mmed-sdk-v3-remote-card span{color:#bfdbfe;font-size:9px;font-weight:1000;letter-spacing:.06em;text-transform:uppercase}",
      ".mmed-sdk-v3-remote-stage .mmed-sdk-v3-remote-card{align-self:center;justify-self:center;width:min(440px,92%);min-height:170px;grid-template-columns:58px minmax(0,1fr);padding:14px}",
      ".mmed-sdk-v3-remote-stage .mmed-sdk-v3-remote-card-avatar{width:58px;height:58px;font-size:18px}",
      ".mmed-sdk-v3-remote-stage .mmed-sdk-v3-remote-card b{font-size:18px}",
      ".mmed-sdk-v3-remote-stage .mmed-sdk-v3-remote-card span{font-size:11px}",
      ".mmed-sdk-v3-remote-stage[data-layout='gallery'] .mmed-sdk-v3-remote-card{width:100%;min-height:120px}",
	      ".mmed-sdk-v3-video-card{position:relative;width:100%;height:100%;min-height:0;display:grid;place-items:center;border:1px solid rgba(34,211,238,.36);border-radius:16px;background:#020617;box-shadow:0 24px 80px rgba(0,0,0,.5);overflow:hidden}",
      ".mmed-sdk-v3-video-stack.has-remote-students .mmed-sdk-v3-video-card{position:absolute;right:14px;bottom:14px;z-index:14;width:min(210px,24%);height:auto;aspect-ratio:16/9;min-height:0;border-color:rgba(250,204,21,.58);border-radius:12px;box-shadow:0 16px 46px rgba(0,0,0,.48),0 0 0 1px rgba(250,204,21,.16)}",
      ".mmed-sdk-v3-video-stack.has-remote-students .mmed-sdk-v3-video-label{left:8px;top:8px;padding:4px 7px;font-size:8px}",
      ".mmed-sdk-v3-self-view-toggle{display:none;position:absolute;right:8px;top:8px;z-index:3;min-height:24px;border:1px solid rgba(250,204,21,.56);border-radius:999px;background:rgba(3,7,18,.78);color:#fde68a;padding:3px 7px;font-size:8px;font-weight:1000;letter-spacing:.06em;text-transform:uppercase}",
      ".mmed-sdk-v3-video-stack.has-remote-students .mmed-sdk-v3-self-view-toggle{display:flex;align-items:center;justify-content:center}",
      ".mmed-sdk-v3-self-view-toggle[hidden]{display:none!important}",
      ".mmed-sdk-v3-video-card.is-self-hidden video{opacity:0}",
      ".mmed-sdk-v3-video-card.is-self-hidden:after{content:'Self-view hidden';position:absolute;inset:0;display:grid;place-items:center;padding:16px;text-align:center;color:#fde68a;background:rgba(3,7,18,.92);font-size:10px;font-weight:1000;letter-spacing:.08em;text-transform:uppercase}",
      ".mmed-sdk-v3-video-card video{position:absolute!important;inset:0!important;width:100%!important;height:100%!important;max-width:100%!important;max-height:100%!important;object-fit:contain!important;object-position:center center!important;background:#020617;display:block}",
      ".mmed-sdk-v3-video-label{position:absolute;left:14px;top:14px;display:flex;gap:8px;align-items:center;border:1px solid rgba(255,255,255,.18);border-radius:999px;background:rgba(3,7,18,.72);padding:8px 10px;color:#fff;font-size:11px;font-weight:1000;letter-spacing:.08em;text-transform:uppercase}",
      ".mmed-sdk-v3-footer{display:grid;grid-template-columns:minmax(0,1fr);gap:6px;padding:7px 12px;border-top:1px solid rgba(127,149,197,.24);background:rgba(5,10,26,.9);transition:padding .18s ease}",
      ".mmed-sdk-v3-surface.has-host-drawer-open .mmed-sdk-v3-footer{padding-right:12px}",
      ".mmed-sdk-v3-footer p{margin:0;color:#cbd5e1;font-size:11px;line-height:1.25;text-align:center}",
      ".mmed-sdk-v3-footer button{min-height:34px;border:1px solid rgba(127,149,197,.42);border-radius:999px;background:#111827;color:#fff;padding:0 12px;font-size:10px;font-weight:1000;letter-spacing:.055em;text-transform:uppercase}",
      ".mmed-sdk-v3-footer button[hidden]{display:none!important}",
      ".mmed-sdk-v3-toolbar{display:grid;grid-template-columns:repeat(auto-fit,minmax(82px,1fr));align-items:center;justify-content:center;gap:6px;width:100%;min-width:0;overflow:visible;padding:1px 0 3px}",
      ".mmed-sdk-v3-surface.has-host-drawer-open .mmed-sdk-v3-toolbar [data-sdk-v3-toggle-host-controls]{display:none!important}",
      ".mmed-sdk-v3-tool-button{display:inline-flex;align-items:center;justify-content:center;gap:6px;min-width:0;width:100%;white-space:nowrap;box-shadow:0 8px 24px rgba(0,0,0,.24)}",
      ".mmed-sdk-v3-tool-button[data-sdk-v3-mute-self],.mmed-sdk-v3-tool-button[data-sdk-v3-unmute-self]{border-color:rgba(34,197,94,.46);background:linear-gradient(180deg,#13233f,#0f172a)}",
      ".mmed-sdk-v3-tool-button[data-sdk-v3-record-start],.mmed-sdk-v3-tool-button[data-sdk-v3-record-resume],.mmed-sdk-v3-tool-button[data-sdk-v3-record-stop]{border-color:rgba(248,113,113,.7);background:linear-gradient(180deg,#ef4444,#7f1d1d)}",
      ".mmed-sdk-v3-tool-button[data-sdk-v3-record-pause]{border-color:rgba(250,204,21,.66);background:linear-gradient(180deg,#d97706,#78350f)}",
      ".mmed-sdk-v3-tool-button[data-sdk-v3-toggle-host-controls]{border-color:rgba(34,211,238,.55);background:linear-gradient(180deg,#0ea5e9,#155e75)}",
      ".mmed-sdk-v3-tool-button[data-sdk-v3-open-preflight],.mmed-sdk-v3-tool-button[data-sdk-v3-more-info]{border-color:rgba(127,149,197,.42);background:linear-gradient(180deg,#1e293b,#0f172a)}",
      ".mmed-sdk-v3-tool-button[data-sdk-v3-leave]{border-color:rgba(248,113,113,.66);background:linear-gradient(180deg,#ef4444,#7f1d1d)}",
      ".mmed-sdk-v3-tool-button:disabled{opacity:.48;cursor:not-allowed;filter:saturate(.55)}",
      ".mmed-sdk-v3-tool-button[data-sdk-v3-more-info]{opacity:.7}",
      ".mmed-sdk-v3-toolbar-status{display:flex;align-items:center;justify-content:center;gap:6px;min-width:0;color:#bfdbfe;font-size:9px;font-weight:1000;letter-spacing:.05em;text-transform:uppercase}",
      ".mmed-sdk-v3-toolbar-status span{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;border:1px solid rgba(127,149,197,.22);border-radius:999px;background:rgba(15,23,42,.72);padding:3px 7px}",
      ".mmed-sdk-v3-track-diagnostics{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:5px;flex:1 1 520px;max-width:820px;min-width:240px;color:#dbeafe;font-size:10px;line-height:1.25}",
      ".mmed-sdk-v3-track-diagnostics[hidden]{display:none!important}",
      ".mmed-sdk-v3-track-diagnostics span{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;border:1px solid rgba(127,149,197,.24);border-radius:999px;background:rgba(15,23,42,.7);padding:5px 8px}",
	      ".mmed-sdk-v3-preflight-launcher{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;align-items:center;min-width:0;padding:7px 8px;border:1px solid rgba(34,211,238,.28);border-radius:10px;background:rgba(8,20,45,.7)}",
	      ".mmed-sdk-v3-preflight-launcher span{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#bfdbfe;font-size:10px;font-weight:900;letter-spacing:.04em}",
	      ".mmed-sdk-v3-preflight-launcher button{min-height:34px;border-radius:9px;border:1px solid rgba(34,211,238,.5);background:linear-gradient(180deg,#0ea5e9,#155e75);color:#fff;padding:7px 10px;font-size:10px;font-weight:1000;letter-spacing:.06em;text-transform:uppercase}",
	      ".mmed-sdk-v3-preflight-modal{position:fixed;inset:0;z-index:100002;display:grid;place-items:center;padding:18px;background:rgba(1,5,16,.72);backdrop-filter:blur(8px)}",
	      ".mmed-sdk-v3-preflight-modal[hidden]{display:none}",
	      ".mmed-sdk-v3-preflight{position:relative;z-index:40;display:grid;grid-template-columns:minmax(0,1fr) minmax(240px,320px);gap:10px;align-items:stretch;width:min(980px,calc(100vw - 36px));min-width:0;max-width:100%;min-height:260px;overflow:visible;border:1px solid rgba(34,211,238,.34);border-radius:14px;background:linear-gradient(180deg,rgba(8,20,45,.98),rgba(4,9,23,.99));padding:12px;box-shadow:0 30px 90px rgba(0,0,0,.58),inset 0 1px 0 rgba(255,255,255,.05)}",
      ".mmed-sdk-v3-preflight-head{grid-column:1/-1;display:flex;align-items:center;justify-content:space-between;gap:8px;min-width:0;color:#cffafe;font-size:10px;font-weight:1000;letter-spacing:.08em;text-transform:uppercase}",
	      ".mmed-sdk-v3-preflight-head strong{color:#fff;white-space:nowrap}",
	      ".mmed-sdk-v3-preflight-head span{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#cbd5e1}",
	      ".mmed-sdk-v3-preflight-head button{min-height:30px;border-radius:8px;border:1px solid rgba(127,149,197,.32);background:#111827;color:#fff;padding:6px 10px;font-size:10px;font-weight:1000;letter-spacing:.06em;text-transform:uppercase}",
      ".mmed-sdk-v3-preflight-controls{position:relative;z-index:2;display:grid;grid-template-columns:minmax(120px,1fr) minmax(120px,1fr) repeat(3,minmax(74px,.55fr));gap:6px;align-items:end;min-width:0}",
      ".mmed-sdk-v3-field{display:grid;gap:3px;min-width:0}",
      ".mmed-sdk-v3-field label{color:#93c5fd;font-size:9px;font-weight:1000;letter-spacing:.08em;text-transform:uppercase}",
      ".mmed-sdk-v3-field select{min-width:0;width:100%;height:34px;border:1px solid rgba(127,149,197,.34);border-radius:8px;background:#071126;color:#fff;padding:0 8px;font-size:11px;font-weight:850;overflow:hidden;text-overflow:ellipsis}",
      ".mmed-sdk-v3-preflight button{min-width:0;min-height:34px;border-radius:8px;border:1px solid rgba(127,149,197,.32);background:#101a38;color:#fff;padding:5px 7px;font-size:9px;font-weight:1000;letter-spacing:.055em;line-height:1.05;text-transform:uppercase;white-space:normal}",
      ".mmed-sdk-v3-preflight [data-sdk-v3-start-preview]{border-color:rgba(34,197,94,.55);background:linear-gradient(180deg,#15803d,#064e3b)}",
      ".mmed-sdk-v3-preflight [data-sdk-v3-preflight-join]{min-height:42px;border-color:rgba(34,197,94,.72);background:linear-gradient(180deg,#16a34a,#14532d);box-shadow:0 0 28px rgba(34,197,94,.18)}",
      ".mmed-sdk-v3-preview{position:relative;z-index:1;min-height:104px;border:1px solid rgba(127,149,197,.28);border-radius:10px;background:#020617;overflow:hidden}",
      ".mmed-sdk-v3-preview video{display:block;width:100%;height:100%;min-height:104px;object-fit:contain;background:#020617}",
      ".mmed-sdk-v3-preview-empty{position:absolute;inset:0;display:grid;place-items:center;padding:10px;text-align:center;color:#94a3b8;font-size:10px;font-weight:900;letter-spacing:.06em;text-transform:uppercase;background:rgba(2,6,23,.72)}",
      ".mmed-sdk-v3-preview.is-active .mmed-sdk-v3-preview-empty{display:none}",
      ".mmed-sdk-v3-meter{position:absolute;left:8px;right:8px;bottom:8px;height:7px;border-radius:999px;background:rgba(15,23,42,.9);overflow:hidden;border:1px solid rgba(255,255,255,.12)}",
      ".mmed-sdk-v3-meter span{display:block;width:0;height:100%;border-radius:999px;background:linear-gradient(90deg,#22c55e,#facc15,#ef4444);transition:width .09s linear}",
      ".mmed-sdk-v3-device-summary{grid-column:1/-1;display:flex;flex-wrap:wrap;gap:6px;color:#bfdbfe;font-size:10px;line-height:1.25}",
      ".mmed-sdk-v3-device-summary span{min-width:0;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;border:1px solid rgba(127,149,197,.22);border-radius:999px;background:rgba(5,10,26,.58);padding:4px 7px}",
      ".mmed-sdk-v3-host-controls{position:absolute;z-index:18;right:10px;top:8px;bottom:104px;display:grid;grid-template-columns:minmax(0,360px) auto;align-items:stretch;max-width:calc(100% - 20px);max-height:none;pointer-events:none}",
      ".mmed-sdk-v3-host-controls:not(.is-open){grid-template-columns:auto}",
      ".mmed-sdk-v3-host-tab{grid-column:2;grid-row:1;pointer-events:auto;writing-mode:vertical-rl;transform:none;min-height:116px;border:1px solid rgba(250,204,21,.62);border-radius:10px 0 0 10px;background:linear-gradient(180deg,#facc15,#b45309);color:#111827;padding:9px 6px;font-size:10px;font-weight:1000;letter-spacing:.08em;text-transform:uppercase;box-shadow:0 12px 32px rgba(0,0,0,.35)}",
      ".mmed-sdk-v3-host-controls:not(.is-open) .mmed-sdk-v3-host-tab{grid-column:1}",
      ".mmed-sdk-v3-host-panel{pointer-events:auto;display:grid;grid-template-rows:auto auto auto minmax(0,1fr);gap:8px;min-width:0;width:min(360px,calc(100vw - 72px));height:100%;max-height:100%;overflow:hidden;border:1px solid rgba(250,204,21,.42);border-radius:12px;background:linear-gradient(180deg,rgba(7,12,28,.96),rgba(2,6,23,.99));padding:10px;box-shadow:0 18px 60px rgba(0,0,0,.48)}",
      ".mmed-sdk-v3-host-controls.is-open .mmed-sdk-v3-host-panel{grid-column:1;grid-row:1}",
      ".mmed-sdk-v3-host-controls:not(.is-open) .mmed-sdk-v3-host-panel{display:none}",
      ".mmed-sdk-v3-host-panel h3{margin:0;color:#fde68a;font-size:13px;font-weight:1000;letter-spacing:.08em;text-transform:uppercase}",
      ".mmed-sdk-v3-host-status{margin:0;color:#dbeafe;font-size:11px;line-height:1.35;font-weight:850}",
      ".mmed-sdk-v3-host-capabilities{display:none!important}",
      ".mmed-sdk-v3-host-capabilities span{border:1px solid rgba(127,149,197,.28);border-radius:999px;background:rgba(15,23,42,.82);padding:4px 7px;color:#dbeafe;font-size:9px;font-weight:1000;letter-spacing:.04em;text-transform:uppercase}",
      ".mmed-sdk-v3-host-capabilities span[data-available='yes']{border-color:rgba(34,197,94,.58);color:#bbf7d0}",
      ".mmed-sdk-v3-host-capabilities span[data-available='no']{border-color:rgba(248,113,113,.48);color:#fecaca}",
      ".mmed-sdk-v3-host-actions{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px}",
      ".mmed-sdk-v3-host-actions button,.mmed-sdk-v3-participant-row button{min-width:0;min-height:30px;border:1px solid rgba(127,149,197,.35);border-radius:8px;background:#111827;color:#fff;padding:5px 7px;font-size:9px;font-weight:1000;letter-spacing:.055em;line-height:1.05;text-transform:uppercase}",
      ".mmed-sdk-v3-host-actions button[hidden]{display:none!important}",
      ".mmed-sdk-v3-host-actions [data-sdk-v3-record-start],.mmed-sdk-v3-host-actions [data-sdk-v3-record-resume]{border-color:rgba(248,113,113,.65);background:linear-gradient(180deg,#ef4444,#7f1d1d)}",
      ".mmed-sdk-v3-host-actions [data-sdk-v3-mute-all],.mmed-sdk-v3-participant-row [data-sdk-v3-member-action='mute']{border-color:rgba(248,113,113,.58);background:linear-gradient(180deg,#dc2626,#7f1d1d)}",
      ".mmed-sdk-v3-host-actions [data-sdk-v3-unmute-all],.mmed-sdk-v3-participant-row [data-sdk-v3-member-action='unmute'],.mmed-sdk-v3-participant-row [data-sdk-v3-member-action='admit']{border-color:rgba(34,197,94,.55);background:linear-gradient(180deg,#16a34a,#064e3b)}",
      ".mmed-sdk-v3-host-actions [aria-pressed='true']{border-color:rgba(34,197,94,.68);background:linear-gradient(180deg,#15803d,#064e3b);color:#ecfdf5}",
      ".mmed-sdk-v3-host-actions button:disabled,.mmed-sdk-v3-participant-row button:disabled{opacity:.45;cursor:not-allowed;filter:saturate(.55)}",
      ".mmed-sdk-v3-participants{display:grid;grid-template-rows:auto minmax(0,1fr);gap:6px;min-width:0;min-height:0;overflow:hidden}",
      ".mmed-sdk-v3-participants h4{margin:2px 0 0;color:#bfdbfe;font-size:12px;font-weight:1000;letter-spacing:.08em;text-transform:uppercase}",
      ".mmed-sdk-v3-participants [data-sdk-v3-participant-list]{min-height:0;overflow:auto;display:grid;gap:6px;padding-right:2px;scrollbar-width:thin}",
      ".mmed-sdk-v3-participant-row{display:grid;grid-template-columns:minmax(0,1fr);gap:6px;align-items:center;min-width:0;border:1px solid rgba(127,149,197,.22);border-radius:10px;background:rgba(15,23,42,.72);padding:7px}",
      ".mmed-sdk-v3-participant-main{min-width:0;display:grid;gap:3px}",
      ".mmed-sdk-v3-participant-name{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#fff;font-size:11px;font-weight:1000}",
      ".mmed-sdk-v3-participant-meta{display:flex;flex-wrap:wrap;gap:4px;color:#cbd5e1;font-size:9px;font-weight:900;text-transform:uppercase}",
      ".mmed-sdk-v3-participant-meta span{border:1px solid rgba(127,149,197,.22);border-radius:999px;background:rgba(2,6,23,.64);padding:2px 5px}",
      ".mmed-sdk-v3-participant-actions{display:grid;grid-template-columns:repeat(auto-fit,minmax(74px,1fr));gap:5px}",
      ".mmed-sdk-v3-participant-note{color:#94a3b8;font-size:10px;font-weight:900;line-height:1.25}",
      ".mmed-sdk-v3-preflight[data-state='error']{border-color:rgba(248,113,113,.62)}",
      ".mmed-sdk-v3-preflight[data-state='ready']{border-color:rgba(34,197,94,.5)}",
      "@media(max-width:1080px){.mmed-sdk-v3-surface.has-host-drawer-open .mmed-sdk-v3-video-wrap,.mmed-sdk-v3-surface.has-host-drawer-open .mmed-sdk-v3-footer{padding-right:8px}.mmed-sdk-v3-host-controls{left:10px;right:10px;top:auto;bottom:54px;grid-template-columns:minmax(0,1fr);height:min(48vh,390px);max-width:none}.mmed-sdk-v3-host-controls:not(.is-open){left:auto;height:auto}.mmed-sdk-v3-host-tab{grid-column:1;grid-row:1;justify-self:end;align-self:end;writing-mode:horizontal-tb;min-height:32px;border-radius:10px 10px 0 0;padding:8px 12px}.mmed-sdk-v3-host-panel{width:100%;height:100%;max-height:100%;grid-column:1;grid-row:1;margin-top:34px}.mmed-sdk-v3-toolbar{grid-template-columns:repeat(auto-fit,minmax(88px,1fr))}}",
      "@media(max-width:720px){.mmed-sdk-v3-video-wrap{padding:8px}.mmed-sdk-v3-footer{padding:6px 8px}.mmed-sdk-v3-host-controls{top:auto;bottom:58px;height:min(55vh,420px)}.mmed-sdk-v3-host-panel{width:100%}.mmed-sdk-v3-host-actions{grid-template-columns:1fr 1fr}.mmed-sdk-v3-toolbar{grid-template-columns:repeat(3,minmax(0,1fr));gap:5px}.mmed-sdk-v3-footer button{min-height:32px;padding:0 6px;font-size:8px}.mmed-sdk-v3-preflight{grid-template-columns:minmax(0,1fr)}.mmed-sdk-v3-preflight-controls{grid-template-columns:repeat(2,minmax(0,1fr))}.mmed-sdk-v3-preview{display:none}}"
	    ].join("");
    document.head.appendChild(style);
  }

  function statusMarkup() {
    return [
      '<div class="mmed-sdk-v3-status" data-sdk-v3-status>',
        '<span data-sdk-v3-state data-state="idle">Ready</span>',
        isDebugMode() ? '<span data-sdk-v3-role>Role: unknown</span>' : "",
      '</div>',
      '<p class="mmed-webex-embed-status" data-sdk-v3-message data-state="idle"></p>'
    ].join("");
  }

	  function surfaceMarkup() {
	    var showDiagnostics = isDebugMode();
	    return [
	      '<div class="mmed-sdk-v3-surface" data-sdk-v3-surface>',
	        isAdminMode() ? hostControlsMarkup() : "",
	        '<div class="mmed-sdk-v3-video-wrap">',
	          '<div class="mmed-sdk-v3-video-stack">',
	          '<div class="mmed-sdk-v3-remote-stage" data-sdk-v3-remote-stage data-layout="speaker"></div>',
	          '<div class="mmed-sdk-v3-remote-strip" data-sdk-v3-remote-strip data-has-media="no">No other participants yet</div>',
            '<div data-sdk-v3-remote-audio-sinks hidden></div>',
	            '<div class="mmed-sdk-v3-video-card">',
	              '<video data-sdk-v3-local-video autoplay playsinline muted></video>',
	              '<div class="mmed-sdk-v3-video-label">' + (isAdminMode() ? "Host local camera" : "Your camera") + '</div>',
	              '<button type="button" class="mmed-sdk-v3-self-view-toggle" data-sdk-v3-toggle-self-view hidden>Hide self</button>',
	            '</div>',
          '</div>',
        '</div>',
        '<div class="mmed-sdk-v3-footer">',
          isAdminMode() ? hostToolbarMarkup() : "",
          '<div class="mmed-sdk-v3-track-diagnostics" data-sdk-v3-track-diagnostics' + (showDiagnostics ? "" : " hidden") + '>',
            '<span data-sdk-v3-selected-camera-label>Selected camera: not selected</span>',
            '<span data-sdk-v3-active-video-track-label>Active video track: not attached</span>',
            '<span data-sdk-v3-selected-mic-label>Selected mic: not selected</span>',
            '<span data-sdk-v3-active-audio-track-label>Active audio track: not attached</span>',
            '<span data-sdk-v3-media-path>Media path: idle</span>',
            showDiagnostics ? '<span data-sdk-v3-role>Role: unknown</span>' : "",
          '</div>',
	          '<p data-sdk-v3-message>' + attr(readyMessage()) + '</p>',
          isAdminMode() ? "" : '<button type="button" class="mmed-sdk-v3-tool-button" data-sdk-v3-leave>Leave Meeting</button>',
        '</div>',
      '</div>'
    ].join("");
  }

  function hostToolbarMarkup() {
    return [
      '<div class="mmed-sdk-v3-toolbar" data-sdk-v3-host-toolbar aria-label="Webex host toolbar">',
        '<button type="button" class="mmed-sdk-v3-tool-button" data-sdk-v3-mute-self title="Mute your microphone">Mute</button>',
        '<button type="button" class="mmed-sdk-v3-tool-button" data-sdk-v3-unmute-self title="Unmute your microphone">Unmute</button>',
        '<button type="button" class="mmed-sdk-v3-tool-button" data-sdk-v3-open-preflight title="Camera and microphone settings">Camera / Mic</button>',
        '<button type="button" class="mmed-sdk-v3-tool-button" data-sdk-v3-record-start title="Start Webex cloud recording">Record</button>',
        '<button type="button" class="mmed-sdk-v3-tool-button" data-sdk-v3-record-pause title="Pause Webex cloud recording">Pause Rec</button>',
        '<button type="button" class="mmed-sdk-v3-tool-button" data-sdk-v3-record-resume title="Resume Webex cloud recording">Resume Rec</button>',
        '<button type="button" class="mmed-sdk-v3-tool-button" data-sdk-v3-record-stop title="Stop Webex cloud recording">Stop Rec</button>',
        '<button type="button" class="mmed-sdk-v3-tool-button" data-sdk-v3-toggle-host-controls title="Show participant controls"><span data-sdk-v3-participant-count-label>Participants</span></button>',
        '<button type="button" class="mmed-sdk-v3-tool-button" data-sdk-v3-leave title="Leave the Webex meeting">Leave</button>',
      '</div>',
      '<div class="mmed-sdk-v3-toolbar-status" data-sdk-v3-toolbar-status>',
        '<span data-sdk-v3-record-state-label>Recording: unknown</span>',
        '<span data-sdk-v3-host-toolbar-message>Host controls become active after the Webex session connects.</span>',
      '</div>'
    ].join("");
  }

  function preflightMarkup() {
	    return [
	      '<div class="mmed-sdk-v3-preflight-launcher" data-sdk-v3-preflight-launcher>',
	        '<span data-sdk-v3-device-status>Camera permission needed. Mic permission needed.</span>',
		        '<button type="button" data-sdk-v3-open-preflight>Check Camera / Mic</button>',
	      '</div>',
	      '<div class="mmed-sdk-v3-preflight-modal" data-sdk-v3-preflight-modal hidden>',
	      '<section class="mmed-sdk-v3-preflight" data-sdk-v3-preflight data-state="idle">',
	        '<div class="mmed-sdk-v3-preflight-head">',
	          '<strong>Camera and mic check</strong>',
	          '<span data-sdk-v3-device-status>Camera permission needed. Mic permission needed.</span>',
	          '<button type="button" data-sdk-v3-close-preflight>Close</button>',
	        '</div>',
        '<div class="mmed-sdk-v3-preflight-controls">',
          '<div class="mmed-sdk-v3-field">',
            '<label for="mmed-sdk-v3-camera-select">Camera</label>',
            '<select id="mmed-sdk-v3-camera-select" data-sdk-v3-camera-select aria-label="Camera"><option value="">Default camera</option></select>',
          '</div>',
          '<div class="mmed-sdk-v3-field">',
            '<label for="mmed-sdk-v3-mic-select">Microphone</label>',
            '<select id="mmed-sdk-v3-mic-select" data-sdk-v3-mic-select aria-label="Microphone"><option value="">Default microphone</option></select>',
          '</div>',
          '<button type="button" data-sdk-v3-refresh-devices>Refresh devices</button>',
          '<button type="button" data-sdk-v3-start-preview>Preview devices</button>',
	          '<button class="mmed-sdk-v3-button" type="button" data-sdk-v3-host-join data-sdk-v3-preflight-join>Start Live Webex Session</button>',
        '</div>',
        '<div class="mmed-sdk-v3-preview" data-sdk-v3-preview>',
          '<video data-sdk-v3-preview-video autoplay playsinline muted></video>',
          '<div class="mmed-sdk-v3-preview-empty" data-sdk-v3-preview-empty>Preview off</div>',
          '<div class="mmed-sdk-v3-meter" aria-hidden="true"><span data-sdk-v3-mic-meter></span></div>',
        '</div>',
        '<div class="mmed-sdk-v3-device-summary" data-sdk-v3-device-summary>',
          '<span data-sdk-v3-camera-summary>Camera: not selected</span>',
          '<span data-sdk-v3-mic-summary>Mic: not selected</span>',
        '</div>',
	      '</section>',
	      '</div>'
	    ].join("");
	  }

  function hostControlsMarkup() {
    return [
      '<section class="mmed-sdk-v3-host-controls is-open" data-sdk-v3-host-controls>',
        '<button class="mmed-sdk-v3-host-tab" type="button" data-sdk-v3-toggle-host-controls>Participants</button>',
        '<div class="mmed-sdk-v3-host-panel">',
          '<h3>Webex participants</h3>',
          '<p class="mmed-sdk-v3-host-status" data-sdk-v3-host-control-status>Start the Webex session to use host controls.</p>',
          '<div class="mmed-sdk-v3-host-capabilities" data-sdk-v3-host-capabilities></div>',
          '<div class="mmed-sdk-v3-host-actions">',
            '<button type="button" data-sdk-v3-refresh-host-controls>Refresh roster</button>',
            '<button type="button" data-sdk-v3-auto-admit>Auto admit: on</button>',
            '<button type="button" data-sdk-v3-hide-no-video>Hide no-video: off</button>',
            '<button type="button" data-sdk-v3-mute-all>Mute all</button>',
            '<button type="button" data-sdk-v3-unmute-all>Unmute all if allowed</button>',
          '</div>',
          '<div class="mmed-sdk-v3-participants">',
            '<h4 data-sdk-v3-participant-heading>Participants (0)</h4>',
            '<div data-sdk-v3-participant-list></div>',
          '</div>',
        '</div>',
      '</section>'
    ].join("");
  }

  function syncHostDrawerLayout() {
    Array.prototype.slice.call(document.querySelectorAll("[data-sdk-v3-surface]")).forEach(function (surface) {
      var drawer = surface.querySelector("[data-sdk-v3-host-controls]");
      var open = !!(drawer && drawer.classList.contains("is-open"));
      surface.classList.toggle("has-host-drawer-open", open);
    });
  }

  function ensurePreflightUi() {
    var adminbar = document.querySelector(".shell.is-active [data-team-challenge-adminbar]") || document.querySelector("[data-team-challenge-adminbar]");
    var meetingControls = adminbar && adminbar.querySelector(".team-meeting-controls");
    if (!adminbar || !meetingControls || adminbar.querySelector("[data-sdk-v3-preflight]")) return;
    meetingControls.insertAdjacentHTML("afterend", preflightMarkup());
    refreshDevices(false);
    updateDeviceSummary();
  }

  function ensureStageUi(stage) {
	    var alreadyBound = stage && stage.getAttribute("data-sdk-v3-bound") === "1";
    if (!stage) return;

    if (!alreadyBound) {
      stage.setAttribute("data-sdk-v3-bound", "1");
      if (!stage.querySelector("[data-sdk-v3-surface]")) {
        stage.insertAdjacentHTML("beforeend", surfaceMarkup());
        syncHostDrawerLayout();
      }

	      if (!stage.querySelector("[data-sdk-v3-status]")) {
	        var intro = stage.querySelector(".mmed-webex-embed-intro");
        if (intro) {
          intro.insertAdjacentHTML("afterbegin", statusMarkup());
        }
      }
    }
    syncHostDrawerLayout();
	  }

  function ensureAllStageUi() {
    Array.prototype.slice.call(document.querySelectorAll("[data-live-stage]")).forEach(ensureStageUi);
    ensurePreflightUi();
  }

  function installPreflightObserver() {
    if (preflightObserver || !window.MutationObserver || !document.body) return;
    preflightObserver = new window.MutationObserver(function () {
      ensureAllStageUi();
      if (document.querySelector("[data-sdk-v3-preflight]")) {
        preflightObserver.disconnect();
        preflightObserver = null;
      }
    });
    preflightObserver.observe(document.body, {
      childList: true,
      subtree: true
    });
    window.setTimeout(ensureAllStageUi, 400);
    window.setTimeout(ensureAllStageUi, 1400);
    window.setTimeout(ensureAllStageUi, 3200);
  }

  function selectedStage() {
    return document.querySelector(".shell.is-active [data-live-stage]") || document.querySelector("[data-live-stage]");
  }

  function mediaDevices() {
    return window.navigator && window.navigator.mediaDevices ? window.navigator.mediaDevices : null;
  }

  function getSelect(selector) {
    return document.querySelector(selector);
  }

  function selectHasValue(select, value) {
    if (!select || !value) return false;
    return Array.prototype.slice.call(select.options || []).some(function (option) {
      return option.value === value;
    });
  }

  function deviceLabel(device, index, fallback) {
    return String(device.label || fallback + " " + (index + 1));
  }

  function selectedCameraLabel() {
    return selectedOptionLabel("[data-sdk-v3-camera-select]", "Default camera");
  }

  function selectedMicLabel() {
    return selectedOptionLabel("[data-sdk-v3-mic-select]", "Default microphone");
  }

  function safeTrackLabel(value, fallback) {
    var label = safeMessage(value || "");
    return label || fallback || "not available";
  }

  function mediaStreamTracks(stream, kind) {
    if (!stream) return [];
    if (kind === "video" && typeof stream.getVideoTracks === "function") {
      return stream.getVideoTracks();
    }
    if (kind === "audio" && typeof stream.getAudioTracks === "function") {
      return stream.getAudioTracks();
    }
    if (typeof stream.getTracks === "function") {
      return stream.getTracks().filter(function (track) {
        return track && track.kind === kind;
      });
    }
    return [];
  }

  function firstTrackLabel(stream, kind) {
    var tracks = mediaStreamTracks(stream, kind);
    return safeTrackLabel(tracks[0] && tracks[0].label, kind === "video" ? "unlabeled video track" : "unlabeled audio track");
  }

  function localStreamOutput(localStream) {
    return localStream && (localStream.outputStream || localStream.stream || localStream);
  }

  function localStreamTrackLabel(localStream, kind) {
    return firstTrackLabel(localStreamOutput(localStream), kind);
  }

  function updateMediaDiagnostics(values) {
    mediaDiagnostics = Object.assign({}, mediaDiagnostics, values || {});
    mediaDiagnostics.selectedCameraLabel = safeTrackLabel(mediaDiagnostics.selectedCameraLabel, "not selected");
    mediaDiagnostics.selectedMicLabel = safeTrackLabel(mediaDiagnostics.selectedMicLabel, "not selected");
    mediaDiagnostics.activeVideoTrackLabel = safeTrackLabel(mediaDiagnostics.activeVideoTrackLabel, "not attached");
    mediaDiagnostics.activeAudioTrackLabel = safeTrackLabel(mediaDiagnostics.activeAudioTrackLabel, "not attached");
    mediaDiagnostics.mediaPath = safeTrackLabel(mediaDiagnostics.mediaPath, "idle");

    Array.prototype.slice.call(document.querySelectorAll("[data-sdk-v3-selected-camera-label]")).forEach(function (node) {
      node.textContent = "Selected camera: " + mediaDiagnostics.selectedCameraLabel;
    });
    Array.prototype.slice.call(document.querySelectorAll("[data-sdk-v3-active-video-track-label]")).forEach(function (node) {
      node.textContent = "Active video track: " + mediaDiagnostics.activeVideoTrackLabel;
    });
    Array.prototype.slice.call(document.querySelectorAll("[data-sdk-v3-selected-mic-label]")).forEach(function (node) {
      node.textContent = "Selected mic: " + mediaDiagnostics.selectedMicLabel;
    });
    Array.prototype.slice.call(document.querySelectorAll("[data-sdk-v3-active-audio-track-label]")).forEach(function (node) {
      node.textContent = "Active audio track: " + mediaDiagnostics.activeAudioTrackLabel;
    });
    Array.prototype.slice.call(document.querySelectorAll("[data-sdk-v3-media-path]")).forEach(function (node) {
      node.textContent = "Media path: " + mediaDiagnostics.mediaPath;
    });
  }

  function updateSelectedDiagnostics() {
    updateMediaDiagnostics({
      selectedCameraLabel: selectedCameraLabel(),
      selectedMicLabel: selectedMicLabel()
    });
  }

  function isCallable(object, method) {
    return !!(object && typeof object[method] === "function");
  }

  function safeDisplayText(value, fallback) {
    var text = safeMessage(value || "");
    return text || fallback || "unknown";
  }

  function safeCapability(label, available) {
    return '<span data-available="' + (available ? "yes" : "no") + '">' + attr(label) + ": " + (available ? "yes" : "no") + '</span>';
  }

  function meetingMembersObject(meeting) {
    return meeting && meeting.members ? meeting.members : null;
  }

  function membersMapFromMeeting(meeting) {
    var members = meetingMembersObject(meeting);
    var collection = members && members.membersCollection;
    if (!collection) return {};
    if (typeof collection.getAll === "function") {
      try {
        return collection.getAll() || {};
      } catch (error) {
        return {};
      }
    }
    return collection.members && typeof collection.members === "object" ? collection.members : {};
  }

  function booleanStatus(value, yesLabel, noLabel) {
    if (value === true) return yesLabel;
    if (value === false) return noLabel;
    return "unknown";
  }

  function normalizeParticipant(member, id) {
    var members = meetingMembersObject(active.meeting);
    var memberId = String((member && member.id) || id || "");
    var name = safeDisplayText(member && member.name, member && member.isSelf ? "You" : "Participant");
    var status = safeDisplayText(member && member.status, "");
    return {
      id: memberId,
      name: name,
      status: status,
      isSelf: !!(member && member.isSelf) || !!(members && memberId && memberId === String(members.selfId || "")),
      isHost: !!(member && (member.isHost || member.isModerator)) || !!(members && memberId && memberId === String(members.hostId || "")),
      isInLobby: !!(member && member.isInLobby),
      isInMeeting: member && member.isInMeeting === false ? false : true,
      isAudioMuted: member ? member.isAudioMuted : null,
      isVideoMuted: member ? member.isVideoMuted : null,
      isMutable: member && member.isMutable === false ? false : true,
      sessionLocusUrl: safeDisplayText(member && (member.sessionLocusUrl || member.locusUrl || member.memberUrl || member.url), "")
    };
  }

  function participantSort(a, b) {
    if (a.isSelf !== b.isSelf) return a.isSelf ? -1 : 1;
    if (a.isHost !== b.isHost) return a.isHost ? -1 : 1;
    return a.name.localeCompare(b.name);
  }

  function collectParticipants(meeting) {
    var map = membersMapFromMeeting(meeting);
    var participants = Object.keys(map).map(function (id) {
      return normalizeParticipant(map[id], id);
    }).filter(function (participant) {
      return !!participant.id;
    });
    return mergeRosterFallbackParticipants(participants).sort(participantSort);
  }

  function rosterFallbackStateUrl() {
    var team = teamConfig();
    return team && team.stateUrl ? String(team.stateUrl) : "";
  }

  function rosterFallbackStudentId(student) {
    return String(student && (student.id || student.userId || student.email || student.name) || "").trim();
  }

  function normalizeRosterFallbackParticipant(student, team) {
    var id = rosterFallbackStudentId(student);
    var name = safeDisplayText(student && (student.name || student.displayName || student.fullName), "Student");
    return {
      id: "roster:" + id,
      name: name,
      status: safeDisplayText(team && team.name, "Daily Drills roster"),
      isSelf: false,
      isHost: false,
      isInLobby: false,
      isInMeeting: true,
      isAudioMuted: null,
      isVideoMuted: null,
      isMutable: false,
      isRosterFallback: true,
      sessionLocusUrl: ""
    };
  }

  function normalizeRosterFallbackState(payload) {
    if (payload && Array.isArray(payload.teams)) return payload;
    if (payload && payload.state && Array.isArray(payload.state.teams)) return payload.state;
    if (payload && payload.data && Array.isArray(payload.data.teams)) return payload.data;
    return null;
  }

  function collectRosterFallbackParticipants(payload) {
    var nextState = normalizeRosterFallbackState(payload);
    var output = [];
    if (!nextState || !Array.isArray(nextState.teams)) return output;
    nextState.teams.forEach(function (team) {
      (Array.isArray(team.students) ? team.students : []).forEach(function (student) {
        var id = rosterFallbackStudentId(student);
        if (!id) return;
        output.push(normalizeRosterFallbackParticipant(student, team));
      });
    });
    return output;
  }

  function participantLikelySamePerson(a, b) {
    var aName = String(a && a.name || "").trim().toLowerCase();
    var bName = String(b && b.name || "").trim().toLowerCase();
    if (!aName || !bName) return false;
    return aName === bName || aName.indexOf(bName) !== -1 || bName.indexOf(aName) !== -1;
  }

  function mergeRosterFallbackParticipants(participants) {
    var merged = (participants || []).slice();
    var remoteSdkParticipants = merged.filter(function (participant) {
      return participant && !participant.isSelf && (participant.isInMeeting || participant.isInLobby);
    });
    if (remoteSdkParticipants.length || !teamRosterFallbackParticipants.length) {
      return merged;
    }
    teamRosterFallbackParticipants.forEach(function (fallback) {
      var exists = merged.some(function (participant) {
        return participantLikelySamePerson(participant, fallback);
      });
      if (!exists) merged.push(fallback);
    });
    return merged;
  }

  function fetchTeamRosterFallback() {
    var url = rosterFallbackStateUrl();
    var headers = { "Accept": "application/json" };
    if (!isAdminMode() || !url || !window.fetch || hostRosterFallbackPollInFlight) {
      return Promise.resolve(teamRosterFallbackParticipants);
    }
    hostRosterFallbackPollInFlight = true;
    if (restNonce()) {
      headers["X-WP-Nonce"] = restNonce();
    }
    return window.fetch(url + (url.indexOf("?") === -1 ? "?" : "&") + "mmed_v3_roster_fallback_ts=" + Date.now(), {
      method: "GET",
      credentials: "same-origin",
      cache: "no-store",
      headers: headers
    }).then(function (response) {
      return response.json().catch(function () { return {}; });
    }).then(function (payload) {
      teamRosterFallbackParticipants = collectRosterFallbackParticipants(payload);
      hostRosterFallbackPollInFlight = false;
      return teamRosterFallbackParticipants;
    }, function () {
      hostRosterFallbackPollInFlight = false;
      return teamRosterFallbackParticipants;
    });
  }

  function recordingState(meeting) {
    var recording = meeting && meeting.recording;
    var members = meetingMembersObject(meeting);
    if (recording && typeof recording === "object") {
      return safeDisplayText(recording.state || recording.status || recording.recordingState || (recording.id ? "active" : ""), "unknown");
    }
    if (members && members.recordingId) return "active";
    return "not active";
  }

  function normalizedRecordingState(value) {
    var state = String(value || "").toLowerCase();
    if (/pause/.test(state)) return "paused";
    if (/active|started|recording|inprogress|in_progress/.test(state)) return "active";
    if (/stop|idle|inactive|not active|none|unknown/.test(state)) return "idle";
    return state || "idle";
  }

  function probeHostCapabilities(meeting) {
    var participants = collectParticipants(meeting);
    var connected = active.state === "connected" && !!meeting;
    var localAudioTrack = mediaStreamTracks(localStreamOutput(active.microphoneStream) || active.sourceMediaStream || preflight.stream, "audio").length > 0;
    return {
      connected: connected,
      hostRole: active.role === "host",
      participants: connected && !!meetingMembersObject(meeting),
      admit: connected && isCallable(meeting, "admit"),
      remoteMute: connected && isCallable(meeting, "mute"),
      selfAudio: connected && ((isCallable(meeting, "muteAudio") && isCallable(meeting, "unmuteAudio")) || localAudioTrack),
      localAudioTrack: connected && localAudioTrack,
      localAudioState: connected ? localAudioTrackState() : "unavailable",
      selfVideo: connected && isCallable(meeting, "muteVideo") && isCallable(meeting, "unmuteVideo"),
      recording: connected && isCallable(meeting, "startRecording") && isCallable(meeting, "stopRecording"),
      recordingPause: connected && isCallable(meeting, "pauseRecording") && isCallable(meeting, "resumeRecording"),
      participantsCount: participants.length
    };
  }

  function refreshHostControls(message) {
    var meeting = active.meeting;
    hostControls.participants = collectParticipants(meeting);
    hostControls.capabilities = probeHostCapabilities(meeting);
    hostControls.recordingState = recordingState(meeting);
    if (message) {
      hostControls.status = message;
    } else if (!meeting || active.state !== "connected") {
      hostControls.status = "Start the Webex session to use host controls.";
    } else if (active.role !== "host") {
      hostControls.status = "Connected, but Webex did not report host role. Host-only controls may be rejected.";
    } else {
      hostControls.status = "Webex host controls are ready. Recording and mute commands still depend on Webex account and meeting permissions.";
    }
    renderHostControls();
    renderRemoteMedia();
    window.setTimeout(maybeAutoAdmitLobbyParticipants, 0);
  }

  function resetHostControls(message) {
    hostControls = {
      status: message || "Start the Webex session to use host controls.",
      capabilities: {},
      participants: [],
      recordingState: "unknown",
      recordingIssue: "",
      autoAdmit: loadAutoAdmitPreference(),
      hideNoVideo: loadHideNoVideoPreference()
    };
    renderHostControls();
  }

  function renderHostControlButtons(capabilities) {
    var connected = !!(capabilities && capabilities.connected);
    var hostRole = !!(capabilities && capabilities.hostRole);
    var remoteMute = !!(capabilities && capabilities.remoteMute && hostRole);
    var selfAudio = !!(capabilities && capabilities.selfAudio);
    var recordingIssue = !!hostControls.recordingIssue;
    var recording = !!(capabilities && capabilities.recording && hostRole && !recordingIssue);
    var recordingPause = !!(capabilities && capabilities.recordingPause && hostRole && !recordingIssue);
    var currentRecordingState = normalizedRecordingState(hostControls.recordingState);
    var showRecordStart = currentRecordingState !== "active" && currentRecordingState !== "paused";
    var showRecordPause = currentRecordingState === "active";
    var showRecordResume = currentRecordingState === "paused";
    var showRecordStop = currentRecordingState === "active" || currentRecordingState === "paused";

    Array.prototype.slice.call(document.querySelectorAll("[data-sdk-v3-refresh-host-controls]")).forEach(function (button) {
      button.disabled = !connected;
    });
    Array.prototype.slice.call(document.querySelectorAll("[data-sdk-v3-mute-self]")).forEach(function (button) {
      button.hidden = !!(connected && selfAudio && capabilities.localAudioState === "muted");
      button.disabled = !selfAudio;
      button.textContent = "Mute";
    });
    Array.prototype.slice.call(document.querySelectorAll("[data-sdk-v3-unmute-self]")).forEach(function (button) {
      button.hidden = !(connected && selfAudio && capabilities.localAudioState === "muted");
      button.disabled = !selfAudio;
      button.textContent = "Unmute";
    });
    Array.prototype.slice.call(document.querySelectorAll("[data-sdk-v3-mute-all],[data-sdk-v3-unmute-all]")).forEach(function (button) {
      button.disabled = !remoteMute || hostControls.participants.filter(function (participant) {
        return !participant.isSelf && participant.isInMeeting && !participant.isInLobby;
      }).length === 0;
    });
    Array.prototype.slice.call(document.querySelectorAll("[data-sdk-v3-record-start]")).forEach(function (button) {
      button.hidden = !showRecordStart;
      button.disabled = !recording;
      button.textContent = recordingIssue ? "Use Webex app" : "Record";
      button.title = recordingIssue ? hostControls.recordingIssue : "Start Webex cloud recording";
    });
    Array.prototype.slice.call(document.querySelectorAll("[data-sdk-v3-record-pause]")).forEach(function (button) {
      button.hidden = !showRecordPause;
      button.disabled = !recordingPause;
      button.textContent = recordingIssue ? "Use Webex app" : "Pause Rec";
      button.title = recordingIssue ? hostControls.recordingIssue : "Pause Webex cloud recording";
    });
    Array.prototype.slice.call(document.querySelectorAll("[data-sdk-v3-record-resume]")).forEach(function (button) {
      button.hidden = !showRecordResume;
      button.disabled = !recordingPause;
      button.textContent = recordingIssue ? "Use Webex app" : "Resume Rec";
      button.title = recordingIssue ? hostControls.recordingIssue : "Resume Webex cloud recording";
    });
    Array.prototype.slice.call(document.querySelectorAll("[data-sdk-v3-record-stop]")).forEach(function (button) {
      button.hidden = !showRecordStop;
      button.disabled = !recording;
      button.textContent = recordingIssue ? "Stop in Webex app" : "Stop Rec";
      button.title = recordingIssue ? hostControls.recordingIssue : "Stop Webex cloud recording";
    });
    Array.prototype.slice.call(document.querySelectorAll("[data-sdk-v3-auto-admit]")).forEach(function (button) {
      button.disabled = !connected || !hostRole || !(capabilities && capabilities.admit);
      button.textContent = "Auto admit: " + (hostControls.autoAdmit ? "on" : "off");
      button.setAttribute("aria-pressed", hostControls.autoAdmit ? "true" : "false");
      button.classList.toggle("is-active", !!hostControls.autoAdmit);
    });
    Array.prototype.slice.call(document.querySelectorAll("[data-sdk-v3-hide-no-video]")).forEach(function (button) {
      button.disabled = false;
      button.textContent = "Hide no-video: " + (hostControls.hideNoVideo ? "on" : "off");
      button.setAttribute("aria-pressed", hostControls.hideNoVideo ? "true" : "false");
      button.classList.toggle("is-active", !!hostControls.hideNoVideo);
    });
    Array.prototype.slice.call(document.querySelectorAll("[data-sdk-v3-toggle-self-view]")).forEach(function (button) {
      button.hidden = !isAdminMode();
    });
  }

  function participantHasVideo(participant) {
    return !!(participant && participant.isVideoMuted === false);
  }

  function visibleHostParticipants() {
    var participants = hostControls.participants || [];
    if (!hostControls.hideNoVideo) return participants;
    return participants.filter(function (participant) {
      return participant.isSelf || participant.isHost || participant.isInLobby || participantHasVideo(participant);
    });
  }

  function renderParticipantRow(participant, index) {
    var canRemoteMute = !!(hostControls.capabilities && hostControls.capabilities.hostRole && hostControls.capabilities.remoteMute && participant.id && !participant.isSelf && participant.isInMeeting && !participant.isInLobby);
    var canAdmit = !!(hostControls.capabilities && hostControls.capabilities.hostRole && hostControls.capabilities.admit && participant.id && participant.isInLobby);
    var actions = [];
    var meta = [
      participant.isSelf ? "you" : "",
      participant.isHost ? "host" : "",
      participant.isInLobby ? "lobby" : "",
      booleanStatus(participant.isAudioMuted, "audio muted", "audio live"),
      booleanStatus(participant.isVideoMuted, "video off", "video on"),
      participant.status
    ].filter(Boolean);

    if (canAdmit) {
      actions.push('<button type="button" data-sdk-v3-member-action="admit" data-sdk-v3-member-index="' + attr(index) + '">Let in</button>');
    }

    if (canRemoteMute) {
      actions.push('<button type="button" data-sdk-v3-member-action="mute" data-sdk-v3-member-index="' + attr(index) + '"' + (participant.isAudioMuted === true ? " disabled" : "") + '>Mute</button>');
      actions.push('<button type="button" data-sdk-v3-member-action="unmute" data-sdk-v3-member-index="' + attr(index) + '"' + (participant.isAudioMuted === false ? " disabled" : "") + '>Ask unmute</button>');
    } else if (!participant.isSelf && participant.isInMeeting && !participant.isInLobby) {
      actions.push('<span class="mmed-sdk-v3-participant-note">Webex did not expose mute controls for this participant yet.</span>');
    } else if (participant.isSelf) {
      actions.push('<span class="mmed-sdk-v3-participant-note">Use the main Mic button for your own audio.</span>');
    }

    return [
      '<div class="mmed-sdk-v3-participant-row">',
        '<div class="mmed-sdk-v3-participant-main">',
          '<span class="mmed-sdk-v3-participant-name">' + attr(participant.name) + '</span>',
          '<span class="mmed-sdk-v3-participant-meta">' + meta.map(function (item) { return '<span>' + attr(item) + '</span>'; }).join("") + '</span>',
        '</div>',
        '<div class="mmed-sdk-v3-participant-actions">' + actions.join("") + '</div>',
      '</div>'
    ].join("");
  }

  function renderHostControls() {
    var capabilities = hostControls.capabilities || {};
    Array.prototype.slice.call(document.querySelectorAll("[data-sdk-v3-host-control-status]")).forEach(function (node) {
      node.textContent = hostControls.status || "";
    });
    Array.prototype.slice.call(document.querySelectorAll("[data-sdk-v3-host-capabilities]")).forEach(function (node) {
      node.innerHTML = [
        safeCapability("participants", !!capabilities.participants),
        safeCapability("admit", !!capabilities.admit),
        safeCapability("remote mute", !!capabilities.remoteMute),
        safeCapability("self audio", !!capabilities.selfAudio),
        '<span data-available="' + (capabilities.localAudioTrack ? "yes" : "no") + '">local mic: ' + attr(capabilities.localAudioState || "unavailable") + '</span>',
        safeCapability("recording", !!capabilities.recording),
        '<span data-available="' + (hostControls.recordingState && hostControls.recordingState !== "unknown" ? "yes" : "no") + '">recording: ' + attr(hostControls.recordingState || "unknown") + '</span>'
      ].join("");
    });
    Array.prototype.slice.call(document.querySelectorAll("[data-sdk-v3-participant-heading]")).forEach(function (node) {
      node.textContent = "Participants (" + hostControls.participants.length + ")";
    });
    Array.prototype.slice.call(document.querySelectorAll("[data-sdk-v3-participant-count-label]")).forEach(function (node) {
      node.textContent = "Participants (" + hostControls.participants.length + ")";
    });
    Array.prototype.slice.call(document.querySelectorAll("[data-sdk-v3-record-state-label]")).forEach(function (node) {
      node.textContent = hostControls.recordingIssue ? "Recording needs Webex app" : "Recording: " + (hostControls.recordingState || "unknown");
    });
    Array.prototype.slice.call(document.querySelectorAll("[data-sdk-v3-host-toolbar-message]")).forEach(function (node) {
      node.textContent = hostControls.recordingIssue || hostControls.status || "Host controls become active after the Webex session connects.";
    });
    Array.prototype.slice.call(document.querySelectorAll("[data-sdk-v3-participant-list]")).forEach(function (node) {
      var visibleParticipants = hostControls.participants.map(function (participant, index) {
        return { participant: participant, index: index };
      }).filter(function (entry) {
        return visibleHostParticipants().indexOf(entry.participant) !== -1;
      });
      node.innerHTML = visibleParticipants.length
        ? visibleParticipants.map(function (entry) { return renderParticipantRow(entry.participant, entry.index); }).join("")
        : '<p class="mmed-sdk-v3-host-status">Only the host is visible right now. Students appear here after they join this exact Webex room and Webex exposes them to the browser SDK.</p>';
    });
    renderHostControlButtons(capabilities);
  }

  function setHostControlStatus(message, state) {
    hostControls.status = message || "";
    Array.prototype.slice.call(document.querySelectorAll("[data-sdk-v3-host-control-status]")).forEach(function (node) {
      node.textContent = hostControls.status;
      node.setAttribute("data-state", state || "idle");
    });
  }

  function runSdkMeetingCommand(actionLabel, callback, successMessage) {
    setHostControlStatus(actionLabel + "...", "loading");
    return Promise.resolve().then(callback).then(function () {
      refreshHostControls(successMessage);
      window.setTimeout(function () {
        refreshHostControls();
      }, 900);
    }).catch(function (error) {
      refreshHostControls(actionLabel + " failed: " + actionableError(error));
    });
  }

  function runRecordingCommand(actionLabel, callback, successMessage) {
    setHostControlStatus(actionLabel + "...", "loading");
    return Promise.resolve().then(callback).then(function () {
      hostControls.recordingIssue = "";
      refreshHostControls(successMessage);
      window.setTimeout(function () {
        refreshHostControls();
      }, 900);
    }).catch(function (error) {
      hostControls.recordingIssue = actionLabel + " failed. Use the Webex app recording control for this meeting.";
      refreshHostControls(hostControls.recordingIssue + " " + actionableError(error));
    });
  }

  function setLocalAudioTrackEnabled(enabled) {
    var outputStream = localStreamOutput(active.microphoneStream) || active.sourceMediaStream || preflight.stream;
    var tracks = mediaStreamTracks(outputStream, "audio");
    if (!tracks.length) {
      return Promise.reject(new Error("No local microphone track is available."));
    }
    tracks.forEach(function (track) {
      track.enabled = !!enabled;
    });
    return Promise.resolve();
  }

  function hasLocalAudioTrack() {
    return mediaStreamTracks(localStreamOutput(active.microphoneStream) || active.sourceMediaStream || preflight.stream, "audio").length > 0;
  }

  function localAudioTrackState() {
    var tracks = mediaStreamTracks(localStreamOutput(active.microphoneStream) || active.sourceMediaStream || preflight.stream, "audio");
    if (!tracks.length) return "unavailable";
    return tracks.some(function (track) { return track.enabled !== false; }) ? "live" : "muted";
  }

  function runSelfAudioMute(mute) {
    var meeting = active.meeting;
    var actionLabel = mute ? "Muting host microphone" : "Unmuting host microphone";
    var successMessage = mute ? "Host microphone muted." : "Host microphone unmuted.";
    setHostControlStatus(actionLabel + "...", "loading");
    if (!meeting || active.state !== "connected") {
      refreshHostControls("Start the Webex session before using microphone controls.");
      return Promise.resolve();
    }

    return Promise.resolve().then(function () {
      if (active.mediaPath === "browser MediaStream wrapped for Webex" && hasLocalAudioTrack()) {
        return setLocalAudioTrackEnabled(!mute).then(function () {
          return "local-track";
        });
      }
      if (mute && isCallable(meeting, "muteAudio")) {
        return meeting.muteAudio();
      }
      if (!mute && isCallable(meeting, "unmuteAudio")) {
        return meeting.unmuteAudio();
      }
      return setLocalAudioTrackEnabled(!mute).then(function () {
        return "local-track";
      });
    }).then(function (path) {
      refreshHostControls(path === "local-track" ? "Browser local microphone track " + (mute ? "muted." : "unmuted.") : successMessage);
    }).catch(function (error) {
      return setLocalAudioTrackEnabled(!mute).then(function () {
        refreshHostControls("Webex self-audio control was rejected (" + actionableError(error) + "). Browser local microphone track was " + (mute ? "muted" : "unmuted") + " instead.");
      }, function (fallbackError) {
        refreshHostControls(actionLabel + " failed: " + actionableError(fallbackError || error));
      });
    }).then(function () {
      window.setTimeout(function () {
        refreshHostControls();
      }, 900);
    });
  }

  function participantForButton(button) {
    var index = Number(button && button.getAttribute("data-sdk-v3-member-index"));
    if (!isFinite(index) || index < 0) return null;
    return hostControls.participants[index] || null;
  }

  function remoteParticipantsForMute() {
    return hostControls.participants.filter(function (participant) {
      return participant.id && !participant.isSelf && participant.isInMeeting && !participant.isInLobby;
    });
  }

  function runParticipantAdmit(participant) {
    var meeting = active.meeting;
    if (!meeting || active.state !== "connected") {
      refreshHostControls("Start the Webex session before admitting lobby participants.");
      return Promise.resolve();
    }
    if (!participant || !participant.id || !participant.isInLobby || !isCallable(meeting, "admit")) {
      refreshHostControls("The SDK did not expose an admit control for this participant.");
      return Promise.resolve();
    }
    return runSdkMeetingCommand("Letting " + participant.name + " into Webex", function () {
      return meeting.admit([participant.id]);
    }, participant.name + " admitted if Webex accepted the command.");
  }

  function lobbyParticipantsForAdmit() {
    return hostControls.participants.filter(function (participant) {
      return participant.id && !participant.isSelf && participant.isInLobby;
    });
  }

  function maybeAutoAdmitLobbyParticipants() {
    var meeting = active.meeting;
    var now = Date.now();
    var targets;
    if (!hostControls.autoAdmit || !meeting || active.state !== "connected") return;
    if (!hostControls.capabilities || !hostControls.capabilities.hostRole || !hostControls.capabilities.admit || !isCallable(meeting, "admit")) return;

    targets = lobbyParticipantsForAdmit().filter(function (participant) {
      var lastAttempt = autoAdmitAttempts[participant.id] || 0;
      return !autoAdmitInFlight[participant.id] && now - lastAttempt > 12000;
    });

    targets.forEach(function (participant) {
      autoAdmitAttempts[participant.id] = now;
      autoAdmitInFlight[participant.id] = true;
      Promise.resolve(meeting.admit([participant.id])).then(function () {
        delete autoAdmitInFlight[participant.id];
        refreshHostControls("Auto-admit sent for " + participant.name + ".");
      }, function (error) {
        delete autoAdmitInFlight[participant.id];
        refreshHostControls("Auto-admit was rejected for " + participant.name + " (" + actionableError(error) + "). Use Let in or the Webex app fallback.");
      });
    });
  }

  function runParticipantMute(participant, mute) {
    var meeting = active.meeting;
    if (!meeting || active.state !== "connected") {
      refreshHostControls("Start the Webex session before using participant controls.");
      return Promise.resolve();
    }
    if (participant && participant.isSelf) {
      return runSelfAudioMute(mute);
    }
    if (!participant || !participant.id || !isCallable(meeting, "mute")) {
      refreshHostControls("The SDK did not expose remote mute for this participant.");
      return Promise.resolve();
    }
    return runSdkMeetingCommand((mute ? "Muting " : "Requesting unmute for ") + participant.name, function () {
      return meeting.mute(participant.id, mute);
    }, mute ? participant.name + " muted if Webex accepted the command." : participant.name + " unmute requested if Webex accepted the command.");
  }

  function runMuteAll(mute) {
    var meeting = active.meeting;
    var targets = remoteParticipantsForMute();
    if (!meeting || active.state !== "connected") {
      refreshHostControls("Start the Webex session before using mute-all.");
      return Promise.resolve();
    }
    if (!targets.length) {
      refreshHostControls("No remote SDK participants are available to " + (mute ? "mute." : "unmute."));
      return Promise.resolve();
    }
    if (!isCallable(meeting, "mute")) {
      refreshHostControls("The SDK did not expose remote mute controls in this meeting state.");
      return Promise.resolve();
    }
    return runSdkMeetingCommand(mute ? "Muting all remote participants" : "Requesting unmute for all remote participants", function () {
      return Promise.all(targets.map(function (participant) {
        return meeting.mute(participant.id, mute).then(function () {
          return { ok: true };
        }, function (error) {
          return { ok: false, error: error };
        });
      })).then(function (results) {
        var failed = results.filter(function (result) { return !result.ok; }).length;
        if (failed) {
          throw new Error(failed + " of " + results.length + " Webex mute commands were rejected.");
        }
      });
    }, mute ? "Mute all sent to Webex." : "Unmute all sent to Webex where allowed.");
  }

  function refreshRemoteParticipantFallback() {
    if (!active.meeting) return;
    hostControls.participants = collectParticipants(active.meeting);
  }

  function stopHostRosterPoll() {
    if (hostRosterPollTimer) {
      window.clearInterval(hostRosterPollTimer);
      hostRosterPollTimer = 0;
    }
  }

  function startHostRosterPoll() {
    if (!isAdminMode()) return;
    stopHostRosterPoll();
    fetchTeamRosterFallback().then(function () {
      if (active.meeting && active.state === "connected") {
        refreshHostControls();
      }
    });
    hostRosterPollTimer = window.setInterval(function () {
      if (!active.meeting || active.state !== "connected") {
        stopHostRosterPoll();
        return;
      }
      fetchTeamRosterFallback().then(function () {
        refreshHostControls();
      }, function () {
        refreshHostControls();
      });
    }, 2000);
  }

  function bindHostControlEvents(meeting) {
    var events = [
      "members:update",
      "members:self:update",
      "members:host:update",
      "meeting:recording:started",
      "meeting:recording:stopped",
      "meeting:recording:paused",
      "meeting:recording:resumed",
      "meeting:self:mutedByOthers",
      "meeting:self:unmutedByOthers",
      "meeting:self:requestedToUnmute"
    ];
    if (!meeting || meeting.__mmedSdkV3HostControlsBound) return;
    meeting.__mmedSdkV3HostControlsBound = true;
    function scheduleRefresh() {
      window.setTimeout(function () {
        refreshHostControls();
      }, 200);
    }
    if (typeof meeting.on === "function") {
      events.forEach(function (eventName) {
        try {
          meeting.on(eventName, scheduleRefresh);
        } catch (error) {}
      });
    }
    if (meeting.members && typeof meeting.members.on === "function") {
      events.forEach(function (eventName) {
        try {
          meeting.members.on(eventName, scheduleRefresh);
        } catch (error) {}
      });
    }
  }

  function remoteMediaKey(stream, fallback) {
    return String((stream && stream.id) || fallback || ("remote-" + Date.now() + "-" + Math.random())).replace(/[^A-Za-z0-9_-]/g, "");
  }

  function remoteMediaLabel(label, fallback) {
    return safeDisplayText(label, fallback || "Remote student");
  }

  function isMediaStreamLike(value) {
    return !!(value && typeof value.getTracks === "function");
  }

  function remoteStreamFromMedia(media) {
    var candidates;
    if (isMediaStreamLike(media)) return media;
    candidates = [
      media && media.stream,
      media && media.outputStream,
      media && media.mediaStream,
      media && media.remoteStream
    ];
    for (var i = 0; i < candidates.length; i += 1) {
      if (isMediaStreamLike(candidates[i])) return candidates[i];
    }
    if (media && typeof media.getMediaStream === "function") {
      try {
        return media.getMediaStream();
      } catch (error) {}
    }
    return null;
  }

  function normalizeRemoteMediaList(value, seen, depth) {
    var output = [];
    var knownFields = [
      "groupRemoteMedia",
      "remoteMedia",
      "remoteMediaGroup",
      "media",
      "stream",
      "outputStream",
      "mediaStream",
      "remoteStream",
      "video",
      "mainVideo",
      "thumbnailVideo"
    ];

    if (!value || depth > 4) return output;
    seen = seen || [];
    if (typeof value === "object") {
      if (seen.indexOf(value) !== -1) return output;
      seen.push(value);
    }

    if (typeof value.getRemoteMedia === "function") {
      try {
        output = output.concat(normalizeRemoteMediaList(value.getRemoteMedia() || [], seen, depth + 1));
      } catch (error) {}
    }

    if (isMediaStreamLike(value)) {
      output.push({ stream: value });
      return output;
    }

    if (Array.isArray(value)) {
      value.forEach(function (item) {
        output = output.concat(normalizeRemoteMediaList(item, seen, depth + 1));
      });
      return output;
    }

    if (value instanceof Map) {
      value.forEach(function (item) {
        output = output.concat(normalizeRemoteMediaList(item, seen, depth + 1));
      });
      return output;
    }

    if (remoteStreamFromMedia(value)) {
      output.push(value);
    }

    if (value && typeof value === "object") {
      knownFields.forEach(function (field) {
        if (value[field] !== undefined && value[field] !== null && value[field] !== value) {
          output = output.concat(normalizeRemoteMediaList(value[field], seen, depth + 1));
        }
      });
    }

    return output;
  }

  function getRemoteMediaFromGroup(group) {
    return normalizeRemoteMediaList(group, [], 0);
  }

  function remoteSourceIsLive(media) {
    return !media || !media.sourceState || String(media.sourceState).toLowerCase() === "live";
  }

  function remoteMediaHasTrack(media, kind) {
    var stream = remoteStreamFromMedia(media);
    var method = kind === "audio" ? "getAudioTracks" : "getVideoTracks";
    if (!stream || typeof stream[method] !== "function") return false;
    return stream[method]().length > 0;
  }

  function participantNameByMedia(media, fallback) {
    var memberId = String(
      (media && (media.memberId || media.participantId || media.personId || media.csi || media.id)) ||
      (media && media.member && (media.member.id || media.member.personId)) ||
      ""
    );
    var directName = safeDisplayText(
      (media && (media.name || media.displayName || media.participantName)) ||
      (media && media.member && (media.member.name || media.member.displayName)),
      ""
    );
    var match;

    if (directName) return directName;
    if (memberId) {
      match = (hostControls.participants || []).filter(function (participant) {
        return String(participant.id || "") === memberId || String(participant.sessionLocusUrl || "") === memberId;
      })[0];
      if (match && match.name) return match.name;
    }
    return fallback || "Remote student";
  }

  function participantInitials(name) {
    var parts = String(name || "Student").trim().split(/\s+/).filter(Boolean);
    return (parts[0] ? parts[0].charAt(0) : "S") + (parts[1] ? parts[1].charAt(0) : "");
  }

  function remoteStripParticipants() {
    refreshRemoteParticipantFallback();
    var participants = (hostControls.participants || []).filter(function (participant) {
      return participant && !participant.isSelf && (participant.isInMeeting || participant.isInLobby);
    });
    if (!hostControls.hideNoVideo) return participants;
    return participants.filter(participantHasVideo);
  }

  function dedupeRemoteMedia(items) {
    var seen = {};
    return items.filter(function (item) {
      var key = item && item.key;
      if (!key || seen[key]) return false;
      seen[key] = true;
      return true;
    });
  }

  function videoItemHasRenderableTrack(item) {
    var stream = item && item.stream;
    if (!stream || typeof stream.getVideoTracks !== "function") return false;
    return stream.getVideoTracks().length > 0;
  }

  function videoItemLooksUsable(item) {
    var label = String((item && item.label) || "").trim();
    return videoItemHasRenderableTrack(item) && !/^unknown$/i.test(label);
  }

  function setRemoteVideoItems(items, status) {
    remoteMedia.videos = dedupeRemoteMedia(items || []).filter(videoItemLooksUsable);
    remoteMedia.status = status || (remoteMedia.videos.length ? "Remote student video is live." : "Waiting for remote student video.");
    renderRemoteMedia();
  }

  function setRemoteAudioItems(items, status) {
    remoteMedia.audios = dedupeRemoteMedia(items || []);
    remoteMedia.status = status || (remoteMedia.audios.length ? "Remote student audio is live." : remoteMedia.status);
    renderRemoteMedia();
  }

  function upsertRemoteVideo(stream, label, key) {
    var itemKey = remoteMediaKey(stream, key);
    var next = remoteMedia.videos.filter(function (item) {
      return item.key !== itemKey;
    });
    next.push({
      key: itemKey,
      stream: stream,
      label: remoteMediaLabel(label, "Remote student video")
    });
    setRemoteVideoItems(next, "Remote student video is live.");
  }

  function upsertRemoteAudio(stream, key) {
    var itemKey = remoteMediaKey(stream, key);
    var next = remoteMedia.audios.filter(function (item) {
      return item.key !== itemKey;
    });
    next.push({
      key: itemKey,
      stream: stream
    });
    setRemoteAudioItems(next, "Remote student audio is live.");
  }

	  function removeRemoteMedia(stream, type) {
	    var key = stream && stream.id;
	    if (!key) return;
    if (!type || /video/i.test(type)) {
      remoteMedia.videos = remoteMedia.videos.filter(function (item) {
        return item.key !== key;
      });
    }
    if (!type || /audio/i.test(type)) {
      remoteMedia.audios = remoteMedia.audios.filter(function (item) {
        return item.key !== key;
      });
    }
	    remoteMedia.status = remoteMedia.videos.length || remoteMedia.audios.length
	      ? "Remote Webex media is live."
	      : "Waiting for remote students to join Webex.";
	    renderRemoteMedia();
	  }

	  function clampSpeakerVolume(value) {
	    if (!Number.isFinite(value)) return 1;
	    return Math.max(0, Math.min(1, value));
	  }

	  function applySpeakerAudioPrefs() {
	    var volume = speakerAudioPrefs.muted ? 0 : clampSpeakerVolume(speakerAudioPrefs.volume);
	    Array.prototype.slice.call(document.querySelectorAll("[data-sdk-v3-remote-audio]")).forEach(function (audio) {
	      audio.volume = volume;
	      audio.muted = speakerAudioPrefs.muted || volume <= 0;
	    });
	  }

	  function setSpeakerVolume(volume, muted) {
	    speakerAudioPrefs.volume = clampSpeakerVolume(Number(volume));
	    speakerAudioPrefs.muted = muted === true;
	    applySpeakerAudioPrefs();
	  }

		  function renderRemoteMedia() {
	    var visibleVideos = remoteMedia.videos.filter(videoItemLooksUsable);
	    var fallbackParticipants = remoteStripParticipants();
	    var hasRemoteStudents = visibleVideos.length > 0 || fallbackParticipants.length > 0;
	    var stageLayout = visibleVideos.length > 4 || (!visibleVideos.length && fallbackParticipants.length > 1) ? "gallery" : "speaker";

	    Array.prototype.slice.call(document.querySelectorAll(".mmed-sdk-v3-video-stack")).forEach(function (stack) {
	      stack.classList.toggle("has-remote-students", hasRemoteStudents);
	    });
	    applyHostSelfViewState();

	    Array.prototype.slice.call(document.querySelectorAll("[data-sdk-v3-remote-stage]")).forEach(function (stage) {
	      stage.setAttribute("data-layout", stageLayout);
	      if (visibleVideos.length) {
	        stage.innerHTML = visibleVideos.slice(0, stageLayout === "gallery" ? 6 : 1).map(function (item, index) {
	          return [
	            '<div class="mmed-sdk-v3-remote-main">',
	              '<video data-sdk-v3-remote-stage-video data-sdk-v3-remote-stage-video-index="' + attr(index) + '" autoplay playsinline></video>',
	              '<span>' + attr(index === 0 ? primaryStudentStageLabel(item.label) : (item.label || "Remote student video")) + '</span>',
	            '</div>'
	          ].join("");
	        }).join("");
	        visibleVideos.slice(0, stageLayout === "gallery" ? 6 : 1).forEach(function (item, index) {
	          var video = stage.querySelector('[data-sdk-v3-remote-stage-video-index="' + index + '"]');
	          attachRemoteVideo(video, item && item.stream);
	        });
	        return;
	      }

	      if (fallbackParticipants.length) {
	        stage.innerHTML = fallbackParticipants.slice(0, 8).map(renderRemoteParticipantCard).join("");
	        return;
	      }

	      stage.innerHTML = "";
	    });

	    Array.prototype.slice.call(document.querySelectorAll("[data-sdk-v3-remote-strip]")).forEach(function (strip) {
	      strip.setAttribute("data-has-media", visibleVideos.length > 1 ? "yes" : (fallbackParticipants.length > 1 ? "fallback" : "no"));
	      if (visibleVideos.length > 1) {
	        strip.innerHTML = visibleVideos.map(function (item, index) {
	          return [
	            '<div class="mmed-sdk-v3-remote-tile">',
	              '<video data-sdk-v3-remote-video data-sdk-v3-remote-video-index="' + attr(index) + '" autoplay playsinline></video>',
	              '<span>' + attr(item.label || "Remote student video") + '</span>',
	            '</div>'
	          ].join("");
	        }).join("");
	        visibleVideos.forEach(function (item, index) {
	          var video = strip.querySelector('[data-sdk-v3-remote-video-index="' + index + '"]');
	          attachRemoteVideo(video, item && item.stream);
	        });
	        return;
	      }
	      if (fallbackParticipants.length > 1) {
	        strip.innerHTML = fallbackParticipants.map(renderRemoteParticipantCard).join("");
	        return;
	      }
	      if (!visibleVideos.length) {
	        strip.innerHTML = "";
	        return;
	      }
	      strip.innerHTML = "";
	    });

    Array.prototype.slice.call(document.querySelectorAll("[data-sdk-v3-remote-audio-sinks]")).forEach(function (sink) {
      sink.innerHTML = remoteMedia.audios.map(function (item, index) {
        return '<audio data-sdk-v3-remote-audio data-sdk-v3-remote-audio-index="' + attr(index) + '" autoplay></audio>';
      }).join("");
      remoteMedia.audios.forEach(function (item, index) {
        var audio = sink.querySelector('[data-sdk-v3-remote-audio-index="' + index + '"]');
        if (!audio || !item.stream) return;
	        if (audio.srcObject !== item.stream) {
	          audio.srcObject = item.stream;
	        }
	        audio.autoplay = true;
	        audio.volume = speakerAudioPrefs.muted ? 0 : clampSpeakerVolume(speakerAudioPrefs.volume);
	        audio.muted = speakerAudioPrefs.muted || audio.volume <= 0;
	        audio.play().catch(function () {});
	      });
	    });
		    applySpeakerAudioPrefs();
		  }

		  function attachRemoteVideo(video, stream) {
		    if (!video || !stream) return;
		    if (video.srcObject !== stream) {
		      video.srcObject = stream;
		    }
		    video.autoplay = true;
		    video.playsInline = true;
		    video.muted = true;
		    video.play().catch(function () {});
		  }

		  function applyHostSelfViewState() {
		    Array.prototype.slice.call(document.querySelectorAll(".mmed-sdk-v3-video-card")).forEach(function (card) {
		      var hasRemoteStudents = !!(card.closest(".mmed-sdk-v3-video-stack") && card.closest(".mmed-sdk-v3-video-stack").classList.contains("has-remote-students"));
		      card.classList.toggle("is-self-hidden", !!(hasRemoteStudents && hostSelfViewHidden));
		    });
		    Array.prototype.slice.call(document.querySelectorAll("[data-sdk-v3-toggle-self-view]")).forEach(function (button) {
		      button.textContent = hostSelfViewHidden ? "Show self" : "Hide self";
		      button.setAttribute("aria-pressed", hostSelfViewHidden ? "true" : "false");
		    });
		  }

		  function primaryStudentStageLabel(label) {
		    var text = safeDisplayText(label || "", "Active student");
		    if (/active speaker/i.test(text)) {
		      return text;
		    }
		    return "Active student: " + text;
		  }

		  function renderRemoteParticipantCard(participant) {
		    var meta = [
		      participant.isInLobby ? "Waiting room" : "In meeting",
		      booleanStatus(participant.isAudioMuted, "Audio muted", "Audio live"),
		      booleanStatus(participant.isVideoMuted, "Video off", "Video on")
		    ].filter(Boolean).join(" / ");
		    return [
		      '<div class="mmed-sdk-v3-remote-card" data-video="' + (participantHasVideo(participant) ? "on" : "off") + '">',
		        '<span class="mmed-sdk-v3-remote-card-avatar">' + attr(participantInitials(participant.name)) + '</span>',
		        '<span class="mmed-sdk-v3-remote-card-main">',
		          '<b>' + attr(participant.name || "Student") + '</b>',
		          '<span>' + attr(meta) + '</span>',
		        '</span>',
		      '</div>'
		    ].join("");
		  }

  function resetRemoteMedia(message) {
    if (remoteVideoRescanTimer) {
      window.clearTimeout(remoteVideoRescanTimer);
      remoteVideoRescanTimer = 0;
    }
    remoteVideoRescanUntil = 0;
    remoteMediaSourceBindings = {};
    remoteMedia = {
      status: message || "Waiting for remote students to join Webex.",
      videos: [],
      audios: [],
      lastLayoutId: "",
      lastLayout: null,
      videoSourceCount: ""
    };
    renderRemoteMedia();
  }

  function handleRemoteMediaReady(media) {
    var stream = remoteStreamFromMedia(media);
    if (!media || !stream) return;
    if (media.type === "remoteVideo") {
      upsertRemoteVideo(stream, participantNameByMedia(media, "Remote student video"));
    } else if (media.type === "remoteAudio") {
      upsertRemoteAudio(stream);
    } else if (media.type === "remoteShare") {
      upsertRemoteVideo(stream, "Remote screen share");
    }
  }

  function handleRemoteMediaStopped(media) {
    var stream = remoteStreamFromMedia(media);
    if (!media || !stream) return;
    removeRemoteMedia(stream, media.type || "");
  }

  function handleRemoteAudioGroup(audioMediaGroup) {
    var items = [];
    getRemoteMediaFromGroup(audioMediaGroup).forEach(function (media, index) {
      var stream = remoteStreamFromMedia(media);
      if (!media || !stream || !remoteSourceIsLive(media) || !remoteMediaHasTrack(media, "audio")) return;
      items.push({
        key: remoteMediaKey(stream, "remote-audio-" + index),
        stream: stream
      });
    });
    setRemoteAudioItems(items, items.length ? "Remote student audio is live." : "Waiting for remote student audio.");
  }

  function panesToArray(panes) {
    if (!panes) return [];
    if (Array.isArray(panes)) return panes;
    if (panes instanceof Map) return Array.from(panes.values());
    if (typeof panes === "object") {
      return Object.keys(panes).map(function (key) {
        var pane = panes[key];
        if (pane && typeof pane === "object" && !pane.__mmedPaneKey) {
          try {
            pane.__mmedPaneKey = key;
          } catch (error) {}
        }
        return pane;
      });
    }
    return [];
  }

  function collectRemoteVideoMediasFromLayout(layout) {
    var media = [];
    layout = layout || {};
    panesToArray(layout.activeSpeakerVideoPanes).forEach(function (pane) {
      media = media.concat(getRemoteMediaFromGroup(pane));
    });
    panesToArray(layout.memberVideoPanes).forEach(function (pane) {
      media = media.concat(getRemoteMediaFromGroup(pane));
    });
    if (layout.screenShareVideo) {
      media = media.concat(getRemoteMediaFromGroup(layout.screenShareVideo));
    }
    return media;
  }

  function bindRemoteMediaSourceEvents(media) {
    var key;
    if (!media || typeof media.on !== "function") return;
    key = String(media.id || media.memberId || media.csi || remoteMediaKey(remoteStreamFromMedia(media), "media")).replace(/[^A-Za-z0-9_-]/g, "");
    if (!key || remoteMediaSourceBindings[key]) return;
    remoteMediaSourceBindings[key] = true;
    ["sourceUpdate", "stopped"].forEach(function (eventName) {
      try {
        media.on(eventName, function () {
          scheduleRemoteVideoLayoutRescan(80, 4000);
        });
      } catch (error) {}
    });
  }

  function bindRemoteVideoLayoutSourceEvents(layout) {
    collectRemoteVideoMediasFromLayout(layout).forEach(bindRemoteMediaSourceEvents);
  }

  function collectRemoteVideoItemsFromPanes(panes, labelPrefix) {
    var items = [];
    panesToArray(panes).forEach(function (pane, paneIndex) {
      var paneKey = (pane && pane.__mmedPaneKey) || paneIndex;
      var medias = getRemoteMediaFromGroup(pane);
      medias.forEach(function (media, index) {
        var stream = remoteStreamFromMedia(media);
        if (!media || !stream || !remoteSourceIsLive(media) || !remoteMediaHasTrack(media, "video")) return;
        items.push({
          key: remoteMediaKey(stream, labelPrefix + "-" + paneKey + "-" + index),
          stream: stream,
          label: participantNameByMedia(media, labelPrefix + " " + (items.length + 1))
        });
      });
    });
    return items;
  }

  function scanRemoteVideoLayout(layout, statusWhenEmpty) {
    var items = [];
    var shareStream;
    layout = layout || {};
    items = items.concat(collectRemoteVideoItemsFromPanes(layout.activeSpeakerVideoPanes, "Active speaker"));
    items = items.concat(collectRemoteVideoItemsFromPanes(layout.memberVideoPanes, "Student"));
    shareStream = remoteStreamFromMedia(layout.screenShareVideo);
    if (layout.screenShareVideo && shareStream && remoteSourceIsLive(layout.screenShareVideo)) {
      items.push({
        key: remoteMediaKey(shareStream, "remote-share"),
        stream: shareStream,
        label: "Remote screen share"
      });
    }
    setRemoteVideoItems(items, items.length ? "Remote student video is live." : (statusWhenEmpty || remoteVideoWaitingMessage()));
    return items;
  }

  function scheduleRemoteVideoLayoutRescan(delayMs, durationMs) {
    var now = Date.now();
    if (!remoteMedia.lastLayout) return;
    remoteVideoRescanUntil = Math.max(remoteVideoRescanUntil || 0, now + (durationMs || 6000));
    if (remoteVideoRescanTimer) return;
    remoteVideoRescanTimer = window.setTimeout(function tick() {
      remoteVideoRescanTimer = 0;
      if (!remoteMedia.lastLayout) return;
      scanRemoteVideoLayout(remoteMedia.lastLayout, remoteVideoWaitingMessage());
      if (!remoteMedia.videos.length && Date.now() < remoteVideoRescanUntil) {
        remoteVideoRescanTimer = window.setTimeout(tick, 450);
      }
    }, Number.isFinite(delayMs) ? delayMs : 150);
  }

  function handleRemoteVideoLayout(layout) {
    layout = layout || {};
    remoteMedia.lastLayout = layout;
    remoteMedia.lastLayoutId = safeDisplayText(layout.layoutId, remoteMedia.lastLayoutId || "");
    bindRemoteVideoLayoutSourceEvents(layout);
    if (!scanRemoteVideoLayout(layout, remoteVideoWaitingMessage()).length) {
      scheduleRemoteVideoLayoutRescan(150, 9000);
    }
  }

  function remoteVideoWaitingMessage() {
    var participants = remoteStripParticipants();
    if (participants.length) {
      return "Students are in Webex. Showing roster until Webex exposes remote video panes.";
    }
    if (remoteMedia.videoSourceCount) {
      return "Waiting for remote student video. Sources: " + remoteMedia.videoSourceCount + ".";
    }
    return "No other participants yet.";
  }

  function handleRemoteVideoSourceCountChanged(payload) {
    if (payload && typeof payload === "object") {
      remoteMedia.videoSourceCount = String(payload.numLiveSources || 0) + " live / " + String(payload.numTotalSource || 0) + " total";
    } else if (payload !== undefined && payload !== null) {
      remoteMedia.videoSourceCount = String(payload);
    }
    if (!remoteMedia.videos.length) {
      remoteMedia.status = remoteVideoWaitingMessage();
      renderRemoteMedia();
    }
  }

  function primeRemoteMediaManager(meeting) {
    var manager = meeting && meeting.remoteMediaManager;
    if (!manager) return Promise.resolve();
    try {
      if (typeof manager.setPreferLiveVideo === "function") {
        manager.setPreferLiveVideo(true);
      }
    } catch (error) {}
	    if (typeof manager.setLayout === "function") {
	      try {
	        return Promise.resolve(manager.setLayout("ActiveSpeaker")).catch(function () {
	          try {
	            return manager.setLayout("AllEqual");
	          } catch (error) {}
	        });
	      } catch (error) {}
	    }
    return Promise.resolve();
  }

  function bindRemoteMediaEvents(meeting) {
    if (!meeting || meeting.__mmedSdkV3RemoteMediaBound || typeof meeting.on !== "function") return;
    meeting.__mmedSdkV3RemoteMediaBound = true;
    resetRemoteMedia("Waiting for remote students to join Webex.");
    [
      ["media:ready", handleRemoteMediaReady],
      ["media:stopped", handleRemoteMediaStopped],
      ["media:stop", handleRemoteMediaStopped],
      ["media:remoteAudio:created", handleRemoteAudioGroup],
      ["media:remoteScreenShareAudio:created", handleRemoteAudioGroup],
      ["media:remoteVideo:layoutChanged", handleRemoteVideoLayout],
      ["media:remoteVideoSourceCountChanged", handleRemoteVideoSourceCountChanged],
      ["media:remoteAudioSourceCountChanged", function () { renderRemoteMedia(); }],
      ["media:activeSpeakerChanged", function () { renderRemoteMedia(); }],
      ["members:update", function () { window.setTimeout(renderRemoteMedia, 200); }],
      ["members:self:update", function () { window.setTimeout(renderRemoteMedia, 200); }],
      ["members:host:update", function () { window.setTimeout(renderRemoteMedia, 200); }]
    ].forEach(function (binding) {
      try {
        meeting.on(binding[0], binding[1]);
      } catch (error) {}
    });
  }

  function compactDeviceName(value) {
    return String(value || "")
      .toLowerCase()
      .replace(/\([^)]*\)/g, "")
      .replace(/\b(default|camera|microphone|built-in|virtual|device|audio|video)\b/g, "")
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  }

  function selectedTrackMismatch() {
    var selected = compactDeviceName(mediaDiagnostics.selectedCameraLabel);
    var activeLabel = compactDeviceName(mediaDiagnostics.activeVideoTrackLabel);
    if (!selected || !activeLabel || /default|not attached|unlabeled/i.test(mediaDiagnostics.selectedCameraLabel + mediaDiagnostics.activeVideoTrackLabel)) {
      return "";
    }
    if (activeLabel.indexOf(selected) !== -1 || selected.indexOf(activeLabel) !== -1) {
      return "";
    }
    if (/macbook/.test(selected) && /macbook/.test(activeLabel)) {
      return "";
    }
    return " SDK camera source mismatch: selected camera was " + mediaDiagnostics.selectedCameraLabel + ", but active video track is " + mediaDiagnostics.activeVideoTrackLabel + ".";
  }

  function setDeviceStatus(message, state) {
    preflight.status = state || "idle";
    Array.prototype.slice.call(document.querySelectorAll("[data-sdk-v3-device-status]")).forEach(function (node) {
      node.textContent = message || "";
    });
    Array.prototype.slice.call(document.querySelectorAll("[data-sdk-v3-preflight]")).forEach(function (node) {
      node.setAttribute("data-state", state || "idle");
    });
    updateHostLaunchButtons();
  }

  function updateDeviceSummary() {
    updateSelectedDiagnostics();
    Array.prototype.slice.call(document.querySelectorAll("[data-sdk-v3-camera-summary]")).forEach(function (node) {
      node.textContent = "Camera: " + selectedCameraLabel();
    });
    Array.prototype.slice.call(document.querySelectorAll("[data-sdk-v3-mic-summary]")).forEach(function (node) {
      node.textContent = "Mic: " + selectedMicLabel();
    });
  }

  function populateDeviceSelects(devices) {
    var cameraSelect = getSelect("[data-sdk-v3-camera-select]");
    var micSelect = getSelect("[data-sdk-v3-mic-select]");
    var storedCamera = readStoredValue(V3_CAMERA_STORAGE_KEY);
    var storedMic = readStoredValue(V3_MIC_STORAGE_KEY);
    var cameras = devices.filter(function (device) { return device.kind === "videoinput"; });
    var microphones = devices.filter(function (device) { return device.kind === "audioinput"; });
    var cameraWasMissing = false;
    var micWasMissing = false;

    if (cameraSelect) {
      cameraSelect.innerHTML = '<option value="">Default camera</option>' + cameras.map(function (device, index) {
        return '<option value="' + attr(device.deviceId) + '">' + attr(deviceLabel(device, index, "Camera")) + '</option>';
      }).join("");
      if (storedCamera && selectHasValue(cameraSelect, storedCamera)) {
        cameraSelect.value = storedCamera;
      } else if (storedCamera) {
        cameraWasMissing = true;
        writeStoredValue(V3_CAMERA_STORAGE_KEY, "");
      }
    }

    if (micSelect) {
      micSelect.innerHTML = '<option value="">Default microphone</option>' + microphones.map(function (device, index) {
        return '<option value="' + attr(device.deviceId) + '">' + attr(deviceLabel(device, index, "Microphone")) + '</option>';
      }).join("");
      if (storedMic && selectHasValue(micSelect, storedMic)) {
        micSelect.value = storedMic;
      } else if (storedMic) {
        micWasMissing = true;
        writeStoredValue(V3_MIC_STORAGE_KEY, "");
      }
    }

    updateDeviceSummary();
    if (cameraWasMissing || micWasMissing) {
      setDeviceStatus("Device unavailable. Using fallback/default device.", "error");
    }
  }

  function refreshDevices(requestPermission) {
    var devicesApi = mediaDevices();
    if (!devicesApi || typeof devicesApi.enumerateDevices !== "function") {
      setDeviceStatus("This browser does not expose camera or mic device selection.", "error");
      return Promise.resolve([]);
    }

    var permissionPromise = Promise.resolve();
    if (requestPermission && typeof devicesApi.getUserMedia === "function") {
      setDeviceStatus("Camera permission needed. Mic permission needed.", "loading");
      permissionPromise = devicesApi.getUserMedia({ video: true, audio: true }).then(function (stream) {
        preflight.permissionGranted = true;
        stopMediaStream(stream);
      }).catch(function (error) {
        return requestBasicPermissionsFallback(error);
      });
    }

    return permissionPromise.then(function () {
      return devicesApi.enumerateDevices();
    }).then(function (devices) {
      preflight.devices = devices || [];
      populateDeviceSelects(preflight.devices);
      if (requestPermission) {
        setDeviceStatus("Devices refreshed. Camera selected. Mic selected.", "ready");
      }
      return preflight.devices;
    }).catch(function (error) {
      setDeviceStatus(actionableDeviceError(error), "error");
      return [];
    });
  }

  function requestBasicPermissionsFallback(originalError) {
    var devicesApi = mediaDevices();
    var videoOk = false;
    var audioOk = false;
    if (!devicesApi || typeof devicesApi.getUserMedia !== "function") {
      return Promise.reject(originalError);
    }

    return devicesApi.getUserMedia({ video: true }).then(function (stream) {
      videoOk = true;
      stopMediaStream(stream);
    }).catch(function () {}).then(function () {
      return devicesApi.getUserMedia({ audio: true }).then(function (stream) {
        audioOk = true;
        stopMediaStream(stream);
      }).catch(function () {});
    }).then(function () {
      if (videoOk && audioOk) {
        preflight.permissionGranted = true;
        return;
      }
      if (!videoOk && !audioOk) {
        throw originalError;
      }
      setDeviceStatus(videoOk ? "Mic permission needed." : "Camera permission needed.", "error");
    });
  }

  function stopMediaStream(stream) {
    if (!stream || typeof stream.getTracks !== "function") return;
    stream.getTracks().forEach(function (track) {
      try {
        track.stop();
      } catch (error) {}
    });
  }

  function selectedPreviewConstraints() {
    var videoId = preferredVideoDeviceId();
    var audioId = preferredAudioDeviceId();
    return {
      video: videoId ? { deviceId: { exact: videoId }, width: { ideal: 640 }, height: { ideal: 480 } } : { width: { ideal: 640 }, height: { ideal: 480 } },
      audio: audioId ? { deviceId: { exact: audioId }, echoCancellation: true, noiseSuppression: true, autoGainControl: true } : { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
    };
  }

  function sdkDeviceConstraint(deviceId) {
    return deviceId ? { exact: deviceId } : undefined;
  }

  function stopPreview() {
    var video = getSelect("[data-sdk-v3-preview-video]");
    var previewBox = getSelect("[data-sdk-v3-preview]");
    var meter = getSelect("[data-sdk-v3-mic-meter]");
    if (preflight.meterAnimation) {
      window.cancelAnimationFrame(preflight.meterAnimation);
      preflight.meterAnimation = 0;
    }
    if (preflight.audioContext && typeof preflight.audioContext.close === "function") {
      preflight.audioContext.close().catch(function () {});
    }
    preflight.audioContext = null;
    preflight.analyser = null;
    stopMediaStream(preflight.stream);
    preflight.stream = null;
    if (video) {
      video.srcObject = null;
    }
    if (previewBox) {
      previewBox.classList.remove("is-active");
    }
    if (meter) {
      meter.style.width = "0";
    }
  }

  function startPreview() {
    var devicesApi = mediaDevices();
    var video = getSelect("[data-sdk-v3-preview-video]");
    var previewBox = getSelect("[data-sdk-v3-preview]");
    if (!devicesApi || typeof devicesApi.getUserMedia !== "function") {
      setDeviceStatus("This browser does not expose camera or mic preview.", "error");
      return Promise.resolve(null);
    }

    stopPreview();
    setDeviceStatus("Camera permission needed. Mic permission needed.", "loading");
    return devicesApi.getUserMedia(selectedPreviewConstraints()).then(function (stream) {
      preflight.permissionGranted = true;
      preflight.stream = stream;
      updateMediaDiagnostics({
        selectedCameraLabel: selectedCameraLabel(),
        selectedMicLabel: selectedMicLabel(),
        activeVideoTrackLabel: firstTrackLabel(stream, "video"),
        activeAudioTrackLabel: firstTrackLabel(stream, "audio"),
        mediaPath: "browser preflight preview"
      });
      if (video) {
        video.srcObject = stream;
        video.muted = true;
        video.autoplay = true;
        video.playsInline = true;
        video.play().catch(function () {});
      }
      if (previewBox) {
        previewBox.classList.add("is-active");
      }
      startMicMeter(stream);
      return refreshDevices(false).then(function () {
        setDeviceStatus("Preview Ready. Click Start Live Webex Session.", "ready");
        updateDeviceSummary();
        return stream;
      });
    }).catch(function (error) {
      return startPreviewFallback(error);
    });
  }

  function startPreviewFallback(error) {
    var devicesApi = mediaDevices();
    var video = getSelect("[data-sdk-v3-preview-video]");
    var previewBox = getSelect("[data-sdk-v3-preview]");
    if (!devicesApi || !preferredVideoDeviceId()) {
      setDeviceStatus(actionableDeviceError(error), "error");
      return Promise.resolve(null);
    }

    writeStoredValue(V3_CAMERA_STORAGE_KEY, "");
    setDeviceStatus("Device unavailable. Using fallback/default device.", "error");
    return devicesApi.getUserMedia({
      video: { width: { ideal: 640 }, height: { ideal: 480 } },
      audio: preferredAudioDeviceId() ? { deviceId: { exact: preferredAudioDeviceId() }, echoCancellation: true, noiseSuppression: true, autoGainControl: true } : { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
    }).then(function (stream) {
      preflight.stream = stream;
      updateMediaDiagnostics({
        selectedCameraLabel: selectedCameraLabel(),
        selectedMicLabel: selectedMicLabel(),
        activeVideoTrackLabel: firstTrackLabel(stream, "video"),
        activeAudioTrackLabel: firstTrackLabel(stream, "audio"),
        mediaPath: "browser preflight fallback"
      });
      if (video) {
        video.srcObject = stream;
        video.muted = true;
        video.autoplay = true;
        video.playsInline = true;
        video.play().catch(function () {});
      }
      if (previewBox) {
        previewBox.classList.add("is-active");
      }
      startMicMeter(stream);
      return refreshDevices(false).then(function () {
        setDeviceStatus("Preview Ready using fallback/default device. Click Start Live Webex Session.", "ready");
        updateDeviceSummary();
        return stream;
      });
    }).catch(function (fallbackError) {
      setDeviceStatus(actionableDeviceError(fallbackError), "error");
      return null;
    });
  }

  function startMicMeter(stream) {
    var audioTracks = stream && typeof stream.getAudioTracks === "function" ? stream.getAudioTracks() : [];
    var meter = getSelect("[data-sdk-v3-mic-meter]");
    var AudioContextCtor = window.AudioContext || window.webkitAudioContext;
    if (!audioTracks.length || !meter || !AudioContextCtor) return;

    try {
      preflight.audioContext = new AudioContextCtor();
      preflight.analyser = preflight.audioContext.createAnalyser();
      preflight.analyser.fftSize = 256;
      preflight.audioContext.createMediaStreamSource(new MediaStream(audioTracks)).connect(preflight.analyser);
      animateMicMeter(meter);
    } catch (error) {}
  }

  function animateMicMeter(meter) {
    var analyser = preflight.analyser;
    var data = analyser ? new Uint8Array(analyser.frequencyBinCount) : null;
    function tick() {
      if (!preflight.analyser || !data) return;
      preflight.analyser.getByteFrequencyData(data);
      var total = 0;
      for (var i = 0; i < data.length; i += 1) {
        total += data[i];
      }
      meter.style.width = Math.min(100, Math.round((total / data.length) * 0.8)) + "%";
      preflight.meterAnimation = window.requestAnimationFrame(tick);
    }
    tick();
  }

  function persistSelectedDevices() {
    var cameraSelect = getSelect("[data-sdk-v3-camera-select]");
    var micSelect = getSelect("[data-sdk-v3-mic-select]");
    writeStoredValue(V3_CAMERA_STORAGE_KEY, cameraSelect ? cameraSelect.value : "");
    writeStoredValue(V3_MIC_STORAGE_KEY, micSelect ? micSelect.value : "");
    updateDeviceSummary();
  }

  function streamHasLiveTracks(stream) {
    var tracks = mediaStreamTracks(stream, "video").concat(mediaStreamTracks(stream, "audio"));
    return tracks.some(function (track) {
      return track && track.readyState === "live";
    });
  }

  function ensureSelectedPreviewStream() {
    if (streamHasLiveTracks(preflight.stream)) {
      updateMediaDiagnostics({
        selectedCameraLabel: selectedCameraLabel(),
        selectedMicLabel: selectedMicLabel(),
        activeVideoTrackLabel: firstTrackLabel(preflight.stream, "video"),
        activeAudioTrackLabel: firstTrackLabel(preflight.stream, "audio"),
        mediaPath: "browser preflight stream"
      });
      return Promise.resolve(preflight.stream);
    }

    return startPreview().then(function (stream) {
      if (!stream || !streamHasLiveTracks(stream)) {
        throw new Error("Selected camera preview did not start.");
      }
      return stream;
    });
  }

  function splitMediaStream(stream, kind) {
    var tracks = mediaStreamTracks(stream, kind);
    if (!tracks.length || typeof MediaStream !== "function") return null;
    return new MediaStream(tracks);
  }

  function findLocalStreamConstructor(webex, name) {
    var candidates = [
      window[name],
      window.Webex && window.Webex[name],
      webex && webex[name],
      webex && webex.meetings && webex.meetings[name],
      webex && webex.meetings && webex.meetings.mediaHelpers && webex.meetings.mediaHelpers[name]
    ];
    for (var i = 0; i < candidates.length; i += 1) {
      if (typeof candidates[i] === "function") {
        return candidates[i];
      }
    }
    return null;
  }

  function createLocalStreamsFromBrowserPreview(webex) {
    return ensureSelectedPreviewStream().then(function (stream) {
      var LocalCameraStream = findLocalStreamConstructor(webex, "LocalCameraStream");
      var LocalMicrophoneStream = findLocalStreamConstructor(webex, "LocalMicrophoneStream");
      var cameraRaw = splitMediaStream(stream, "video");
      var microphoneRaw = splitMediaStream(stream, "audio");

      if (!LocalCameraStream || !LocalMicrophoneStream) {
        throw new Error("Webex LocalStream wrapper classes are unavailable in this SDK bundle.");
      }
      if (!cameraRaw || !microphoneRaw) {
        throw new Error("Selected browser stream did not expose both camera and microphone tracks.");
      }

      active.sourceMediaStream = stream;
      active.cameraStream = new LocalCameraStream(cameraRaw);
      active.microphoneStream = new LocalMicrophoneStream(microphoneRaw);
      active.mediaPath = "browser MediaStream wrapped for Webex";
      updateMediaDiagnostics({
        selectedCameraLabel: selectedCameraLabel(),
        selectedMicLabel: selectedMicLabel(),
        activeVideoTrackLabel: firstTrackLabel(cameraRaw, "video"),
        activeAudioTrackLabel: firstTrackLabel(microphoneRaw, "audio"),
        mediaPath: active.mediaPath
      });

      return {
        microphone: active.microphoneStream,
        camera: active.cameraStream
      };
    });
  }

  function actionableDeviceError(error) {
    var message = safeMessage(error);
    if (/notallowed|permission|denied/i.test(message)) {
      return "Camera permission needed. Mic permission needed.";
    }
    if (/notfound|overconstrained|device|source/i.test(message)) {
      return "Device unavailable. Refresh devices or choose another camera/mic.";
    }
    return message || "Device unavailable. Refresh devices or choose another camera/mic.";
  }

  function loadWebexSdk() {
    if (window.Webex && typeof window.Webex.init === "function") {
      return Promise.resolve(window.Webex);
    }
    if (sdkLoadPromise) return sdkLoadPromise;

    sdkLoadPromise = new Promise(function (resolve, reject) {
      var script = document.createElement("script");
      script.src = SDK_BUNDLE_URL;
      script.async = true;
      script.crossOrigin = "anonymous";
      script.onload = function () {
        if (window.Webex && typeof window.Webex.init === "function") {
          resolve(window.Webex);
          return;
        }
        reject(new Error("Webex SDK loaded but did not expose Webex.init."));
      };
      script.onerror = function () {
        reject(new Error("Could not load the Webex SDK bundle."));
      };
      document.head.appendChild(script);
    });

    return sdkLoadPromise;
  }

  function hydrateMeetingFromState() {
    var meeting = currentMeeting();
    if (destinationFromMeeting(meeting)) {
      return Promise.resolve(meeting);
    }

    if (!config.stateEndpoint) {
      return Promise.reject(new Error(isAdminMode() ? "No Webex room is selected yet." : "The host has not opened the video room yet."));
    }

    var headers = {
      "Accept": "application/json",
      "X-WP-Nonce": restNonce()
    };
    if (viewerTicket()) {
      headers["X-MMED-Viewer-Ticket"] = viewerTicket();
    }
    return fetch(config.stateEndpoint, {
      method: "GET",
      credentials: "same-origin",
      cache: "no-store",
      headers: headers
    }).then(function (response) {
      return response.json().catch(function () {
        return {};
      }).then(function (payload) {
        if (!response.ok || !payload.meeting) {
          throw new Error(payload.message || (isAdminMode() ? "No Webex room is selected yet." : "The host has not opened the video room yet."));
        }
        updateMeetingConfig(payload.meeting);
        return payload.meeting;
      });
    });
  }

  function fetchHostToken(meeting) {
    var body = {};
    if (meeting && meeting.id) body.meeting_id = meeting.id;
    if (meeting && meeting.joinUrl) body.join_url = meeting.joinUrl;

    return fetch(restBaseUrl() + "/webex/start-meeting", {
      method: "POST",
      credentials: "same-origin",
      cache: "no-store",
      headers: {
        "Accept": "application/json",
        "Content-Type": "application/json",
        "X-WP-Nonce": restNonce()
      },
      body: JSON.stringify(body)
    }).then(function (response) {
      return response.json().catch(function () {
        return {};
      }).then(function (payload) {
        if (!response.ok || !payload.token) {
          throw new Error(payload.message || "Could not get a host-capable Webex token.");
        }
        return payload.token;
      });
    });
  }

  function fetchGuestToken(refreshedNonce) {
    var identity = currentGuestIdentity();
    var query = new URLSearchParams();
    var tokenUrl = restBaseUrl() + "/webex/guest-token";

    if (identity.displayName) {
      query.set("displayName", identity.displayName);
    }
    if (identity.guestId) {
      query.set("guestId", identity.guestId);
    }
    if (query.toString()) {
      tokenUrl += "?" + query.toString();
    }

    return fetch(tokenUrl, {
      method: "GET",
      credentials: "same-origin",
      cache: "no-store",
      headers: {
        "Accept": "application/json",
        "X-WP-Nonce": restNonce()
      }
    }).then(function (response) {
      return response.json().catch(function () {
        return {};
      }).then(function (payload) {
        if (!response.ok || !payload.token) {
          throw new Error(payload.message || "Could not get a Webex attendee token.");
        }
        return payload.token;
      });
    }).catch(function (error) {
      if (!refreshedNonce && isNonceError(error)) {
        return refreshRestNonce().then(function () {
          return fetchGuestToken(true);
        });
      }
      throw error;
    });
  }

  function waitForWebexReady(webex) {
    return new Promise(function (resolve) {
      var settled = false;
      function done() {
        if (settled) return;
        settled = true;
        resolve();
      }
      if (webex && typeof webex.once === "function") {
        webex.once("ready", done);
      }
      window.setTimeout(done, 4500);
    });
  }

  function createCameraStream(helpers) {
    var deviceId = preferredVideoDeviceId();
    var options = {
      width: 640,
      height: 480
    };

    if (deviceId) {
      options.deviceId = sdkDeviceConstraint(deviceId);
    }

    return helpers.createCameraStream(options).catch(function (error) {
      if (!deviceId) {
        throw error;
      }
      return helpers.createCameraStream({
        deviceId: deviceId,
        width: 640,
        height: 480
      }).catch(function () {
        setState("loading", "unknown", "Saved camera was unavailable. Trying the browser default camera...");
        return helpers.createCameraStream({
          width: 640,
          height: 480
        });
      });
    });
  }

  function createMicrophoneStream(helpers) {
    var deviceId = preferredAudioDeviceId();
    var options = {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true
    };

    if (deviceId) {
      options.deviceId = sdkDeviceConstraint(deviceId);
    }

    return helpers.createMicrophoneStream(options).catch(function (error) {
      if (!deviceId) {
        throw error;
      }
      return helpers.createMicrophoneStream({
        deviceId: deviceId,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      }).catch(function () {
        setState("loading", "unknown", "Saved microphone was unavailable. Trying the browser default microphone...");
        return helpers.createMicrophoneStream({
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        });
      });
    });
  }

  function createLocalStreams(webex) {
    var helpers = webex && webex.meetings && webex.meetings.mediaHelpers;

    return createLocalStreamsFromBrowserPreview(webex).catch(function (previewError) {
      if (!helpers || typeof helpers.createCameraStream !== "function" || typeof helpers.createMicrophoneStream !== "function") {
        throw previewError;
      }
      active.mediaPath = "Webex mediaHelpers with selected device constraints";
      setState("loading", "unknown", "Selected preview stream could not be attached directly. Webex is using the selected camera and microphone...");
      return Promise.all([
        createMicrophoneStream(helpers),
        createCameraStream(helpers)
      ]).then(function (streams) {
        active.microphoneStream = streams[0];
        active.cameraStream = streams[1];
        updateMediaDiagnostics({
          selectedCameraLabel: selectedCameraLabel(),
          selectedMicLabel: selectedMicLabel(),
          activeVideoTrackLabel: localStreamTrackLabel(active.cameraStream, "video"),
          activeAudioTrackLabel: localStreamTrackLabel(active.microphoneStream, "audio"),
          mediaPath: active.mediaPath
        });
        return {
          microphone: active.microphoneStream,
          camera: active.cameraStream
        };
      });
    });
  }

  function renderLocalVideo(stage, cameraStream) {
    var video = stage && stage.querySelector("[data-sdk-v3-local-video]");
    var outputStream = cameraStream && (cameraStream.outputStream || cameraStream.stream || cameraStream);
    if (!video || !outputStream) return;
    video.srcObject = outputStream;
    video.muted = true;
    video.autoplay = true;
    video.playsInline = true;
    video.play().catch(function () {});
  }

  function stopLocalStream(stream) {
    var outputStream = stream && (stream.outputStream || stream.stream || stream);
    if (!outputStream || typeof outputStream.getTracks !== "function") return;
    outputStream.getTracks().forEach(function (track) {
      try {
        track.stop();
      } catch (error) {}
    });
  }

  function localStreamSharesTracks(localStream, referenceStream) {
    var outputStream = localStreamOutput(localStream);
    var outputTracks;
    var referenceTracks;
    if (!outputStream || !referenceStream || typeof outputStream.getTracks !== "function" || typeof referenceStream.getTracks !== "function") {
      return false;
    }
    outputTracks = outputStream.getTracks();
    referenceTracks = referenceStream.getTracks();
    return outputTracks.some(function (track) {
      return referenceTracks.indexOf(track) !== -1;
    });
  }

  function restoreLivePreviewAfterJoinFailure() {
    var video = getSelect("[data-sdk-v3-preview-video]");
    var previewBox = getSelect("[data-sdk-v3-preview]");
    if (!streamHasLiveTracks(preflight.stream)) return false;
    if (video) {
      video.srcObject = preflight.stream;
      video.muted = true;
      video.autoplay = true;
      video.playsInline = true;
      video.play().catch(function () {});
    }
    if (previewBox) {
      previewBox.classList.add("is-active");
    }
    updateMediaDiagnostics({
      activeVideoTrackLabel: firstTrackLabel(preflight.stream, "video"),
      activeAudioTrackLabel: firstTrackLabel(preflight.stream, "audio"),
      mediaPath: "browser preflight preview"
    });
    setDeviceStatus("Preview Ready. Webex did not connect; selected camera and mic are still live.", "ready");
    return true;
  }

  function cleanupSdkMeeting(options) {
    options = options || {};
    var stage = active.stage || selectedStage();
    if (!options.keepPreview) {
      stopPreview();
    }

    stopHostRosterPoll();
	    if (active.meeting && typeof active.meeting.leave === "function") {
	      try {
	        active.meeting.leave();
      } catch (error) {}
    }

    if (active.webex && active.webex.meetings && typeof active.webex.meetings.unregister === "function") {
      try {
        active.webex.meetings.unregister();
      } catch (error) {}
    }

    stopLocalStream(active.cameraStream);
    stopLocalStream(active.microphoneStream);
    active.meeting = null;
    active.webex = null;
    active.cameraStream = null;
    active.microphoneStream = null;
    active.sourceMediaStream = options.keepPreview ? active.sourceMediaStream : null;
    active.mediaPath = "";
    if (!options.keepPreview) {
      updateMediaDiagnostics({
        activeVideoTrackLabel: "not attached",
        activeAudioTrackLabel: "not attached",
        mediaPath: "idle"
      });
    }

    if (stage) {
      stage.classList.remove("is-sdk-v3-active");
      var video = stage.querySelector("[data-sdk-v3-local-video]");
      if (video) {
        video.srcObject = null;
      }
    }

	    setState("idle", "unknown", readyMessage());
    resetHostControls("Start the Webex session to use host controls.");
    resetRemoteMedia("No other participants yet.");
    syncHostDrawerLayout();
	  }

  function normalizeRole(value) {
    var role = String(value || "").toLowerCase();
    if (/host|cohost|moderator/.test(role)) return "host";
    if (/attendee|participant|guest/.test(role)) return "attendee";
    return role || "unknown";
  }

  function resolveRole(meeting) {
    if (!meeting || typeof meeting.getCurUserType !== "function") {
      return Promise.resolve("unknown");
    }

    try {
      return Promise.resolve(meeting.getCurUserType()).then(normalizeRole, function () {
        return "unknown";
      });
    } catch (error) {
      return Promise.resolve("unknown");
    }
  }

  function bindRoleEvents(meeting) {
    if (!meeting || typeof meeting.on !== "function") return;
    meeting.on("meeting:self:rolesChanged", function () {
      resolveRole(meeting).then(function (role) {
        setState(active.state, role, active.error || (isAdminMode()
          ? (role === "host" ? "Connected as host." : "Connected, but Webex did not report host role.")
          : "Connected as student."));
      });
    });
    meeting.on("meeting:reconnectionStarting", function () {
      setState("loading", active.role, "Webex is reconnecting...");
    });
    meeting.on("meeting:reconnectionSuccess", function () {
      setState("connected", active.role, "Webex reconnected.");
    });
    meeting.on("meeting:reconnectionFailure", function () {
      setState("failed", active.role, isAdminMode()
        ? "Webex reconnection failed. Use the Webex host app fallback if class is live."
        : "Webex reconnection failed. Retry inside Daily Drills or message the host.");
    });
  }

  function actionableError(error) {
    var message = safeMessage(error);
    if (/concurrent active meeting limit exceeded/i.test(message)) {
      return "Webex blocked browser host join because this host account is already in another active meeting. End every other Webex session for this account, then click Start Live Webex Session again.";
    }
    if (/permission|not authorized|forbidden|403/i.test(message)) {
      return "Webex rejected browser host join. Confirm the connected Webex account owns or cohosts this meeting, then reconnect Webex if needed.";
    }
    if (/no v3 webex meeting|meeting is selected|choose|paste/i.test(message)) {
      return "Choose a Webex room first, then click Start Live Webex Session.";
    }
    if (/camera|microphone|media|permission denied|notallowed/i.test(message)) {
      return "Browser camera or microphone could not start. Allow camera and microphone for MissionMed in Chrome, then click Start Live Webex Session again.";
    }
    if (/sdk bundle|webex sdk/i.test(message)) {
      return message;
    }
    return message || "Browser host join failed. Use the Webex app fallback while class keeps moving.";
  }

  function actionableGuestError(error) {
    var message = safeMessage(error);
    if (/authenticate|token|guest token|attendee token|join token|rest_cookie_invalid_nonce|nonce/i.test(message)) {
      return "The live room could not confirm your entry. Stay on the roster, retry the in-page join, or use the external join link and message the host.";
    }
    if (/confluence url for the device is null|device.*null|webex-js-sdk|409/i.test(message)) {
      return "The first in-page join path was unavailable. Switching to the compatible video-room join.";
    }
    if (/permission|not authorized|forbidden|403/i.test(message)) {
      return "The in-browser student join was not authorized. Refresh this page or use the external join link and message the host.";
    }
    if (/camera|microphone|media|permission denied|notallowed/i.test(message)) {
      return "Camera or microphone permission is needed. Allow MissionMed in Chrome, then choose Play again.";
    }
    if (/no v3 webex meeting|meeting is selected|choose|paste/i.test(message)) {
      return "The host has not opened the video room yet. Keep this page open and try again when Dr J starts the room.";
    }
    return message || "The student video join failed. Retry inside Dr J Drills LIVE or use the external join link and message the host.";
  }

  function shouldUseWidgetGuestFallback(error) {
    var message = safeMessage(error);
    return /confluence url for the device is null|device.*null|webex-js-sdk|409/i.test(message);
  }

  function startGuestWidgetFallback(stage, error) {
    if (isAdminMode() || !shouldUseWidgetGuestFallback(error)) {
      return false;
    }
    if (!window.MMEDLiveDrillsEmbeddedWebex || typeof window.MMEDLiveDrillsEmbeddedWebex.start !== "function") {
      return false;
    }

    cleanupFailedJoin(stage);
    setState("loading", "attendee", "Switching to the compatible in-page video join...");
    setEmbedStatus(stage, "Switching to the compatible in-page video join...", "loading");
    window.setTimeout(function () {
      window.MMEDLiveDrillsEmbeddedWebex.start({
        allowAdmin: false,
        hostMode: false,
        autoClickJoin: true,
        forceTokenRefresh: true,
        source: "sdk_guest_device_registration_fallback"
      });
    }, 80);
    return true;
  }

  function sdkJoinOptions() {
    return {
      enableMultistream: true,
      breakoutsSupported: false
    };
  }

  function sdkMediaOptions(localStreams) {
    return {
      localStreams: localStreams,
      audioEnabled: true,
      videoEnabled: true,
      allowMediaInLobby: true,
      additionalMediaOptions: {
        sendAudio: true,
        receiveAudio: true,
        sendVideo: true,
        receiveVideo: true
      }
    };
  }

  function joinWithMediaFallback(meeting, localStreams) {
    return meeting.join(sdkJoinOptions()).then(function () {
      return meeting.addMedia(sdkMediaOptions(localStreams));
    });
  }

  function joinMeetingWithMedia(meeting, localStreams) {
    if (!meeting || typeof meeting.join !== "function" || typeof meeting.addMedia !== "function") {
      return Promise.reject(new Error("Webex meeting media controls are unavailable."));
    }
    if (typeof meeting.joinWithMedia === "function") {
      return Promise.resolve(meeting.joinWithMedia({
        joinOptions: sdkJoinOptions(),
        mediaOptions: sdkMediaOptions(localStreams)
      })).catch(function (error) {
        setState("loading", active.role || "unknown", "Webex combined media join was rejected. Retrying standard media join...");
        return joinWithMediaFallback(meeting, localStreams).catch(function () {
          throw error;
        });
      });
    }
    return joinWithMediaFallback(meeting, localStreams);
  }

  function initWebexWithToken(token, message) {
    return loadWebexSdk().then(function (Webex) {
      setState("loading", "unknown", message || "Initializing Webex session...");
      active.webex = Webex.init({
        config: {
          appName: "MissionMed Daily Drills SDK V3",
          appPlatform: "web"
        },
        credentials: {
          access_token: token
        }
      });
      return waitForWebexReady(active.webex);
    });
  }

  function joinHostWithSdk(stage) {
    var destination = "";
    var localStreams = null;

    if (!stage || !isAdminMode()) {
      setState("failed", "unknown", "Start Live Webex Session is available only to the host.");
      return Promise.resolve();
    }

    active.stage = stage;
    stage.classList.add("is-sdk-v3-active");
    setState("loading", "unknown", "Starting Webex...");
    setEmbedStatus(stage, "Starting Webex inside Daily Drills...", "loading");

    return cleanupBeforeJoin().then(function () {
      active.stage = stage;
      stage.classList.add("is-sdk-v3-active");
      return hydrateMeetingFromState();
    }).then(function (meeting) {
      destination = destinationFromMeeting(meeting);
      if (!destination) {
        throw new Error("No V3 Webex meeting is selected yet.");
      }
      setState("loading", "unknown", "Confirming host access...");
      return fetchHostToken(meeting);
    }).then(function (token) {
      setState("loading", "unknown", "Loading browser video...");
      return initWebexWithToken(token, "Initializing host session...");
    }).then(function () {
      if (active.webex.meetings && typeof active.webex.meetings.register === "function") {
        setState("loading", "unknown", "Registering this browser with Webex...");
        return active.webex.meetings.register();
      }
    }).then(function () {
      setState("loading", "unknown", "Opening camera and microphone...");
      return createLocalStreams(active.webex);
    }).then(function (streams) {
      localStreams = streams;
      renderLocalVideo(stage, localStreams.camera);
      setState("loading", "unknown", "Joining selected Webex room...");
      return active.webex.meetings.create(destination);
    }).then(function (meeting) {
	      active.meeting = meeting;
	      bindRoleEvents(meeting);
      bindHostControlEvents(meeting);
      bindRemoteMediaEvents(meeting);
      refreshHostControls("SDK meeting object ready. Waiting for host role and roster...");
	      setState("loading", "unknown", "Joining selected Webex room with host audio and video...");
	      return joinMeetingWithMedia(meeting, localStreams);
	    }).then(function () {
	      return primeRemoteMediaManager(active.meeting);
	    }).then(function () {
      return resolveRole(active.meeting);
    }).then(function (role) {
      var mismatch = selectedTrackMismatch();
      var message = role === "host"
        ? "You are live as host. Your camera is in the Daily Drills stage."
        : "Webex connected, but reported role " + role + ". Confirm this meeting is owned or cohosted by the connected Webex account.";
      if (mismatch) {
        message += mismatch;
	      }
		      setState("connected", role, message);
      refreshHostControls(role === "host" ? "Webex host controls ready." : "Connected, but Webex did not report host role.");
      startHostRosterPoll();
		      setEmbedStatus(stage, message, role === "host" && !mismatch ? "ready" : "error");
		    }).catch(function (error) {
      var message = actionableError(error);
      setState("failed", active.role || "unknown", message);
      setEmbedStatus(stage, message, "error");
      if (active.meeting || active.webex || active.cameraStream || active.microphoneStream) {
        cleanupFailedJoin(stage);
      }
	    });
	  }

  function joinGuestWithSdk(stage) {
    var destination = "";
    var localStreams = null;

    if (!stage || isAdminMode()) {
      return Promise.resolve();
    }

    active.stage = stage;
    stage.classList.add("is-sdk-v3-active");
    setState("loading", "unknown", "Opening the live Webex room...");
    setEmbedStatus(stage, "Opening Webex inside Daily Drills...", "loading");

    return cleanupBeforeJoin().then(function () {
      active.stage = stage;
      stage.classList.add("is-sdk-v3-active");
      return hydrateMeetingFromState();
    }).then(function (meeting) {
      destination = destinationFromMeeting(meeting);
      if (!destination) {
        throw new Error("No V3 Webex meeting is selected yet.");
      }
      setState("loading", "unknown", "Getting student Webex access...");
      return fetchGuestToken();
    }).then(function (token) {
      setState("loading", "unknown", "Loading browser video...");
      return initWebexWithToken(token, "Joining as student...");
    }).then(function () {
      if (active.webex.meetings && typeof active.webex.meetings.register === "function") {
        setState("loading", "unknown", "Registering this browser with Webex...");
        return active.webex.meetings.register();
      }
    }).then(function () {
      setState("loading", "unknown", "Opening camera and microphone...");
      return createLocalStreams(active.webex);
    }).then(function (streams) {
      localStreams = streams;
      renderLocalVideo(stage, localStreams.camera);
      setState("loading", "unknown", "Joining the live Webex room...");
      return active.webex.meetings.create(destination);
    }).then(function (meeting) {
	      active.meeting = meeting;
	      bindRoleEvents(meeting);
	      bindRemoteMediaEvents(meeting);
	      setState("loading", "attendee", "Joining the live Webex room with student audio and video...");
	      return joinMeetingWithMedia(meeting, localStreams);
	    }).then(function () {
	      return primeRemoteMediaManager(active.meeting);
	    }).then(function () {
      return resolveRole(active.meeting);
    }).then(function (role) {
      role = normalizeRole(role);
      if (role === "unknown") {
        role = "attendee";
      }
      setState("connected", role, "You are connected to Webex inside Daily Drills.");
      setEmbedStatus(stage, "You are connected to Webex inside Daily Drills.", "ready");
    }).catch(function (error) {
      if (startGuestWidgetFallback(stage, error)) {
        return;
      }
      var message = actionableGuestError(error);
      setState("failed", active.role || "unknown", message);
      setEmbedStatus(stage, message, "error");
      if (active.meeting || active.webex || active.cameraStream || active.microphoneStream) {
        cleanupFailedJoin(stage);
      }
    });
  }

  function cleanupBeforeJoin() {
    cleanupSdkMeeting({ keepPreview: true });
    return Promise.resolve();
  }

  function cleanupFailedJoin(stage) {
    var video;
    var previewStillLive = streamHasLiveTracks(preflight.stream);
    if (active.meeting && typeof active.meeting.leave === "function") {
      try {
        active.meeting.leave();
      } catch (error) {}
    }
    if (active.webex && active.webex.meetings && typeof active.webex.meetings.unregister === "function") {
      try {
        active.webex.meetings.unregister();
      } catch (error) {}
    }
    if (!localStreamSharesTracks(active.cameraStream, preflight.stream)) {
      stopLocalStream(active.cameraStream);
    }
    if (!localStreamSharesTracks(active.microphoneStream, preflight.stream)) {
      stopLocalStream(active.microphoneStream);
    }
    active.meeting = null;
    active.webex = null;
    active.cameraStream = null;
    active.microphoneStream = null;
	    active.sourceMediaStream = null;
	    active.mediaPath = "";
    stopHostRosterPoll();
    resetHostControls("Start the Webex session to use host controls.");
    resetRemoteMedia("Waiting for remote students to join Webex.");
	    if (!previewStillLive || !restoreLivePreviewAfterJoinFailure()) {
      updateMediaDiagnostics({
        activeVideoTrackLabel: "not attached",
        activeAudioTrackLabel: "not attached",
        mediaPath: "idle"
      });
    }
    if (stage) {
      stage.classList.remove("is-sdk-v3-active");
      video = stage.querySelector("[data-sdk-v3-local-video]");
      if (video) video.srcObject = null;
    }
  }

	  function bindControls() {
	    document.addEventListener("click", function (event) {
	      var button = event.target && event.target.closest("[data-sdk-v3-host-join]");
		      var leaveButton = event.target && event.target.closest("[data-sdk-v3-leave]");
		      var refreshButton = event.target && event.target.closest("[data-sdk-v3-refresh-devices]");
		      var previewButton = event.target && event.target.closest("[data-sdk-v3-start-preview]");
		      var openPreflightButton = event.target && event.target.closest("[data-sdk-v3-open-preflight]");
		      var closePreflightButton = event.target && event.target.closest("[data-sdk-v3-close-preflight]");
      var toggleHostControlsButton = event.target && event.target.closest("[data-sdk-v3-toggle-host-controls]");
      var refreshHostControlsButton = event.target && event.target.closest("[data-sdk-v3-refresh-host-controls]");
      var autoAdmitButton = event.target && event.target.closest("[data-sdk-v3-auto-admit]");
	      var hideNoVideoButton = event.target && event.target.closest("[data-sdk-v3-hide-no-video]");
	      var toggleSelfViewButton = event.target && event.target.closest("[data-sdk-v3-toggle-self-view]");
	      var muteSelfButton = event.target && event.target.closest("[data-sdk-v3-mute-self]");
      var unmuteSelfButton = event.target && event.target.closest("[data-sdk-v3-unmute-self]");
      var muteAllButton = event.target && event.target.closest("[data-sdk-v3-mute-all]");
      var unmuteAllButton = event.target && event.target.closest("[data-sdk-v3-unmute-all]");
      var recordStartButton = event.target && event.target.closest("[data-sdk-v3-record-start]");
      var recordPauseButton = event.target && event.target.closest("[data-sdk-v3-record-pause]");
      var recordResumeButton = event.target && event.target.closest("[data-sdk-v3-record-resume]");
      var recordStopButton = event.target && event.target.closest("[data-sdk-v3-record-stop]");
      var shareInfoButton = event.target && event.target.closest("[data-sdk-v3-share-info]");
      var moreInfoButton = event.target && event.target.closest("[data-sdk-v3-more-info]");
      var participantActionButton = event.target && event.target.closest("[data-sdk-v3-member-action]");
	      var hostOnlyControl = button || toggleHostControlsButton || refreshHostControlsButton || autoAdmitButton || hideNoVideoButton || toggleSelfViewButton || muteAllButton || unmuteAllButton || recordStartButton || recordPauseButton || recordResumeButton || recordStopButton || shareInfoButton || moreInfoButton || participantActionButton;

      if (hostOnlyControl && !isAdminMode()) {
        event.preventDefault();
        event.stopPropagation();
        setState("failed", "attendee", "Host Webex controls are not available in student mode.");
        return;
      }

      if (leaveButton) {
        event.preventDefault();
        event.stopPropagation();
        cleanupSdkMeeting();
        return;
      }

      if (toggleHostControlsButton) {
        event.preventDefault();
        event.stopPropagation();
        var hostDrawer = toggleHostControlsButton.closest("[data-sdk-v3-host-controls]") || document.querySelector("[data-sdk-v3-host-controls]");
        if (hostDrawer) hostDrawer.classList.toggle("is-open");
        syncHostDrawerLayout();
        return;
      }

      if (refreshHostControlsButton) {
        event.preventDefault();
        event.stopPropagation();
        refreshHostControls("SDK roster and controls refreshed.");
        return;
      }

      if (autoAdmitButton) {
        event.preventDefault();
        event.stopPropagation();
        saveAutoAdmitPreference(!hostControls.autoAdmit);
        refreshHostControls(hostControls.autoAdmit ? "Auto-admit enabled for lobby students." : "Auto-admit disabled. Use Let in for lobby students.");
        return;
      }

	      if (hideNoVideoButton) {
	        event.preventDefault();
	        event.stopPropagation();
	        saveHideNoVideoPreference(!hostControls.hideNoVideo);
	        refreshHostControls(hostControls.hideNoVideo ? "Students without video are hidden from the V3 strip/drawer." : "All SDK participants are visible in the V3 strip/drawer.");
	        return;
	      }

	      if (toggleSelfViewButton) {
	        event.preventDefault();
	        event.stopPropagation();
	        saveSelfViewHiddenPreference(!hostSelfViewHidden);
	        refreshHostControls(hostSelfViewHidden ? "Host self-view hidden. Student video remains prioritized." : "Host self-view shown as picture-in-picture.");
	        return;
	      }

      if (muteSelfButton || unmuteSelfButton) {
        event.preventDefault();
        event.stopPropagation();
        runSelfAudioMute(!!muteSelfButton);
        return;
      }

      if (muteAllButton || unmuteAllButton) {
        event.preventDefault();
        event.stopPropagation();
        runMuteAll(!!muteAllButton);
        return;
      }

      if (recordStartButton || recordPauseButton || recordResumeButton || recordStopButton) {
        event.preventDefault();
        event.stopPropagation();
        if (!active.meeting) {
          refreshHostControls("Start the Webex session before using recording controls.");
          return;
        }
        if (recordStartButton) {
          runRecordingCommand("Starting Webex recording", function () { return active.meeting.startRecording(); }, "Record command sent to Webex.");
        } else if (recordPauseButton) {
          runRecordingCommand("Pausing Webex recording", function () { return active.meeting.pauseRecording(); }, "Pause record command sent to Webex.");
        } else if (recordResumeButton) {
          runRecordingCommand("Resuming Webex recording", function () { return active.meeting.resumeRecording(); }, "Resume record command sent to Webex.");
        } else {
          runRecordingCommand("Stopping Webex recording", function () { return active.meeting.stopRecording(); }, "Stop record command sent to Webex.");
        }
        return;
      }

      if (shareInfoButton) {
        event.preventDefault();
        event.stopPropagation();
        refreshHostControls("Screen share is not enabled in this V3 SDK build yet. Use the Webex desktop fallback for sharing while we wire SDK share controls.");
        return;
      }

      if (moreInfoButton) {
        event.preventDefault();
        event.stopPropagation();
        refreshHostControls("V3 exposes mic, recording, roster, admit, and mute controls when the SDK/account allows them. Desktop-only items stay in the Webex app fallback until custom SDK support is added.");
        var moreDrawer = document.querySelector("[data-sdk-v3-host-controls]");
        if (moreDrawer) moreDrawer.classList.add("is-open");
        return;
      }

      if (participantActionButton) {
        event.preventDefault();
        event.stopPropagation();
        if (participantActionButton.getAttribute("data-sdk-v3-member-action") === "admit") {
          runParticipantAdmit(participantForButton(participantActionButton));
        } else {
          runParticipantMute(participantForButton(participantActionButton), participantActionButton.getAttribute("data-sdk-v3-member-action") === "mute");
        }
        return;
      }

		      if (openPreflightButton) {
	        event.preventDefault();
	        event.stopPropagation();
	        ensureAllStageUi();
	        var modal = document.querySelector("[data-sdk-v3-preflight-modal]");
	        if (modal) modal.hidden = false;
	        refreshDevices(false);
	        return;
	      }

	      if (closePreflightButton) {
	        event.preventDefault();
	        event.stopPropagation();
	        var preflightModal = document.querySelector("[data-sdk-v3-preflight-modal]");
	        if (preflightModal) preflightModal.hidden = true;
	        return;
	      }

	      var clickedPreflightModal = event.target && event.target.closest("[data-sdk-v3-preflight-modal]");
	      if (clickedPreflightModal && event.target === clickedPreflightModal) {
	        event.preventDefault();
	        event.stopPropagation();
	        clickedPreflightModal.hidden = true;
	        return;
	      }

      if (refreshButton) {
        event.preventDefault();
        event.stopPropagation();
        ensureAllStageUi();
        refreshDevices(true);
        return;
      }

      if (previewButton) {
        event.preventDefault();
        event.stopPropagation();
        ensureAllStageUi();
        persistSelectedDevices();
        startPreview();
        return;
      }

      if (button) {
        event.preventDefault();
        event.stopPropagation();
        ensureAllStageUi();
        persistSelectedDevices();
	        if (button.hasAttribute("data-sdk-v3-preflight-join")) {
	          startPreview().then(function (stream) {
	            if (stream) {
	              var modal = document.querySelector("[data-sdk-v3-preflight-modal]");
	              if (modal) modal.hidden = true;
	              joinHostWithSdk(selectedStage());
	            }
	          });
          return;
        }
        joinHostWithSdk(selectedStage());
        return;
      }

    }, true);

    document.addEventListener("change", function (event) {
      if (!event.target || !event.target.closest("[data-sdk-v3-camera-select],[data-sdk-v3-mic-select]")) return;
      persistSelectedDevices();
      if (event.target.closest("[data-sdk-v3-camera-select]")) {
        setDeviceStatus("Camera selected.", "ready");
      } else {
        setDeviceStatus("Mic selected.", "ready");
      }
      if (preflight.stream) {
        startPreview();
      }
    }, true);
  }

  function init() {
    if (!config.enabled || !isV3Route()) return;
    ensureStyles();
    ensureAllStageUi();
    installPreflightObserver();
	    setState("idle", "unknown", readyMessage());
    bindControls();
    window.MMEDLiveDrillsSDKV3 = {
      enabled: true,
      route: config.route,
      runtimeMode: config.runtimeMode,
      stateEndpoint: config.stateEndpoint,
	      startHost: function () {
	        ensureAllStageUi();
	        return joinHostWithSdk(selectedStage());
	      },
	      startGuest: function () {
	        ensureAllStageUi();
	        return joinGuestWithSdk(selectedStage());
	      },
	      leave: cleanupSdkMeeting,
	      setSpeakerVolume: setSpeakerVolume,
	      status: function () {
	        return {
	          state: active.state,
	          role: active.role,
	          hasMeeting: !!active.meeting,
	          hasLocalMedia: !!active.cameraStream,
		          mediaPath: active.mediaPath || mediaDiagnostics.mediaPath,
		          selectedCameraLabel: mediaDiagnostics.selectedCameraLabel,
		          activeVideoTrackLabel: mediaDiagnostics.activeVideoTrackLabel,
		          selectedMicLabel: mediaDiagnostics.selectedMicLabel,
		          activeAudioTrackLabel: mediaDiagnostics.activeAudioTrackLabel,
              remoteVideoCount: remoteMedia.videos.length,
              remoteAudioCount: remoteMedia.audios.length,
              remoteMediaStatus: remoteMedia.status,
              remoteVideoSourceCount: remoteMedia.videoSourceCount || "",
              remoteLayoutId: remoteMedia.lastLayoutId || ""
		        };
      }
    };
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
