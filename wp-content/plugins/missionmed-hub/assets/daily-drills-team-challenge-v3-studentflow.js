(function () {
  "use strict";

  if (window.__MMED_DRILLS_LIVE_FLOOR_INITIALIZED__) {
    return;
  }
  window.__MMED_DRILLS_LIVE_FLOOR_INITIALIZED__ = true;

  var config = normalizeBootstrapConfig(window.MMEDLiveDrillsTeamChallengePreview || {});
  window.MMEDLiveDrillsTeamChallengePreview = config;
  if (!config.enabled || !config.stateUrl) {
    return;
  }

  var professionalAvatarFiles = [
    "doctor-female-01.webp",
    "doctor-female-02.webp",
    "doctor-female-03.webp",
    "doctor-female-04.webp",
    "doctor-female-05.webp",
    "doctor-female-06.webp",
    "doctor-male-01.webp",
    "doctor-male-02.webp",
    "superhero-female-01.webp",
    "superhero-female-02.webp"
  ];

  var legacyShell = document.getElementById("legacyShell");
  if (!legacyShell) {
    return;
  }

  var state = null;
  var lastConfirmedState = null;
  var mode = config.mode === "admin" || config.isAdmin ? "admin" : "student";
  var isAdmin = mode === "admin";
  var currentUserId = Number(config.currentUserId || 0);
  var currentUserProfile = normalizeCurrentUserProfile(config.currentUser || config.user || {});
  var fastStateActionUrl = config.fastStateActionUrl || config.stateUrl || "";
  var fastStateUrl = fastStateActionUrl;
  var fastStateWriteUrl = fastStateActionUrl;
  var fastStateReadUrl = fastStateActionUrl;
  var pollTimer = null;
  var realtimeWorker = null;
  var realtimeMode = "starting";
  var refreshInFlight = false;
  var pendingActions = 0;
  var actionQueue = Promise.resolve();
  var draggedStudent = null;
  var draggedAssignmentStudent = null;
  var studentWebexOpened = false;
  var audioContext = null;
  var lastWinnerKey = "";
  var lastFeedbackEventKey = "";
  var hasRenderedState = false;
  var realtimePollInterval = Math.max(300, Math.min(Number(config.pollInterval || 450), 900));
  var realtimeTurboInterval = 300;
  var realtimeBurstUntil = Date.now() + 60000;
  var lastStateFingerprint = "";
  var latestAppliedStateMs = 0;
  var latestAppliedEventSeq = -1;
  var stateEtag = "";
  var serverClockOffsetMs = 0;
  var serverClockSamples = 0;
  var diagnosticsEnabled = false;
  var diagnosticEvents = [];
  var correctSoundUrl = "https://cdn.missionmedinstitute.com/html-system/LIVE/Shared/assets/Music/Announcer%20Correct%20Answer.mp3";
  var missedSoundUrl = "https://cdn.missionmedinstitute.com/html-system/LIVE/Shared/assets/Music/Child%20Voice%20Try%20Again%202.mp3";
  var winnerSoundUrl = "https://cdn.missionmedinstitute.com/html-system/LIVE/Shared/assets/Music/Cheering%20Small%20Crowd.mp3";
  var soundCache = {};
		  var scheduledSessions = Array.isArray(config.scheduledSessions) ? config.scheduledSessions.slice() : [];
		  var personalMeetingRoomUrl = String(config.personalMeetingRoomUrl || "");
		  if (!personalMeetingRoomUrl && config.meeting && isInitialPersonalMeetingRoomUrl(config.meeting.joinUrl)) {
		    personalMeetingRoomUrl = String(config.meeting.joinUrl || "");
		  }
		  var personalMeetingRoomOptionValue = "__personal_room__";
		  var nonceRefreshPromise = null;
		  var guestStorageKey = "mmedLiveTeamChallengeGuest";
		  var viewerTicketStorageKey = "mmedLiveTeamChallengeViewerTicket";
		  var viewerTicketMetaStorageKey = "mmedLiveTeamChallengeViewerTicketMeta";
	  var activeGuestRosterStorageKey = "mmedLiveTeamChallengeActiveGuestId";
	  var watchingStorageKey = "mmedLiveTeamChallengeWatching";
	  var chatTargetStorageKey = "mmedLiveTeamChallengeChatTargetV3";
	  var scoreLedgerStorageKey = "mmedLiveTeamChallengeScoreLedgerV3";
	  var autoNextEnabledStorageKey = "mmedLiveTeamChallengeAutoNextEnabled";
	  var autoNextModeStorageKey = "mmedLiveTeamChallengeAutoNextMode";
		  var adminSeenStorageKey = "mmedLiveTeamChallengeAdminSeen";
		  var adminStepStorageKey = "mmedLiveTeamChallengeAdminStep";
		  var effectsVolumeStorageKey = "mmedLiveTeamChallengeEffectsVolume";
		  var effectsMutedStorageKey = "mmedLiveTeamChallengeEffectsMuted";
		  var speakerVolumeStorageKey = "mmedLiveTeamChallengeSpeakerVolume";
		  var speakerMutedStorageKey = "mmedLiveTeamChallengeSpeakerMuted";
			  var guestFieldsHydrated = false;
			  var guestFieldsDirty = false;
			  var guestEntryMode = !currentUserId;
			  var activeGuestRosterId = loadActiveGuestRosterId();
			  clearLegacySharedViewerTicket();
			  var viewerTicket = loadViewerTicket();
			  var viewerTicketMeta = loadViewerTicketMeta();
			  if (!viewerTicketBelongsToCurrentContext(viewerTicketMeta)) {
			    viewerTicket = "";
			    clearSessionViewerTicket();
			  }
			  if (config.viewerTicket) {
			    viewerTicket = String(config.viewerTicket || "");
			    viewerTicketMeta = { id: currentUserId ? "u" + String(currentUserId) : "", role: isAdmin ? "host" : "participant", kind: currentUserId ? "signed" : "guest" };
			    persistSessionViewerTicket(viewerTicket, viewerTicketMeta);
			  }
			  var autoNextEnabled = loadAutoNextEnabled();
			  var autoNextMode = loadAutoNextMode();
			  var activeAdminStep = loadAdminStep();
			  var audioPrefs = loadAudioPrefs();
			  var countdownTimer = null;

  if (hasGuestResetParam()) {
    resetStoredGuestChoice();
  }

  rememberAdminMode();

  function defaultRestUrl() {
    return window.location.origin.replace(/\/$/, "") + "/wp-json/mmed/v1";
  }

  function buildFastStateUrl() {
    return "";
  }

  function buildFastStateWriteUrl() {
    var origin = window.location.origin.replace(/\/$/, "");
    if (window.location.pathname.indexOf("/daily-drills-live-webex-v3/") === -1) {
      return "";
    }
    return origin + "/daily-drills-live-webex-v3/?mmed_v3_team_state_fast=1";
  }

  function buildFastStateReadUrl() {
    return fastStateActionUrl ? appendUrlParam(fastStateActionUrl, "mmed_v3_state", "1") : "";
  }

  function appendUrlParam(rawUrl, key, value) {
    try {
      var parsed = new URL(String(rawUrl || ""), window.location.href);
      parsed.searchParams.set(key, value);
      return parsed.toString();
    } catch (error) {
      if (!rawUrl) return "";
      return String(rawUrl) + (String(rawUrl).indexOf("?") === -1 ? "?" : "&") + encodeURIComponent(key) + "=" + encodeURIComponent(value);
    }
  }

  function hasGuestResetParam() {
    return /(?:^|[?&])mmed_guest_reset=1(?:&|$)/.test(window.location.search || "");
  }

		  function resetStoredGuestChoice() {
		    try {
		      window.localStorage.removeItem(guestStorageKey);
		      window.localStorage.removeItem(activeGuestRosterStorageKey);
		      window.localStorage.removeItem(watchingStorageKey);
		      window.localStorage.removeItem(viewerTicketStorageKey);
		      window.sessionStorage.removeItem(viewerTicketStorageKey);
		      window.sessionStorage.removeItem(viewerTicketMetaStorageKey);
		    } catch (error) {}
		  }

		  function clearLegacySharedViewerTicket() {
		    try {
		      if (window.localStorage) window.localStorage.removeItem(viewerTicketStorageKey);
		    } catch (error) {}
		  }

		  function loadViewerTicket() {
		    try {
		      return String((window.sessionStorage && window.sessionStorage.getItem(viewerTicketStorageKey)) || "");
		    } catch (error) {
		      return "";
		    }
		  }

		  function loadViewerTicketMeta() {
		    try {
		      var raw = window.sessionStorage && window.sessionStorage.getItem(viewerTicketMetaStorageKey);
		      var parsed = raw ? JSON.parse(raw) : {};
		      return parsed && typeof parsed === "object" ? parsed : {};
		    } catch (error) {
		      return {};
		    }
		  }

		  function viewerTicketBelongsToCurrentContext(meta) {
		    meta = meta && typeof meta === "object" ? meta : {};
		    if (!meta.kind) return false;
		    if (meta.kind === "guest") return !currentUserId;
		    return !!currentUserId && String(meta.id || "") === "u" + String(currentUserId);
		  }

		  function clearSessionViewerTicket() {
		    try {
		      if (!window.sessionStorage) return;
		      window.sessionStorage.removeItem(viewerTicketStorageKey);
		      window.sessionStorage.removeItem(viewerTicketMetaStorageKey);
		    } catch (error) {}
		  }

		  function persistSessionViewerTicket(ticket, meta) {
		    try {
		      if (!window.sessionStorage) return;
		      if (ticket) {
		        window.sessionStorage.setItem(viewerTicketStorageKey, String(ticket));
		        window.sessionStorage.setItem(viewerTicketMetaStorageKey, JSON.stringify(meta || {}));
		      } else {
		        clearSessionViewerTicket();
		      }
		    } catch (error) {}
		  }

		  function saveViewerTicket(ticket, viewer) {
		    viewerTicket = String(ticket || "");
		    config.viewerTicket = viewerTicket;
		    viewer = viewer && typeof viewer === "object" ? viewer : {};
		    viewerTicketMeta = viewerTicket ? {
		      id: String(viewer.id || (currentUserId ? "u" + String(currentUserId) : "")),
		      role: String(viewer.role || (isAdmin ? "host" : "participant")),
		      kind: String(viewer.id || "").indexOf("guest-") === 0 || !currentUserId ? "guest" : "signed"
		    } : {};
		    persistSessionViewerTicket(viewerTicket, viewerTicketMeta);
		    if (realtimeWorker) {
		      realtimeWorker.postMessage({ type: "update-viewer", viewerTicket: viewerTicket });
		    } else {
		      stateEtag = "";
		      scheduleRealtimePoll(0);
		    }
		    if (window.MMEDLiveDrillsWebexPreview) {
		      window.MMEDLiveDrillsWebexPreview.viewerTicket = viewerTicket;
		    }
		    if (window.MMEDLiveDrillsSDKV3Config) {
		      window.MMEDLiveDrillsSDKV3Config.viewerTicket = viewerTicket;
		    }
		  }

	  function rememberAdminMode() {
	    if (!isAdmin) return;
	    try {
	      if (window.localStorage) {
	        window.localStorage.setItem(adminSeenStorageKey, "1");
	      }
	    } catch (error) {}
	  }

	  function hasAdminSessionMemory() {
	    try {
	      return !isAdmin && !!(window.localStorage && window.localStorage.getItem(adminSeenStorageKey) === "1");
	    } catch (error) {
	      return false;
	    }
	  }

	  function normalizeCurrentUserProfile(rawProfile) {
	    var profile = rawProfile && typeof rawProfile === "object" ? rawProfile : {};
	    var firstName = String(profile.first_name || profile.firstName || "");
	    var lastName = String(profile.last_name || profile.lastName || "");
	    var displayName = String(profile.name || profile.display_name || profile.displayName || "");
	    var nickname = String(profile.nickname || profile.slug || "");
	    var avatarUrls = profile.avatar_urls || profile.avatarUrls || {};
	    var avatarUrl = String(profile.avatarUrl || profile.avatar_url || avatarUrls["96"] || avatarUrls["48"] || avatarUrls["24"] || "");
	    var avatarFullUrl = String(profile.avatarFullUrl || profile.avatar_full_url || avatarUrls["192"] || avatarUrls["96"] || avatarUrl || "");
	    var name = displayName || [firstName, lastName].join(" ").trim() || nickname;
	    return {
	      id: Number(profile.id || currentUserId || 0),
	      firstName: firstName,
	      lastName: lastName,
	      displayName: displayName,
	      name: name,
	      avatarUrl: avatarUrl,
	      avatarFullUrl: avatarFullUrl
	    };
	  }

	  function fetchCurrentUserProfile() {
	    if (!currentUserId || isAdmin || !window.fetch) {
	      renderStudentIdentity();
	      return Promise.resolve(currentUserProfile);
	    }
	    var headers = {};
	    if (config.nonce) {
	      headers["X-WP-Nonce"] = config.nonce;
	    }
	    return window.fetch(window.location.origin.replace(/\/$/, "") + "/wp-json/wp/v2/users/me?context=view&mmed_live_user_ts=" + Date.now(), {
	      method: "GET",
	      credentials: "same-origin",
	      cache: "no-store",
	      headers: headers
	    }).then(function (response) {
	      if (!response.ok) {
	        throw new Error("User profile unavailable");
	      }
	      return response.json();
	    }).then(function (profile) {
	      currentUserProfile = normalizeCurrentUserProfile(profile);
	      config.currentUser = currentUserProfile;
	      updateLocalCurrentUserRosterEntry();
	      renderStudentIdentity();
	      renderStudentPanelAvatars();
	      if (state && Array.isArray(state.teams)) {
	        renderState();
	      }
	      return currentUserProfile;
	    }).catch(function () {
	      renderStudentIdentity();
	      return currentUserProfile;
	    });
	  }

	  function currentStudentDisplayName(payload) {
	    var profile = loadGuestProfile();
	    var name = "";
	    if (currentUserId) {
	      name = currentUserProfile.name || currentUserProfile.displayName || [currentUserProfile.firstName || "", currentUserProfile.lastName || ""].join(" ").trim();
	    } else {
	      name = [payload && payload.firstName || profile.firstName || "", payload && payload.lastName || profile.lastName || ""].join(" ").trim();
	    }
	    return name || (currentUserId ? "MissionMed Student" : "You");
	  }

	  function currentStudentAvatarFields() {
	    if (!currentUserId) {
	      return {};
	    }
	    return {
	      avatarUrl: currentUserProfile.avatarUrl || "",
	      avatarFullUrl: currentUserProfile.avatarFullUrl || currentUserProfile.avatarUrl || "",
	      avatarSource: currentUserProfile.avatarUrl ? "wordpress" : "wordpress_pending",
	      avatarSeed: "u" + String(currentUserId)
	    };
	  }

	  function updateLocalCurrentUserRosterEntry(targetState) {
	    var targetId = currentUserId ? "u" + String(currentUserId) : "";
	    var displayName = currentStudentDisplayName();
	    var avatarFields = currentStudentAvatarFields();
	    var rosterState = targetState || state;
	    if (!targetId || !rosterState || !Array.isArray(rosterState.teams)) {
	      return;
	    }
	    rosterState.teams.forEach(function (team) {
	      (team.students || []).forEach(function (student) {
	        if (String(student.id || "") === targetId) {
	          student.name = displayName;
	          student.initials = initialsFromName(displayName);
	          if (avatarFields.avatarUrl) {
	            student.avatarUrl = avatarFields.avatarUrl;
	          }
	          if (avatarFields.avatarFullUrl) {
	            student.avatarFullUrl = avatarFields.avatarFullUrl;
	          }
	          student.avatarSource = avatarFields.avatarSource || student.avatarSource;
	          student.avatarSeed = avatarFields.avatarSeed || student.avatarSeed;
	        }
	      });
	    });
	  }

	  function loadAutoNextEnabled() {
	    try {
	      return !!(window.localStorage && window.localStorage.getItem(autoNextEnabledStorageKey) === "1");
	    } catch (error) {
	      return false;
	    }
	  }

	  function saveAutoNextEnabled(value) {
	    autoNextEnabled = !!value;
	    try {
	      if (window.localStorage) {
	        window.localStorage.setItem(autoNextEnabledStorageKey, autoNextEnabled ? "1" : "0");
	      }
	    } catch (error) {}
	    updateAutoNextControls();
	  }

	  function loadAutoNextMode() {
	    try {
	      var stored = window.localStorage && window.localStorage.getItem(autoNextModeStorageKey);
	      return stored === "fair_random" ? "fair_random" : "ordered";
	    } catch (error) {
	      return "ordered";
	    }
	  }

	  function saveAutoNextMode(value) {
		    autoNextMode = value === "fair_random" ? "fair_random" : "ordered";
		    try {
		      if (window.localStorage) {
		        window.localStorage.setItem(autoNextModeStorageKey, autoNextMode);
	      }
	    } catch (error) {}
		    updateAutoNextControls();
		  }

		  function loadAdminStep() {
		    return "1";
		  }

		  function setAdminStep(step) {
		    activeAdminStep = /^[123]$/.test(String(step || "")) ? String(step) : "1";
		    try {
		      if (window.localStorage) {
		        window.localStorage.setItem(adminStepStorageKey, activeAdminStep);
		      }
		    } catch (error) {}
		    syncAdminStepTabs();
		  }

		  function loadAudioPrefs() {
		    return {
		      effectsVolume: loadVolumePreference(effectsVolumeStorageKey, 0.88),
		      effectsMuted: loadBooleanPreference(effectsMutedStorageKey, false),
		      speakerVolume: loadVolumePreference(speakerVolumeStorageKey, 1),
		      speakerMuted: loadBooleanPreference(speakerMutedStorageKey, false)
		    };
		  }

		  function loadVolumePreference(key, fallback) {
		    try {
		      var stored = window.localStorage && window.localStorage.getItem(key);
		      if (stored === null || stored === "") {
		        return fallback;
		      }
		      return clampVolume(Number(stored));
		    } catch (error) {
		      return fallback;
		    }
		  }

		  function loadBooleanPreference(key, fallback) {
		    try {
		      var stored = window.localStorage && window.localStorage.getItem(key);
		      if (stored === "1") return true;
		      if (stored === "0") return false;
		      return fallback;
		    } catch (error) {
		      return fallback;
		    }
		  }

		  function saveAudioPrefs() {
		    try {
		      if (!window.localStorage) return;
		      window.localStorage.setItem(effectsVolumeStorageKey, String(audioPrefs.effectsVolume));
		      window.localStorage.setItem(effectsMutedStorageKey, audioPrefs.effectsMuted ? "1" : "0");
		      window.localStorage.setItem(speakerVolumeStorageKey, String(audioPrefs.speakerVolume));
		      window.localStorage.setItem(speakerMutedStorageKey, audioPrefs.speakerMuted ? "1" : "0");
		    } catch (error) {}
		  }

		  function clampVolume(value) {
		    if (!Number.isFinite(value)) {
		      return 1;
		    }
		    return Math.max(0, Math.min(1, value));
		  }

		  function customAccountUrl(rawUrl) {
		    var redirect = window.location.origin.replace(/\/$/, "") + "/daily-drills-live-webex-v3/";
		    var fallback = window.location.origin.replace(/\/$/, "") + "/my-account/?redirect_to=" + encodeURIComponent(redirect);
		    var url;
		    if (!rawUrl) {
		      return fallback;
		    }
		    try {
		      url = new URL(rawUrl, window.location.origin);
		      if (/\/wp-login\.php$/i.test(url.pathname || "")) {
		        return fallback;
		      }
		      if (!/\/my-account\/?$/i.test(url.pathname || "")) {
		        return fallback;
		      }
		      if (!url.searchParams.get("redirect_to")) {
		        url.searchParams.set("redirect_to", redirect);
		      }
		      return url.toString();
		    } catch (error) {
		      return fallback;
		    }
		  }

  function normalizeBootstrapConfig(rawConfig) {
    var next = rawConfig && typeof rawConfig === "object" ? rawConfig : {};
    var isPreviewRoute = /\/daily-drills-live-webex-v3\/?$/i.test(window.location.pathname || "");

    if (!next.stateUrl && isPreviewRoute) {
      next.stateUrl = defaultRestUrl() + "/live-drills-v3/team-challenge";
    }
    if (next.stateUrl) {
      next.enabled = true;
    }
    next.isAdmin = next.isAdmin === true;
    next.mode = next.isAdmin ? "admin" : (next.mode || "student");
	    next.currentUserId = Number(next.currentUserId || 0);
	    next.workerUrl = String(next.workerUrl || "");
	    next.viewerTicket = String(next.viewerTicket || "");
	    next.avatarBaseUrl = next.avatarBaseUrl || (window.location.origin.replace(/\/$/, "") + "/wp-content/plugins/missionmed-hub/assets/team-challenge-avatars/");
		    next.loginUrl = customAccountUrl(next.loginUrl);
		    next.registrationUrl = customAccountUrl(next.registrationUrl);
	    next.avatarStudioUrl = next.avatarStudioUrl || "";
    next.meeting = next.meeting && typeof next.meeting === "object" ? next.meeting : {};
    next.scheduledSessions = Array.isArray(next.scheduledSessions) ? next.scheduledSessions : [];
	    next.pollInterval = next.pollInterval || 450;
	    next.copy = next.copy || {
	      studentMode: "The host will choose each player in turn.",
      adminMode: "Select the active student, or use Auto next, then mark Correct or Missed."
    };

    return next;
  }

  document.body.classList.add("mmed-team-challenge-enabled");
  document.body.classList.toggle("mmed-team-challenge-admin", isAdmin);

  injectStyles();
  injectFloorStyles();
  mountChallengeFrame();
  bindControls();
  preloadSounds();
  startRealtimePolling();
  fetchCurrentUserProfile();
	  countdownTimer = window.setInterval(renderCountdown, 250);
		  window.addEventListener("beforeunload", function () {
		    window.clearTimeout(pollTimer);
		    window.clearInterval(countdownTimer);
		    if (realtimeWorker) {
		      realtimeWorker.postMessage({ type: "stop" });
		      realtimeWorker.terminate();
		      realtimeWorker = null;
		    }
		  });
	  window.addEventListener("focus", function () {
	    enterRealtimeBurst(8000, true);
	  });
		  document.addEventListener("visibilitychange", function () {
		    if (!document.hidden) {
		      enterRealtimeBurst(8000, true);
		    } else if (realtimeWorker) {
		      realtimeWorker.postMessage({ type: "poll-now" });
		    }
		  });
	  document.addEventListener("pointerdown", function () {
	    enterRealtimeBurst(4500, false);
	    primeFeedbackAudio();
	  }, true);
	  document.addEventListener("keydown", function () {
	    enterRealtimeBurst(4500, false);
	    primeFeedbackAudio();
	  }, true);

		  function startRealtimePolling() {
		    if (config.workerUrl && window.Worker) {
		      try {
		        realtimeWorker = new Worker(config.workerUrl);
		        realtimeMode = "worker";
		        realtimeWorker.onmessage = handleRealtimeWorkerMessage;
		        realtimeWorker.onerror = function () {
		          recordDiagnostic("worker_failed", { mode: "fallback" });
		          stopRealtimeWorker();
		          startMainThreadFallback();
		        };
		        realtimeWorker.postMessage({
		          type: "start",
		          url: fastStateUrl || config.stateUrl,
		          viewerTicket: viewerTicket,
		          intervalMs: realtimePollInterval,
		          etag: stateEtag
		        });
		        return;
		      } catch (error) {
		        recordDiagnostic("worker_start_failed", { message: safeDiagnosticMessage(error) });
		        stopRealtimeWorker();
		      }
		    }
		    startMainThreadFallback();
		  }

		  function stopRealtimeWorker() {
		    if (!realtimeWorker) return;
		    try {
		      realtimeWorker.postMessage({ type: "stop" });
		      realtimeWorker.terminate();
		    } catch (error) {}
		    realtimeWorker = null;
		  }

		  function startMainThreadFallback() {
		    realtimeMode = "main-thread-fallback";
		    scheduleRealtimePoll(0);
		  }

		  function handleRealtimeWorkerMessage(event) {
		    var message = event && event.data && typeof event.data === "object" ? event.data : {};
		    if (message.etag) stateEtag = String(message.etag);
		    updateServerClock(message.timing || {});
		    recordDiagnostic(message.type || "worker_message", message.timing || {});
		    if (message.type === "state" && message.state) {
		      applyAuthoritativeState(message.state, message.timing || {});
		      renderConnectionState("connected");
		      return;
		    }
		    if (message.type === "unchanged") {
		      renderConnectionState("connected");
		      return;
		    }
		    if (message.type === "authorization-expired") {
		      saveViewerTicket("");
		      setGuestWatching(false);
		      renderStatus("Your room access expired. Choose Play or Watch again to reconnect.");
		      return;
		    }
		    if (message.type === "read-error") {
		      renderConnectionState("reconnecting");
		    }
		  }

		  function scheduleRealtimePoll(delay) {
		    if (realtimeWorker) {
		      if (typeof delay === "number" && delay <= 0) {
		        realtimeWorker.postMessage({ type: "poll-now" });
		      }
		      return;
		    }
		    window.clearTimeout(pollTimer);
	    pollTimer = window.setTimeout(function () {
	      refreshState().then(function () {
	        scheduleRealtimePoll();
	      });
	    }, typeof delay === "number" ? delay : currentRealtimePollDelay());
	  }

		  function currentRealtimePollDelay() {
		    var baseDelay = realtimePollInterval;
		    if (Date.now() < realtimeBurstUntil) {
		      baseDelay = realtimeTurboInterval;
	    }
	    return baseDelay + Math.floor(Math.random() * 24);
	  }

	  function enterRealtimeBurst(durationMs, pollNow) {
	    realtimeBurstUntil = Math.max(realtimeBurstUntil, Date.now() + Math.max(Number(durationMs || 0), 0));
		    if (pollNow) {
		      if (realtimeWorker) {
		        realtimeWorker.postMessage({ type: "poll-now" });
		      } else {
		        scheduleRealtimePoll(0);
		      }
		    }
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
      var marker = "window.MMEDLiveDrillsTeamChallengePreview = ";
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

		  function fetchState(method, payload) {
		    var requestMethod = method || "GET";
		    var requestUrl = fastStateActionUrl || config.stateUrl;
		    var startedAtMs = Date.now();
		    var headers = { "Accept": "application/json" };
		    if (!requestUrl) {
		      return Promise.reject(new Error("The live room connection is unavailable. Refresh the page."));
		    }
		    if (requestMethod === "POST") {
		      headers["Content-Type"] = "application/json";
		      if (config.nonce) headers["X-WP-Nonce"] = config.nonce;
		    } else if (stateEtag) {
		      headers["If-None-Match"] = stateEtag;
		    }
		    if (viewerTicket) headers["X-MMED-Viewer-Ticket"] = viewerTicket;

		    return window.fetch(requestUrl, {
		      method: requestMethod,
		      credentials: "same-origin",
		      cache: "no-store",
		      headers: headers,
		      body: payload ? JSON.stringify(payload) : undefined
		    }).then(function (response) {
		      var receivedAtMs = Date.now();
		      var nextEtag = response.headers.get("ETag");
		      var timing = {
		        requestStartedAtMs: startedAtMs,
		        clientReceivedAtMs: receivedAtMs,
		        serverNowMs: Number(response.headers.get("X-MMED-Server-Now-Ms") || 0),
		        eventSeq: Number(response.headers.get("X-MMED-Event-Seq") || 0),
		        snapshotAgeMs: Number(response.headers.get("X-MMED-Snapshot-Age-Ms") || 0),
		        readerMode: requestMethod === "GET" ? realtimeMode : "writer",
		        roundTripMs: Math.max(0, receivedAtMs - startedAtMs)
		      };
		      if (nextEtag) stateEtag = nextEtag;
		      updateServerClock(timing);
		      recordDiagnostic(response.status === 304 ? "unchanged" : "response", timing);
		      if (response.status === 304) return null;
		      return response.json().catch(function () {
		        return {};
		      }).then(function (body) {
		        if (!response.ok) {
		          var error = new Error(body.message || "The live room could not complete that action. Try again.");
		          error.status = response.status;
		          throw error;
		        }
		        body._clientTiming = timing;
		        return body;
		      });
		    });
		  }

		  function stateWriteUrlForPayload() {
		    return fastStateActionUrl || config.stateUrl || fastStateWriteUrl;
		  }

	  function requestState(method, payload, options) {
	    options = options || {};
	    return fetchState(method, payload).catch(function (error) {
	      if ((method || "GET") === "GET" && error && error.status === 401 && viewerTicket && !options.publicRetry) {
	        saveViewerTicket("");
	        return requestState(method, payload, { publicRetry: true });
	      }
	      if (!isNonceError(error)) {
	        throw error;
      }

      return refreshConfigNonce().then(function () {
        return fetchState(method, payload);
      });
    });
  }

	  function refreshState(options) {
	    options = options || {};
    if (refreshInFlight || (pendingActions > 0 && !options.force)) {
      return Promise.resolve();
    }

    refreshInFlight = true;
		    return requestState("GET").then(function (nextState) {
		      if (nextState) applyAuthoritativeState(nextState, nextState._clientTiming || {});
	    }).catch(function (error) {
	      renderStatus(error.message || "The live room could not refresh. Keep this page open while it reconnects.");
	      renderConnectionState("reconnecting");
	    }).then(function () {
	      refreshInFlight = false;
	    });
	  }

	  function stateEventSeq(nextState) {
	    var sequence = Number(nextState && nextState.eventSeq);
	    return Number.isFinite(sequence) ? Math.max(0, Math.floor(sequence)) : 0;
	  }

	  function applyAuthoritativeState(nextState, timing) {
	    var incomingSeq;
	    var incomingVersion;
	    var fingerprint;
	    var previousState;
	    var feedback;
	    var incomingRole;
	    var currentRole;
	    if (!nextState || typeof nextState !== "object") return false;
	    incomingSeq = stateEventSeq(nextState);
	    incomingRole = String(nextState.viewer && nextState.viewer.role || "public");
	    currentRole = String(state && state.viewer && state.viewer.role || "public");
	    if (incomingSeq < latestAppliedEventSeq) {
	      recordDiagnostic("stale_rejected", { incomingEventSeq: incomingSeq, appliedEventSeq: latestAppliedEventSeq });
	      return false;
	    }
	    if (incomingSeq === latestAppliedEventSeq && incomingRole === currentRole && state) {
	      return false;
	    }

	    incomingVersion = stateVersionMs(nextState);
	    fingerprint = stateFingerprint(nextState);
	    previousState = state ? cloneState(state) : null;
	    updateServerClock(Object.assign({}, timing || {}, { serverNowMs: Number(nextState.nowMs || (timing && timing.serverNowMs) || 0) }));
	    state = normalizeState(nextState);
	    latestAppliedEventSeq = Math.max(latestAppliedEventSeq, incomingSeq);
	    latestAppliedStateMs = Math.max(latestAppliedStateMs, incomingVersion || 0);
	    lastConfirmedState = cloneState(state);
	    updateMeetingConfigFromState(nextState);
	    feedback = detectIncomingFeedback(previousState, state);
	    renderState();
	    renderConnectionState("connected");
	    playIncomingFeedback(feedback);
	    if (fingerprint && fingerprint !== lastStateFingerprint) {
	      lastStateFingerprint = fingerprint;
	      enterRealtimeBurst(3000, false);
	    }
	    recordDiagnostic("state_applied", {
	      eventSeq: incomingSeq,
	      clientAppliedAtMs: Date.now(),
	      clientReceivedAtMs: Number(timing && timing.clientReceivedAtMs || 0),
	      lifecycle: lifecycleState(state),
	      mode: realtimeMode
	    });
	    return true;
	  }

	  function updateServerClock(timing) {
	    timing = timing && typeof timing === "object" ? timing : {};
	    var serverNowMs = Number(timing.serverNowMs || 0);
	    var startedAtMs = Number(timing.requestStartedAtMs || 0);
	    var receivedAtMs = Number(timing.clientReceivedAtMs || Date.now());
	    if (!Number.isFinite(serverNowMs) || serverNowMs <= 0) return;
	    var midpoint = startedAtMs > 0 ? startedAtMs + Math.max(0, receivedAtMs - startedAtMs) / 2 : receivedAtMs;
	    var sample = serverNowMs - midpoint;
	    if (!Number.isFinite(sample)) return;
	    if (!serverClockSamples) {
	      serverClockOffsetMs = sample;
	    } else {
	      serverClockOffsetMs = (serverClockOffsetMs * 0.75) + (sample * 0.25);
	    }
	    serverClockSamples += 1;
	  }

	  function authoritativeNowMs() {
	    return Date.now() + serverClockOffsetMs;
	  }

	  function lifecycleState(targetState) {
	    var lifecycle = targetState && targetState.lifecycle && typeof targetState.lifecycle === "object" ? targetState.lifecycle : {};
	    var value = String(lifecycle.state || "idle").toLowerCase();
	    return ["idle", "doors_open", "live", "ended", "archived"].indexOf(value) !== -1 ? value : "idle";
	  }

	  function roomAcceptsEntry() {
	    return ["doors_open", "live"].indexOf(lifecycleState(state || {})) !== -1;
	  }

	  function entryClosedReason() {
	    var roomState = lifecycleState(state || {});
	    if (roomState === "ended") return "This session has ended. The host will open a new room for the next drill.";
	    if (roomState === "archived") return "This session is closed. Return at the next scheduled drill.";
	    return "The room is not open yet. Keep this page open until the host opens the doors.";
	  }

	  function safeDiagnosticMessage(value) {
	    return String(value && value.message ? value.message : value || "")
	      .replace(/https?:\/\/\S+/gi, "[url]")
	      .replace(/(?:token|nonce|authorization)\s*[:=]?\s*\S+/gi, "[credential]")
	      .slice(0, 180);
	  }

	  function recordDiagnostic(type, details) {
	    if (!isAdmin) return;
	    details = details && typeof details === "object" ? details : {};
	    var safe = {
	      type: String(type || "event").slice(0, 48),
	      atMs: Date.now(),
	      eventSeq: Number(details.eventSeq || details.incomingEventSeq || 0),
	      action: String(details.action || "").slice(0, 48),
	      mode: String(details.mode || details.readerMode || realtimeMode).slice(0, 48),
	      lifecycle: String(details.lifecycle || (state ? lifecycleState(state) : "idle")).slice(0, 24),
	      optimisticMs: Number(details.optimisticMs || 0),
	      roundTripMs: Number(details.roundTripMs || 0),
	      serverProcessingMs: Number(details.serverProcessingMs || 0),
	      lockWaitMs: Number(details.lockWaitMs || 0),
	      snapshotAgeMs: Number(details.snapshotAgeMs || 0),
	      clientReceivedAtMs: Number(details.clientReceivedAtMs || 0),
	      clientAppliedAtMs: Number(details.clientAppliedAtMs || 0),
	      serverAcceptedAtMs: Number(details.serverAcceptedAtMs || 0),
	      message: safeDiagnosticMessage(details.message || "")
	    };
	    diagnosticEvents.push(safe);
	    diagnosticEvents = diagnosticEvents.slice(-200);
	    renderDiagnostics();
	  }

	  function renderConnectionState(connectionState) {
	    Array.prototype.slice.call(document.querySelectorAll("[data-connection-state]")).forEach(function (node) {
	      node.setAttribute("data-state", connectionState || "connected");
	      node.textContent = connectionState === "reconnecting" ? "Reconnecting" : "Connected";
	    });
	  }

	  function renderDiagnostics() {
	    if (!isAdmin) return;
	    var panel = document.querySelector("[data-floor-diagnostics]");
	    if (!panel) return;
	    panel.hidden = !diagnosticsEnabled;
	    if (!diagnosticsEnabled) return;
	    var latest = diagnosticEvents[diagnosticEvents.length - 1] || {};
	    var latestOfType = function (type) {
	      for (var index = diagnosticEvents.length - 1; index >= 0; index -= 1) {
	        if (diagnosticEvents[index].type === type) return diagnosticEvents[index];
	      }
	      return {};
	    };
	    var optimistic = latestOfType("optimistic_ack");
	    var accepted = latestOfType("server_accepted");
	    var applied = latestOfType("state_applied");
	    var snapshotAge = state && state.snapshotGeneratedAtMs ? Math.max(0, authoritativeNowMs() - Number(state.snapshotGeneratedAtMs || 0)) : 0;
	    panel.textContent = [
	      "Connection: " + realtimeMode,
	      "Event: " + Number(state && state.eventSeq || 0),
	      "Room: " + lifecycleState(state || {}),
	      "Snapshot age: " + Math.round(snapshotAge) + " ms",
	      "Last round trip: " + Math.round(Number(latest.roundTripMs || 0)) + " ms",
	      "Optimistic ack: " + Math.round(Number(optimistic.optimisticMs || 0)) + " ms",
	      "Server processing: " + Math.round(Number(accepted.serverProcessingMs || 0)) + " ms",
	      "Writer lock: " + Math.round(Number(accepted.lockWaitMs || 0)) + " ms",
	      "Receive to apply: " + Math.max(0, Math.round(Number(applied.clientAppliedAtMs || 0) - Number(applied.clientReceivedAtMs || 0))) + " ms",
	      "Clock offset: " + Math.round(serverClockOffsetMs) + " ms",
	      "Conditional reads: " + diagnosticEvents.filter(function (item) { return item.type === "unchanged"; }).length,
	      "Stale rejects: " + diagnosticEvents.filter(function (item) { return item.type === "stale_rejected"; }).length
	    ].join(" | ");
	  }

	  if (isAdmin) {
	    window.MMEDLiveDrillsDiagnostics = {
	      enable: function () { diagnosticsEnabled = true; renderDiagnostics(); },
	      disable: function () { diagnosticsEnabled = false; renderDiagnostics(); },
	      exportSafeMetrics: function () { return cloneState(diagnosticEvents); }
	    };
	  }

	  function stateFingerprint(nextState) {
	    var teams = Array.isArray(nextState && nextState.teams) ? nextState.teams : [];
	    var scores = teams.map(function (team) {
	      var students = Array.isArray(team.students) ? team.students : [];
	      return [
	        team.id || "",
	        Number(team.score || 0),
	        students.map(function (student) {
	          return [
	            student.id || "",
	            Number(student.points || 0),
		            Number(student.questionsAsked || student.asked || student.attempts || 0)
	          ].join(",");
	        }).join(";")
	      ].join(":");
	    }).join("|");
	    var winner = nextState && nextState.winner ? nextState.winner : {};
	    var lastEvent = nextState && nextState.lastEvent ? nextState.lastEvent : {};
	    var active = nextState && nextState.active ? nextState.active : {};
	    var sync = nextState && nextState.sync ? nextState.sync : {};
		    return [
		      stateEventSeq(nextState),
		      lifecycleState(nextState),
		      sync.revision || "",
	      nextState && nextState.updatedAt ? nextState.updatedAt : "",
	      active.teamId || "",
	      active.studentId || "",
	      winner.teamId || "",
	      winner.updatedAt || "",
	      lastEvent.type || "",
	      lastEvent.updatedAt || "",
	      scores
	    ].join("||");
	  }

	  function stateVersionMs(nextState) {
		    var parsed;
		    var updatedAt;
	    if (!nextState || typeof nextState !== "object") {
	      return 0;
	    }
	    if (nextState.snapshotGeneratedAtMs) {
	      return Number(nextState.snapshotGeneratedAtMs) || 0;
	    }
		    if (nextState.updatedAt) {
		      updatedAt = String(nextState.updatedAt).trim();
		      parsed = Date.parse(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(updatedAt) ? updatedAt.replace(" ", "T") + "Z" : updatedAt);
	      return Number.isFinite(parsed) ? parsed : 0;
	    }
	    return 0;
	  }

  function sendAction(payload, options) {
	    options = options || {};
			    if (!isAdmin && ["join_in", "watch", "opt_out", "guest_join", "guest_watch", "guest_opt_out", "send_chat_message"].indexOf(payload.action) === -1) {
	      return Promise.reject(new Error("That control is available to the host only."));
	    }
	    var actionStartedAtMs = Date.now();
	    recordDiagnostic("action_initiated", { action: payload.action, actionInitiatedAtMs: actionStartedAtMs });

		    if (options.optimistic) {
		      applyOptimistic(payload);
		      recordDiagnostic("optimistic_ack", {
		        action: payload.action,
		        actionInitiatedAtMs: actionStartedAtMs,
		        optimisticAcknowledgedAtMs: Date.now(),
		        optimisticMs: Math.max(0, Date.now() - actionStartedAtMs)
		      });
		      enterRealtimeBurst(3000, false);
		    } else {
		      renderStatus("Saving that room update...");
		    }

	    pendingActions += 1;
	    actionQueue = actionQueue.catch(function () {
	      return null;
	    }).then(function () {
	      return requestState("POST", payload).then(function (nextState) {
		        var issuedTicket = String(nextState && nextState._viewerTicket || "");
		        var meta = nextState && nextState._meta && typeof nextState._meta === "object" ? nextState._meta : {};
		        if (issuedTicket) {
		          delete nextState._viewerTicket;
		          saveViewerTicket(issuedTicket, nextState.viewer || {});
		        }
		        recordDiagnostic("server_accepted", {
		          action: payload.action,
		          actionInitiatedAtMs: actionStartedAtMs,
		          serverAcceptedAtMs: Number(meta.serverAcceptedAtMs || 0),
		          clientReceivedAtMs: Date.now(),
		          eventSeq: stateEventSeq(nextState),
		          serverProcessingMs: Number(meta.processingMs || 0),
		          lockWaitMs: Number(meta.lockWaitMs || 0)
		        });
		        var clientTiming = nextState._clientTiming || {};
		        delete nextState._meta;
		        delete nextState._clientTiming;
		        applyAuthoritativeState(nextState, clientTiming);
		        enterRealtimeBurst(3000, true);
		        return nextState;
		      }).catch(function (error) {
	        if (lastConfirmedState && pendingActions <= 1) {
	          state = cloneState(lastConfirmedState);
	          renderState();
	        }
	        renderStatus(error.message || "That update did not save. Try again or ask the host for help.");
	        if (options.propagateErrors) throw error;
	        return null;
	      }).then(function (value) {
	        pendingActions = Math.max(0, pendingActions - 1);
	        return value;
	      }, function (error) {
	        pendingActions = Math.max(0, pendingActions - 1);
	        throw error;
	      });
	    });

    return actionQueue;
  }

  function applyOptimistic(payload) {
    if (!state) {
      renderStatus("Updating Team Challenge...");
      return;
    }

    var nextState = cloneState(state);

    if (payload.action === "select_student") {
      nextState.active = {
        teamId: payload.teamId || "",
        studentId: payload.studentId || ""
      };
      nextState.nextTeamId = nextTeamId(nextState.active.teamId);
      var selected = findStudent(nextState, nextState.active.studentId);
      nextState.lastEvent = {
        type: "select_student",
        message: selected ? selected.student.name + " is up." : "Student is up."
      };
    }

	    if (payload.action === "score") {
	      var active = nextState.active || {};
	      var found = findStudent(nextState, active.studentId);
	      if (found) {
	        found.student.attempts = Number(found.student.attempts || 0) + 1;
        found.student.questionsAsked = Number(found.student.questionsAsked || 0) + 1;
        if (payload.correct) {
          found.student.points = Number(found.student.points || 0) + 1;
          found.team.score = Number(found.team.score || 0) + 1;
          playCorrectSound();
        } else {
          playMissedSound();
        }
	        preserveParticipantScore(found.student);
	        nextState.lastEvent = {
	          type: payload.correct ? "correct" : "missed",
	          message: payload.correct ? found.student.name + " scored for " + found.team.name + "." : found.student.name + " missed. No point awarded."
	        };
	        nextState.lastScore = {
	          teamId: found.team.id,
	          studentId: found.student.id,
	          correct: !!payload.correct
	        };
	        nextState.nextTeamId = nextTeamId(found.team.id);
		        nextState.winner = null;
		        if (payload.autoNext) {
		          chooseNextStudent(nextState, payload.autoNextMode);
		        }
	      }
	    }

	    if (payload.action === "undo_score") {
	      var undoTarget = nextState.lastScore || nextState.active || {};
	      var hasLastScore = !!(nextState.lastScore && Object.prototype.hasOwnProperty.call(nextState.lastScore, "correct"));
	      var shouldRemovePoint = hasLastScore ? !!undoTarget.correct : true;
	      var undoFound = findStudent(nextState, undoTarget.studentId);
	      if (undoFound) {
	        var oldPoints = Number(undoFound.student.points || 0);
	        var oldAttempts = Number(undoFound.student.attempts || 0);
	        var oldQuestions = Number(undoFound.student.questionsAsked || oldAttempts);
	        if (shouldRemovePoint && oldPoints > 0) {
	          undoFound.student.points = oldPoints - 1;
	          undoFound.team.score = Math.max(0, Number(undoFound.team.score || 0) - 1);
	        }
	        if (oldAttempts > 0) {
	          undoFound.student.attempts = oldAttempts - 1;
	        }
	        if (oldQuestions > 0) {
	          undoFound.student.questionsAsked = oldQuestions - 1;
	        }
	        storeParticipantScore(undoFound.student);
	        nextState.lastEvent = {
	          type: "undo_score",
	          message: "Score corrected for " + undoFound.student.name + "."
	        };
	        nextState.nextTeamId = nextTeamId(undoFound.team.id);
	        nextState.lastScore = null;
	        nextState.winner = null;
	      }
	    }

	    if (payload.action === "auto_select_next") {
	      chooseNextStudent(nextState, payload.mode);
	    }

    if (payload.action === "move_student") {
      var current = findStudent(nextState, (nextState.active || {}).studentId);
      var otherTeam = current ? firstOtherTeam(nextState, current.team.id) : null;
      if (current && otherTeam) {
        moveStudentInState(nextState, current.student.id, otherTeam.id);
      }
    }

    if (payload.action === "assign_student") {
      moveStudentInState(nextState, payload.studentId, payload.targetTeamId);
    }

    if (payload.action === "auto_assign" || payload.action === "shuffle_teams") {
      autoAssignBalanced(nextState, payload.action === "shuffle_teams");
    }

	    if (payload.action === "reset") {
	      lastWinnerKey = "";
	      resetScores(nextState);
	      nextState.lastScore = null;
	    }

	    if (payload.action === "set_session_title") {
	      nextState.sessionTitle = String(payload.title || "").slice(0, 80);
	      nextState.lastEvent = {
	        type: "set_session_title",
	        message: "Session title updated."
	      };
	    }

			    if (payload.action === "set_host_note") {
			      nextState.hostNote = String(payload.note || "").slice(0, 220);
			      nextState.lastEvent = {
			        type: "set_host_note",
			        message: nextState.hostNote ? "Student note updated." : "Student note cleared."
			      };
			    }

			    if (payload.action === "set_countdown") {
			      nextState.countdown = clientCountdownFromPayload(payload, nextState.countdown);
			      nextState.lastEvent = {
			        type: "set_countdown",
			        message: "Countdown updated."
			      };
			    }

			    if (payload.action === "send_chat_message") {
			      addOptimisticChatMessage(nextState, payload);
			    }

    if (payload.action === "declare_winner") {
      applyWinner(nextState, payload.teamId);
    }

    if (payload.action === "join_in" || payload.action === "guest_join") {
      addOptimisticParticipant(nextState, payload);
    }

    if (payload.action === "opt_out" || payload.action === "guest_opt_out") {
      removeOptimisticParticipant(nextState, payload);
    }

    state = nextState;
    renderState();
  }

  function injectStyles() {
    if (document.getElementById("mmed-team-challenge-style")) {
      return;
    }

    var style = document.createElement("style");
    style.id = "mmed-team-challenge-style";
    style.textContent = [
      "@keyframes mmedTeamChallengeAurora{0%{transform:translate3d(-2%,-2%,0) rotate(0deg);opacity:.2}50%{transform:translate3d(2%,1%,0) rotate(5deg);opacity:.36}100%{transform:translate3d(-2%,-2%,0) rotate(0deg);opacity:.2}}",
      "@keyframes mmedTeamChallengePulseBlue{0%,100%{box-shadow:0 0 0 2px rgba(147,197,253,.92),0 0 22px rgba(59,130,246,.78),0 0 70px rgba(37,99,235,.42),inset 0 1px 0 rgba(255,255,255,.65)}50%{box-shadow:0 0 0 3px rgba(219,234,254,1),0 0 36px rgba(96,165,250,.98),0 0 110px rgba(37,99,235,.68),inset 0 1px 0 rgba(255,255,255,.9)}}",
      "@keyframes mmedTeamChallengePulseRed{0%,100%{box-shadow:0 0 0 2px rgba(252,165,165,.92),0 0 22px rgba(239,68,68,.8),0 0 70px rgba(220,38,38,.42),inset 0 1px 0 rgba(255,255,255,.65)}50%{box-shadow:0 0 0 3px rgba(254,226,226,1),0 0 36px rgba(248,113,113,.98),0 0 110px rgba(220,38,38,.68),inset 0 1px 0 rgba(255,255,255,.9)}}",
      "@keyframes mmedTeamScorePop{0%{transform:scale(1);filter:brightness(1)}28%{transform:scale(1.07);filter:brightness(1.35)}100%{transform:scale(1);filter:brightness(1)}}",
      "@keyframes mmedTeamMissPulse{0%{transform:translateX(0);filter:brightness(1)}22%{transform:translateX(-4px);filter:brightness(1.22)}46%{transform:translateX(4px);filter:brightness(1.08)}100%{transform:translateX(0);filter:brightness(1)}}",
      "@keyframes mmedTeamWinnerGlow{0%,100%{filter:brightness(1);transform:scale(1)}45%{filter:brightness(1.28);transform:scale(1.01)}}",
      "@keyframes mmedConfettiFall{0%{transform:translate3d(var(--x),-12vh,0) rotate(0deg);opacity:0}12%{opacity:1}100%{transform:translate3d(calc(var(--x) + var(--drift)),112vh,0) rotate(720deg);opacity:0}}",
      "@keyframes mmedBalloonRise{0%{transform:translate3d(var(--x),105vh,0) scale(.8);opacity:0}14%{opacity:.95}100%{transform:translate3d(calc(var(--x) + var(--drift)),-18vh,0) scale(1.04);opacity:0}}",
      "html:has(body.mmed-team-challenge-enabled),body.mmed-team-challenge-enabled{height:100%;overflow:hidden}",
      "body.mmed-team-challenge-enabled{background:#030712}",
      ".mmed-team-challenge-enabled .preview-chrome,.mmed-team-challenge-enabled .shell-title,.mmed-team-challenge-enabled .header-right,.mmed-team-challenge-enabled .participant-strip,.mmed-team-challenge-enabled [data-note],.mmed-team-challenge-enabled .self-report,.mmed-team-challenge-enabled .drill-question-zone{display:none!important}",
      "body.mmed-team-challenge-enabled:not(.mmed-team-challenge-admin) .mmed-webex-embed-actions,body.mmed-team-challenge-enabled:not(.mmed-team-challenge-admin) [data-webex-start],body.mmed-team-challenge-enabled:not(.mmed-team-challenge-admin) [data-webex-app-fallback]{display:none!important}",
      ".mmed-team-challenge-enabled .shell.is-active{display:block;height:100vh;overflow:hidden}",
      ".mmed-team-challenge-enabled .mm-drill{height:100vh;min-height:0;padding:8px;overflow:hidden}",
      ".mmed-team-challenge-enabled .mm-drill .app{width:100%;height:calc(100vh - 16px);min-height:0;max-width:none;grid-template-columns:clamp(180px,20vw,300px) minmax(380px,1fr) clamp(180px,20vw,300px);grid-template-rows:58px minmax(0,1fr);gap:8px;margin:0}",
      ".mmed-team-challenge-enabled .mm-drill .brand-header{min-height:0;height:58px;padding:8px 12px;border-radius:10px}",
      ".mmed-team-challenge-enabled .brand-logo{width:38px;height:38px;border-radius:8px}",
      ".mmed-team-challenge-enabled .mode-badge{font-size:22px;white-space:nowrap}",
      ".mmed-team-challenge-enabled .brand-logo-wrap p{display:none}",
      ".team-session-title{margin-left:12px;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#c8d4f4;font-size:14px;font-weight:900;letter-spacing:.06em;text-transform:uppercase}",
      ".mmed-team-challenge-enabled .center-column{min-height:0;display:grid;grid-template-rows:minmax(320px,1fr) minmax(0,auto);gap:8px;overflow:hidden}",
      ".mmed-team-challenge-admin .center-column{grid-template-rows:minmax(430px,1fr) minmax(250px,auto)}",
      ".mmed-team-challenge-enabled .player-shell{min-height:0;height:100%;display:grid;grid-template-rows:24px minmax(0,1fr);overflow:hidden}",
      ".mmed-team-challenge-enabled .player-topbar{height:24px;min-height:0;padding:0 10px;border-radius:10px 10px 0 0}",
      ".mmed-team-challenge-enabled .live-stage{min-height:0;height:100%;position:relative;overflow:hidden}",
      ".mmed-team-challenge-enabled .live-stage:before,.mmed-team-challenge-enabled [data-live-stage]:before{content:'';position:absolute;inset:-20%;z-index:0;pointer-events:none;background:radial-gradient(circle at 20% 20%,rgba(37,99,235,.42),transparent 32%),radial-gradient(circle at 82% 32%,rgba(220,38,38,.38),transparent 34%),radial-gradient(circle at 52% 86%,rgba(250,204,21,.18),transparent 30%);animation:mmedTeamChallengeAurora 9s ease-in-out infinite}",
      ".mmed-team-challenge-enabled [data-live-stage]>*{position:relative;z-index:1}",
      ".team-challenge-panel{display:flex;flex-direction:column;min-height:0;height:100%;padding:0;background:linear-gradient(180deg,rgba(12,18,38,.98),rgba(4,7,18,.98));border:1px solid rgba(127,149,197,.28);border-radius:10px;box-shadow:0 22px 70px rgba(0,0,0,.38);overflow:hidden}",
      ".team-challenge-panel.is-blue{--team-color:#2563eb;--team-soft:rgba(37,99,235,.24);--team-mid:#1d4ed8;--team-strong:#60a5fa}",
      ".team-challenge-panel.is-red{--team-color:#dc2626;--team-soft:rgba(220,38,38,.24);--team-mid:#991b1b;--team-strong:#f87171}",
      ".team-challenge-panel.is-drop-target{border-color:rgba(250,204,21,.8);box-shadow:0 0 0 2px rgba(250,204,21,.25),0 22px 70px rgba(0,0,0,.38)}",
      ".team-challenge-panel.is-winner{animation:mmedTeamWinnerGlow 1.1s ease-in-out infinite;border-color:rgba(250,204,21,.9);box-shadow:0 0 0 2px rgba(250,204,21,.28),0 0 64px var(--team-soft),0 22px 70px rgba(0,0,0,.38)}",
      ".team-challenge-head{display:flex;align-items:center;justify-content:space-between;gap:10px;height:56px;padding:10px 14px;background:linear-gradient(180deg,var(--team-color),rgba(9,13,28,.55));border-bottom:1px solid rgba(255,255,255,.12)}",
      ".team-challenge-title-stack{min-width:0;display:grid;gap:3px}",
      ".team-challenge-head h3{margin:0;color:#fff;font-size:19px;letter-spacing:.1em;text-transform:uppercase;line-height:1.05}",
      ".team-challenge-count{display:inline-flex;align-items:center;width:max-content;min-height:18px;padding:2px 7px;border:1px solid rgba(255,255,255,.18);border-radius:999px;background:rgba(3,6,18,.32);color:#dbeafe;font-size:10px;font-weight:900;letter-spacing:.09em;text-transform:uppercase}",
      ".team-challenge-total{min-width:46px;text-align:center;color:#fff;font-size:32px;font-weight:900;line-height:1}",
      ".team-challenge-list{flex:1;min-height:0;display:grid;grid-auto-rows:clamp(52px,5.65vh,64px);align-content:start;gap:6px;padding:9px;overflow:hidden}",
	      ".team-challenge-student{position:relative;display:grid;grid-template-columns:38px minmax(0,1fr) 74px 38px;align-items:center;gap:7px;height:clamp(52px,5.65vh,64px);min-height:52px;max-height:64px;width:100%;padding:4px 9px 4px 4px;border:1px solid rgba(127,149,197,.24);border-radius:999px;background:linear-gradient(180deg,rgba(255,255,255,.12),rgba(255,255,255,.045));color:#eef5ff;text-align:left;box-shadow:inset 0 1px 0 rgba(255,255,255,.1);transition:transform .08s ease,border-color .08s ease,box-shadow .08s ease,background .08s ease}",
      ".team-challenge-student:not(:disabled):active{transform:translateY(1px) scale(.995)}",
      ".team-challenge-student.is-blue.is-active{border-color:rgba(219,234,254,.98);background:linear-gradient(180deg,rgba(255,255,255,.62),rgba(96,165,250,.25) 42%,rgba(29,78,216,.28));backdrop-filter:blur(12px);animation:mmedTeamChallengePulseBlue 1.12s ease-in-out infinite}",
      ".team-challenge-student.is-red.is-active{border-color:rgba(254,226,226,.98);background:linear-gradient(180deg,rgba(255,255,255,.6),rgba(248,113,113,.25) 42%,rgba(153,27,27,.31));backdrop-filter:blur(12px);animation:mmedTeamChallengePulseRed 1.12s ease-in-out infinite}",
      ".team-challenge-student.is-active:after{content:'LIVE';position:absolute;right:91px;top:-8px;padding:2px 7px;border-radius:999px;background:rgba(255,255,255,.94);color:#0f172a;font-size:9px;font-weight:900;letter-spacing:.1em}",
      ".team-challenge-student.is-mvp:before{content:'MVP';position:absolute;left:26px;bottom:-8px;padding:2px 6px;border-radius:999px;background:#facc15;color:#111827;font-size:8px;font-weight:1000;letter-spacing:.08em;box-shadow:0 0 18px rgba(250,204,21,.5)}",
      ".team-challenge-total.is-score-flash,.team-challenge-student.is-score-flash{animation:mmedTeamScorePop .46s ease-out 1;border-color:rgba(134,239,172,.88)!important;box-shadow:0 0 0 2px rgba(34,197,94,.28),0 0 36px rgba(34,197,94,.32)!important}",
      ".team-challenge-student.is-score-missed{animation:mmedTeamMissPulse .44s ease-out 1;border-color:rgba(248,113,113,.78)!important;box-shadow:0 0 0 2px rgba(239,68,68,.22),0 0 30px rgba(239,68,68,.24)!important}",
      ".team-challenge-student:disabled{cursor:default}",
      ".team-challenge-student.is-dragging{opacity:.45}",
      ".team-challenge-avatar{position:relative;display:grid;place-items:center;width:34px;height:34px;border-radius:50%;overflow:hidden;background:linear-gradient(180deg,#9ca3af,#374151);color:#fff;font-size:11px;font-weight:900;letter-spacing:.04em;box-shadow:inset 0 1px 0 rgba(255,255,255,.22)}",
      ".team-challenge-avatar img,.team-avatar-svg{width:100%;height:100%;object-fit:cover;object-position:center top;display:block}",
      ".team-challenge-avatar img.team-avatar-headshot{object-fit:cover;object-position:center 11%;transform:scale(5.65);transform-origin:center 11%;background:radial-gradient(circle at 45% 20%,rgba(255,255,255,.18),transparent 32%),#07101f}",
      ".team-avatar-svg text{font-family:Inter,Arial,sans-serif;font-weight:900}",
	      ".team-challenge-name{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:13px;font-weight:900}",
		      ".team-challenge-asked{display:grid;grid-template-columns:auto auto;place-items:center;justify-content:center;column-gap:5px;height:40px;min-width:74px;border-radius:13px;background:linear-gradient(180deg,rgba(253,224,71,.55),rgba(146,64,14,.52));border:1px solid rgba(254,240,138,.95);font-size:0;color:#fff7cc;letter-spacing:0;text-shadow:0 2px 8px rgba(0,0,0,.68);box-shadow:0 0 22px rgba(250,204,21,.24),inset 0 1px 0 rgba(255,255,255,.32)}",
	      ".team-challenge-asked span{font-size:13px;font-weight:1000;line-height:1;color:#fde68a}",
	      ".team-challenge-asked strong{font-size:25px;font-weight:1000;line-height:1;color:#fff}",
	      ".team-challenge-points{font-size:24px;font-weight:1000;text-align:right}",
					    ".team-challenge-adminbar{display:none;gap:10px;padding:8px;border:1px solid rgba(250,204,21,.3);border-radius:10px;background:rgba(3,6,18,.86);min-height:250px;max-height:min(360px,38vh);overflow:auto;scrollbar-width:thin}",
	      ".team-challenge-joinbar{display:none;position:relative;z-index:4;width:100%;height:100%;min-height:0;padding:8px;border:1px solid rgba(250,204,21,.55);border-radius:14px;background:radial-gradient(circle at 18% 18%,rgba(250,204,21,.14),rgba(4,8,20,.97) 38%),linear-gradient(135deg,rgba(15,23,42,.98),rgba(4,8,20,.99));box-shadow:0 18px 54px rgba(0,0,0,.42),inset 0 1px 0 rgba(255,255,255,.1);overflow:hidden;scrollbar-width:thin}",
			      ".mmed-team-challenge-admin .team-challenge-adminbar{display:flex;flex-wrap:wrap;align-items:flex-start;align-content:flex-start}",
	      "body:not(.mmed-team-challenge-admin) .center-column{grid-template-rows:minmax(255px,1fr) minmax(260px,34vh)}",
	      "body:not(.mmed-team-challenge-admin) .team-challenge-joinbar{display:grid;grid-template-columns:minmax(0,1fr);gap:10px;text-align:center}",
	      ".team-challenge-joinbar.is-joined,.team-challenge-joinbar.is-watching{background:linear-gradient(135deg,rgba(7,12,28,.98),rgba(3,6,18,.99));box-shadow:0 16px 46px rgba(0,0,0,.38),inset 0 1px 0 rgba(255,255,255,.08)}",
		      "@media(min-width:761px){body:not(.mmed-team-challenge-admin):has(.team-challenge-joinbar.is-joined) .center-column,body:not(.mmed-team-challenge-admin):has(.team-challenge-joinbar.is-watching) .center-column{grid-template-rows:minmax(255px,1fr) 360px}body:not(.mmed-team-challenge-admin) .team-challenge-joinbar.is-joined,body:not(.mmed-team-challenge-admin) .team-challenge-joinbar.is-watching{min-height:0}}",
	      ".team-challenge-joinbar:before{content:'DR J LIVE';position:absolute;left:12px;top:10px;width:max-content;padding:3px 9px;border-radius:999px;background:rgba(250,204,21,.14);border:1px solid rgba(250,204,21,.36);color:#fde68a;font-size:9px;font-weight:1000;letter-spacing:.16em;text-transform:uppercase}",
	      ".team-challenge-adminbar p{margin:0;color:#c8d4f4;font-size:12px;line-height:1.25}",
	      ".team-challenge-joinbar p{margin:0;color:#dbeafe;font-size:13px;line-height:1.25}",
	      ".team-challenge-joinbar p b{display:block;color:#fff;font-size:clamp(24px,4.2vw,44px);line-height:.9;letter-spacing:.07em;text-transform:uppercase;text-shadow:0 0 24px rgba(250,204,21,.34)}",
	      ".team-challenge-joinbar.is-joined p b,.team-challenge-joinbar.is-watching p b{font-size:20px;letter-spacing:.06em}",
		      ".team-host-readiness{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:4px;min-width:0;min-height:24px}",
		      ".team-host-ready-item{display:grid;grid-template-columns:auto minmax(0,1fr);align-items:center;gap:4px;min-height:24px;min-width:0;padding:2px 5px;border:1px solid rgba(127,149,197,.26);border-radius:999px;background:rgba(10,18,40,.72);color:#cbd5e1;overflow:hidden}",
		      ".team-host-ready-item:before{content:'';width:7px;height:7px;border-radius:50%;background:#64748b;box-shadow:0 0 12px rgba(100,116,139,.35)}",
		      ".team-host-ready-item[data-state='ready']{border-color:rgba(34,197,94,.54);color:#dcfce7;background:rgba(20,83,45,.28)}",
		      ".team-host-ready-item[data-state='ready']:before{background:#22c55e;box-shadow:0 0 16px rgba(34,197,94,.55)}",
		      ".team-host-ready-item[data-state='warn']{border-color:rgba(250,204,21,.55);color:#fef3c7;background:rgba(113,63,18,.24)}",
		      ".team-host-ready-item[data-state='warn']:before{background:#facc15;box-shadow:0 0 16px rgba(250,204,21,.48)}",
		      ".team-host-ready-item[data-state='error']{border-color:rgba(248,113,113,.55);color:#fee2e2;background:rgba(127,29,29,.26)}",
		      ".team-host-ready-item[data-state='error']:before{background:#ef4444;box-shadow:0 0 16px rgba(248,113,113,.5)}",
		      ".team-host-ready-item b,.team-host-ready-item small{display:block;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
		      ".team-host-ready-item b{font-size:7.8px;font-weight:1000;letter-spacing:.05em;text-transform:uppercase}",
		      ".team-host-ready-item small{font-size:7.2px;font-weight:850;color:inherit;opacity:.78}",
	      ".team-student-step-strip{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px;min-width:0}",
	      ".team-student-step-pill{display:grid;grid-template-columns:auto minmax(0,1fr);align-items:center;gap:6px;min-height:34px;padding:5px 8px;border:1px solid rgba(127,149,197,.28);border-radius:11px;background:rgba(10,18,40,.78);color:#cbd5e1;text-align:left;overflow:hidden}",
	      ".team-student-step-pill b{display:grid;place-items:center;width:24px;height:24px;border-radius:50%;background:rgba(127,149,197,.22);color:#fff;font-size:12px;font-weight:1000}",
	      ".team-student-step-pill span{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:10px;font-weight:1000;letter-spacing:.07em;text-transform:uppercase}",
	      ".team-challenge-joinbar:not(.is-joined):not(.is-watching) [data-student-step='1'],.team-challenge-joinbar.is-joined [data-student-step='2'],.team-challenge-joinbar.is-watching [data-student-step='2']{border-color:rgba(250,204,21,.72);background:linear-gradient(180deg,rgba(250,204,21,.2),rgba(10,18,40,.84));color:#fff;box-shadow:0 0 22px rgba(250,204,21,.16)}",
	      ".team-challenge-joinbar.is-joined [data-student-step='3'],.team-challenge-joinbar.is-watching [data-student-step='3']{border-color:rgba(34,197,94,.42);color:#dcfce7}",
	      ".team-student-room-lock{display:flex;align-items:center;justify-content:center;gap:7px;min-width:0;min-height:26px;padding:5px 10px;border:1px solid rgba(134,239,172,.38);border-radius:999px;background:rgba(20,83,45,.42);color:#dcfce7;font-size:10px;font-weight:1000;letter-spacing:.08em;text-transform:uppercase;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
	      ".team-student-room-lock:before{content:'Room locked';flex:0 0 auto;color:#86efac}",
	      ".team-student-room-lock span{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#fff}",
	      ".team-student-panel-layout{display:grid;grid-template-columns:minmax(92px,.28fr) minmax(0,1.9fr) minmax(92px,.28fr);gap:8px;align-items:stretch;height:100%;min-height:0;overflow:hidden}",
	      ".team-student-panel-main{display:grid;grid-template-rows:auto auto minmax(0,1fr) auto auto;gap:6px;min-width:0;min-height:0;overflow:hidden}",
	      ".team-student-top{display:grid;grid-template-columns:minmax(0,1fr) minmax(150px,.28fr);gap:8px;align-items:center;min-width:0}",
	      ".team-challenge-joinbar.is-joined .team-student-panel-main,.team-challenge-joinbar.is-watching .team-student-panel-main{grid-template-columns:minmax(0,1fr) minmax(0,1fr);grid-template-rows:auto minmax(40px,auto) minmax(0,1fr);grid-template-areas:'top top' 'room cta' 'chat audio';align-items:stretch}",
	      ".team-challenge-joinbar.is-joined .team-student-top,.team-challenge-joinbar.is-watching .team-student-top{grid-area:top}",
	      ".team-challenge-joinbar.is-joined .team-student-room-lock,.team-challenge-joinbar.is-watching .team-student-room-lock{grid-area:room;align-self:stretch}",
	      ".team-challenge-joinbar.is-joined .team-student-webex-cta,.team-challenge-joinbar.is-watching .team-student-webex-cta{grid-area:cta;align-self:stretch;min-height:40px}",
	      ".team-challenge-joinbar.is-joined .team-chat-box,.team-challenge-joinbar.is-watching .team-chat-box{grid-area:chat;min-height:0;height:100%;padding:7px;gap:5px}",
	      ".team-challenge-joinbar.is-joined .team-volume-controls,.team-challenge-joinbar.is-watching .team-volume-controls{grid-area:audio;min-height:0;height:100%;padding:7px;gap:5px}",
	      ".team-student-avatar-card{display:grid;grid-template-rows:minmax(64px,1fr) auto auto;gap:5px;min-height:0;padding:7px;border:1px solid rgba(127,149,197,.24);border-radius:12px;background:linear-gradient(180deg,rgba(15,23,42,.78),rgba(2,6,23,.72));color:#fff;overflow:hidden}",
	      ".team-student-avatar-art{display:grid;place-items:center;min-height:64px;border-radius:10px;overflow:hidden;background:linear-gradient(145deg,#1d4ed8,#111827 62%,#facc15)}",
	      ".team-student-avatar-art img{width:100%;height:100%;object-fit:contain;object-position:center bottom;display:block}",
	      ".team-student-avatar-art .team-avatar-svg{width:100%;height:100%}",
	      ".team-student-avatar-card b{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px;font-weight:1000;letter-spacing:.04em}",
	      ".team-student-avatar-card span{color:#bfdbfe;font-size:9px;font-weight:900;letter-spacing:.1em;text-transform:uppercase}",
	      ".team-student-card-drj .team-student-avatar-art{background:linear-gradient(145deg,#111827,#7f1d1d 58%,#facc15)}",
	      ".team-admin-expired-warning{border:1px solid rgba(248,113,113,.62);border-radius:14px;background:rgba(127,29,29,.72);color:#fee2e2;padding:10px 12px;font-size:13px;font-weight:900;line-height:1.3}",
	      ".team-student-identity{display:flex;align-items:center;justify-content:space-between;gap:10px;min-height:32px;padding:6px 10px;border:1px solid rgba(34,197,94,.32);border-radius:12px;background:rgba(20,83,45,.28);color:#dcfce7;font-size:10px;font-weight:1000;letter-spacing:.07em;text-transform:uppercase;overflow:hidden}",
	      ".team-student-identity b{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#fff;font-size:12px;letter-spacing:.02em;text-transform:none}",
	      ".team-student-identity span{flex:0 0 auto;color:#86efac}",
	      ".team-account-fields,.team-guest-fields{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;text-align:left}",
	      ".team-guest-fields{display:none}",
	      ".team-challenge-joinbar.is-guest-entry .team-guest-fields{display:grid;grid-template-columns:repeat(3,minmax(0,1fr))}",
      ".team-account-fields label,.team-guest-fields label{display:grid;gap:5px;color:#cbd5e1;font-size:11px;font-weight:900;letter-spacing:.1em;text-transform:uppercase}",
      ".team-account-fields label{gap:3px;font-size:9.5px}",
      ".team-guest-fields label[data-guest-email-wrap]{grid-column:auto}",
      ".team-account-fields input,.team-guest-fields input{width:100%;height:42px;border:1px solid rgba(250,204,21,.34);border-radius:12px;background:rgba(5,10,24,.92);color:#fff;padding:0 12px;font-size:15px;font-weight:850;letter-spacing:.02em;box-shadow:inset 0 1px 0 rgba(255,255,255,.08)}",
      ".team-account-fields input{height:38px;border-radius:11px;font-size:14px}",
	      ".team-account-fields input:focus,.team-guest-fields input:focus{outline:2px solid rgba(250,204,21,.65);outline-offset:2px}",
		      ".team-challenge-joinbar.is-logged-in .team-guest-fields,.team-challenge-joinbar.is-joined .team-guest-fields,.team-challenge-joinbar.is-watching .team-guest-fields{display:none}",
			      ".team-account-primary{display:grid;grid-template-columns:minmax(150px,.42fr) minmax(0,1fr) minmax(230px,.72fr);gap:8px;align-items:center;padding:8px;border:1px solid rgba(250,204,21,.34);border-radius:12px;background:rgba(250,204,21,.09);text-align:left;min-height:0}",
		      ".team-account-primary strong{display:block;color:#fff;font-size:15px;font-weight:1000;letter-spacing:.04em;text-transform:uppercase}",
		      ".team-account-primary span{display:block;color:#dbeafe;font-size:12px;line-height:1.3}",
		      ".team-account-actions{display:grid;grid-template-columns:minmax(0,1.2fr) minmax(0,.72fr) minmax(0,.68fr);gap:7px;align-items:stretch}",
		      ".team-account-primary a,.team-account-primary button,.team-logged-in-tools button,.team-chat-box button,.team-chat-box select{min-width:0;border:1px solid rgba(127,149,197,.34);border-radius:10px;background:#101a38;color:#fff;padding:9px 11px;font-size:10px;font-weight:1000;letter-spacing:.06em;text-transform:uppercase;text-align:center;text-decoration:none}",
		      ".team-account-primary [data-account-create-join]{border-color:rgba(34,197,94,.72);background:linear-gradient(180deg,#16a34a,#14532d)}",
		      ".team-account-primary a{display:grid;place-items:center}",
		      ".team-challenge-joinbar.is-logged-in .team-account-primary,.team-challenge-joinbar.is-guest-entry .team-account-primary,.team-challenge-joinbar.is-joined .team-account-primary,.team-challenge-joinbar.is-watching .team-account-primary{display:none}",
			      ".team-logged-in-tools{display:none;gap:8px;align-items:center;justify-content:center}",
	      ".team-challenge-joinbar.is-logged-in .team-logged-in-tools{display:flex}",
	      ".team-join-actions{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;align-items:stretch}",
	      ".team-challenge-joinbar:not(.is-logged-in):not(.is-guest-entry):not(.is-joined):not(.is-watching) .team-join-actions{display:none}",
	      ".team-challenge-joinbar:not(.is-joined):not(.is-watching) .team-chat-box,.team-challenge-joinbar:not(.is-joined):not(.is-watching) .team-volume-controls{display:none}",
	      ".team-student-webex-cta{display:none;width:100%;min-height:46px;border:1px solid rgba(134,239,172,.9);border-radius:13px;background:linear-gradient(180deg,#22c55e,#15803d 58%,#14532d);color:#ecfdf5;box-shadow:0 0 34px rgba(34,197,94,.28),inset 0 1px 0 rgba(255,255,255,.25);font-size:13px;font-weight:1000;letter-spacing:.08em;text-transform:uppercase}",
	      ".team-student-webex-cta span{display:block;color:#bbf7d0;font-size:10px;font-weight:950;letter-spacing:.08em;line-height:1.2}",
	      ".team-student-webex-cta:disabled{opacity:.72;cursor:wait}",
	      ".team-challenge-joinbar.is-joined .team-student-webex-cta,.team-challenge-joinbar.is-watching .team-student-webex-cta{display:block}",
			      ".team-admin-stack{flex:1 1 560px;min-width:min(100%,420px);min-height:0;display:grid;gap:7px;align-content:start}",
		      ".team-admin-step{min-width:0;min-height:0;display:grid;gap:7px;padding:8px;border:1px solid rgba(127,149,197,.2);border-radius:10px;background:rgba(9,15,32,.58);overflow:auto;scrollbar-width:thin}",
			      ".team-admin-step[data-admin-step='1']{min-height:315px;overflow:auto}",
			      ".team-admin-step[data-admin-step='2']{min-height:170px;overflow:auto}",
			      ".team-score-step{flex:1 1 420px;min-width:min(100%,340px)}",
	      ".team-admin-step h4{display:flex;align-items:center;gap:8px;margin:0;color:#fff;font-size:12px;font-weight:1000;letter-spacing:.08em;text-transform:uppercase}",
	      ".team-admin-step h4 span{display:inline-grid;place-items:center;min-width:58px;min-height:22px;border:1px solid rgba(250,204,21,.58);border-radius:999px;background:rgba(250,204,21,.16);color:#fde68a;font-size:10px}",
	      ".team-control-banner{display:flex;align-items:center;gap:7px;min-width:0;width:100%;max-width:100%;min-height:22px;padding:3px 8px;border:1px solid rgba(250,204,21,.48);border-radius:999px;background:linear-gradient(180deg,rgba(250,204,21,.2),rgba(15,23,42,.68));color:#fef3c7;box-shadow:0 0 18px rgba(250,204,21,.14);overflow:hidden}",
      ".team-control-banner strong{font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:#fff}",
      ".team-control-banner span{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:10px;font-weight:900;letter-spacing:.08em;text-transform:uppercase;color:#fde68a}",
      ".team-meeting-current{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#93a4cd;font-size:11px;font-weight:800;letter-spacing:.02em}",
      ".team-session-controls{display:grid;grid-template-columns:minmax(0,1fr) minmax(96px,.22fr) minmax(82px,.16fr);gap:7px;align-items:center;min-width:0;max-width:100%;overflow:hidden}",
      ".team-session-controls input{width:100%;min-width:0;height:40px;border:1px solid rgba(127,149,197,.32);border-radius:10px;background:rgba(10,18,40,.92);color:#fff;padding:0 11px;font-size:13px;font-weight:850;letter-spacing:.03em;overflow:hidden;text-overflow:ellipsis}",
		      ".team-meeting-controls{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px;align-items:center;min-width:0;max-width:100%;min-height:95px;overflow:visible}",
      ".team-meeting-controls input{grid-column:1/-1;width:100%;min-width:0;height:40px;border:1px solid rgba(127,149,197,.32);border-radius:10px;background:rgba(10,18,40,.92);color:#fff;padding:0 11px;font-size:13px;font-weight:850;letter-spacing:.02em;overflow:hidden;text-overflow:ellipsis}",
	      ".team-meeting-controls [data-host-webex-start]{grid-column:1/-1;min-height:48px;border-color:rgba(34,197,94,.82);background:linear-gradient(180deg,#22c55e,#14532d);box-shadow:0 0 30px rgba(34,197,94,.22);font-size:12px}",
      ".team-schedule-controls{display:grid;grid-template-columns:minmax(0,1fr) minmax(150px,.24fr) minmax(150px,.24fr);gap:7px;align-items:center;min-width:0;max-width:100%;min-height:40px;overflow:visible}",
      ".team-schedule-controls select{grid-column:auto}",
      ".team-schedule-controls select,.team-schedule-form input{width:100%;min-width:0;height:40px;border:1px solid rgba(127,149,197,.32);border-radius:10px;background:rgba(10,18,40,.92);color:#fff;padding:0 11px;font-size:13px;font-weight:850;letter-spacing:.02em;overflow:hidden;text-overflow:ellipsis}",
      ".team-schedule-controls select{min-width:0}",
	      ".team-schedule-form{display:none;grid-template-columns:minmax(0,1fr) minmax(126px,.44fr) minmax(58px,.16fr) minmax(90px,.22fr);gap:7px;align-items:center;min-width:0;max-width:100%;overflow:hidden}",
	      ".team-schedule-form.is-open{display:grid}",
	      ".team-schedule-note{color:#9ba8c8;font-size:10.5px;line-height:1.2}",
	      ".team-host-note-controls{display:grid;grid-template-columns:minmax(0,1fr) minmax(96px,.22fr) minmax(88px,.2fr);gap:7px;align-items:stretch;min-width:0}",
	      ".team-host-note-controls textarea{width:100%;min-width:0;min-height:54px;resize:vertical;border:1px solid rgba(127,149,197,.32);border-radius:10px;background:rgba(10,18,40,.92);color:#fff;padding:9px 11px;font-size:13px;font-weight:800;line-height:1.25}",
	      ".team-auto-next-controls{display:grid;grid-template-columns:minmax(118px,.7fr) minmax(140px,.8fr) minmax(130px,.8fr);gap:7px;align-items:stretch;min-width:0}",
	      ".team-auto-next-controls select{width:100%;min-width:0;height:40px;border:1px solid rgba(127,149,197,.32);border-radius:10px;background:#101a38;color:#fff;padding:0 10px;font-size:11px;font-weight:950;letter-spacing:.04em;text-transform:uppercase}",
	      ".team-auto-next-controls button,.team-host-note-controls button{min-width:0;min-height:40px;border:1px solid rgba(127,149,197,.28);border-radius:10px;padding:8px 10px;color:#fff;font-size:10.5px;font-weight:950;letter-spacing:.055em;text-transform:uppercase;background:#101a38;white-space:normal;line-height:1.08}",
	      ".team-auto-next-controls [data-auto-next-toggle][aria-pressed='true']{border-color:rgba(34,197,94,.72);background:linear-gradient(180deg,#15803d,#064e3b);color:#ecfdf5}",
	      ".team-challenge-actions{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;align-content:start;align-items:stretch}",
      ".team-challenge-actions button,.team-session-controls button,.team-meeting-controls button,.team-schedule-controls button,.team-schedule-form button{min-width:0;max-width:100%;min-height:40px;border:1px solid rgba(127,149,197,.28);border-radius:10px;padding:8px 10px;color:#fff;font-size:11px;font-weight:950;letter-spacing:.06em;text-transform:uppercase;background:#101a38;white-space:normal;line-height:1.08;overflow:hidden;text-overflow:ellipsis}",
		      ".team-challenge-joinbar button{min-height:44px;border:1px solid rgba(127,149,197,.28);border-radius:12px;padding:8px 11px;color:#fff;font-size:12px;font-weight:1000;letter-spacing:.07em;text-transform:uppercase;background:#101a38}",
	      ".team-challenge-joinbar .team-account-primary button,.team-challenge-joinbar .team-chat-box button,.team-challenge-joinbar .team-chat-box select,.team-challenge-joinbar .team-logged-in-tools button{min-height:34px;border-radius:10px;padding:8px 10px;font-size:10px}",
      ".team-challenge-joinbar [data-join-in]{border-color:rgba(134,239,172,.8);background:linear-gradient(180deg,#22c55e,#14532d);box-shadow:0 0 34px rgba(34,197,94,.24)}",
	      ".team-challenge-joinbar [data-opt-out]{border-color:rgba(191,219,254,.45);background:linear-gradient(180deg,#1f2f5f,#0f172a)}",
	      ".team-challenge-joinbar.is-joined .team-join-actions,.team-challenge-joinbar.is-watching .team-join-actions{grid-template-columns:1fr}",
	      ".team-challenge-joinbar.is-joined [data-join-in]{display:none}",
	      ".team-challenge-joinbar.is-joined [data-opt-out]{position:absolute;right:10px;bottom:10px;min-height:30px;border-radius:999px;padding:6px 10px;font-size:9px;letter-spacing:.08em;background:rgba(15,23,42,.9);box-shadow:none}",
	      ".team-challenge-joinbar.is-watching [data-opt-out]{display:none}",
	      ".team-countdown-card{display:grid;gap:5px;min-width:0;padding:7px;border:1px solid rgba(250,204,21,.34);border-radius:12px;background:linear-gradient(180deg,rgba(250,204,21,.11),rgba(15,23,42,.66));color:#fff}",
	      ".team-countdown-head{display:flex;align-items:center;justify-content:space-between;gap:8px;color:#fde68a;font-size:10px;font-weight:1000;letter-spacing:.12em;text-transform:uppercase}",
	      ".team-countdown-head em{font-style:normal;color:#bfdbfe;font-size:9px;letter-spacing:.1em}",
	      ".team-countdown-display{font-size:clamp(30px,4.1vw,52px);font-weight:1000;line-height:.92;letter-spacing:.05em;color:#fff;text-shadow:0 0 28px rgba(250,204,21,.38),0 5px 0 rgba(0,0,0,.28)}",
	      ".team-countdown-display.is-live{color:#86efac;text-shadow:0 0 28px rgba(34,197,94,.34),0 5px 0 rgba(0,0,0,.28)}",
	      ".team-countdown-controls{display:grid;grid-template-columns:minmax(70px,.5fr) minmax(70px,.5fr) repeat(3,minmax(62px,.38fr));gap:6px;align-items:center}",
	      ".team-countdown-controls input{width:100%;min-width:0;height:34px;border:1px solid rgba(127,149,197,.32);border-radius:9px;background:rgba(10,18,40,.92);color:#fff;padding:0 8px;font-size:12px;font-weight:900}",
	      ".team-countdown-controls button{min-width:0;min-height:34px;border:1px solid rgba(127,149,197,.28);border-radius:9px;padding:6px 8px;color:#fff;font-size:9.5px;font-weight:950;letter-spacing:.055em;text-transform:uppercase;background:#101a38;white-space:normal;line-height:1.05}",
	      ".team-countdown-controls [data-countdown-start]{border-color:rgba(34,197,94,.68);background:linear-gradient(180deg,#16a34a,#14532d)}",
	      ".team-countdown-presets{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:4px}",
	      ".team-countdown-presets button{min-width:0;min-height:28px;border:1px solid rgba(250,204,21,.36);border-radius:999px;background:rgba(250,204,21,.13);color:#fde68a;padding:4px 7px;font-size:8.5px;font-weight:1000;letter-spacing:.055em;text-transform:uppercase}",
	      ".team-countdown-presets [data-countdown-preset='30']{border-color:rgba(34,197,94,.62);background:rgba(34,197,94,.18);color:#bbf7d0}",
	      ".mmed-team-challenge-admin .team-countdown-card{grid-template-columns:auto minmax(88px,.22fr) minmax(0,1fr);align-items:center;gap:6px;padding:6px}",
	      ".mmed-team-challenge-admin .team-countdown-head{display:grid;justify-content:start;gap:2px;white-space:nowrap}",
	      ".mmed-team-challenge-admin .team-countdown-display{font-size:28px;text-align:center;letter-spacing:.04em;text-shadow:0 0 16px rgba(250,204,21,.24)}",
	      ".mmed-team-challenge-admin .team-countdown-controls{grid-template-columns:50px 50px repeat(3,minmax(48px,.3fr));gap:4px}",
	      ".mmed-team-challenge-admin .team-countdown-controls input{height:28px;padding:0 6px;font-size:10px}",
	      ".mmed-team-challenge-admin .team-countdown-controls button{min-height:28px;padding:4px 6px;font-size:8.5px}",
	      ".mmed-team-challenge-admin .team-countdown-presets{grid-column:1/-1}",
	      ".team-volume-controls{display:grid;gap:7px;min-width:0;padding:8px;border:1px solid rgba(127,149,197,.22);border-radius:12px;background:rgba(5,10,26,.68);text-align:left}",
	      ".team-volume-controls h4{margin:0;color:#fff;font-size:11px;font-weight:1000;letter-spacing:.08em;text-transform:uppercase}",
	      ".team-volume-row{display:grid;grid-template-columns:92px minmax(0,1fr) 58px;gap:7px;align-items:center;color:#dbeafe;font-size:10px;font-weight:950;letter-spacing:.06em;text-transform:uppercase}",
	      ".team-volume-row input[type='range']{width:100%;min-width:0;accent-color:#facc15}",
	      ".team-volume-row button{min-height:28px;border:1px solid rgba(127,149,197,.28);border-radius:999px;background:#101a38;color:#fff;padding:4px 8px;font-size:9px;font-weight:1000;letter-spacing:.06em;text-transform:uppercase}",
	      ".team-volume-row button[aria-pressed='true']{border-color:rgba(248,113,113,.72);background:linear-gradient(180deg,#dc2626,#7f1d1d)}",
	      ".team-challenge-actions [data-score]{min-width:0;height:58px;font-size:17px;border-radius:12px}",
	      ".team-challenge-actions [data-auto-next],.team-challenge-actions [data-undo-score]{height:50px}",
	      ".team-challenge-actions [data-score='correct']{background:linear-gradient(180deg,#22c55e,#14532d);border-color:#86efac;box-shadow:0 0 24px rgba(34,197,94,.22)}",
	      ".team-challenge-actions [data-score='incorrect']{background:linear-gradient(180deg,#ef4444,#7f1d1d);border-color:#fca5a5;box-shadow:0 0 24px rgba(239,68,68,.2)}",
	      ".team-challenge-actions [data-undo-score]{border-color:rgba(250,204,21,.68);background:linear-gradient(180deg,#2f3a55,#111827);color:#fef3c7}",
      ".team-challenge-actions [data-winner='blue']{border-color:#60a5fa}",
      ".team-challenge-actions [data-winner='red']{border-color:#f87171}",
      ".team-challenge-status{color:#9ba8c8;font-size:12px;min-height:16px}",
      ".team-active-video-note,.team-active-avatar-card,[data-team-active-avatar-card]{display:none!important}",
      ".team-active-avatar-card{position:absolute;right:12px;top:36px;z-index:18;width:138px;padding:8px;border:1px solid rgba(255,255,255,.18);border-radius:14px;background:linear-gradient(180deg,rgba(10,15,32,.82),rgba(3,6,18,.74));box-shadow:0 16px 42px rgba(0,0,0,.34);backdrop-filter:blur(12px);text-align:center;color:#fff}",
      ".team-active-avatar-card .team-active-avatar-art{height:112px;border-radius:12px;overflow:hidden;display:grid;place-items:center;background:linear-gradient(145deg,var(--team-strong,#60a5fa),#111827 64%,var(--team-mid,#1d4ed8));box-shadow:inset 0 1px 0 rgba(255,255,255,.16)}",
      ".team-active-avatar-card img{width:100%;height:100%;object-fit:cover;object-position:center top;display:block;transform:none}",
      ".team-active-avatar-card img.team-avatar-pro{object-fit:contain;object-position:center bottom;padding:3px;background:radial-gradient(circle at 50% 18%,rgba(255,255,255,.2),transparent 34%),linear-gradient(180deg,rgba(8,13,28,.22),rgba(3,7,18,.44))}",
      ".team-active-avatar-card .team-avatar-svg{width:100%;height:100%}",
      ".team-active-avatar-card b{display:block;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-top:7px;font-size:12px;letter-spacing:.04em}",
      ".team-active-avatar-card span{display:block;color:#c8d4f4;font-size:10px;text-transform:uppercase;letter-spacing:.12em}",
      ".team-assignment-modal{position:fixed;inset:0;z-index:99999;display:none;align-items:center;justify-content:center;padding:18px;background:rgba(1,5,16,.68);backdrop-filter:blur(8px)}",
      ".team-assignment-modal.is-open{display:flex}",
      ".team-assignment-dialog{width:min(1120px,calc(100vw - 28px));height:min(760px,calc(100vh - 28px));display:grid;grid-template-rows:auto minmax(0,1fr);border:1px solid rgba(250,204,21,.34);border-radius:16px;background:linear-gradient(180deg,#101a38,#050814);box-shadow:0 30px 90px rgba(0,0,0,.58);overflow:hidden}",
      ".team-assignment-head{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px 16px;border-bottom:1px solid rgba(127,149,197,.25)}",
      ".team-assignment-head h3{margin:0;color:#fff;font-size:18px;letter-spacing:.1em;text-transform:uppercase}",
      ".team-assignment-head-actions{display:flex;gap:8px}",
      ".team-assignment-head button{border:1px solid rgba(127,149,197,.28);border-radius:10px;background:#111827;color:#fff;padding:8px 12px;font-weight:900;letter-spacing:.06em;text-transform:uppercase}",
      ".team-assignment-board{min-height:0;display:grid;grid-template-columns:minmax(220px,1fr) minmax(300px,1.15fr) minmax(220px,1fr);gap:10px;padding:10px}",
      ".team-assignment-zone,.team-assignment-pool{min-height:0;display:flex;flex-direction:column;border:1px solid rgba(127,149,197,.24);border-radius:14px;background:rgba(255,255,255,.04);overflow:hidden}",
      ".team-assignment-zone[data-assign-drop='blue']{border-color:rgba(96,165,250,.48);background:linear-gradient(180deg,rgba(37,99,235,.18),rgba(255,255,255,.035))}",
      ".team-assignment-zone[data-assign-drop='red']{border-color:rgba(248,113,113,.48);background:linear-gradient(180deg,rgba(220,38,38,.18),rgba(255,255,255,.035))}",
      ".team-assignment-zone.is-drop-target{box-shadow:0 0 0 2px rgba(250,204,21,.28),0 0 42px rgba(250,204,21,.14)}",
      ".team-assignment-zone h4,.team-assignment-pool h4{display:flex;align-items:center;justify-content:space-between;gap:8px;margin:0;padding:10px 12px;border-bottom:1px solid rgba(127,149,197,.18);color:#fff;font-size:13px;letter-spacing:.1em;text-transform:uppercase}",
      ".team-assignment-instructions{margin:0;padding:8px 12px;border-bottom:1px solid rgba(127,149,197,.14);color:#b9c6e8;font-size:11px;line-height:1.35}",
      ".team-assignment-zone h4 span{font-size:10px;color:#c8d4f4;letter-spacing:.08em}",
      ".team-assignment-list{min-height:0;overflow:auto;padding:8px;display:grid;align-content:start;gap:7px}",
      ".team-assignment-row{display:grid;grid-template-columns:34px minmax(0,1fr) auto auto;align-items:center;gap:7px;padding:6px;border:1px solid rgba(127,149,197,.22);border-radius:12px;background:rgba(255,255,255,.045);color:#fff}",
      ".team-assignment-row.is-zone-row{grid-template-columns:34px minmax(0,1fr) auto}",
      ".team-assignment-row b{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#fff;font-size:12px}",
      ".team-assignment-row small{display:block;color:#9ba8c8;font-size:10px}",
      ".team-assignment-row button{min-width:34px;height:30px;border:1px solid rgba(127,149,197,.3);border-radius:999px;background:#101a38;color:#fff;font-size:14px;font-weight:900}",
      ".team-assignment-row .assign-arrow-blue{border-color:rgba(96,165,250,.78);background:linear-gradient(180deg,#1d4ed8,#0f1f4d);box-shadow:0 0 18px rgba(37,99,235,.2)}",
      ".team-assignment-row .assign-arrow-red{border-color:rgba(248,113,113,.78);background:linear-gradient(180deg,#dc2626,#4b1115);box-shadow:0 0 18px rgba(220,38,38,.2)}",
      ".team-celebration{position:fixed;inset:0;z-index:99998;pointer-events:none;overflow:hidden}",
      ".team-celebration-piece{position:absolute;top:0;left:0;width:10px;height:16px;border-radius:3px;background:var(--color);animation:mmedConfettiFall var(--duration) linear forwards;animation-delay:var(--delay)}",
      ".team-celebration-balloon{position:absolute;left:0;top:0;width:34px;height:44px;border-radius:50% 50% 46% 46%;background:radial-gradient(circle at 35% 28%,rgba(255,255,255,.8),transparent 20%),var(--color);box-shadow:inset -8px -10px 12px rgba(0,0,0,.14);animation:mmedBalloonRise var(--duration) ease-in forwards;animation-delay:var(--delay)}",
      ".team-celebration-balloon:after{content:'';position:absolute;left:50%;bottom:-14px;width:1px;height:16px;background:rgba(255,255,255,.55)}",
      ".team-winner-announcement{position:fixed;inset:0;z-index:100000;display:none;place-items:center;pointer-events:none;background:radial-gradient(circle at 50% 45%,rgba(250,204,21,.2),transparent 36%),rgba(1,5,16,.28);backdrop-filter:blur(2px)}",
	      ".team-winner-announcement.is-open{display:grid}",
	      ".team-winner-card{width:min(720px,calc(100vw - 36px));padding:28px 32px;border:2px solid rgba(250,204,21,.85);border-radius:24px;background:linear-gradient(135deg,rgba(9,13,28,.96),rgba(16,24,54,.93));box-shadow:0 30px 110px rgba(0,0,0,.62),0 0 70px rgba(250,204,21,.32);text-align:center;color:#fff;text-transform:uppercase}",
	      ".team-winner-card span{display:block;color:#fde68a;font-size:16px;font-weight:1000;letter-spacing:.2em}",
	      ".team-winner-card strong{display:block;margin-top:8px;font-size:clamp(42px,7vw,82px);line-height:.95;letter-spacing:.06em;text-shadow:0 0 28px rgba(250,204,21,.42)}",
	      ".team-winner-card em{display:block;margin-top:14px;color:#bfdbfe;font-size:18px;font-style:normal;font-weight:900;letter-spacing:.12em}",
		      ".team-public-note{position:fixed;left:50%;top:72px;z-index:99997;display:none;max-width:min(860px,calc(100vw - 36px));transform:translateX(-50%);padding:10px 14px;border:1px solid rgba(250,204,21,.58);border-radius:14px;background:rgba(3,6,18,.93);box-shadow:0 18px 54px rgba(0,0,0,.36);color:#fff;text-align:center;font-size:15px;font-weight:850;line-height:1.3}",
		      ".team-public-note.is-visible{display:block}",
			      ".team-chat-box{display:grid;grid-template-rows:auto auto auto auto minmax(48px,1fr);gap:8px;min-height:0;padding:9px;border:1px solid rgba(127,149,197,.24);border-radius:14px;background:rgba(5,10,26,.74);text-align:left;overflow:hidden}",
		      ".team-chat-box h4{margin:0;color:#fff;font-size:12px;font-weight:1000;letter-spacing:.08em;text-transform:uppercase}",
		      ".team-chat-target-status{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#bfdbfe;font-size:10px;font-weight:1000;letter-spacing:.05em;text-transform:uppercase}",
		      ".team-chat-row{display:grid;grid-template-columns:minmax(112px,.4fr) minmax(0,1fr) auto;gap:8px;align-items:center}",
		      ".team-chat-box input{width:100%;min-width:0;height:40px;border:1px solid rgba(127,149,197,.32);border-radius:10px;background:rgba(10,18,40,.92);color:#fff;padding:0 11px;font-size:13px;font-weight:800}",
		      ".team-chat-emojis{display:flex;gap:6px;flex-wrap:wrap}",
		      ".team-chat-emojis button{min-height:30px;padding:4px 8px;font-size:16px;letter-spacing:0;text-transform:none}",
			      ".team-chat-log{display:grid;align-content:start;gap:5px;min-height:48px;max-height:clamp(64px,12vh,140px);overflow:auto;color:#dbeafe;font-size:12px;line-height:1.25;scrollbar-width:thin}",
			      ".team-challenge-joinbar.is-joined .team-chat-box,.team-challenge-joinbar.is-watching .team-chat-box{grid-template-rows:auto auto 34px 28px minmax(0,1fr)}",
			      ".team-challenge-joinbar.is-joined .team-chat-row,.team-challenge-joinbar.is-watching .team-chat-row{grid-template-columns:minmax(94px,.36fr) minmax(0,1fr) minmax(48px,.18fr);gap:5px}",
			      ".team-challenge-joinbar.is-joined .team-chat-box input,.team-challenge-joinbar.is-watching .team-chat-box input{height:34px;font-size:12px;padding:0 9px}",
			      ".team-challenge-joinbar.is-joined .team-chat-emojis,.team-challenge-joinbar.is-watching .team-chat-emojis{gap:4px;overflow:hidden;flex-wrap:nowrap}",
			      ".team-challenge-joinbar.is-joined .team-chat-emojis button,.team-challenge-joinbar.is-watching .team-chat-emojis button{min-height:26px;padding:3px 7px;font-size:14px}",
			      ".team-challenge-joinbar.is-joined .team-chat-log,.team-challenge-joinbar.is-watching .team-chat-log{min-height:0;max-height:none;font-size:11px}",
			      ".mmed-team-challenge-admin .team-chat-box{max-height:150px}",
			      ".mmed-team-challenge-admin .team-chat-log{max-height:72px}",
		      ".team-chat-log div{padding:6px 8px;border:1px solid rgba(127,149,197,.18);border-radius:10px;background:rgba(15,23,42,.58)}",
		      ".team-avatar-studio-modal{position:fixed;inset:0;z-index:99998;display:none;align-items:center;justify-content:center;padding:18px;background:rgba(1,5,16,.72);backdrop-filter:blur(8px)}",
		      ".team-avatar-studio-modal.is-open{display:flex}",
		      ".team-avatar-studio-dialog{width:min(1180px,calc(100vw - 28px));height:min(820px,calc(100vh - 28px));display:grid;grid-template-rows:auto minmax(0,1fr);border:1px solid rgba(250,204,21,.34);border-radius:16px;background:#050814;box-shadow:0 30px 90px rgba(0,0,0,.58);overflow:hidden}",
		      ".team-avatar-studio-head{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 14px;border-bottom:1px solid rgba(127,149,197,.25);color:#fff;font-size:14px;font-weight:1000;letter-spacing:.08em;text-transform:uppercase}",
		      ".team-avatar-studio-head button{border:1px solid rgba(127,149,197,.32);border-radius:10px;background:#111827;color:#fff;padding:8px 12px;font-weight:900;text-transform:uppercase}",
		      ".team-avatar-studio-unavailable{display:none;place-content:center;height:100%;padding:28px;text-align:center;color:#dbeafe;font-size:15px;font-weight:900;line-height:1.45}",
		      ".team-avatar-studio-unavailable.is-visible{display:grid}",
		      ".team-avatar-studio-dialog iframe{width:100%;height:100%;border:0;background:#020617}",
			      "@media(max-height:860px){.mmed-team-challenge-enabled .center-column{grid-template-rows:minmax(300px,1fr) minmax(0,auto)}.mmed-team-challenge-admin .center-column{grid-template-rows:minmax(360px,1fr) minmax(235px,auto)}.team-challenge-adminbar{min-height:235px;max-height:min(330px,36vh)}.team-challenge-actions [data-score]{height:50px}.team-challenge-actions button,.team-session-controls button,.team-meeting-controls button,.team-schedule-controls button,.team-schedule-form button{min-height:36px;padding:7px 8px;font-size:10px}}",
	      "@media(max-width:1180px){.mmed-team-challenge-enabled .mm-drill .app{grid-template-columns:clamp(154px,20vw,230px) minmax(340px,1fr) clamp(154px,20vw,230px)}.team-challenge-head{height:50px;padding:8px 10px}.team-challenge-head h3{font-size:14px}.team-challenge-total{min-width:36px;font-size:28px}.team-challenge-name{font-size:12px}.team-active-avatar-card{display:none}.team-session-title{display:none}.mmed-team-challenge-admin .team-challenge-adminbar{grid-template-columns:minmax(0,1fr);grid-template-rows:auto auto}.team-challenge-actions{grid-template-columns:repeat(4,minmax(0,1fr));gap:5px}.team-challenge-actions button,.team-session-controls button,.team-meeting-controls button,.team-schedule-controls button,.team-schedule-form button{min-height:34px;padding:5px 7px;font-size:9.5px;letter-spacing:.045em}.team-challenge-actions [data-score]{height:44px;font-size:13px}.team-meeting-controls{grid-template-columns:repeat(4,minmax(0,1fr))}.team-schedule-controls{grid-template-columns:repeat(2,minmax(0,1fr))}.team-schedule-controls select{grid-column:1/-1}.team-account-actions,.team-chat-row{grid-template-columns:1fr}}",
      "@media(max-width:980px){.mmed-team-challenge-enabled .mm-drill{padding:6px}.mmed-team-challenge-enabled .mm-drill .app{height:calc(100vh - 12px);grid-template-columns:minmax(138px,170px) minmax(300px,1fr) minmax(138px,170px);grid-template-rows:50px minmax(0,1fr);gap:6px}.mmed-team-challenge-enabled .mm-drill .brand-header{height:50px;padding:6px 9px}.mmed-team-challenge-enabled .brand-logo{width:32px;height:32px}.mmed-team-challenge-enabled .mode-badge{font-size:18px}.mmed-team-challenge-enabled .player-shell{grid-template-rows:22px minmax(0,1fr)}.mmed-team-challenge-enabled .player-topbar{height:22px}.team-challenge-head{height:46px}.team-challenge-head h3{font-size:12px;letter-spacing:.07em}.team-challenge-count{font-size:9px;padding:1px 6px}.team-challenge-total{font-size:25px}.team-challenge-list{grid-auto-rows:50px;gap:5px;padding:7px}.team-challenge-student{grid-template-columns:30px minmax(0,1fr) 58px 30px;height:50px;min-height:50px;max-height:50px;gap:5px;padding:3px 6px 3px 3px}.team-challenge-student.is-active:after{right:68px}.team-challenge-avatar{width:28px;height:28px}.team-challenge-name{font-size:10.5px}.team-challenge-asked{height:34px;min-width:58px}.team-challenge-asked span{font-size:10px}.team-challenge-asked strong{font-size:19px}.team-challenge-points{font-size:18px}.team-challenge-adminbar{min-height:0;padding:6px;gap:5px}.team-control-banner{min-height:20px;padding:2px 7px}.team-control-banner strong{font-size:9px}.team-control-banner span{font-size:9px}.team-meeting-current,.team-challenge-status{font-size:10px}.team-session-controls{grid-template-columns:minmax(100px,1fr) minmax(60px,.38fr) minmax(52px,.28fr);gap:4px}.team-meeting-controls{grid-template-columns:repeat(4,minmax(0,1fr));gap:4px}.team-schedule-controls{grid-template-columns:repeat(2,minmax(0,1fr));gap:4px}.team-schedule-form{grid-template-columns:minmax(120px,1fr) minmax(128px,.8fr) 54px minmax(74px,.45fr)}.team-session-controls input,.team-schedule-controls select,.team-schedule-form input{height:30px;font-size:10px;padding:0 7px}.team-meeting-controls input{height:30px;font-size:9.5px;padding:0 7px}.team-challenge-actions{grid-template-columns:repeat(4,minmax(0,1fr));gap:4px}.team-challenge-actions button,.team-session-controls button,.team-meeting-controls button,.team-schedule-controls button,.team-schedule-form button{min-height:30px;border-radius:8px;padding:4px 5px;font-size:8.5px;letter-spacing:.035em}.team-challenge-actions [data-score]{height:38px;font-size:12px}}",
      "@media(max-width:820px){.mmed-team-challenge-enabled .mm-drill .app{grid-template-columns:minmax(112px,140px) minmax(260px,1fr) minmax(112px,140px);gap:5px}.team-challenge-actions{grid-template-columns:repeat(3,minmax(0,1fr))}.team-challenge-actions [data-score]{grid-column:span 1}.team-schedule-form{grid-template-columns:minmax(0,1fr) minmax(0,1fr);}.team-challenge-actions button,.team-session-controls button,.team-meeting-controls button,.team-schedule-controls button,.team-schedule-form button{font-size:8px;padding:4px}.team-challenge-head h3{font-size:10.5px}.team-challenge-total{font-size:22px}.team-challenge-name{font-size:9.5px}}",
		      ".mmed-team-challenge-enabled .team-session-controls,.mmed-team-challenge-enabled .team-schedule-form{min-width:0;max-width:100%;overflow:hidden}",
		      ".mmed-team-challenge-enabled .team-admin-stack{min-width:0;max-width:100%;overflow:visible}",
	      ".mmed-team-challenge-enabled .team-meeting-controls,.mmed-team-challenge-enabled .team-schedule-controls{min-width:0;max-width:100%;overflow:visible}",
      ".mmed-team-challenge-enabled .team-meeting-controls button,.mmed-team-challenge-enabled .team-schedule-controls button,.mmed-team-challenge-enabled .team-session-controls button{white-space:normal;line-height:1.05}",
	      "@media(max-width:760px){body:not(.mmed-team-challenge-admin) .center-column{grid-template-rows:minmax(240px,1fr) minmax(360px,46vh)}.team-student-panel-layout{grid-template-columns:minmax(0,1fr)}.team-student-avatar-card{display:none}.team-student-top{grid-template-columns:minmax(0,1fr)}.team-countdown-controls{grid-template-columns:repeat(2,minmax(0,1fr))}.team-countdown-controls button{min-height:32px}.team-challenge-joinbar{padding:8px}.team-challenge-joinbar p b{font-size:30px}.team-join-actions{grid-template-columns:1fr}.team-challenge-joinbar button{min-height:46px}}",
		      ".mmed-team-challenge-admin .center-column{grid-template-rows:minmax(300px,1fr) minmax(350px,42vh)!important}",
	      ".mmed-team-challenge-admin .team-challenge-adminbar{display:grid!important;grid-template-rows:auto auto minmax(0,1fr);gap:6px;align-content:stretch;align-items:stretch;min-height:0!important;max-height:none!important;height:100%;overflow:hidden!important;padding:7px}",
	      ".team-admin-tabs{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px;min-width:0}",
	      ".team-admin-tab{min-width:0;min-height:34px;border:1px solid rgba(127,149,197,.32);border-radius:10px;background:linear-gradient(180deg,#111c3d,#071126);color:#dbeafe;padding:5px 8px;font-size:11px;font-weight:1000;letter-spacing:.075em;text-transform:uppercase;line-height:1.05;white-space:normal}",
	      ".team-admin-tab span{display:block;margin-top:1px;color:#93c5fd;font-size:9px;letter-spacing:.08em}",
	      ".team-admin-tab[aria-pressed='true']{border-color:rgba(250,204,21,.82);background:linear-gradient(180deg,rgba(250,204,21,.28),rgba(30,41,59,.9));color:#fff;box-shadow:0 0 22px rgba(250,204,21,.18)}",
	      ".team-admin-stack{display:grid!important;grid-template-rows:auto auto minmax(0,1fr)!important;gap:5px;min-width:0!important;max-width:100%!important;min-height:0!important;overflow:hidden!important}",
	      ".mmed-team-challenge-admin .team-control-banner{min-height:21px;padding:2px 8px}",
	      ".mmed-team-challenge-admin .team-admin-step{display:none;min-width:0!important;min-height:0!important;max-height:none!important;overflow:hidden!important;padding:7px;gap:6px;border-radius:11px}",
	      ".team-challenge-adminbar[data-active-admin-step='1'] .team-admin-step[data-admin-step='1'],.team-challenge-adminbar[data-active-admin-step='2'] .team-admin-step[data-admin-step='2'],.team-challenge-adminbar[data-active-admin-step='3'] .team-admin-step[data-admin-step='3']{display:grid}",
	      ".mmed-team-challenge-admin .team-admin-step h4{font-size:11px;line-height:1.05}",
	      ".mmed-team-challenge-admin .team-admin-step h4 span{min-width:50px;min-height:20px;font-size:9px}",
	      ".mmed-team-challenge-admin .team-admin-step[data-admin-step='1']{grid-template-rows:auto auto minmax(30px,auto) minmax(68px,auto) minmax(32px,auto) auto;align-content:start}",
	      ".mmed-team-challenge-admin .team-schedule-controls{grid-template-columns:minmax(0,1fr) minmax(112px,.24fr) minmax(118px,.24fr);gap:5px;min-height:0}",
	      ".mmed-team-challenge-admin .team-schedule-controls select,.mmed-team-challenge-admin .team-schedule-form input,.mmed-team-challenge-admin .team-session-controls input,.mmed-team-challenge-admin .team-meeting-controls input{height:32px;font-size:11px;padding:0 8px;border-radius:9px}",
	      ".mmed-team-challenge-admin .team-meeting-controls{grid-template-columns:repeat(5,minmax(0,1fr));gap:5px;min-height:0;align-items:stretch}",
	      ".mmed-team-challenge-admin .team-meeting-controls input{grid-column:1/-1}",
	      ".mmed-team-challenge-admin .team-meeting-controls [data-host-webex-start]{grid-column:auto;min-height:34px;font-size:9px;box-shadow:0 0 18px rgba(34,197,94,.18)}",
	      ".mmed-team-challenge-admin .team-session-controls{grid-template-columns:minmax(0,1fr) minmax(94px,.2fr) minmax(92px,.18fr);gap:5px}",
	      ".mmed-team-challenge-admin .team-schedule-form.is-open{grid-template-columns:minmax(0,1fr) minmax(128px,.5fr) 54px minmax(84px,.24fr);gap:5px}",
	      ".mmed-team-challenge-admin .team-schedule-note{font-size:9.5px;line-height:1.15;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
	      ".mmed-team-challenge-admin .team-admin-step[data-admin-step='2']{grid-template-columns:minmax(0,1fr) minmax(0,.92fr);grid-template-rows:auto auto minmax(34px,auto) minmax(0,1fr);align-content:stretch}",
	      ".mmed-team-challenge-admin .team-admin-step[data-admin-step='2'] h4,.mmed-team-challenge-admin .team-admin-step[data-admin-step='2'] .team-countdown-card,.mmed-team-challenge-admin .team-admin-step[data-admin-step='2'] .team-host-note-controls,.mmed-team-challenge-admin .team-admin-step[data-admin-step='2'] .team-challenge-status{grid-column:1/-1}",
	      ".mmed-team-challenge-admin .team-admin-step[data-admin-step='2'] .team-chat-box{min-height:0;max-height:none!important;height:100%;grid-template-rows:auto 32px 26px minmax(0,1fr)}",
	      ".mmed-team-challenge-admin .team-admin-step[data-admin-step='2'] .team-volume-controls{min-height:0;height:100%;gap:5px;padding:7px}",
	      ".mmed-team-challenge-admin .team-host-note-controls textarea{min-height:42px;height:42px;resize:none;font-size:11px;padding:7px 9px}",
	      ".mmed-team-challenge-admin .team-countdown-card{grid-template-columns:auto minmax(82px,.22fr) minmax(0,1fr);padding:5px}",
	      ".mmed-team-challenge-admin .team-countdown-display{font-size:25px}",
	      ".mmed-team-challenge-admin .team-countdown-controls input{height:26px}",
	      ".mmed-team-challenge-admin .team-countdown-controls button{min-height:26px}",
	      ".mmed-team-challenge-admin .team-score-step{flex:none!important;min-width:0!important}",
	      ".mmed-team-challenge-admin .team-score-step .team-auto-next-controls{grid-template-columns:minmax(128px,.42fr) minmax(160px,.58fr) minmax(140px,.42fr);gap:5px}",
	      ".mmed-team-challenge-admin .team-score-step .team-auto-next-controls select,.mmed-team-challenge-admin .team-score-step .team-auto-next-controls button{height:34px;min-height:34px}",
	      ".mmed-team-challenge-admin .team-score-step .team-challenge-actions{grid-template-columns:repeat(6,minmax(0,1fr));gap:5px}",
	      ".mmed-team-challenge-admin .team-score-step .team-challenge-actions [data-score]{grid-column:span 3;height:44px;font-size:16px}",
	      ".mmed-team-challenge-admin .team-score-step .team-challenge-actions button{min-height:32px;padding:5px 7px;font-size:9.5px}",
	      "@media(max-height:820px){.mmed-team-challenge-admin .center-column{grid-template-rows:minmax(270px,1fr) minmax(350px,44vh)!important}.team-admin-tab{min-height:30px;font-size:10px}.mmed-team-challenge-admin .team-challenge-adminbar{padding:6px;gap:5px}.mmed-team-challenge-admin .team-admin-step{padding:6px;gap:5px}.mmed-team-challenge-admin .team-admin-step[data-admin-step='2']{grid-template-columns:minmax(0,1fr) minmax(0,.92fr)}.mmed-team-challenge-admin .team-score-step .team-challenge-actions button{min-height:30px;font-size:8.8px}.mmed-team-challenge-admin .team-score-step .team-challenge-actions [data-score]{height:40px}}",
	      "@media(max-width:1180px){.mmed-team-challenge-admin .team-score-step .team-challenge-actions{grid-template-columns:repeat(6,minmax(0,1fr))}.mmed-team-challenge-admin .team-meeting-controls{grid-template-columns:repeat(5,minmax(0,1fr))}.mmed-team-challenge-admin .team-schedule-controls select{grid-column:auto}}"
    ].join("");
    document.head.appendChild(style);
  }

  function injectFloorStyles() {
    var style = document.createElement("style");
    style.id = "mmed-live-floor-layout";
    style.textContent = [
      "html{height:auto!important;min-height:100%}",
      "body.mmed-team-challenge-enabled{height:auto!important;min-height:100vh;overflow-x:hidden!important;overflow-y:auto!important;background:#050814}",
      ".mmed-team-challenge-enabled #legacyShell,.mmed-team-challenge-enabled .shell.is-active{display:block;min-width:0;height:auto!important;min-height:100vh;overflow:visible!important}",
      ".mmed-team-challenge-enabled .mm-drill{height:auto!important;min-height:100vh;padding:10px;overflow:visible!important}",
      ".mmed-team-challenge-enabled .mm-drill .app{display:grid!important;grid-template-areas:'brand brand brand' 'blue center red';grid-template-columns:minmax(210px,300px) minmax(0,1fr) minmax(210px,300px)!important;grid-template-rows:auto auto!important;align-items:stretch;gap:10px;width:100%;max-width:1920px;min-height:calc(100vh - 20px);height:auto!important;margin:0 auto;overflow:visible!important}",
      ".mmed-team-challenge-enabled .brand-header{grid-area:brand;min-width:0}",
      ".mmed-team-challenge-enabled #leftPanel{grid-area:blue}",
      ".mmed-team-challenge-enabled #rightPanel{grid-area:red}",
      ".mmed-team-challenge-enabled .center-column{grid-area:center;display:grid!important;grid-template-rows:minmax(440px,72vh) auto!important;align-content:start;gap:10px;min-width:0;height:auto!important;max-height:none!important;overflow:visible!important}",
      ".mmed-team-challenge-enabled .player-shell{position:relative;min-width:0;min-height:440px;height:auto!important;overflow:hidden}",
      ".mmed-team-challenge-enabled .live-stage{position:relative;min-height:390px;height:calc(100% - 42px)!important;overflow:hidden}",
      ".mmed-team-challenge-enabled .team-challenge-panel{min-width:0;height:auto!important;min-height:440px;max-height:none!important;overflow:hidden}",
      ".mmed-team-challenge-enabled .team-challenge-list{overflow-y:auto;overscroll-behavior:contain;min-height:0}",
      ".mmed-team-challenge-enabled .team-challenge-total{font-size:32px;line-height:1;flex:0 0 auto}",
      ".mmed-team-challenge-enabled .team-challenge-head h3{font-size:18px;overflow-wrap:anywhere}",
      ".mmed-team-challenge-enabled .team-challenge-adminbar,.mmed-team-challenge-enabled .team-challenge-joinbar{position:relative!important;inset:auto!important;min-width:0;min-height:0;height:auto!important;max-height:none!important;overflow:visible!important}",
      ".mmed-team-challenge-enabled .team-student-panel-layout{min-height:0}",
	      ".mmed-team-challenge-enabled .team-student-panel-main{height:auto!important;overflow:visible!important}",
	      ".mmed-team-challenge-enabled .team-challenge-joinbar:not(.is-joined):not(.is-watching) .team-chat-box,.mmed-team-challenge-enabled .team-challenge-joinbar:not(.is-joined):not(.is-watching) .team-volume-controls{display:none}",
	      ".mmed-team-challenge-enabled .team-challenge-joinbar:not(.is-joined):not(.is-watching) .team-student-panel-main{grid-template-rows:auto!important;align-content:start}",
      ".mmed-team-challenge-enabled .team-guest-fields{grid-template-columns:minmax(0,1fr)!important}",
      ".mmed-team-challenge-enabled .team-guest-fields label{min-width:0}",
	      ".mmed-team-challenge-enabled .team-guest-fields input{min-height:44px}",
      ".mmed-team-challenge-enabled .team-guest-fields [data-entry-help]{display:block;color:#cbd5e1;font-size:12px;line-height:1.35;text-transform:none}",
	      ".mmed-team-challenge-enabled .team-join-actions{grid-template-columns:repeat(2,minmax(0,1fr))}",
	      ".mmed-team-challenge-enabled .team-join-actions button{min-height:48px}",
	      ".mmed-team-challenge-enabled .team-challenge-joinbar.is-joined .team-join-actions,.mmed-team-challenge-enabled .team-challenge-joinbar.is-watching .team-join-actions{position:static;grid-column:1/-1}",
	      ".mmed-team-challenge-enabled .team-challenge-joinbar.is-joined [data-opt-out]{position:static;right:auto;bottom:auto;min-height:44px;border-radius:8px;padding:8px 11px;font-size:10px}",
	      "body.mmed-team-challenge-enabled:not(.mmed-team-challenge-admin):has(.team-challenge-joinbar:not(.is-joined):not(.is-watching)) .center-column{grid-template-rows:minmax(220px,30vh) auto!important}",
	      "body.mmed-team-challenge-enabled:not(.mmed-team-challenge-admin):has(.team-challenge-joinbar:not(.is-joined):not(.is-watching)) .player-shell{min-height:220px}",
	      "body.mmed-team-challenge-enabled:not(.mmed-team-challenge-admin):has(.team-challenge-joinbar:not(.is-joined):not(.is-watching)) .live-stage{min-height:174px}",
	      ".mmed-team-challenge-enabled .team-challenge-joinbar p span{display:block;margin-top:6px}",
      ".mmed-team-challenge-enabled .team-student-signin{display:block;margin-top:6px;color:#bfdbfe;font-size:12px;text-align:center}",
      ".mmed-team-challenge-enabled .team-room-state-overlay{position:absolute;z-index:9;inset:0;display:grid;place-content:center;gap:10px;padding:28px;text-align:center;background:#040713;color:#eef5ff}",
      ".mmed-team-challenge-enabled .team-room-state-overlay[hidden]{display:none}",
      ".mmed-team-challenge-enabled .team-room-state-overlay span{color:#facc15;font-size:11px;font-weight:950;text-transform:uppercase}",
      ".mmed-team-challenge-enabled .team-room-state-overlay h2{margin:0;font-size:30px;line-height:1.1;letter-spacing:0}",
      ".mmed-team-challenge-enabled .team-room-state-overlay p{max-width:560px;margin:0;color:#cbd5e1;font-size:15px;line-height:1.5}",
	      ".mmed-team-challenge-enabled .team-lifecycle-controls{display:grid;grid-template-columns:minmax(82px,.8fr) repeat(6,minmax(0,1fr));align-items:center;gap:5px;padding:6px;border:1px solid rgba(127,149,197,.28);background:#0a1025}",
      ".mmed-team-challenge-enabled .team-lifecycle-controls strong{font-size:12px;color:#f8fafc}",
      ".mmed-team-challenge-enabled .team-lifecycle-controls button{min-height:34px;border:1px solid rgba(127,149,197,.34);border-radius:6px;background:#101a38;color:#eef5ff;padding:6px 8px;font-size:10px;font-weight:900;text-transform:uppercase}",
      ".mmed-team-challenge-enabled .team-lifecycle-controls button[aria-current='true']{border-color:#facc15;color:#fef08a}",
      ".mmed-team-challenge-enabled .team-lifecycle-controls button:disabled{opacity:.42;cursor:not-allowed}",
      ".mmed-team-challenge-enabled .team-floor-diagnostics{padding:7px 9px;border:1px solid rgba(34,211,238,.34);background:#071827;color:#bae6fd;font:11px/1.45 ui-monospace,SFMono-Regular,Menlo,monospace;overflow-wrap:anywhere}",
      ".mmed-team-challenge-enabled .team-connection-state{display:inline-flex;align-items:center;gap:5px;white-space:nowrap}",
      ".mmed-team-challenge-enabled .team-connection-state:before{content:'';width:7px;height:7px;border-radius:50%;background:#22c55e}",
	      ".mmed-team-challenge-enabled .team-connection-state[data-state='reconnecting']:before{background:#facc15}",
	      ".mmed-team-challenge-admin .team-challenge-adminbar,.mmed-team-challenge-admin .team-admin-stack{grid-template-columns:minmax(0,1fr)!important}",
      ".mmed-team-challenge-enabled .team-countdown-display{font-size:42px!important;letter-spacing:0!important}",
	      "body.mmed-team-challenge-enabled:not([data-room-state='live']) .team-challenge-student.is-active:after{content:'NEXT'}",
	      "body.mmed-team-challenge-enabled[data-room-state='idle'] .team-student-room-lock:before{content:'Room waiting'}",
	      "body.mmed-team-challenge-enabled[data-room-state='doors_open'] .team-student-room-lock:before{content:'Doors open'}",
	      "body.mmed-team-challenge-enabled[data-room-state='live'] .team-student-room-lock:before{content:'Room live'}",
	      "body.mmed-team-challenge-enabled[data-room-state='ended'] .team-student-room-lock:before,body.mmed-team-challenge-enabled[data-room-state='archived'] .team-student-room-lock:before{content:'Room closed'}",
	      "@media(max-height:800px) and (min-width:1100px){body.mmed-team-challenge-admin .center-column{grid-template-rows:minmax(300px,42vh) auto!important}body.mmed-team-challenge-admin .player-shell{min-height:300px}body.mmed-team-challenge-admin .live-stage{min-height:254px}body.mmed-team-challenge-enabled:not(.mmed-team-challenge-admin) .center-column{grid-template-rows:minmax(300px,48vh) auto!important}}",
	      "@media(max-width:1099px){.mmed-team-challenge-enabled .mm-drill .app{grid-template-areas:'brand brand' 'blue red' 'center center';grid-template-columns:minmax(0,1fr) minmax(0,1fr)!important;grid-template-rows:auto auto auto!important}.mmed-team-challenge-enabled .team-challenge-panel{min-height:0;max-height:280px}.mmed-team-challenge-enabled .team-challenge-list{max-height:210px}.mmed-team-challenge-enabled .center-column{grid-template-rows:minmax(400px,70vh) auto!important}body.mmed-team-challenge-enabled:not(.mmed-team-challenge-admin):has(.team-challenge-joinbar:not(.is-joined):not(.is-watching)) .center-column{grid-template-rows:minmax(220px,30vh) auto!important}.mmed-team-challenge-enabled .team-lifecycle-controls{grid-template-columns:repeat(3,minmax(0,1fr))}.mmed-team-challenge-enabled .team-lifecycle-controls strong{grid-column:1/-1}}",
      "@media(max-width:720px){.mmed-team-challenge-enabled .mm-drill{padding:6px}.mmed-team-challenge-enabled .mm-drill .app{gap:6px}.mmed-team-challenge-enabled .brand-header{padding:9px 10px}.mmed-team-challenge-enabled .brand-logo{width:36px;height:36px}.mmed-team-challenge-enabled .team-session-title{display:none}.mmed-team-challenge-enabled .team-challenge-panel{max-height:210px;border-radius:6px}.mmed-team-challenge-enabled .team-challenge-head{height:auto;min-height:58px;padding:8px}.mmed-team-challenge-enabled .team-challenge-head h3{font-size:13px;line-height:1.15}.mmed-team-challenge-enabled .team-challenge-count{font-size:9px}.mmed-team-challenge-enabled .team-challenge-total{font-size:28px}.mmed-team-challenge-enabled .team-challenge-list{max-height:145px}.mmed-team-challenge-enabled .team-challenge-name{font-size:11px}.mmed-team-challenge-enabled .center-column{grid-template-rows:minmax(310px,62vh) auto!important}.mmed-team-challenge-enabled .player-shell{min-height:310px}.mmed-team-challenge-enabled .live-stage{min-height:264px}.mmed-team-challenge-enabled .team-room-state-overlay{padding:18px}.mmed-team-challenge-enabled .team-room-state-overlay h2{font-size:24px}.mmed-team-challenge-enabled .team-student-panel-layout{grid-template-columns:minmax(0,1fr)!important}.mmed-team-challenge-enabled .team-student-avatar-card{display:none}.mmed-team-challenge-enabled .team-student-top{grid-template-columns:minmax(0,1fr)!important}.mmed-team-challenge-enabled .team-join-actions{grid-template-columns:repeat(2,minmax(0,1fr))!important}.mmed-team-challenge-enabled .team-join-actions button,.mmed-team-challenge-enabled .team-student-webex-cta{min-height:48px}.mmed-team-challenge-enabled .team-countdown-display{font-size:36px!important}.mmed-team-challenge-enabled .team-lifecycle-controls{grid-template-columns:repeat(2,minmax(0,1fr))}.mmed-team-challenge-enabled .team-lifecycle-controls strong{grid-column:1/-1}.mmed-team-challenge-enabled .team-admin-tabs{grid-template-columns:repeat(3,minmax(0,1fr))}.mmed-team-challenge-enabled .team-admin-step{overflow:visible!important}}",
	      "@media(max-width:430px){.mmed-team-challenge-enabled .team-challenge-head h3{font-size:12px}.mmed-team-challenge-enabled .team-challenge-total{font-size:25px}.mmed-team-challenge-enabled .team-challenge-list{max-height:125px}.mmed-team-challenge-enabled .center-column{grid-template-rows:minmax(280px,58vh) auto!important}.mmed-team-challenge-enabled .player-shell{min-height:280px}.mmed-team-challenge-enabled .live-stage{min-height:234px}body.mmed-team-challenge-enabled:not(.mmed-team-challenge-admin):has(.team-challenge-joinbar:not(.is-joined):not(.is-watching)) .center-column{grid-template-rows:minmax(190px,24vh) auto!important}body.mmed-team-challenge-enabled:not(.mmed-team-challenge-admin):has(.team-challenge-joinbar:not(.is-joined):not(.is-watching)) .player-shell{min-height:190px}body.mmed-team-challenge-enabled:not(.mmed-team-challenge-admin):has(.team-challenge-joinbar:not(.is-joined):not(.is-watching)) .live-stage{min-height:144px}.mmed-team-challenge-enabled .team-challenge-joinbar:before{display:none}.mmed-team-challenge-enabled .team-student-step-strip{display:none}.mmed-team-challenge-enabled .team-student-top{grid-template-columns:minmax(0,1fr) minmax(112px,.48fr)!important}.mmed-team-challenge-enabled .team-challenge-joinbar p b{font-size:24px}.mmed-team-challenge-enabled .team-countdown-card{padding:5px}.mmed-team-challenge-enabled .team-countdown-display{font-size:30px!important}.mmed-team-challenge-enabled .team-join-actions{grid-template-columns:minmax(0,1fr)!important}}"
    ].join("");
    document.head.appendChild(style);
  }

  function mountChallengeFrame() {
    var left = legacyShell.querySelector("#leftPanel");
    var right = legacyShell.querySelector("#rightPanel");
    var player = legacyShell.querySelector("#playerShell");
    var stage = legacyShell.querySelector("[data-live-stage]");
    var brand = legacyShell.querySelector(".brand-logo-wrap");
    var oldScorebar = legacyShell.querySelector("[data-team-challenge-scorebar]");

    if (oldScorebar) {
      oldScorebar.remove();
    }
    if (left) {
      left.className = "team-challenge-panel is-blue";
      left.innerHTML = panelMarkup("blue", "Beta Blockers");
    }
    if (right) {
      right.className = "team-challenge-panel is-red";
      right.innerHTML = panelMarkup("red", "Red Blood Cells");
    }
    if (brand && !legacyShell.querySelector("[data-team-session-title]")) {
      brand.insertAdjacentHTML("beforeend", '<div class="team-session-title" data-team-session-title>Live Team Challenge</div>');
    }
    if (!isAdmin) {
      var staleAdminbar = legacyShell.querySelector("[data-team-challenge-adminbar]");
      if (staleAdminbar) {
        staleAdminbar.remove();
      }
    }
    if (isAdmin && !legacyShell.querySelector("[data-team-challenge-adminbar]")) {
      var adminbar = document.createElement("section");
      adminbar.className = "team-challenge-adminbar";
      adminbar.setAttribute("data-team-challenge-adminbar", "");
      adminbar.setAttribute("data-active-admin-step", activeAdminStep);
      adminbar.innerHTML = [
	        '<div class="team-admin-tabs" role="tablist" aria-label="Admin workflow steps">',
	        '<button class="team-admin-tab" type="button" data-admin-step-tab="1" aria-pressed="false">Step 1 <span>Room</span></button>',
	        '<button class="team-admin-tab" type="button" data-admin-step-tab="2" aria-pressed="false">Step 2 <span>Countdown + Message</span></button>',
	        '<button class="team-admin-tab" type="button" data-admin-step-tab="3" aria-pressed="false">Step 3 <span>Score</span></button>',
	        '</div>',
		        '<div class="team-admin-stack">',
			        '<div class="team-control-banner" aria-label="Host controls"><strong>Host controls</strong><span>Open the doors, start the room, then score each turn.</span><span class="team-connection-state" data-connection-state data-state="connected">Connected</span></div>',
			        '<div class="team-lifecycle-controls" data-lifecycle-controls aria-label="Room status controls">',
			        '<strong data-lifecycle-label>Room idle</strong>',
			        '<button type="button" data-lifecycle-command="new">New session</button>',
			        '<button type="button" data-lifecycle-command="doors_open">Open doors</button>',
			        '<button type="button" data-lifecycle-command="live">Start room</button>',
			        '<button type="button" data-lifecycle-command="ended">End room</button>',
			        '<button type="button" data-lifecycle-command="archived">Archive</button>',
			        '<button type="button" data-floor-diagnostics-toggle aria-expanded="false">Diagnostics</button>',
			        '</div>',
			        '<div class="team-floor-diagnostics" data-floor-diagnostics hidden></div>',
			        hostReadinessMarkup(),
	        '<section class="team-admin-step" data-admin-step="1">',
	        '<h4><span>Step 1</span> Choose Webex room</h4>',
	        '<div class="team-meeting-current" data-current-meeting-label>Meeting: not set</div>',
		        '<div class="team-schedule-controls">',
		        '<select data-scheduled-session-select aria-label="Scheduled Live Drills Webex sessions"></select>',
		        '<button type="button" data-scheduled-session-use>Use selected</button>',
		        '<button type="button" data-schedule-session-toggle>Schedule ahead</button>',
		        '</div>',
				        '<div class="team-meeting-controls">',
		        '<input type="url" data-meeting-link-input aria-label="Webex meeting link" placeholder="Paste Webex room link, or use Personal Room / scheduled session below">',
				        '<button type="button" data-meeting-link-pmr>Use personal room</button>',
				        '<button type="button" data-meeting-link-active>Find live room</button>',
				        '<button type="button" data-meeting-link-save>Use pasted link</button>',
					        '<button type="button" data-meeting-start-now>Create new Webex room</button>',
					        '<button type="button" data-host-webex-start>Start Live Webex Session</button>',
		        '</div>',
		        '<div class="team-schedule-form" data-schedule-session-form hidden>',
	        '<input type="text" maxlength="120" data-scheduled-title aria-label="New scheduled Webex title" placeholder="Scheduled Webex title">',
	        '<input type="datetime-local" data-scheduled-start aria-label="Eastern Time start">',
	        '<input type="number" min="15" max="240" step="15" value="60" data-scheduled-duration aria-label="Duration minutes">',
	        '<button type="button" data-scheduled-session-create>Create Webex</button>',
	        '</div>',
		        '<div class="team-schedule-note">Host order: choose a room first, then click Start Live Webex Session. Create new room is only for a fresh test room.</div>',
	        '</section>',
	        '<section class="team-admin-step" data-admin-step="2">',
		        '<h4><span>Step 2</span> Countdown + message students</h4>',
				        countdownMarkup(true),
			        '<div class="team-host-note-controls">',
		        '<textarea maxlength="220" data-host-note-input aria-label="Message visible to students" placeholder="Message visible to everyone, e.g. Click Yes if you are answering live."></textarea>',
		        '<button type="button" data-host-note-save>Send note</button>',
		        '<button type="button" data-host-note-clear>Clear</button>',
		        '</div>',
			        '<div class="team-challenge-status" data-team-challenge-status></div>',
			        chatBoxMarkup("admin"),
				        volumeControlsMarkup(),
				        '</section>',
		        '<section class="team-admin-step team-score-step" data-admin-step="3">',
	        '<h4><span>Step 3</span> Score the drill</h4>',
	        '<div class="team-auto-next-controls">',
	        '<button type="button" data-auto-next-toggle aria-pressed="false">Auto next: off</button>',
	        '<select data-auto-next-mode aria-label="Auto next selection mode"><option value="ordered">Order: fair rotation</option><option value="fair_random">Random: favor fewer Qs</option></select>',
	        '<button type="button" data-auto-next>Next student now</button>',
	        '</div>',
	        '<div class="team-challenge-actions">',
		        '<button type="button" data-score="correct">Correct <span>(C)</span></button>',
		        '<button type="button" data-score="incorrect">Missed <span>(M)</span></button>',
		        '<button type="button" data-undo-score>Undo score <span>(U)</span></button>',
		        '<button type="button" data-team-assign>Assign teams</button>',
	        '<button type="button" data-balance-teams>Balance Teams</button>',
	        '<button type="button" data-winner="blue">Winner: Beta</button>',
	        '<button type="button" data-winner="red">Winner: Red</button>',
	        '<button type="button" data-reset>Reset Score</button>',
		        '</div>',
		        '</section>',
		        '</div>'
	      ].join("");
      player.insertAdjacentElement("afterend", adminbar);
		    syncAdminStepTabs();
    }
    if (isAdmin) {
      var staleJoinbar = document.querySelector("[data-team-challenge-joinbar]");
      if (staleJoinbar) {
        staleJoinbar.remove();
      }
    }
    if (!isAdmin && !document.querySelector("[data-team-challenge-joinbar]")) {
      var joinbar = document.createElement("section");
		      joinbar.className = "team-challenge-joinbar";
		      joinbar.setAttribute("data-team-challenge-joinbar", "");
		      joinbar.innerHTML = [
			        '<div class="team-student-panel-layout">',
			        '<aside class="team-student-avatar-card team-student-card-you" data-student-panel-avatar="student"></aside>',
			        '<div class="team-student-panel-main">',
			        '<div class="team-student-top">',
			        '<p data-join-prompt><b>JUMPING IN?</b><span>Are you playing in Team Challenge, or watching this round?</span></p>',
			        countdownMarkup(false),
			        '</div>',
			        '<div class="team-student-step-strip" aria-label="Student live drill steps">',
			        '<div class="team-student-step-pill" data-student-step="1"><b>1</b><span>Choose</span></div>',
			        '<div class="team-student-step-pill" data-student-step="2"><b>2</b><span>Enter room</span></div>',
			        '<div class="team-student-step-pill" data-student-step="3"><b>3</b><span>Chat + Play</span></div>',
			        '</div>',
			        '<div class="team-student-room-lock" data-student-meeting-lock><span>Waiting for the host</span></div>',
			        '<div class="team-student-identity" data-student-identity></div>',
			        '<div class="team-challenge-status" data-team-challenge-status role="status" aria-live="polite"></div>',
			        '<div class="team-logged-in-tools" data-logged-in-tools>',
			        '<button type="button" data-avatar-studio-open>Choose avatar</button>',
			        '</div>',
			        '<button type="button" class="team-student-webex-cta" data-student-webex-enter>Enter video room<span>Join the host when the room is live</span></button>',
			        '<div class="team-guest-fields" data-guest-fields>',
			        '<label>Your name<input type="text" maxlength="60" autocomplete="name" data-guest-name placeholder="Name the host will see" aria-describedby="guest-name-help"></label>',
			        '<span id="guest-name-help" data-entry-help>Enter your name, then choose Play or Watch.</span>',
			        '</div>',
			        '<div class="team-join-actions">',
			        '<button type="button" data-join-in>Play</button>',
			        '<button type="button" data-opt-out>Watch</button>',
			        '</div>',
			        currentUserId ? '' : '<a class="team-student-signin" href="' + escapeAttr(config.loginUrl) + '">Already have an account? Sign in</a>',
			        chatBoxMarkup("student"),
			        volumeControlsMarkup(),
			        '</div>',
			        '<aside class="team-student-avatar-card team-student-card-drj" data-student-panel-avatar="drj"></aside>',
			        '</div>'
		      ].join("");
		      player.insertAdjacentElement("afterend", joinbar);
	    }
	    if (stage) {
      var staleActiveAvatar = stage.querySelector("[data-team-active-avatar-card]");
	      if (staleActiveAvatar) {
	        staleActiveAvatar.remove();
	      }
	      if (!stage.querySelector("[data-room-state-overlay]")) {
	        stage.insertAdjacentHTML("beforeend", '<section class="team-room-state-overlay" data-room-state-overlay><span data-room-state-kicker>Dr J Drills LIVE</span><h2 data-room-state-title>Checking the room...</h2><p data-room-state-copy>Keep this page open while the current room loads.</p></section>');
	      }
    }
    if (isAdmin && !document.querySelector("[data-team-assignment-modal]")) {
      document.body.insertAdjacentHTML("beforeend", assignmentModalMarkup());
    }
    if (!document.querySelector("[data-team-celebration]")) {
      document.body.insertAdjacentHTML("beforeend", '<div class="team-celebration" data-team-celebration aria-hidden="true"></div>');
    }
	    if (!document.querySelector("[data-team-winner-announcement]")) {
	      document.body.insertAdjacentHTML("beforeend", '<div class="team-winner-announcement" data-team-winner-announcement aria-hidden="true"></div>');
	    }
		    if (!document.querySelector("[data-team-public-note]")) {
		      document.body.insertAdjacentHTML("beforeend", '<div class="team-public-note" data-team-public-note aria-live="polite"></div>');
		    }
		    if (!document.querySelector("[data-avatar-studio-modal]")) {
		      document.body.insertAdjacentHTML("beforeend", avatarStudioModalMarkup());
		    }
		  }

	  function panelMarkup(teamId, title) {
    return [
      '<div class="team-challenge-head">',
      '<div class="team-challenge-title-stack">',
      '<h3 data-team-title="' + teamId + '">' + title + '</h3>',
      '<span class="team-challenge-count" data-team-count="' + teamId + '">0 players</span>',
      '</div>',
      '<b class="team-challenge-total" data-team-total="' + teamId + '">0</b>',
      '</div>',
      '<div class="team-challenge-list" data-team-list="' + teamId + '"></div>'
	    ].join("");
	  }

		  function chatBoxMarkup(context) {
		    return [
		      '<section class="team-chat-box" data-team-chat-box data-chat-context="' + escapeAttr(context || "student") + '">',
	      '<h4>Class chat</h4>',
	      '<div class="team-chat-target-status" data-chat-target-status>To Everyone</div>',
	      '<div class="team-chat-row">',
	      '<select data-chat-target aria-label="Message recipient"><option value="all">Everyone</option><option value="host">Host</option><option value="team:mine">My team</option></select>',
	      '<input type="text" maxlength="180" data-chat-input aria-label="Chat message" placeholder="Message host, class, team, or student">',
	      '<button type="button" data-chat-send>Send</button>',
	      '</div>',
	      '<div class="team-chat-emojis" aria-label="Quick emojis">',
	      '<button type="button" data-chat-emoji="👏">👏</button>',
	      '<button type="button" data-chat-emoji="✅">✅</button>',
	      '<button type="button" data-chat-emoji="🙋">🙋</button>',
	      '<button type="button" data-chat-emoji="🔥">🔥</button>',
	      '<button type="button" data-chat-emoji="😂">😂</button>',
	      '</div>',
	      '<div class="team-chat-log" data-chat-log aria-live="polite"></div>',
		      '</section>'
		    ].join("");
		  }

		  function countdownMarkup(hostControls) {
		    return [
		      '<section class="team-countdown-card" data-team-countdown-card>',
		      '<div class="team-countdown-head"><span>Countdown</span><em data-countdown-status>Ready</em></div>',
		      '<div class="team-countdown-display" data-countdown-display>00:00</div>',
		      hostControls ? [
		        '<div class="team-countdown-controls">',
		        '<input type="number" min="0" max="180" step="1" value="5" data-countdown-minutes aria-label="Countdown minutes">',
		        '<input type="number" min="0" max="59" step="1" value="0" data-countdown-seconds aria-label="Countdown seconds">',
	        '<button type="button" data-countdown-start>Start</button>',
	        '<button type="button" data-countdown-stop>Pause</button>',
	        '<button type="button" data-countdown-reset>Reset</button>',
	        '<div class="team-countdown-presets" aria-label="Quick countdown starts">',
	        '<button type="button" data-countdown-preset="30">Start 30s</button>',
	        '<button type="button" data-countdown-preset="60">Start 1m</button>',
	        '<button type="button" data-countdown-preset="120">Start 2m</button>',
	        '<button type="button" data-countdown-preset="300">Start 5m</button>',
	        '</div>',
	        '</div>'
	      ].join("") : "",
		      '</section>'
		    ].join("");
		  }

		  function hostReadinessMarkup() {
		    return [
		      '<div class="team-host-readiness" data-host-readiness aria-label="Host readiness checklist">',
		      hostReadyItemMarkup("admin", "Admin", "Detected"),
		      hostReadyItemMarkup("room", "Room", "Choose Webex"),
		      hostReadyItemMarkup("devices", "Camera / mic", "Check"),
		      hostReadyItemMarkup("webex", "Webex host", "Not live"),
		      hostReadyItemMarkup("countdown", "Countdown", "Ready"),
		      hostReadyItemMarkup("teams", "Teams", "Waiting"),
		      hostReadyItemMarkup("session", "Session", "Not ready"),
		      '</div>'
		    ].join("");
		  }

		  function hostReadyItemMarkup(key, label, detail) {
		    return '<div class="team-host-ready-item" data-ready-key="' + escapeAttr(key) + '" data-state="off"><span><b>' + escapeHtml(label) + '</b><small>' + escapeHtml(detail) + '</small></span></div>';
		  }

		  function volumeControlsMarkup() {
		    return [
		      '<section class="team-volume-controls" data-team-volume-controls>',
		      '<h4>Audio</h4>',
		      '<div class="team-volume-row">',
		      '<span>Effects</span>',
		      '<input type="range" min="0" max="100" step="1" data-effects-volume aria-label="Game sound effects volume">',
		      '<button type="button" data-effects-mute aria-pressed="false">Mute</button>',
		      '</div>',
		      '<div class="team-volume-row">',
		      '<span>Speakers</span>',
		      '<input type="range" min="0" max="100" step="1" data-speaker-volume aria-label="Webex speaker volume">',
		      '<button type="button" data-speaker-mute aria-pressed="false">Mute</button>',
		      '</div>',
		      '</section>'
		    ].join("");
		  }

		  function avatarStudioModalMarkup() {
	    return [
	      '<div class="team-avatar-studio-modal" data-avatar-studio-modal aria-hidden="true">',
	      '<div class="team-avatar-studio-dialog" role="dialog" aria-modal="true" aria-label="Avatar Studio">',
	      '<div class="team-avatar-studio-head"><span>Avatar Studio</span><button type="button" data-avatar-studio-close>Close</button></div>',
	      '<div class="team-avatar-studio-unavailable" data-avatar-studio-unavailable>Avatar Studio is not available inside this live room yet. Keep your current avatar and stay in class.</div>',
	      '<iframe data-avatar-studio-frame title="MissionMed Avatar Studio" loading="lazy"></iframe>',
	      '</div>',
	      '</div>'
	    ].join("");
	  }

  function assignmentModalMarkup() {
    return [
      '<div class="team-assignment-modal" data-team-assignment-modal aria-hidden="true">',
      '<div class="team-assignment-dialog" role="dialog" aria-modal="true" aria-label="Assign Team Challenge students">',
      '<div class="team-assignment-head">',
      '<h3>Assign Teams</h3>',
      '<div class="team-assignment-head-actions">',
      '<button type="button" data-auto-assign>Balance Teams</button>',
      '<button type="button" data-team-assign-close>Close</button>',
      '</div>',
      '</div>',
      '<div class="team-assignment-board">',
      '<section class="team-assignment-zone" data-assign-drop="blue"><h4>Beta Blockers <span data-modal-team-count="blue">0</span></h4><p class="team-assignment-instructions">Drop students here for the blue team.</p><div class="team-assignment-list" data-assignment-team="blue"></div></section>',
      '<section class="team-assignment-pool"><h4>Roster</h4><p class="team-assignment-instructions">Drag students into a team, or use the single left/right arrows.</p><div class="team-assignment-list" data-team-assignment-list></div></section>',
      '<section class="team-assignment-zone" data-assign-drop="red"><h4>Red Blood Cells <span data-modal-team-count="red">0</span></h4><p class="team-assignment-instructions">Drop students here for the red team.</p><div class="team-assignment-list" data-assignment-team="red"></div></section>',
      '</div>',
      '</div>',
      '</div>'
    ].join("");
  }

  function loadGuestProfile() {
    try {
      var raw = window.localStorage && window.localStorage.getItem(guestStorageKey);
      var parsed = raw ? JSON.parse(raw) : {};
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch (error) {
      return {};
    }
  }

  function saveGuestProfile(profile) {
    try {
      if (window.localStorage) {
        window.localStorage.setItem(guestStorageKey, JSON.stringify(profile || {}));
      }
    } catch (error) {
      // Local storage is best-effort only for guest roster identity.
    }
  }

  function loadActiveGuestRosterId() {
    try {
      return String((window.localStorage && window.localStorage.getItem(activeGuestRosterStorageKey)) || "").trim();
    } catch (error) {
      return "";
    }
  }

  function saveActiveGuestRosterId(guestId) {
    activeGuestRosterId = String(guestId || "").trim();
    try {
      if (window.localStorage) {
        if (activeGuestRosterId) {
          window.localStorage.setItem(activeGuestRosterStorageKey, activeGuestRosterId);
        } else {
          window.localStorage.removeItem(activeGuestRosterStorageKey);
        }
      }
    } catch (error) {
      // Active guest identity is best-effort UI state only.
    }
  }

  function setGuestWatching(value) {
    try {
      if (window.localStorage) {
        if (value) {
          window.localStorage.setItem(watchingStorageKey, String(state && state.sessionId || "pending"));
        } else {
          window.localStorage.removeItem(watchingStorageKey);
        }
      }
    } catch (error) {
      // Local watching state is only used to keep the prompt out of the way.
    }
  }

  function guestIsWatching() {
    try {
      var watchedSession = String((window.localStorage && window.localStorage.getItem(watchingStorageKey)) || "");
      var currentSession = String(state && state.sessionId || "");
      return !!(watchedSession && currentSession && watchedSession === currentSession);
    } catch (error) {
      return false;
    }
  }

  function ensureGuestId(profile) {
    profile = profile || {};
    if (!profile.id) {
      profile.id = "guest-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
    }
    return profile.id;
  }

	  function chatTargetKey(context) {
	    return chatTargetStorageKey + ":" + String(context || "student");
	  }

	  function loadPreferredChatTarget(context) {
	    try {
	      return String((window.localStorage && window.localStorage.getItem(chatTargetKey(context))) || "").trim();
	    } catch (error) {
	      return "";
	    }
	  }

	  function rememberChatTarget(context, value) {
	    var target = String(value || "all").trim() || "all";
	    try {
	      if (window.localStorage) {
	        window.localStorage.setItem(chatTargetKey(context), target);
	      }
	    } catch (error) {
	      // Recipient memory is a convenience only; chat still sends normally.
	    }
	  }

	  function loadScoreLedger() {
	    try {
	      var raw = window.localStorage && window.localStorage.getItem(scoreLedgerStorageKey);
	      var parsed = raw ? JSON.parse(raw) : {};
	      return parsed && typeof parsed === "object" ? parsed : {};
	    } catch (error) {
	      return {};
	    }
	  }

	  function saveScoreLedger(ledger) {
	    try {
	      if (window.localStorage) {
	        window.localStorage.setItem(scoreLedgerStorageKey, JSON.stringify(ledger || {}));
	      }
	    } catch (error) {
	      // Score ledger is best-effort client continuity between roster changes.
	    }
	  }

	  function clearScoreLedger() {
	    try {
	      if (window.localStorage) {
	        window.localStorage.removeItem(scoreLedgerStorageKey);
	      }
	    } catch (error) {}
	  }

	  function scoreLedgerKeyForStudent(student) {
	    var id = String(student && student.id ? student.id : "").trim();
	    if (id) return id;
	    if (student && student.userId) return "u" + String(student.userId);
	    return "";
	  }

	  function scoreSnapshot(student) {
	    return {
	      points: Math.max(0, Number(student && student.points || 0)),
	      attempts: Math.max(0, Number(student && student.attempts || 0)),
	      questionsAsked: Math.max(0, Number(student && (student.questionsAsked || student.attempts) || 0)),
	      updatedAt: Date.now()
	    };
	  }

	  function preserveParticipantScore(student) {
	    var key = scoreLedgerKeyForStudent(student);
	    var snapshot;
	    var ledger;
	    if (!key) return;
	    snapshot = scoreSnapshot(student);
	    ledger = loadScoreLedger();
	    if (!snapshot.points && !snapshot.attempts && !snapshot.questionsAsked) {
	      delete ledger[key];
	    } else {
	      ledger[key] = snapshot;
	    }
	    saveScoreLedger(ledger);
	  }

	  function storeParticipantScore(student) {
	    var key = scoreLedgerKeyForStudent(student);
	    var snapshot;
	    var ledger;
	    if (!key) return;
	    snapshot = scoreSnapshot(student);
	    ledger = loadScoreLedger();
	    if (!snapshot.points && !snapshot.attempts && !snapshot.questionsAsked) {
	      delete ledger[key];
	    } else {
	      ledger[key] = snapshot;
	    }
	    saveScoreLedger(ledger);
	  }

	  function persistScoreLedgerFromState(targetState) {
	    if (!targetState || !Array.isArray(targetState.teams)) return;
	    targetState.teams.forEach(function (team) {
	      (team.students || []).forEach(preserveParticipantScore);
	    });
	  }

	  function restoreScoreForStudent(student) {
	    var key = scoreLedgerKeyForStudent(student);
	    var snapshot = key ? loadScoreLedger()[key] : null;
	    var changed = false;
	    if (!snapshot) return false;
	    if (Number(snapshot.points || 0) > Number(student.points || 0)) {
	      student.points = Number(snapshot.points || 0);
	      changed = true;
	    }
	    if (Number(snapshot.attempts || 0) > Number(student.attempts || 0)) {
	      student.attempts = Number(snapshot.attempts || 0);
	      changed = true;
	    }
	    if (Number(snapshot.questionsAsked || 0) > Number(student.questionsAsked || 0)) {
	      student.questionsAsked = Number(snapshot.questionsAsked || 0);
	      changed = true;
	    }
	    return changed;
	  }

	  function restoreScoresFromLedger(targetState) {
	    var changed = false;
	    if (!targetState || !Array.isArray(targetState.teams)) return false;
	    targetState.teams.forEach(function (team) {
	      (team.students || []).forEach(function (student) {
	        changed = restoreScoreForStudent(student) || changed;
	      });
	    });
	    return changed;
	  }

		  function fillGuestFields() {
	    var joinbar = document.querySelector("[data-team-challenge-joinbar]");
	    var profile = loadGuestProfile();
	    if (!joinbar || currentUserId) {
	      return;
	    }
	    if (guestFieldsHydrated || guestFieldsDirty) {
	      return;
	    }
		    var name = joinbar.querySelector("[data-guest-name]");
		    var savedName = String(profile.displayName || [profile.firstName || "", profile.lastName || ""].join(" ")).trim();
		    if (name && savedName && !name.value && document.activeElement !== name) {
		      name.value = savedName;
		    }
		    guestFieldsHydrated = true;
		  }

	  function clearGuestFieldInputs() {
	    var joinbar = document.querySelector("[data-team-challenge-joinbar]");
	    var fields;
	    if (!joinbar) {
	      return;
	    }
		    fields = [joinbar.querySelector("[data-guest-name]")];
	    fields.forEach(function (field) {
	      if (field) {
	        field.value = "";
	      }
	    });
	  }

	  function collectGuestPayload() {
	    var joinbar = document.querySelector("[data-team-challenge-joinbar]");
	    var profile = loadGuestProfile();
	    var nameInput = joinbar && joinbar.querySelector("[data-guest-name]");
	    var displayName = nameInput ? nameInput.value.replace(/\s+/g, " ").trim() : "";
	    var nameLength = Array.from(displayName).length;

	    if (nameLength < 2 || nameLength > 60) {
	      renderStatus(nameLength > 60 ? "Use a name with 60 characters or fewer." : "Enter the name you want the host to see.");
	      if (nameInput) nameInput.focus();
	      return null;
	    }

		    var nameParts = displayName.split(" ");
		    profile.displayName = displayName;
		    profile.firstName = nameParts.shift() || displayName;
		    profile.lastName = nameParts.join(" ");
		    delete profile.email;
		    profile.id = ensureGuestId(profile);
	    saveGuestProfile(profile);
	    saveActiveGuestRosterId(profile.id);
	    guestFieldsDirty = false;
	    guestFieldsHydrated = true;

	    return {
	      guestId: profile.id,
	      displayName: displayName,
	      firstName: profile.firstName,
	      lastName: profile.lastName
		    };
	  }

		  function collectAccountPayload() {
		    var joinbar = document.querySelector("[data-team-challenge-joinbar]");
		    var first = joinbar && joinbar.querySelector("[data-account-first]");
		    var last = joinbar && joinbar.querySelector("[data-account-last]");
		    var email = joinbar && joinbar.querySelector("[data-account-email]");
		    var password = joinbar && joinbar.querySelector("[data-account-password]");
		    var firstName = first ? first.value.trim() : "";
		    var lastName = last ? last.value.trim() : "";
		    var emailValue = email ? email.value.trim() : "";
		    var passwordValue = password ? password.value : "";

		    if (!firstName || !lastName || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailValue)) {
		      renderStatus("Enter first name, last name, and email to create your free account.");
		      if (!firstName && first) {
		        first.focus();
		      } else if (!lastName && last) {
		        last.focus();
		      } else if (email) {
		        email.focus();
		      }
		      return null;
		    }

		    if (passwordValue.length < 8) {
		      renderStatus("Use a password with at least 8 characters.");
		      if (password) {
		        password.focus();
		      }
		      return null;
		    }

		    return {
		      action: "create_account_join",
		      firstName: firstName,
		      lastName: lastName,
		      email: emailValue,
		      password: passwordValue
		    };
		  }

		  function submitCreateAccountJoin(button) {
		    var payload = collectAccountPayload();
		    if (!payload) {
		      return;
		    }

		    if (button) {
		      button.disabled = true;
		      button.textContent = "Creating...";
		    }
		    pendingActions += 1;
		    renderStatus("Creating your account and opening the live room...");
		    requestState("POST", payload).then(function (nextState) {
		      state = normalizeState(nextState);
		      lastConfirmedState = cloneState(state);
		      updateMeetingConfigFromState(nextState);
		      clearAccountPasswordField();
		      renderState();
		      renderStatus("Account created. You are on the roster and the live room is opening.");
		      startStudentWebexAfterChoice("play");
		    }).catch(function (error) {
		      renderStatus(error.message || "Could not create the account. Enter as guest for this round.");
		    }).then(function () {
		      pendingActions = Math.max(0, pendingActions - 1);
		      if (button) {
		        button.disabled = false;
		        button.textContent = "Create account + join live";
		      }
		    });
		  }

		  function wait(ms) {
		    return new Promise(function (resolve) {
		      window.setTimeout(resolve, ms);
		    });
		  }

		  function clearAccountPasswordField() {
		    var password = document.querySelector("[data-team-challenge-joinbar] [data-account-password]");
		    if (password) {
		      password.value = "";
		    }
		  }

			  function submitJoinIn(joinButton) {
	    var payload = currentUserId ? { action: "join_in" } : collectGuestPayload();
	    if (!roomAcceptsEntry()) {
	      renderStatus(entryClosedReason());
	      return Promise.resolve(null);
	    }
	    if (!payload) return Promise.resolve(null);
	    if (!currentUserId) payload.action = "guest_join";
	    if (joinButton) {
	      joinButton.disabled = true;
	      joinButton.textContent = "Joining...";
	    }
	    return sendAction(payload, { optimistic: true, propagateErrors: true }).then(function (nextState) {
	      if (!nextState) return null;
	      setGuestWatching(false);
	      guestEntryMode = false;
	      renderJoinBar();
	      if (lifecycleState(nextState) === "live") {
	        startStudentWebexAfterChoice("play");
	      } else {
	        renderStatus("You are on the roster. The video room will open when the host starts the session.");
	      }
	      return nextState;
	    }).catch(function (error) {
	      guestEntryMode = !currentUserId;
	      renderStatus(error.message || "You were not added. Check your name and try Play again.");
	      return null;
	    }).then(function (result) {
	      if (joinButton) {
	        joinButton.disabled = false;
	        joinButton.textContent = "Play";
	      }
	      return result;
	    });
	  }

	  function submitOptOut(optOutButton) {
	    var payload = currentUserId ? { action: "watch" } : collectGuestPayload();
	    if (!roomAcceptsEntry()) {
	      renderStatus(entryClosedReason());
	      return Promise.resolve(null);
	    }
	    if (!payload) return Promise.resolve(null);
	    if (!currentUserId) payload.action = "guest_watch";
	    if (optOutButton) {
	      optOutButton.disabled = true;
	      optOutButton.textContent = "Joining...";
	    }
	    return sendAction(payload, { optimistic: true, propagateErrors: true }).then(function (nextState) {
	      if (!nextState) return null;
	      setGuestWatching(true);
	      guestEntryMode = false;
	      renderJoinBar();
	      if (lifecycleState(nextState) === "live") {
	        startStudentWebexAfterChoice("watch");
	      } else {
	        renderStatus("You are watching. The video room will open when the host starts the session.");
	      }
	      return nextState;
	    }).catch(function (error) {
	      guestEntryMode = !currentUserId;
	      renderStatus(error.message || "You were not added as a viewer. Check your name and try Watch again.");
	      return null;
	    }).then(function (result) {
	      if (optOutButton) {
	        optOutButton.disabled = false;
	        optOutButton.textContent = "Watch";
	      }
	      return result;
	    });
	  }

		  function handleAdminbarClick(event) {
		    var target = event && event.target;
		    var adminbar = target && target.closest("[data-team-challenge-adminbar]");
		    var winnerButton;
		    var scoreButton;
		    if (!isAdmin || !adminbar) {
		      return false;
		    }

		    if (target.closest("[data-admin-step-tab]")) {
		      setAdminStep(target.closest("[data-admin-step-tab]").getAttribute("data-admin-step-tab"));
		      return true;
		    }

		    var lifecycleButton = target.closest("[data-lifecycle-command]");
		    if (lifecycleButton) {
		      transitionLifecycle(lifecycleButton.getAttribute("data-lifecycle-command"), lifecycleButton);
		      return true;
		    }

		    if (target.closest("[data-floor-diagnostics-toggle]")) {
		      diagnosticsEnabled = !diagnosticsEnabled;
		      renderDiagnostics();
		      renderLifecycle();
		      return true;
		    }

		    scoreButton = target.closest("[data-score]");
		    if (scoreButton) {
		      scoreActive(scoreButton.dataset.score === "correct");
		      return true;
		    }

		    if (target.closest("[data-auto-next-toggle]")) {
		      saveAutoNextEnabled(!autoNextEnabled);
		      return true;
		    }

		    if (target.closest("[data-auto-next]")) {
		      sendAction({ action: "auto_select_next", mode: autoNextMode }, { optimistic: true });
		      return true;
		    }

		    if (target.closest("[data-host-note-save]")) {
		      saveHostNote(false);
		      return true;
		    }

			    if (target.closest("[data-host-note-clear]")) {
			      saveHostNote(true);
			      return true;
			    }

			    if (target.closest("[data-countdown-start]")) {
			      setCountdown("start");
			      return true;
			    }

			    if (target.closest("[data-countdown-preset]")) {
			      startCountdownPreset(target.closest("[data-countdown-preset]"));
			      return true;
			    }

			    if (target.closest("[data-countdown-stop]")) {
			      setCountdown("stop");
			      return true;
			    }

			    if (target.closest("[data-countdown-reset]")) {
			      setCountdown("reset");
			      return true;
			    }

			    if (target.closest("[data-balance-teams]")) {
			      sendAction({ action: "auto_assign" }, { optimistic: true });
			      return true;
		    }

		    if (target.closest("[data-session-start]")) {
		      playStartSound();
		      renderStatus("Team Challenge started.");
		      return true;
		    }

		    if (target.closest("[data-session-title-save]")) {
		      saveSessionTitle();
		      return true;
		    }

		    if (target.closest("[data-meeting-link-save]")) {
		      saveMeetingLinkFromInput();
		      return true;
		    }

		    if (target.closest("[data-meeting-link-clipboard]")) {
		      useCopiedMeetingLink();
		      return true;
		    }

		    if (target.closest("[data-meeting-link-active]")) {
		      useActiveWebexMeeting();
		      return true;
		    }

		    if (target.closest("[data-meeting-link-pmr]")) {
		      usePersonalMeetingRoom();
		      return true;
		    }

		    if (target.closest("[data-meeting-start-now]")) {
		      startWebexNow();
		      return true;
		    }

			    if (target.closest("[data-host-webex-start]")) {
			      openHostWebexMeeting(target.closest("[data-host-webex-start]"));
			      return true;
			    }

		    if (target.closest("[data-scheduled-session-use]")) {
		      selectScheduledSession();
		      return true;
		    }

		    if (target.closest("[data-schedule-session-toggle]")) {
		      toggleScheduleSessionForm();
		      return true;
		    }

		    if (target.closest("[data-scheduled-session-create]")) {
		      scheduleWebexSession();
		      return true;
		    }

		    winnerButton = target.closest("[data-winner]");
		    if (winnerButton) {
		      sendAction({ action: "declare_winner", teamId: winnerButton.dataset.winner }, { optimistic: true });
		      return true;
		    }

		    if (target.closest("[data-reset]")) {
		      sendAction({ action: "reset" }, { optimistic: true });
		      return true;
		    }

		    if (target.closest("[data-undo-score]")) {
		      undoScore();
		      return true;
		    }

		    if (target.closest("[data-team-assign]")) {
		      openAssignmentModal();
		      return true;
		    }

		    return false;
		  }

		  function watchStudentWebexConnection() {
		    var attempts = 0;
		    var watcher = window.setInterval(function () {
		      var embedded = window.MMEDLiveDrillsEmbeddedWebex;
		      var stageStatus = document.querySelector("[data-webex-embed-status]");
		      attempts += 1;
		      if (stageStatus && stageStatus.getAttribute("data-state") === "error") {
		        window.clearInterval(watcher);
		        studentWebexOpened = false;
		        setStudentWebexCtaState("Retry video room", "You remain in this round", false);
		        renderStatus("You are still in the room. Tap Retry video room, or ask the host for the external join link.");
		        return;
		      }
		      if (embedded && typeof embedded.hasMeetingMedia === "function" && embedded.hasMeetingMedia()) {
		        window.clearInterval(watcher);
		        setStudentWebexCtaState("Video connected", "You are in the live room", true);
		        renderStatus("You are in the live room and ready for Dr J Drills LIVE.");
		        return;
		      }
		      if (embedded && typeof embedded.hasJoinControl === "function" && embedded.hasJoinControl()) {
		        setStudentWebexCtaState("Tap Join above", "One final browser confirmation is required", false);
		        renderStatus("The video room is ready. Tap Join in the video stage once to enter.");
		        return;
		      }
		      if (attempts >= 12) {
		        window.clearInterval(watcher);
		        studentWebexOpened = false;
		        setStudentWebexCtaState("Retry video room", "You remain in this round", false);
		        renderStatus("You are still in the room. Tap Retry video room if the stage did not load, or ask the host for help.");
		      }
		    }, 1000);
		  }

		  function startStudentWebexAfterChoice(choice) {
		    var source;
		    var embedded;
		    if (isAdmin) {
		      return;
		    }
		    source = choice === "watch" ? "student_watch_choice" : "student_play_choice";
		    studentWebexOpened = true;
		    setStudentWebexCtaState("Opening video room...", "Check the stage above", true);
		    renderStatus(choice === "watch" ? "Opening the live room as a viewer..." : "Opening the live room for your team...");

		    embedded = window.MMEDLiveDrillsEmbeddedWebex;
			    if (embedded && typeof embedded.hasJoinControl === "function" && embedded.hasJoinControl() && typeof embedded.clickJoinNow === "function") {
			      if (embedded.clickJoinNow()) {
		        setStudentWebexCtaState("Joining now", "The room is opening in the video stage", true);
			        watchStudentWebexConnection();
			        return;
			      }
			    }

		    if (embedded && typeof embedded.start === "function") {
		      embedded.start({
		        allowAdmin: false,
		        hostMode: false,
		        autoClickJoin: true,
		        forceTokenRefresh: true,
		        source: source
		      });
			      watchStudentWebexConnection();
			      return;
			    }
		    if (window.MMEDLiveDrillsSDKV3 && typeof window.MMEDLiveDrillsSDKV3.startGuest === "function") {
		      Promise.resolve(window.MMEDLiveDrillsSDKV3.startGuest({ source: source })).catch(function (error) {
		        studentWebexOpened = false;
		        setStudentWebexCtaState("Retry video room", "Video did not open automatically", false);
		        renderStatus(error && error.message ? error.message : "The video room could not open automatically. Use the stage control to retry.");
		      });
		      return;
		    }
		    studentWebexOpened = false;
		    setStudentWebexCtaState("Enter video room", "Video did not open automatically", false);
		    renderStatus(choice === "watch" ? "You are set to watch. The video room is still loading; use the stage control to retry." : "You are on the roster. The video room is still loading; use the stage control to retry.");
		  }

		  function setStudentWebexCtaState(label, sublabel, disabled) {
		    var button = document.querySelector("[data-student-webex-enter]");
		    var text = String(label || "Enter video room");
		    var detail = String(sublabel || "Join the host in the live video room");
		    if (!button) {
		      return;
		    }
		    button.disabled = !!disabled;
		    button.innerHTML = escapeHtml(text) + "<span>" + escapeHtml(detail) + "</span>";
		  }

		  function enterStudentWebexFromPanel(button) {
		    var joined = currentUserIsOnRoster();
		    var watching = !joined && guestIsWatching();
		    var choice = watching ? "watch" : "play";
		    if (!joined && !watching) {
		      renderStatus("Choose Play or Watch first, then enter the video room.");
		      return;
		    }
		    if (button) {
		      setStudentWebexCtaState("Opening video room...", "Check the stage above", true);
		      window.setTimeout(function () {
		        if (!button || !button.isConnected) {
		          return;
		        }
		        setStudentWebexCtaState("Video opened above", "Tap only if the room did not load", false);
		      }, 5000);
		    }
		    renderStatus("Opening the video room in the stage...");
		    startStudentWebexAfterChoice(choice);
		  }

	  function bindControls() {
	    document.addEventListener("click", function (event) {
	      var hostIntroButton = event.target && event.target.closest("[data-start-embedded-webex][data-admin-browser-join]");
	      if (!hostIntroButton || !isAdmin) {
	        return;
	      }
	      event.preventDefault();
	      event.stopPropagation();
	      if (typeof event.stopImmediatePropagation === "function") {
	        event.stopImmediatePropagation();
	      }
	      openHostWebexMeeting(legacyShell.querySelector("[data-host-webex-start]") || hostIntroButton);
	    }, true);

	    document.addEventListener("click", function (event) {
		      var guestFocusButton = event.target && event.target.closest("[data-account-guest-focus]");
		      if (guestFocusButton) {
		        event.preventDefault();
		        focusGuestFields();
		        return;
		      }

		      var createAccountButton = event.target && event.target.closest("[data-account-create-join]");
		      if (createAccountButton) {
		        event.preventDefault();
		        submitCreateAccountJoin(createAccountButton);
		        return;
		      }

	      var avatarOpenButton = event.target && event.target.closest("[data-avatar-studio-open]");
	      if (avatarOpenButton) {
	        event.preventDefault();
	        openAvatarStudio();
	        return;
	      }

		      var studentWebexButton = event.target && event.target.closest("[data-student-webex-enter]");
		      if (studentWebexButton) {
		        event.preventDefault();
		        enterStudentWebexFromPanel(studentWebexButton);
		        return;
		      }

	      if (event.target && event.target.closest("[data-avatar-studio-close]")) {
	        event.preventDefault();
	        closeAvatarStudio();
	        return;
	      }

	      var avatarModal = document.querySelector("[data-avatar-studio-modal]");
	      if (avatarModal && avatarModal.classList.contains("is-open") && event.target === avatarModal) {
	        closeAvatarStudio();
	        return;
	      }

	      var emojiButton = event.target && event.target.closest("[data-chat-emoji]");
	      if (emojiButton) {
	        event.preventDefault();
	        appendChatEmoji(emojiButton);
	        return;
	      }

	      var chatButton = event.target && event.target.closest("[data-chat-send]");
		      if (chatButton) {
		        event.preventDefault();
		        sendChatMessage(chatButton);
		        return;
		      }

		      var volumeMuteButton = event.target && event.target.closest("[data-effects-mute],[data-speaker-mute]");
		      if (volumeMuteButton) {
		        event.preventDefault();
		        toggleVolumeMute(volumeMuteButton);
		        return;
		      }

		      var joinButton = event.target && event.target.closest("[data-team-challenge-joinbar] [data-join-in]");
	      if (joinButton) {
	        event.preventDefault();
	        submitJoinIn(joinButton);
	        return;
      }

	      var optOutButton = event.target && event.target.closest("[data-team-challenge-joinbar] [data-opt-out]");
		      if (optOutButton) {
		        event.preventDefault();
		        submitOptOut(optOutButton);
		        return;
		      }

		      if (handleAdminbarClick(event)) {
		        event.preventDefault();
		        return;
		      }
		    });

		    document.addEventListener("input", function (event) {
		      if (event.target && event.target.closest("[data-team-challenge-joinbar] [data-guest-name]")) {
		        guestFieldsDirty = true;
		      }
		      if (event.target && event.target.matches("[data-effects-volume],[data-speaker-volume]")) {
		        updateVolumeFromInput(event.target);
		      }
		    }, true);

	    legacyShell.addEventListener("click", function (event) {
	      if (event.target && event.target.closest("[data-team-challenge-adminbar],[data-team-challenge-joinbar]")) {
	        return;
	      }
	      var joinButton = event.target.closest("[data-join-in]");
	      if (joinButton) {
	        submitJoinIn(joinButton);
        return;
      }
      var optOutButton = event.target.closest("[data-opt-out]");
      if (optOutButton) {
        submitOptOut(optOutButton);
        return;
      }

      if (!isAdmin) {
        return;
      }

      var studentButton = event.target.closest("[data-team-student]");
      if (studentButton) {
        sendAction({
          action: "select_student",
          teamId: studentButton.dataset.teamId,
          studentId: studentButton.dataset.studentId
        }, { optimistic: true });
        return;
      }

      var scoreButton = event.target.closest("[data-score]");
      if (scoreButton) {
        scoreActive(scoreButton.dataset.score === "correct");
        return;
      }

	      if (event.target.closest("[data-auto-next-toggle]")) {
	        saveAutoNextEnabled(!autoNextEnabled);
	        return;
	      }

	      if (event.target.closest("[data-auto-next]")) {
	        sendAction({ action: "auto_select_next", mode: autoNextMode }, { optimistic: true });
	        return;
	      }

	      if (event.target.closest("[data-host-note-save]")) {
	        saveHostNote(false);
	        return;
	      }

	      if (event.target.closest("[data-host-note-clear]")) {
	        saveHostNote(true);
	        return;
	      }

      if (event.target.closest("[data-balance-teams]")) {
        sendAction({ action: "auto_assign" }, { optimistic: true });
        return;
      }

      if (event.target.closest("[data-session-start]")) {
        playStartSound();
        renderStatus("Team Challenge started.");
        return;
      }

      if (event.target.closest("[data-session-title-save]")) {
        saveSessionTitle();
        return;
      }

      if (event.target.closest("[data-meeting-link-save]")) {
        saveMeetingLinkFromInput();
        return;
      }

      if (event.target.closest("[data-meeting-link-clipboard]")) {
        useCopiedMeetingLink();
        return;
      }

	      if (event.target.closest("[data-meeting-link-active]")) {
	        useActiveWebexMeeting();
	        return;
	      }
		      if (event.target.closest("[data-meeting-link-pmr]")) {
		        usePersonalMeetingRoom();
		        return;
		      }
		      if (event.target.closest("[data-meeting-start-now]")) {
		        startWebexNow();
		        return;
		      }
		      if (event.target.closest("[data-host-webex-start]")) {
		        openHostWebexMeeting();
		        return;
		      }

      if (event.target.closest("[data-scheduled-session-use]")) {
        selectScheduledSession();
        return;
      }

      if (event.target.closest("[data-schedule-session-toggle]")) {
        toggleScheduleSessionForm();
        return;
      }

      if (event.target.closest("[data-scheduled-session-create]")) {
        scheduleWebexSession();
        return;
      }

      var winnerButton = event.target.closest("[data-winner]");
      if (winnerButton) {
        sendAction({ action: "declare_winner", teamId: winnerButton.dataset.winner }, { optimistic: true });
        return;
      }

	      if (event.target.closest("[data-reset]")) {
	        sendAction({ action: "reset" }, { optimistic: true });
	        return;
	      }

	      if (event.target.closest("[data-undo-score]")) {
	        undoScore();
	        return;
	      }

	      if (event.target.closest("[data-team-assign]")) {
	        openAssignmentModal();
	      }
    });

	    legacyShell.addEventListener("keydown", function (event) {
	      if (event.key === "Enter" && event.target && event.target.matches("[data-chat-input]")) {
	        event.preventDefault();
	        sendChatMessage(event.target.closest("[data-team-chat-box]").querySelector("[data-chat-send]"));
	        return;
	      }
	      if (!isAdmin || event.key !== "Enter") {
	        return;
	      }
      if (event.target && event.target.matches("[data-session-title-input]")) {
        saveSessionTitle();
      }
      if (event.target && event.target.matches("[data-meeting-link-input]")) {
        saveMeetingLinkFromInput();
      }
	      if (event.target && event.target.matches("[data-scheduled-title],[data-scheduled-start],[data-scheduled-duration]")) {
	        scheduleWebexSession();
	      }
	      if (event.target && event.target.matches("[data-countdown-minutes],[data-countdown-seconds]")) {
	        setCountdown("start");
	      }
	    });

		    document.addEventListener("keydown", function (event) {
		      if (event.key === "Enter" && event.target && event.target.matches("[data-team-challenge-joinbar] [data-account-first],[data-team-challenge-joinbar] [data-account-last],[data-team-challenge-joinbar] [data-account-email],[data-team-challenge-joinbar] [data-account-password]")) {
		        event.preventDefault();
		        submitCreateAccountJoin(document.querySelector("[data-account-create-join]"));
		        return;
		      }
		      if (event.key === "Enter" && event.target && event.target.matches("[data-team-challenge-joinbar] [data-chat-input]")) {
		        event.preventDefault();
		        sendChatMessage(event.target.closest("[data-team-chat-box]").querySelector("[data-chat-send]"));
	        return;
	      }
	      if (!isAdmin || event.metaKey || event.ctrlKey || event.altKey || isTypingTarget(event.target)) {
	        return;
      }
      var key = String(event.key || "").toLowerCase();
      if (key === "c") {
        event.preventDefault();
        scoreActive(true);
      }
	      if (key === "m") {
	        event.preventDefault();
	        scoreActive(false);
	      }
	      if (key === "u") {
	        event.preventDefault();
	        undoScore();
	      }
		    });

	    document.addEventListener("change", function (event) {
	      var chatTarget = event.target && event.target.closest("[data-chat-target]");
	      var box;
	      var context;
	      if (chatTarget) {
	        box = chatTarget.closest("[data-team-chat-box]");
	        context = box ? box.getAttribute("data-chat-context") : "student";
	        rememberChatTarget(context, chatTarget.value);
	        updateChatTargetStatus(box, chatTarget.value);
	        return;
	      }
	      if (event.target && event.target.closest("[data-auto-next-mode]")) {
	        saveAutoNextMode(event.target.value);
	      }
	    }, true);

	    bindDragAndDrop();

    document.addEventListener("click", function (event) {
      if (event.target.closest("[data-team-assign-close]")) {
        closeAssignmentModal();
        return;
      }

      if (event.target.closest("[data-auto-assign]")) {
        sendAction({ action: "auto_assign" }, { optimistic: true });
        return;
      }

      var assignButton = event.target.closest("[data-assign-target]");
      if (assignButton) {
        sendAction({
          action: "assign_student",
          studentId: assignButton.dataset.studentId,
          targetTeamId: assignButton.dataset.assignTarget
        }, { optimistic: true });
        return;
      }

      var modal = document.querySelector("[data-team-assignment-modal]");
      if (modal && modal.classList.contains("is-open") && event.target === modal) {
        closeAssignmentModal();
      }
    });
  }

  function bindDragAndDrop() {
    legacyShell.addEventListener("dragstart", function (event) {
      var studentButton = event.target.closest("[data-team-student]");
      if (!studentButton || !isAdmin) {
        return;
      }
      draggedStudent = {
        teamId: studentButton.dataset.teamId,
        studentId: studentButton.dataset.studentId
      };
      studentButton.classList.add("is-dragging");
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", draggedStudent.studentId);
    });

    legacyShell.addEventListener("dragend", function (event) {
      var studentButton = event.target.closest("[data-team-student]");
      if (studentButton) {
        studentButton.classList.remove("is-dragging");
      }
      clearDropTargets();
      draggedStudent = null;
    });

    legacyShell.addEventListener("dragover", function (event) {
      var list = event.target.closest("[data-team-list]");
      if (!list || !draggedStudent) {
        return;
      }
      event.preventDefault();
      var panel = list.closest(".team-challenge-panel");
      if (panel) {
        panel.classList.add("is-drop-target");
      }
    });

    legacyShell.addEventListener("drop", function (event) {
      var list = event.target.closest("[data-team-list]");
      if (!list || !draggedStudent) {
        return;
      }
      event.preventDefault();
      assignDraggedStudent(list.dataset.teamList, draggedStudent.studentId);
    });

    document.addEventListener("dragstart", function (event) {
      var row = event.target.closest("[data-assignment-student]");
      if (!row || !isAdmin) {
        return;
      }
      draggedAssignmentStudent = row.dataset.studentId || "";
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", draggedAssignmentStudent);
    });

    document.addEventListener("dragover", function (event) {
      var zone = event.target.closest("[data-assign-drop]");
      if (!zone || !draggedAssignmentStudent) {
        return;
      }
      event.preventDefault();
      zone.classList.add("is-drop-target");
    });

    document.addEventListener("dragleave", function (event) {
      var zone = event.target.closest("[data-assign-drop]");
      if (zone && !zone.contains(event.relatedTarget)) {
        zone.classList.remove("is-drop-target");
      }
    });

    document.addEventListener("drop", function (event) {
      var zone = event.target.closest("[data-assign-drop]");
      if (!zone || !draggedAssignmentStudent) {
        return;
      }
      event.preventDefault();
      assignDraggedStudent(zone.dataset.assignDrop, draggedAssignmentStudent);
    });

    document.addEventListener("dragend", function () {
      clearDropTargets();
      draggedAssignmentStudent = null;
    });
  }

  function clearDropTargets() {
    document.querySelectorAll(".is-drop-target").forEach(function (node) {
      node.classList.remove("is-drop-target");
    });
  }

  function assignDraggedStudent(targetTeamId, studentId) {
    clearDropTargets();
    draggedStudent = null;
    draggedAssignmentStudent = null;
    if (!targetTeamId || !studentId) {
      return;
    }
    sendAction({
      action: "assign_student",
      studentId: studentId,
      targetTeamId: targetTeamId
    }, { optimistic: true });
  }

				  function scoreActive(correct) {
				    var useAutoNext = isAutoNextCurrentlyEnabled();
				    sendAction({
				      action: "score",
				      correct: !!correct,
				      autoNext: useAutoNext,
				      autoNextMode: useAutoNext ? autoNextMode : ""
				    }, { optimistic: true });
				  }

		  function isAutoNextCurrentlyEnabled() {
		    var toggle = legacyShell.querySelector("[data-auto-next-toggle]");
		    if (toggle && toggle.getAttribute("aria-pressed") === "true") {
		      autoNextEnabled = true;
		      return true;
		    }
		    try {
		      autoNextEnabled = !!(window.localStorage && window.localStorage.getItem(autoNextEnabledStorageKey) === "1");
		    } catch (error) {}
		    return !!autoNextEnabled;
		  }

	  function isInitialPersonalMeetingRoomUrl(rawUrl) {
	    try {
	      var parsed = new URL(String(rawUrl || ""), window.location.href);
	      return parsed.protocol === "https:" && /(^|\.)webex\.com$/i.test(parsed.hostname) && parsed.pathname.toLowerCase().indexOf("/meet/") !== -1;
	    } catch (error) {
	      return false;
	    }
	  }

	  function undoScore() {
	    sendAction({
	      action: "undo_score"
	    }, { optimistic: true });
	  }

	  function saveSessionTitle() {
    var input = legacyShell.querySelector("[data-session-title-input]");
    if (!input) {
      return;
    }
    sendAction({
      action: "set_session_title",
      title: input.value || ""
    }, { optimistic: true });
  }

  function saveMeetingLinkFromInput() {
    var input = legacyShell.querySelector("[data-meeting-link-input]");
    if (!input) {
      return;
    }
    var rawValue = input.value || "";
    if (isLikelyWebexUrl(rawValue)) {
      setMeetingLink(rawValue);
      return;
    }
    useCopiedMeetingLink();
  }

  function useCopiedMeetingLink() {
    var input = legacyShell.querySelector("[data-meeting-link-input]");
    if (!input) {
      return;
    }

    if (window.navigator && window.navigator.clipboard && window.navigator.clipboard.readText) {
      window.navigator.clipboard.readText().then(function (text) {
        input.value = String(text || "").trim();
        setMeetingLink(input.value);
      }).catch(function () {
        promptForMeetingLink(input);
      });
      return;
    }

    promptForMeetingLink(input);
  }

  function promptForMeetingLink(input) {
    var pasted = window.prompt("Paste the current Webex meeting link:");
    if (pasted === null) {
      return;
    }
    input.value = String(pasted || "").trim();
    setMeetingLink(input.value);
  }

	  function setMeetingLink(rawUrl, titleOverride) {
	    if (!isAdmin) {
	      return;
	    }

	    var joinUrl = String(rawUrl || "").trim();
	    var title = String(titleOverride || "").trim();
	    if (!isLikelyWebexUrl(joinUrl)) {
	      renderStatus("Paste a valid Webex meeting link.");
	      return;
	    }

	    pendingActions += 1;
	    renderStatus(isPersonalMeetingRoomUrl(joinUrl) ? "Saving Personal Meeting Room for browser-host mode..." : "Saving this exact Webex meeting link...");
	    requestState("POST", {
	      action: "set_meeting_link",
	      joinUrl: joinUrl,
	      title: title || (state && state.sessionTitle ? state.sessionTitle : "Live Team Challenge Webex Meeting")
	    }).then(function (nextState) {
	      state = normalizeState(nextState);
	      lastConfirmedState = cloneState(state);
	      updateMeetingConfigFromState(nextState);
	      renderState();
		      renderStatus(isPersonalMeetingRoomUrl(joinUrl) ? "Personal Meeting Room is saved for this live session. Roster kept. Click Start Live Webex Session when ready." : "This exact Webex meeting link is saved. Roster kept. Click Start Live Webex Session when ready.");
	    }).catch(function (error) {
	      renderStatus(error.message || "Could not save Webex meeting link.");
	    }).then(function () {
      pendingActions = Math.max(0, pendingActions - 1);
    });
  }

	  function useActiveWebexMeeting() {
	    if (!isAdmin) {
	      return;
	    }

    pendingActions += 1;
    renderStatus("Looking for a scheduled Webex meeting that is live now...");
    requestState("POST", {
      action: "use_active_meeting"
    }).then(function (nextState) {
      state = normalizeState(nextState);
      lastConfirmedState = cloneState(state);
      updateMeetingConfigFromState(nextState);
      renderState();
	      renderStatus("Scheduled live Webex meeting selected. Roster kept. Click Start Live Webex Session when ready.");
    }).catch(function (error) {
      renderStatus(error.message || "Webex could not see your desktop meeting. Paste the active meeting link, then click Use this link.");
    }).then(function () {
	      pendingActions = Math.max(0, pendingActions - 1);
	    });
	  }

		  function usePersonalMeetingRoom() {
	    if (!isAdmin) {
	      return;
	    }
	    var pmrUrl = String(personalMeetingRoomUrl || "").trim();
	    if (!isLikelyWebexUrl(pmrUrl)) {
	      renderStatus("Personal Meeting Room is not saved yet. Paste the PMR link once, then click Use link.");
	      return;
	    }
	    var input = legacyShell.querySelector("[data-meeting-link-input]");
	    if (input) {
	      input.value = pmrUrl;
	    }
			    setMeetingLink(pmrUrl, "Dr Brian Personal Meeting Room");
			  }

			  function saveMeetingLinkForHostStart(joinUrl, titleOverride) {
			    var title = String(titleOverride || "").trim();
			    pendingActions += 1;
			    renderStatus("Saving selected Webex room before host launch...");
			    return requestState("POST", {
			      action: "set_meeting_link",
			      joinUrl: joinUrl,
			      title: title || (state && state.sessionTitle ? state.sessionTitle : "Live Team Challenge Webex Meeting")
			    }).then(function (nextState) {
			      state = normalizeState(nextState);
			      lastConfirmedState = cloneState(state);
			      updateMeetingConfigFromState(nextState);
			      renderState();
			      renderStatus("Selected Webex room saved. Starting host video...");
			      return nextState;
			    }).catch(function (error) {
			      renderStatus(error.message || "Could not save selected Webex room before host launch.");
			      throw error;
			    }).then(function (nextState) {
			      pendingActions = Math.max(0, pendingActions - 1);
			      return nextState;
			    }, function (error) {
			      pendingActions = Math.max(0, pendingActions - 1);
			      throw error;
			    });
			  }

		  function startWebexNow() {
		    if (!isAdmin) {
		      return;
		    }

		    var titleInput = legacyShell.querySelector("[data-session-title-input]");
		    var title = titleInput && titleInput.value ? String(titleInput.value).trim() : "";
		    if (!title) {
		      title = state && state.sessionTitle ? state.sessionTitle : "Dr J Live Drills";
		    }
		    title = title + " - Browser Room " + new Date().toLocaleTimeString([], {
		      hour: "numeric",
		      minute: "2-digit"
		    });

		    pendingActions += 1;
		    renderStatus("Creating a fresh Webex room for browser-host mode...");
		    requestState("POST", {
		      action: "schedule_session",
		      title: title,
		      startLocal: toDateTimeLocalValue(new Date(Date.now() + 60 * 1000)),
		      durationMinutes: 60
		    }).then(function (nextState) {
		      state = normalizeState(nextState);
		      lastConfirmedState = cloneState(state);
		      updateMeetingConfigFromState(nextState);
		      renderState();
		      renderStatus("Fresh Webex room created and selected. Starting Webex inside the app...");
		      window.setTimeout(openHostWebexMeeting, 500);
		    }).catch(function (error) {
		      renderStatus(error.message || "Could not create a fresh Webex room.");
		    }).then(function () {
		      pendingActions = Math.max(0, pendingActions - 1);
		    });
		  }

			  function setHostStartButtonState(button, label, disabled) {
			    if (!button) {
			      return;
			    }
			    button.textContent = label;
			    button.disabled = !!disabled;
			  }

				  function openHostWebexMeeting(button) {
	    if (!isAdmin) {
	      return;
	    }

		    button = button || legacyShell.querySelector("[data-host-webex-start]");
	    var meeting = (config.meeting && typeof config.meeting === "object") ? config.meeting : {};
	    var input = legacyShell.querySelector("[data-meeting-link-input]");
	    var joinUrl = input && input.value ? String(input.value).trim() : String(meeting.joinUrl || "").trim();
	    if (!isLikelyWebexUrl(joinUrl)) {
	      renderStatus("Choose or paste the Webex meeting first, then click Start Live Webex Session.");
	      setHostStartButtonState(button, "Failed, retry", false);
		      return;
		    }

		    if (String(meeting.joinUrl || "").trim() !== joinUrl) {
		      setHostStartButtonState(button, "Saving room...", true);
		      saveMeetingLinkForHostStart(joinUrl, isPersonalMeetingRoomUrl(joinUrl) ? "Dr Brian Personal Meeting Room" : "").then(function () {
		        window.setTimeout(function () {
		          openHostWebexMeeting(button);
		        }, 250);
		      }).catch(function (error) {
		        setHostStartButtonState(button, "Failed, retry", false);
		        renderStatus(error && error.message ? error.message : "Could not save that Webex room. Choose the room again, then retry.");
		      });
		      return;
		    }

		    if (window.MMEDLiveDrillsSDKV3 && typeof window.MMEDLiveDrillsSDKV3.startHost === "function") {
	      setHostStartButtonState(button, "Starting Webex...", true);
	      renderStatus("Starting Webex inside Daily Drills. Keep desktop Webex muted or closed to avoid echo.");
		      Promise.resolve(window.MMEDLiveDrillsSDKV3.startHost()).then(function () {
		        if (button && window.MMEDLiveDrillsSDKV3 && typeof window.MMEDLiveDrillsSDKV3.status === "function") {
		          var sdkState = window.MMEDLiveDrillsSDKV3.status();
		          setHostStartButtonState(button, sdkState && sdkState.state === "connected" ? "Connected as Host" : "Start Live Webex Session", sdkState && sdkState.state === "connected");
			        if (sdkState && sdkState.state === "connected") {
			          setAdminStep("3");
			        }
		        }
		      }, function (error) {
		        setHostStartButtonState(button, "Failed, retry", false);
		        renderStatus(error && error.message ? error.message : "Browser Webex could not start. Use the Webex app fallback if class is live.");
		      });
	      return;
	    }

    if (window.MMEDLiveDrillsEmbeddedWebex && typeof window.MMEDLiveDrillsEmbeddedWebex.start === "function") {
      window.MMEDLiveDrillsEmbeddedWebex.start({ allowAdmin: true, hostMode: true });
      renderStatus("Joining Webex inside the Daily Drills stage as host with the connected Webex account. Keep the desktop Webex app muted or closed to avoid echo.");
      return;
    }

    renderStatus("In-app Webex video is not ready on this page yet. Use the Webex app fallback if class is live.");
  }

  function toggleScheduleSessionForm() {
    var form = legacyShell.querySelector("[data-schedule-session-form]");
    if (!form) {
      return;
    }
    var nextOpen = form.hasAttribute("hidden");
    form.toggleAttribute("hidden", !nextOpen);
    form.classList.toggle("is-open", nextOpen);
    if (nextOpen) {
      prepareScheduleDefaults();
    }
  }

  function prepareScheduleDefaults() {
    var title = legacyShell.querySelector("[data-scheduled-title]");
    var start = legacyShell.querySelector("[data-scheduled-start]");
    var duration = legacyShell.querySelector("[data-scheduled-duration]");
    if (title && !title.value) {
      title.value = state && state.sessionTitle ? state.sessionTitle : "Dr J Live Drills Team Challenge";
    }
    if (start && !start.value) {
      var date = new Date(Date.now() + 10 * 60 * 1000);
      date.setMinutes(Math.ceil(date.getMinutes() / 5) * 5, 0, 0);
      start.value = toDateTimeLocalValue(date);
    }
    if (duration && !duration.value) {
      duration.value = "60";
    }
  }

  function scheduleWebexSession() {
    if (!isAdmin) {
      return;
    }
    var title = legacyShell.querySelector("[data-scheduled-title]");
    var start = legacyShell.querySelector("[data-scheduled-start]");
    var duration = legacyShell.querySelector("[data-scheduled-duration]");
    var startLocal = start ? String(start.value || "").trim() : "";

    pendingActions += 1;
    renderStatus("Creating scheduled Webex session...");
    requestState("POST", {
      action: "schedule_session",
      title: title ? title.value || "" : "",
      startLocal: startLocal,
      durationMinutes: duration ? duration.value || 60 : 60
    }).then(function (nextState) {
      state = normalizeState(nextState);
      lastConfirmedState = cloneState(state);
      updateMeetingConfigFromState(nextState);
      renderState();
      renderStatus("Scheduled Webex session created. Roster kept. Start students when ready.");
    }).catch(function (error) {
      renderStatus(error.message || "Could not create scheduled Webex session.");
    }).then(function () {
      pendingActions = Math.max(0, pendingActions - 1);
    });
  }

  function selectScheduledSession() {
    if (!isAdmin) {
      return;
    }
	    var select = legacyShell.querySelector("[data-scheduled-session-select]");
	    var sessionId = select ? String(select.value || "").trim() : "";
	    if (sessionId === personalMeetingRoomOptionValue) {
	      usePersonalMeetingRoom();
	      return;
	    }
	    if (!sessionId) {
	      renderStatus("Choose Personal Room or a scheduled Webex session first.");
	      return;
	    }

    pendingActions += 1;
    renderStatus("Selecting scheduled Webex session...");
    requestState("POST", {
      action: "select_session",
      sessionId: sessionId
    }).then(function (nextState) {
      state = normalizeState(nextState);
      lastConfirmedState = cloneState(state);
      updateMeetingConfigFromState(nextState);
      renderState();
      renderStatus("Scheduled Webex session selected. Roster kept. Start students when ready.");
    }).catch(function (error) {
      renderStatus(error.message || "Could not select that scheduled Webex session.");
    }).then(function () {
      pendingActions = Math.max(0, pendingActions - 1);
    });
  }

	  function isLikelyWebexUrl(rawUrl) {
	    try {
	      var parsed = new URL(String(rawUrl || ""), window.location.href);
	      return parsed.protocol === "https:" && /(^|\.)webex\.com$/i.test(parsed.hostname);
	    } catch (error) {
	      return false;
	    }
	  }

	  function isPersonalMeetingRoomUrl(rawUrl) {
	    try {
	      var parsed = new URL(String(rawUrl || ""), window.location.href);
	      return isLikelyWebexUrl(parsed.href) && parsed.pathname.toLowerCase().indexOf("/meet/") !== -1;
	    } catch (error) {
	      return false;
	    }
	  }

  function renderState() {
    if (!state || !Array.isArray(state.teams)) {
      return;
    }

	    renderLifecycle();
	    updateSessionTitle();
	    updateMeetingLabel();
		    syncAdminStepTabs();
		    renderHostNote();
		    updateAutoNextControls();
		    renderCountdown();
		    renderHostReadiness();
		    renderVolumeControls();
		    renderChatTargets();
		    renderChatMessages();
	    var winnerTeamId = state.winner && state.winner.teamId ? state.winner.teamId : "";

    state.teams.forEach(function (team) {
      var list = legacyShell.querySelector('[data-team-list="' + team.id + '"]');
      var total = legacyShell.querySelector('[data-team-total="' + team.id + '"]');
      var title = legacyShell.querySelector('[data-team-title="' + team.id + '"]');
      var count = legacyShell.querySelector('[data-team-count="' + team.id + '"]');
      var panel = legacyShell.querySelector(".team-challenge-panel.is-" + team.id);
      var studentCount = (team.students || []).length;

      if (total) total.textContent = String(team.score || 0);
      if (title) title.textContent = team.name || team.label || team.id;
      if (count) count.textContent = studentCount + (studentCount === 1 ? " player" : " players");
      if (panel) panel.classList.toggle("is-winner", team.id === winnerTeamId);

      if (list) {
        list.innerHTML = "";
        (team.students || []).forEach(function (student) {
          list.appendChild(studentRow(team, student));
        });
      }
    });

	    var active = getActiveStudent();
	    renderActiveAvatar(active);
	    renderJoinBar();
	    renderStudentPanelAvatars();
	    renderAssignmentModal();

    var eventMessage = state.lastEvent && state.lastEvent.message ? state.lastEvent.message : "";
    renderStatus(eventMessage || ((config.copy && config.copy.studentMode) || ""));

    maybeCelebrateWinner(state.winner, !hasRenderedState);
    hasRenderedState = true;
  }

  function detectIncomingFeedback(previousState, nextState) {
    var event = nextState && nextState.lastEvent ? nextState.lastEvent : {};
    var type = String(event.type || "");
    var key;
    var target;
    if (isAdmin || !previousState || !nextState || ["correct", "missed", "undo_score"].indexOf(type) === -1) {
      return null;
    }

    target = scoreFeedbackTarget(previousState, nextState);
    key = [
      type,
      event.updatedAt || nextState.updatedAt || "",
      event.message || "",
      target.teamId || "",
      target.studentId || "",
      target.pointsDelta || 0,
      target.attemptsDelta || 0
    ].join("|");

    if (key === lastFeedbackEventKey) {
      return null;
    }

    lastFeedbackEventKey = key;
    return {
      type: type,
      teamId: target.teamId || "",
      studentId: target.studentId || "",
      correct: type === "correct" || target.pointsDelta > 0,
      message: event.message || ""
    };
  }

  function scoreFeedbackTarget(previousState, nextState) {
    var target = {
      teamId: "",
      studentId: "",
      pointsDelta: 0,
      attemptsDelta: 0
    };
    var lastScore = nextState && nextState.lastScore ? nextState.lastScore : {};
    var active = nextState && nextState.active ? nextState.active : {};
    var previousStudents = {};

    (previousState.teams || []).forEach(function (team) {
      (team.students || []).forEach(function (student) {
        previousStudents[String(student.id || "")] = {
          teamId: team.id || "",
          points: Number(student.points || 0),
          attempts: Number(student.questionsAsked || student.attempts || 0)
        };
      });
    });

    (nextState.teams || []).some(function (team) {
      return (team.students || []).some(function (student) {
        var id = String(student.id || "");
        var previous = previousStudents[id] || null;
        var points = Number(student.points || 0);
        var attempts = Number(student.questionsAsked || student.attempts || 0);
        if (previous && (points !== previous.points || attempts !== previous.attempts)) {
          target.teamId = team.id || previous.teamId || "";
          target.studentId = id;
          target.pointsDelta = points - previous.points;
          target.attemptsDelta = attempts - previous.attempts;
          return true;
        }
        return false;
      });
    });

    target.teamId = target.teamId || String(lastScore.teamId || active.teamId || "");
    target.studentId = target.studentId || String(lastScore.studentId || active.studentId || "");
    return target;
  }

  function playIncomingFeedback(feedback) {
    if (!feedback) {
      return;
    }
    if (feedback.type === "correct") {
      playCorrectSound();
    } else if (feedback.type === "missed") {
      playMissedSound();
    } else if (feedback.type === "undo_score") {
      playUndoSound();
    }
    pulseScoreFeedback(feedback);
    enterRealtimeBurst(4000, false);
  }

  function pulseScoreFeedback(feedback) {
    var total;
    var row;
    if (!feedback) {
      return;
    }
    if (feedback.teamId) {
      total = legacyShell.querySelector('[data-team-total="' + feedback.teamId + '"]');
      pulseElement(total, "is-score-flash", 520);
    }
    if (feedback.studentId) {
      row = findStudentRowElement(feedback.studentId);
      pulseElement(row, feedback.correct ? "is-score-flash" : "is-score-missed", 520);
    }
  }

  function findStudentRowElement(studentId) {
    var rows = Array.prototype.slice.call(legacyShell.querySelectorAll("[data-team-student]"));
    var id = String(studentId || "");
    for (var index = 0; index < rows.length; index += 1) {
      if (String(rows[index].dataset.studentId || "") === id) {
        return rows[index];
      }
    }
    return null;
  }

  function pulseElement(element, className, duration) {
    if (!element) {
      return;
    }
    element.classList.remove(className);
    void element.offsetWidth;
    element.classList.add(className);
    window.setTimeout(function () {
      element.classList.remove(className);
    }, duration || 520);
  }

  function lifecycleAllowedTargets(current) {
    var transitions = {
      idle: ["doors_open", "archived"],
      doors_open: ["idle", "live", "ended"],
      live: ["ended"],
      ended: ["archived"],
      archived: []
    };
    return transitions[current] || [];
  }

  function transitionLifecycle(command, button) {
    var roomState = lifecycleState(state || {});
    var normalized = String(command || "").toLowerCase();
    if (!isAdmin || ["new", "idle", "doors_open", "live", "ended", "archived"].indexOf(normalized) === -1) {
      return;
    }
    if (normalized === "new") {
      var hasSessionData = (state && state.teams || []).some(function (team) {
        return Number(team.score || 0) > 0 || (team.students || []).length > 0;
      });
      if (hasSessionData && !window.confirm("Start a new session? This clears the current roster, scores, chat, and winner.")) {
        return;
      }
    } else if (lifecycleAllowedTargets(roomState).indexOf(normalized) === -1) {
      renderStatus("Use the next available room step shown in the host controls.");
      return;
    }
    if (button) button.disabled = true;
    renderStatus(normalized === "new" ? "Preparing a new session..." : "Updating the room status...");
    sendAction({ action: "session_lifecycle", command: normalized }, { optimistic: false, propagateErrors: true })
      .catch(function (error) {
        renderStatus(error.message || "The room status did not change. Try again.");
      }).then(function () {
        if (button) button.disabled = false;
        renderLifecycle();
      });
  }

  function lifecyclePresentation(roomState) {
    var presentations = {
      idle: {
        label: "Room idle",
        kicker: "Upcoming session",
        title: "The room opens soon",
        copy: "Keep this page open. Play and Watch become available when the host opens the doors."
      },
      doors_open: {
        label: "Doors open",
        kicker: "Doors open",
        title: "Choose Play or Watch",
        copy: "Enter your name below and choose how you want to join this round."
      },
      live: {
        label: "Room live",
        kicker: "Live now",
        title: "Dr J is live",
        copy: "Choose Play or Watch below to enter the live room."
      },
      ended: {
        label: "Session ended",
        kicker: "Session complete",
        title: "This drill has ended",
        copy: "Scores are final. The host will open a new room for the next drill."
      },
      archived: {
        label: "Room archived",
        kicker: "Room closed",
        title: "This session is closed",
        copy: "Return here for the next scheduled Dr J Drills LIVE session."
      }
    };
    return presentations[roomState] || presentations.idle;
  }

  function renderLifecycle() {
    var roomState = lifecycleState(state || {});
    var presentation = lifecyclePresentation(roomState);
    var overlay = legacyShell.querySelector("[data-room-state-overlay]");
    var accepted = roomAcceptsEntry();
    legacyShell.setAttribute("data-room-state", roomState);
    document.body.setAttribute("data-room-state", roomState);
    Array.prototype.slice.call(legacyShell.querySelectorAll("[data-room-state-label]" )).forEach(function (node) {
      node.textContent = presentation.label;
    });
    Array.prototype.slice.call(legacyShell.querySelectorAll("[data-room-state-meta]" )).forEach(function (node) {
      node.textContent = roomState === "live" ? "LIVE" : (roomState === "doors_open" ? "OPEN" : "WAITING");
    });
    if (overlay) {
      var kicker = overlay.querySelector("[data-room-state-kicker]");
      var title = overlay.querySelector("[data-room-state-title]");
      var copy = overlay.querySelector("[data-room-state-copy]");
      if (kicker) kicker.textContent = presentation.kicker;
      if (title) title.textContent = presentation.title;
      if (copy) copy.textContent = presentation.copy;
      overlay.hidden = roomState === "live";
    }
    if (isAdmin) {
      var allowed = lifecycleAllowedTargets(roomState);
      var lifecycleLabel = document.querySelector("[data-lifecycle-label]");
      if (lifecycleLabel) lifecycleLabel.textContent = presentation.label;
      Array.prototype.slice.call(document.querySelectorAll("[data-lifecycle-command]")).forEach(function (button) {
        var command = button.getAttribute("data-lifecycle-command");
        button.setAttribute("aria-current", command === roomState ? "true" : "false");
        button.disabled = command !== "new" && allowed.indexOf(command) === -1;
      });
      var diagnosticsToggle = document.querySelector("[data-floor-diagnostics-toggle]");
      if (diagnosticsToggle) diagnosticsToggle.setAttribute("aria-expanded", diagnosticsEnabled ? "true" : "false");
    }
    return accepted;
  }

	  function renderJoinBar() {
    if (isAdmin) {
      return;
    }

    var joinbar = document.querySelector("[data-team-challenge-joinbar]");
    if (!joinbar) {
      return;
    }

    var joined = currentUserIsOnRoster();
    var watching = !joined && guestIsWatching();
    var prompt = joinbar.querySelector("[data-join-prompt]");
    var joinButton = joinbar.querySelector("[data-join-in]");
    var optOutButton = joinbar.querySelector("[data-opt-out]");
	    var helper = joinbar.querySelector("[data-entry-help]");
	    var roomState = lifecycleState(state || {});
	    var acceptsEntry = roomAcceptsEntry();

	    joinbar.classList.toggle("is-joined", joined);
	    joinbar.classList.toggle("is-watching", watching);
	    joinbar.classList.toggle("is-logged-in", !!currentUserId);
	    joinbar.classList.toggle("is-guest-entry", !!guestEntryMode);
	    joinbar.setAttribute("data-room-state", roomState);
	    fillGuestFields();
	    renderStudentIdentity();

    if (prompt) {
      prompt.innerHTML = joined
	        ? "<b>YOU ARE PLAYING.</b><span>You are on a team roster for scoring.</span>"
        : watching
	          ? "<b>YOU ARE WATCHING.</b><span>You are off the scoring roster for this round.</span>"
	          : acceptsEntry
	            ? "<b>READY TO JOIN?</b><span>Choose Play for a team or Watch from the gallery.</span>"
	            : "<b>ROOM STATUS</b><span>" + escapeHtml(lifecyclePresentation(roomState).copy) + "</span>";
    }
    if (joinButton) {
	      joinButton.textContent = joined ? "Playing" : watching ? "Switch to Play" : "Play";
	      joinButton.disabled = joined || !acceptsEntry;
    }
	    if (optOutButton) {
	      optOutButton.textContent = watching ? "Watching" : "Watch";
	      optOutButton.disabled = watching || !acceptsEntry;
	    }
	    if (helper) {
	      helper.textContent = acceptsEntry ? "Enter your name, then choose Play or Watch." : entryClosedReason();
	    }
	    var videoButton = joinbar.querySelector("[data-student-webex-enter]");
	    if (videoButton && !studentWebexOpened) {
	      videoButton.disabled = roomState !== "live" || (!joined && !watching);
	      setStudentWebexCtaState(roomState === "live" ? "Enter video room" : "Video room opens when live", roomState === "live" ? "Join Dr J in the live stage" : "Keep this page open", videoButton.disabled);
	    }
		  }

		  function normalizeCountdown(raw) {
		    raw = raw && typeof raw === "object" ? raw : {};
		    var duration = Math.max(0, Math.min(10800, Math.floor(Number(raw.durationSeconds || 0))));
		    var endsAt = Math.max(0, Number(raw.endsAtEpoch || 0));
		    var isRunning = raw.isRunning === true && endsAt > 0;
		    return {
		      durationSeconds: duration,
		      endsAtEpoch: endsAt,
		      isRunning: isRunning
		    };
		  }

		  function countdownRemainingSeconds(raw) {
		    var countdown = normalizeCountdown(raw || (state && state.countdown));
		    if (countdown.isRunning && countdown.endsAtEpoch > 0) {
		      return Math.max(0, Math.ceil(countdown.endsAtEpoch - (authoritativeNowMs() / 1000)));
		    }
		    return Math.max(0, countdown.durationSeconds);
		  }

		  function formatCountdown(seconds) {
		    seconds = Math.max(0, Math.floor(Number(seconds || 0)));
		    var minutes = Math.floor(seconds / 60);
		    var secs = seconds % 60;
		    return String(minutes).padStart(2, "0") + ":" + String(secs).padStart(2, "0");
		  }

		  function renderCountdown() {
		    var countdown = normalizeCountdown(state && state.countdown);
		    var remaining = countdownRemainingSeconds(countdown);
		    var isLive = lifecycleState(state || {}) === "live";
		    var expired = countdown.isRunning && remaining <= 0;
		    Array.prototype.slice.call(document.querySelectorAll("[data-team-countdown-card]")).forEach(function (card) {
		      var display = card.querySelector("[data-countdown-display]");
		      var status = card.querySelector("[data-countdown-status]");
		      if (display) {
		        display.textContent = isLive ? "LIVE" : formatCountdown(remaining);
		        display.classList.toggle("is-live", isLive);
		      }
		      if (status) {
		        status.textContent = isLive ? "Live" : (countdown.isRunning && !expired ? "Starting" : (remaining > 0 ? "Paused" : "Ready"));
		      }
		    });
		    syncPlayerTopbarCountdown(countdown, remaining, isLive);
		    updateCountdownInputs(countdown, remaining);
		    renderHostReadiness();
		  }

	  function syncPlayerTopbarCountdown(countdown, remaining, isLive) {
	    var value = isLive ? "LIVE" : ((countdown.isRunning || remaining > 0) ? formatCountdown(remaining) : "READY");
	    var timers = Array.prototype.slice.call(legacyShell.querySelectorAll(".player-topbar > span[data-countdown-synced], .player-topbar > span:last-child"));
	    timers.forEach(function (timer) {
	      if (!timer) {
	        return;
	      }
	      timer.textContent = value;
	      timer.setAttribute("data-countdown-synced", "true");
	    });
	  }

		  function updateCountdownInputs(countdown, remaining) {
		    var minutesInput = legacyShell.querySelector("[data-countdown-minutes]");
		    var secondsInput = legacyShell.querySelector("[data-countdown-seconds]");
		    var value = countdown.isRunning ? remaining : countdown.durationSeconds;
		    if (minutesInput && document.activeElement !== minutesInput) {
		      minutesInput.value = String(Math.floor(value / 60));
		    }
		    if (secondsInput && document.activeElement !== secondsInput) {
		      secondsInput.value = String(value % 60);
		    }
		  }

		  function readCountdownDuration() {
		    var minutesInput = legacyShell.querySelector("[data-countdown-minutes]");
		    var secondsInput = legacyShell.querySelector("[data-countdown-seconds]");
		    var minutes = minutesInput ? Math.max(0, Math.floor(Number(minutesInput.value || 0))) : 0;
		    var seconds = secondsInput ? Math.max(0, Math.floor(Number(secondsInput.value || 0))) : 0;
		    seconds = Math.min(seconds, 59);
		    var total = Math.min(10800, (minutes * 60) + seconds);
		    if (total <= 0 && state && state.countdown) {
		      total = countdownRemainingSeconds(state.countdown) || Number(state.countdown.durationSeconds || 0);
		    }
		    return total > 0 ? total : 300;
		  }

	  function setCountdown(command, overrideDuration) {
	    if (!isAdmin) {
	      return;
	    }
	    var duration = command === "reset" ? 0 : (command === "stop" ? countdownRemainingSeconds(state && state.countdown) : (overrideDuration || readCountdownDuration()));
	    sendAction({
	      action: "set_countdown",
	      command: command,
	      durationSeconds: duration
	    }, { optimistic: true });
	  }

	  function startCountdownPreset(button) {
	    var seconds = Math.max(0, Math.min(10800, Math.floor(Number(button && button.getAttribute("data-countdown-preset") || 0))));
	    var minutesInput = legacyShell.querySelector("[data-countdown-minutes]");
	    var secondsInput = legacyShell.querySelector("[data-countdown-seconds]");
	    if (!seconds) {
	      return;
	    }
	    if (minutesInput) {
	      minutesInput.value = String(Math.floor(seconds / 60));
	    }
	    if (secondsInput) {
	      secondsInput.value = String(seconds % 60);
	    }
	    setCountdown("start", seconds);
	  }

		  function clientCountdownFromPayload(payload, currentCountdown) {
		    var command = String(payload.command || "set");
		    var duration = Math.max(0, Math.min(10800, Math.floor(Number(payload.durationSeconds || 0))));
		    if (command === "start") {
		      duration = duration > 0 ? duration : 300;
		      return {
		        durationSeconds: duration,
		        endsAtEpoch: Math.floor(Date.now() / 1000) + duration,
		        isRunning: true
		      };
		    }
		    if (command === "stop") {
		      return {
		        durationSeconds: duration || countdownRemainingSeconds(currentCountdown),
		        endsAtEpoch: 0,
		        isRunning: false
		      };
		    }
		    if (command === "reset") {
		      return {
		        durationSeconds: 0,
		        endsAtEpoch: 0,
		        isRunning: false
		      };
		    }
		    return {
		      durationSeconds: duration,
		      endsAtEpoch: 0,
		      isRunning: false
		    };
		  }

		  function updateVolumeFromInput(input) {
		    var value = clampVolume(Number(input.value || 0) / 100);
		    if (input.matches("[data-effects-volume]")) {
		      audioPrefs.effectsVolume = value;
		      audioPrefs.effectsMuted = value <= 0 ? true : audioPrefs.effectsMuted;
		    }
		    if (input.matches("[data-speaker-volume]")) {
		      audioPrefs.speakerVolume = value;
		      audioPrefs.speakerMuted = value <= 0 ? true : audioPrefs.speakerMuted;
		    }
		    saveAudioPrefs();
		    renderVolumeControls();
		    applySpeakerVolume();
		  }

		  function toggleVolumeMute(button) {
		    if (button.matches("[data-effects-mute]")) {
		      audioPrefs.effectsMuted = !audioPrefs.effectsMuted;
		    }
		    if (button.matches("[data-speaker-mute]")) {
		      audioPrefs.speakerMuted = !audioPrefs.speakerMuted;
		    }
		    saveAudioPrefs();
		    renderVolumeControls();
		    applySpeakerVolume();
		  }

		  function renderVolumeControls() {
		    Array.prototype.slice.call(document.querySelectorAll("[data-effects-volume]")).forEach(function (input) {
		      if (document.activeElement !== input) {
		        input.value = String(Math.round(audioPrefs.effectsVolume * 100));
		      }
		    });
		    Array.prototype.slice.call(document.querySelectorAll("[data-speaker-volume]")).forEach(function (input) {
		      if (document.activeElement !== input) {
		        input.value = String(Math.round(audioPrefs.speakerVolume * 100));
		      }
		    });
		    Array.prototype.slice.call(document.querySelectorAll("[data-effects-mute]")).forEach(function (button) {
		      button.setAttribute("aria-pressed", audioPrefs.effectsMuted ? "true" : "false");
		      button.textContent = audioPrefs.effectsMuted ? "Muted" : "Mute";
		    });
		    Array.prototype.slice.call(document.querySelectorAll("[data-speaker-mute]")).forEach(function (button) {
		      button.setAttribute("aria-pressed", audioPrefs.speakerMuted ? "true" : "false");
		      button.textContent = audioPrefs.speakerMuted ? "Muted" : "Mute";
		    });
		    Object.keys(soundCache).forEach(function (url) {
		      if (soundCache[url]) {
		        soundCache[url].volume = effectsOutputVolume();
		      }
		    });
		    applySpeakerVolume();
		  }

		  function effectsOutputVolume() {
		    return audioPrefs.effectsMuted ? 0 : clampVolume(audioPrefs.effectsVolume);
		  }

		  function speakerOutputVolume() {
		    return audioPrefs.speakerMuted ? 0 : clampVolume(audioPrefs.speakerVolume);
		  }

		  function applySpeakerVolume() {
		    var volume = speakerOutputVolume();
		    Array.prototype.slice.call(document.querySelectorAll("[data-sdk-v3-remote-audio]")).forEach(function (audio) {
		      audio.volume = volume;
		      audio.muted = audioPrefs.speakerMuted || volume <= 0;
		    });
		    if (window.MMEDLiveDrillsSDKV3 && typeof window.MMEDLiveDrillsSDKV3.setSpeakerVolume === "function") {
		      window.MMEDLiveDrillsSDKV3.setSpeakerVolume(clampVolume(audioPrefs.speakerVolume), !!audioPrefs.speakerMuted);
		    }
		  }

		  function renderStudentPanelAvatars() {
		    if (isAdmin) {
		      return;
		    }
		    var studentCard = document.querySelector('[data-student-panel-avatar="student"]');
		    var drjCard = document.querySelector('[data-student-panel-avatar="drj"]');
		    if (studentCard) {
		      renderStudentAvatarCard(studentCard, viewerStudentEntry(), "Your avatar");
		    }
		    if (drjCard) {
		      renderStudentAvatarCard(drjCard, {
		        team: { id: "red", name: "Dr J Interactive Drill" },
		        student: {
		          id: "dr-j",
		          name: "Dr J",
		          initials: "DJ",
		          avatarSeed: "dr-j-mentor",
		          avatarStyle: "mentor"
		        }
		      }, "Host");
		    }
		  }

		  function renderStudentIdentity() {
		    if (isAdmin) {
		      return;
		    }
		    var node = document.querySelector("[data-student-identity]");
		    if (!node) {
		      return;
		    }
		    if (currentUserId) {
		      node.innerHTML = '<b>Signed in as ' + escapeHtml(currentStudentDisplayName()) + '</b><span>Ready for live drill</span>';
		      return;
		    }
		    var profile = loadGuestProfile();
		    var guestName = [profile.firstName || "", profile.lastName || ""].join(" ").trim();
		    if (guestName) {
		      node.innerHTML = '<b>Guest: ' + escapeHtml(guestName) + '</b><span>Saved for this room</span>';
		      return;
		    }
		    node.innerHTML = '<b>Guest entry</b><span>No account needed</span>';
		  }

		  function viewerStudentEntry() {
		    var profile = loadGuestProfile();
		    var targetId = currentUserId ? "u" + String(currentUserId) : String(profile.id || "");
		    var found = targetId ? findStudent(state, targetId) : null;
		    if (found) {
		      return found;
		    }
		    var name = currentStudentDisplayName();
		    name = name || "You";
		    var avatarFields = currentStudentAvatarFields();
		    return {
		      team: (state && state.teams && state.teams[0]) || { id: "blue", name: "Beta Blockers" },
		      student: {
		        id: targetId || "you",
		        name: name,
		        initials: initialsFromName(name),
		        avatarUrl: avatarFields.avatarUrl || "",
		        avatarFullUrl: avatarFields.avatarFullUrl || "",
		        avatarSource: avatarFields.avatarSource || (currentUserId ? "wordpress_pending" : "guest"),
		        avatarSeed: avatarFields.avatarSeed || targetId || name,
		        avatarStyle: "student"
		      }
		    };
		  }

		  function renderStudentAvatarCard(node, entry, label) {
		    var student = entry && entry.student ? entry.student : { id: "student", name: "You", initials: "Y" };
		    var team = entry && entry.team ? entry.team : { id: "blue", name: "" };
		    node.innerHTML = [
		      '<div class="team-student-avatar-art">',
		      avatarMarkup(student, team, true),
		      '</div>',
		      '<b>' + escapeHtml(student.name || "Student") + '</b>',
		      '<span>' + escapeHtml(label || "") + '</span>'
		    ].join("");
		  }

			  function focusGuestFields() {
		    guestEntryMode = true;
		    guestFieldsDirty = true;
		    guestFieldsHydrated = true;
		    renderJoinBar();
		    clearGuestFieldInputs();
		    var name = document.querySelector("[data-team-challenge-joinbar] [data-guest-name]");
		    if (name) {
		      name.focus();
			      renderStatus("Enter your name, then choose Play or Watch.");
	    }
	  }

	  function updateAutoNextControls() {
	    var toggle = legacyShell.querySelector("[data-auto-next-toggle]");
	    var mode = legacyShell.querySelector("[data-auto-next-mode]");
	    if (toggle) {
	      toggle.setAttribute("aria-pressed", autoNextEnabled ? "true" : "false");
	      toggle.textContent = autoNextEnabled ? "Auto next: on" : "Auto next: off";
	    }
	    if (mode && mode.value !== autoNextMode) {
	      mode.value = autoNextMode;
	    }
	  }

		  function syncAdminStepTabs() {
		    var adminbar = legacyShell.querySelector("[data-team-challenge-adminbar]");
		    if (!adminbar) {
		      return;
		    }
		    if (!/^[123]$/.test(String(activeAdminStep || ""))) {
		      activeAdminStep = "1";
		    }
		    adminbar.setAttribute("data-active-admin-step", activeAdminStep);
		    Array.prototype.slice.call(adminbar.querySelectorAll("[data-admin-step-tab]")).forEach(function (button) {
		      var isActive = button.getAttribute("data-admin-step-tab") === activeAdminStep;
		      button.setAttribute("aria-pressed", isActive ? "true" : "false");
		    });
		    Array.prototype.slice.call(adminbar.querySelectorAll("[data-admin-step]")).forEach(function (panel) {
		      var isActive = panel.getAttribute("data-admin-step") === activeAdminStep;
		      panel.setAttribute("aria-hidden", isActive ? "false" : "true");
		    });
		  }

		  function sdkStatusForReadiness() {
		    try {
		      if (window.MMEDLiveDrillsSDKV3 && typeof window.MMEDLiveDrillsSDKV3.status === "function") {
		        return window.MMEDLiveDrillsSDKV3.status() || {};
		      }
		    } catch (error) {}
		    return {};
		  }

		  function readableTrackLabel(value) {
		    value = String(value || "").trim();
		    if (!value || /not attached|not selected|unknown/i.test(value)) {
		      return "";
		    }
		    return value.replace(/^Active (video|audio) track:\s*/i, "").replace(/^Selected (camera|mic):\s*/i, "");
		  }

		  function hostMeetingReadiness() {
		    var meeting = (config.meeting && typeof config.meeting === "object") ? config.meeting : {};
		    var pmrUrl = String(personalMeetingRoomUrl || "").trim();
		    var joinUrl = String(meeting.joinUrl || "").trim() || (isLikelyWebexUrl(pmrUrl) ? pmrUrl : "");
		    var title = String(meeting.title || "").trim();
		    if (isPersonalMeetingRoomUrl(joinUrl) && (!title || /drills live|team challenge|webex-test|not set/i.test(title))) {
		      title = "Personal Room";
		    }
		    return {
		      joinUrl: joinUrl,
		      title: title || (joinUrl ? "Webex selected" : "Choose Webex")
		    };
		  }

		  function setReadyItem(key, stateName, detail) {
		    Array.prototype.slice.call(document.querySelectorAll('[data-ready-key="' + key + '"]')).forEach(function (node) {
		      var small = node.querySelector("small");
		      node.setAttribute("data-state", stateName || "off");
		      if (small) {
		        small.textContent = detail || "";
		      }
		    });
		  }

		  function renderHostReadiness() {
		    if (!isAdmin) {
		      return;
		    }
		    var sdk = sdkStatusForReadiness();
		    var meeting = hostMeetingReadiness();
		    var roster = allStudentsFromState();
		    var countdown = normalizeCountdown(state && state.countdown);
		    var remaining = countdownRemainingSeconds(countdown);
		    var webexConnected = sdk.state === "connected";
		    var webexHost = webexConnected && sdk.role === "host";
		    var cameraLabel = readableTrackLabel(sdk.activeVideoTrackLabel || sdk.selectedCameraLabel);
		    var micLabel = readableTrackLabel(sdk.activeAudioTrackLabel || sdk.selectedMicLabel);
		    var devicesReady = !!(sdk.hasLocalMedia || cameraLabel || micLabel);
		    var teamsReady = roster.length > 0;
		    var sessionReady = webexHost && teamsReady;

		    setReadyItem("admin", "ready", "Detected");
		    setReadyItem("room", meeting.joinUrl ? "ready" : "warn", meeting.title);
		    setReadyItem("devices", devicesReady ? "ready" : "warn", devicesReady ? "Camera/mic ready" : "Check first");
		    setReadyItem("webex", webexHost ? "ready" : (sdk.state === "loading" ? "warn" : (sdk.state === "failed" ? "error" : "warn")), webexHost ? "Host live" : (sdk.state === "loading" ? "Starting" : (sdk.state === "failed" ? "Retry needed" : "Start Webex")));
		    setReadyItem("countdown", (countdown.isRunning || remaining > 0) ? "ready" : "warn", lifecycleState(state || {}) === "live" ? "Room live" : (remaining > 0 ? formatCountdown(remaining) : "Set time"));
		    setReadyItem("teams", teamsReady ? "ready" : "warn", roster.length + (roster.length === 1 ? " player" : " players"));
		    setReadyItem("session", sessionReady ? "ready" : "warn", sessionReady ? "Ready to run" : "Finish steps");
		  }

	  function saveHostNote(clear) {
	    var input = legacyShell.querySelector("[data-host-note-input]");
	    var note = clear ? "" : (input ? input.value : "");
	    sendAction({ action: "set_host_note", note: note }, { optimistic: true });
	  }

	  function renderHostNote() {
	    var note = String((state && state.hostNote) || "").slice(0, 220);
	    var publicNote = document.querySelector("[data-team-public-note]");
	    var input = legacyShell.querySelector("[data-host-note-input]");
	    if (publicNote) {
	      publicNote.textContent = note;
	      publicNote.classList.toggle("is-visible", !!note);
	    }
	    if (input && document.activeElement !== input && input.value !== note) {
	      input.value = note;
	    }
	  }

	  function openAvatarStudio() {
	    if (!currentUserId) {
	      renderStatus("Create or sign into a free account before opening Avatar Studio.");
	      return;
	    }
	    var modal = document.querySelector("[data-avatar-studio-modal]");
	    var frame = modal && modal.querySelector("[data-avatar-studio-frame]");
	    var unavailable = modal && modal.querySelector("[data-avatar-studio-unavailable]");
	    var studioUrl = String(config.avatarStudioUrl || "").trim();
	    if (!modal || !frame) {
	      return;
	    }
	    if (!studioUrl || /\/homepage-arena\/?$/i.test(studioUrl)) {
	      frame.hidden = true;
	      frame.src = "about:blank";
	      if (unavailable) {
	        unavailable.classList.add("is-visible");
	      }
	      renderStatus("Avatar Studio is not available in this live room. Stay in class with your current avatar.");
	    } else {
	      if (unavailable) {
	        unavailable.classList.remove("is-visible");
	      }
	      frame.hidden = false;
	      frame.src = studioUrl;
	    }
	    modal.classList.add("is-open");
	    modal.setAttribute("aria-hidden", "false");
	  }

	  function closeAvatarStudio() {
	    var modal = document.querySelector("[data-avatar-studio-modal]");
	    var frame = modal && modal.querySelector("[data-avatar-studio-frame]");
	    if (!modal) {
	      return;
	    }
	    modal.classList.remove("is-open");
	    modal.setAttribute("aria-hidden", "true");
	    if (frame) {
	      frame.hidden = false;
	    }
	  }

	  function appendChatEmoji(button) {
	    var box = button && button.closest("[data-team-chat-box]");
	    var input = box && box.querySelector("[data-chat-input]");
	    if (!input) {
	      return;
	    }
	    input.value = (input.value ? input.value + " " : "") + (button.dataset.chatEmoji || "");
	    input.focus();
	  }

	  function sendChatMessage(button) {
	    var box = button && button.closest("[data-team-chat-box]");
	    var input = box && box.querySelector("[data-chat-input]");
	    var target = box && box.querySelector("[data-chat-target]");
	    var profile = loadGuestProfile();
	    var context = box ? box.getAttribute("data-chat-context") : "student";
	    var text = input ? String(input.value || "").trim() : "";
	    if (!text) {
	      renderStatus("Type a short chat message first.");
	      return;
	    }
	    if (target) {
	      rememberChatTarget(context, target.value);
	      updateChatTargetStatus(box, target.value);
	    }
	    sendAction({
	      action: "send_chat_message",
	      message: text,
	      target: target ? target.value : "all",
	      guestId: profile.id || "",
	      firstName: profile.firstName || "",
	      lastName: profile.lastName || ""
	    }, { optimistic: true });
	    if (input) {
	      input.value = "";
	    }
	  }

	  function updateChatTargetStatus(box, value) {
	    var node = box && box.querySelector("[data-chat-target-status]");
	    if (node) {
	      node.textContent = "To " + chatTargetLabel(value || "all");
	    }
	  }

	  function renderChatTargets() {
	    var students = allStudentsFromState();
	    Array.prototype.slice.call(document.querySelectorAll("[data-chat-target]")).forEach(function (select) {
	      var box = select.closest("[data-team-chat-box]");
	      var context = box ? box.getAttribute("data-chat-context") : "student";
	      var stored = loadPreferredChatTarget(context);
	      var previous = select.getAttribute("data-chat-target-hydrated") === "1" ? (select.value || stored || "all") : (stored || select.value || "all");
	      var options = context === "admin"
	        ? [
	            { value: "all", label: "Everyone" },
	            { value: "team:blue", label: "Beta team" },
	            { value: "team:red", label: "Red team" },
	            { value: "active", label: "Active student" }
	          ]
	        : [
	            { value: "all", label: "Everyone" },
	            { value: "host", label: "Host" },
	            { value: "team:mine", label: "My team" }
	          ];
	      students.forEach(function (item) {
	        options.push({ value: "student:" + item.student.id, label: item.student.name || "Student" });
	      });
	      select.innerHTML = options.map(function (item) {
	        return '<option value="' + escapeAttr(item.value) + '">' + escapeHtml(item.label) + '</option>';
	      }).join("");
	      select.value = options.some(function (item) { return item.value === previous; }) ? previous : options[0].value;
	      select.setAttribute("data-chat-target-hydrated", "1");
	      rememberChatTarget(context, select.value);
	      updateChatTargetStatus(box, select.value);
	    });
	  }

	  function renderChatMessages() {
	    var messages = Array.isArray(state && state.chatMessages) ? state.chatMessages.slice(-8) : [];
	    Array.prototype.slice.call(document.querySelectorAll("[data-chat-log]")).forEach(function (log) {
	      if (!messages.length) {
	        log.innerHTML = '<div>No class messages yet.</div>';
	        return;
	      }
	      log.innerHTML = messages.map(function (message) {
	        return '<div><b>' + escapeHtml(message.fromName || "Student") + '</b> <span>to ' + escapeHtml(message.targetLabel || "Everyone") + ':</span> ' + escapeHtml(message.message || "") + '</div>';
	      }).join("");
	    });
	  }

	  function allStudentsFromState() {
	    var result = [];
	    if (!state || !Array.isArray(state.teams)) {
	      return result;
	    }
	    state.teams.forEach(function (team) {
	      (team.students || []).forEach(function (student) {
	        result.push({ team: team, student: student });
	      });
	    });
	    return result;
	  }

  function currentUserIsOnRoster() {
    var targetId = "";
    var guestProfile;
    if (!state || !Array.isArray(state.teams)) {
      return false;
    }

    if (currentUserId) {
      targetId = "u" + String(currentUserId);
    } else {
      guestProfile = loadGuestProfile();
      targetId = guestProfile && guestProfile.id ? String(guestProfile.id) : String(activeGuestRosterId || "");
    }

    if (!targetId) {
      return false;
    }

    for (var teamIndex = 0; teamIndex < state.teams.length; teamIndex += 1) {
      var students = state.teams[teamIndex].students || [];
      for (var studentIndex = 0; studentIndex < students.length; studentIndex += 1) {
        if (String(students[studentIndex].id || "") === targetId) {
          return true;
        }
      }
    }
    return false;
  }

  function updateSessionTitle() {
    var title = state.sessionTitle || "Live Team Challenge";
    var titleNode = legacyShell.querySelector("[data-team-session-title]");
    var input = legacyShell.querySelector("[data-session-title-input]");
    if (titleNode) {
      titleNode.textContent = title;
	  titleNode.hidden = /^dr\s*j\s*drills\s*live$/i.test(String(title).trim());
    }
    if (input && document.activeElement !== input) {
      input.value = title;
    }
  }

		  function updateMeetingLabel() {
		    var meeting = (config.meeting && typeof config.meeting === "object") ? config.meeting : {};
		    var title = meeting.title || "No Webex meeting selected";
		    var label = legacyShell.querySelector("[data-current-meeting-label]");
		    var studentRoomLabels = document.querySelectorAll("[data-student-meeting-lock]");
		    var studentWebexButton = document.querySelector("[data-student-webex-enter]");
		    var input = legacyShell.querySelector("[data-meeting-link-input]");
		    var pmrUrl = String(personalMeetingRoomUrl || "").trim();
		    var effectiveJoinUrl = meeting.joinUrl || (isLikelyWebexUrl(pmrUrl) ? pmrUrl : "");
		    if (isPersonalMeetingRoomUrl(meeting.joinUrl) && (!title || /drills live|team challenge|webex-test|not set/i.test(title))) {
		      title = "Dr Brian Personal Meeting Room";
		    }
		    if (!meeting.joinUrl && isLikelyWebexUrl(pmrUrl)) {
		      title = "Dr Brian Personal Meeting Room";
		    }
		    if (label) {
		      label.textContent = "Meeting: " + title;
		    }
		    Array.prototype.slice.call(studentRoomLabels).forEach(function (node) {
		      var span = node.querySelector("span") || node;
		      var roomState = lifecycleState(state || {});
		      span.textContent = roomState === "live" ? "Video room ready" : (roomState === "doors_open" ? "Doors open - choose Play or Watch" : lifecyclePresentation(roomState).label);
		    });
		    if (studentWebexButton && !studentWebexOpened) {
		      var sublabel = studentWebexButton.querySelector("span");
		      if (sublabel) {
		        sublabel.textContent = lifecycleState(state || {}) === "live" ? "Join Dr J in the live stage" : "Keep this page open";
		      }
		    }
	    if (input && document.activeElement !== input && !input.value && effectiveJoinUrl) {
	      input.value = effectiveJoinUrl;
	    }
	    updateScheduledSessionControls(meeting);
	  }

  function updateMeetingConfigFromState(nextState) {
    if (!nextState || !nextState.meeting || typeof nextState.meeting !== "object") {
      return;
    }

	    config.meeting = Object.assign({}, config.meeting || {}, nextState.meeting);
	    if (config.meeting && isPersonalMeetingRoomUrl(config.meeting.joinUrl)) {
	      personalMeetingRoomUrl = String(config.meeting.joinUrl || "");
	      config.personalMeetingRoomUrl = personalMeetingRoomUrl;
	    }
	    if (window.MMEDLiveDrillsTeamChallengePreview) {
	      window.MMEDLiveDrillsTeamChallengePreview.meeting = Object.assign(
	        {},
	        window.MMEDLiveDrillsTeamChallengePreview.meeting || {},
	        nextState.meeting
	      );
	      window.MMEDLiveDrillsTeamChallengePreview.personalMeetingRoomUrl = personalMeetingRoomUrl;
	    }
    if (!window.MMEDLiveDrillsWebexPreview) {
      window.MMEDLiveDrillsWebexPreview = {
        restUrl: defaultRestUrl(),
        nonce: config.nonce || "",
        widgetLayout: "Stack",
        meeting: {}
      };
    }
    if (window.MMEDLiveDrillsWebexPreview) {
      window.MMEDLiveDrillsWebexPreview.meeting = Object.assign(
        {},
        window.MMEDLiveDrillsWebexPreview.meeting || {},
        nextState.meeting
      );
    }
  }

  function updateScheduledSessionControls(meeting) {
    var select = legacyShell.querySelector("[data-scheduled-session-select]");
    if (!select) {
      return;
    }

	    var currentValue = select.value;
	    var selectedByMeeting = "";
	    select.innerHTML = '<option value="">Choose Webex room...</option>';
	    var pmrUrl = String(personalMeetingRoomUrl || "").trim();
		    if (isLikelyWebexUrl(pmrUrl)) {
		      var pmrOption = document.createElement("option");
		      pmrOption.value = personalMeetingRoomOptionValue;
		      pmrOption.textContent = "Dr Brian Personal Meeting Room";
		      if (meeting && isPersonalMeetingRoomUrl(meeting.joinUrl)) {
		        selectedByMeeting = personalMeetingRoomOptionValue;
		      }
		      if (meeting && !meeting.joinUrl && !currentValue) {
		        selectedByMeeting = personalMeetingRoomOptionValue;
		      }
		      select.appendChild(pmrOption);
		    }
	    scheduledSessions.forEach(function (session) {
	      var option = document.createElement("option");
      option.value = String(session.sessionId || "");
      option.textContent = scheduledSessionLabel(session);
      if (meeting && meeting.joinUrl && session.joinUrl === meeting.joinUrl) {
        selectedByMeeting = option.value;
      }
      select.appendChild(option);
    });

    select.value = currentValue || selectedByMeeting || "";
  }

  function scheduledSessionLabel(session) {
    var title = session && session.title ? String(session.title) : "Live Drills Webex";
    var start = session && session.start ? formatSessionStart(session.start) : "";
    return start ? title + " · " + start : title;
  }

  function formatSessionStart(rawValue) {
    var date = new Date(String(rawValue || ""));
    if (Number.isNaN(date.getTime())) {
      return "";
    }
    return date.toLocaleString([], {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit"
    });
  }

  function toDateTimeLocalValue(date) {
    var pad = function (value) {
      return String(value).padStart(2, "0");
    };
    return [
      date.getFullYear(),
      "-",
      pad(date.getMonth() + 1),
      "-",
      pad(date.getDate()),
      "T",
      pad(date.getHours()),
      ":",
      pad(date.getMinutes())
    ].join("");
  }

  function studentRow(team, student) {
    var active = state.active && state.active.teamId === team.id && state.active.studentId === student.id;
    var mvp = isTeamMvp(team, student);
    var button = document.createElement("button");
    button.type = "button";
    button.className = "team-challenge-student is-" + team.id + (active ? " is-active" : "") + (mvp ? " is-mvp" : "");
    button.disabled = !isAdmin;
    button.draggable = isAdmin;
    button.dataset.teamStudent = "1";
    button.dataset.teamId = team.id;
    button.dataset.studentId = student.id;
    button.innerHTML = [
      '<span class="team-challenge-avatar"></span>',
      '<span class="team-challenge-name"></span>',
      '<span class="team-challenge-asked"></span>',
      '<b class="team-challenge-points"></b>'
    ].join("");
    button.querySelector(".team-challenge-avatar").innerHTML = avatarMarkup(student, team, false);
    button.querySelector(".team-challenge-name").textContent = student.name || "Student";
	    button.querySelector(".team-challenge-asked").innerHTML = "<span>Q</span><strong>" + escapeHtml(String(student.questionsAsked || student.attempts || 0)) + "</strong>";
    button.querySelector(".team-challenge-points").textContent = String(student.points || 0);
    return button;
  }

  function renderActiveAvatar(active) {
    var card = legacyShell.querySelector("[data-team-active-avatar-card]");
    if (!card) {
      return;
    }
    card.remove();
  }

  function avatarMarkup(student, team, large) {
    var src = large ? (student.avatarFullUrl || student.avatarUrl || "") : (student.avatarUrl || student.avatarFullUrl || "");
    if (src && !isDefaultAvatarUrl(src)) {
      return '<img class="team-avatar-real' + (large ? "" : " team-avatar-headshot") + '" src="' + escapeAttr(src) + '" alt="" loading="lazy" decoding="async">';
    }
    var professional = professionalAvatarUrl(student, large);
    if (professional) {
      return '<img class="team-avatar-pro' + (large ? "" : " team-avatar-headshot") + '" src="' + escapeAttr(professional) + '" alt="" loading="lazy" decoding="async">';
    }
    return generatedAvatarMarkup(student, team, large);
  }

  function isDefaultAvatarUrl(src) {
    return /gravatar\.com\/avatar\//i.test(src || "");
  }

  function professionalAvatarUrl(student) {
    var rawBase = String(config.avatarBaseUrl || "");
    if (!rawBase || !professionalAvatarFiles.length) {
      return "";
    }
    var base = rawBase.replace(/\/?$/, "/");
    var seed = hashString((student.avatarSeed || student.id || "") + "|" + (student.name || "") + "|" + (student.avatarStyle || ""));
    var file = professionalAvatarFiles[seed % professionalAvatarFiles.length];
    return base + file;
  }

  function generatedAvatarMarkup(student, team, large) {
    var initials = escapeHtml(student.initials || initialsFromName(student.name || "Student"));
    var seed = hashString((student.id || "") + "|" + (student.name || ""));
    var accent = team && team.id === "red" ? "#ef4444" : "#60a5fa";
    var bg = team && team.id === "red" ? "#7f1d1d" : "#1d4ed8";
    var scaleText = large ? "23" : "24";
    return [
      '<svg class="team-avatar-svg" viewBox="0 0 100 100" role="img" aria-label="' + escapeAttr(student.name || "Student") + ' avatar">',
      '<defs>',
      '<linearGradient id="g' + seed + '" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="' + accent + '"/><stop offset="1" stop-color="' + bg + '"/></linearGradient>',
      '<radialGradient id="r' + seed + '" cx="50%" cy="28%" r="70%"><stop offset="0" stop-color="#ffffff" stop-opacity=".2"/><stop offset=".45" stop-color="#0f172a" stop-opacity=".2"/><stop offset="1" stop-color="#020617" stop-opacity=".72"/></radialGradient>',
      '</defs>',
      '<rect width="100" height="100" rx="' + (large ? "14" : "50") + '" fill="url(#g' + seed + ')"/>',
      '<rect width="100" height="100" rx="' + (large ? "14" : "50") + '" fill="url(#r' + seed + ')"/>',
      '<path d="M50 14l28 14v20c0 20-12 32-28 40-16-8-28-20-28-40V28z" fill="rgba(2,6,23,.56)" stroke="rgba(255,255,255,.35)" stroke-width="2"/>',
      '<text x="50" y="' + (large ? "57" : "58") + '" text-anchor="middle" font-size="' + scaleText + '" fill="#fff">' + initials + '</text>',
      '</svg>'
    ].join("");
  }

  function openAssignmentModal() {
    var modal = document.querySelector("[data-team-assignment-modal]");
    if (!modal) {
      return;
    }
    renderAssignmentModal();
    modal.classList.add("is-open");
    modal.setAttribute("aria-hidden", "false");
  }

  function closeAssignmentModal() {
    var modal = document.querySelector("[data-team-assignment-modal]");
    if (!modal) {
      return;
    }
    modal.classList.remove("is-open");
    modal.setAttribute("aria-hidden", "true");
  }

  function renderAssignmentModal() {
    if (!state || !Array.isArray(state.teams)) {
      return;
    }

    var pool = document.querySelector("[data-team-assignment-list]");
    var blue = document.querySelector('[data-assignment-team="blue"]');
    var red = document.querySelector('[data-assignment-team="red"]');
    if (!pool || !blue || !red) {
      return;
    }

    pool.innerHTML = "";
    blue.innerHTML = "";
    red.innerHTML = "";

    state.teams.forEach(function (team) {
      var count = document.querySelector('[data-modal-team-count="' + team.id + '"]');
      if (count) {
        count.textContent = String((team.students || []).length);
      }
      (team.students || []).forEach(function (student) {
        pool.appendChild(assignmentRow(team, student, "pool"));
        if (team.id === "blue") {
          blue.appendChild(assignmentRow(team, student, "zone"));
        }
        if (team.id === "red") {
          red.appendChild(assignmentRow(team, student, "zone"));
        }
      });
    });
  }

  function assignmentRow(team, student, variant) {
    var row = document.createElement("div");
    row.className = "team-assignment-row" + (variant === "zone" ? " is-zone-row" : "");
    row.draggable = isAdmin;
    row.dataset.assignmentStudent = "1";
    row.dataset.studentId = student.id;
    var actions = variant === "pool" ? [
      assignmentArrow("blue", student.id, "&larr;", "Move student to Beta Blockers"),
      assignmentArrow("red", student.id, "&rarr;", "Move student to Red Blood Cells")
    ] : [
      assignmentArrow(team.id === "blue" ? "red" : "blue", student.id, team.id === "blue" ? "&rarr;" : "&larr;", team.id === "blue" ? "Move student to Red Blood Cells" : "Move student to Beta Blockers")
    ];
    row.innerHTML = [
      '<span class="team-challenge-avatar"></span>',
      '<b></b>',
      actions.join("")
    ].join("");
    row.querySelector(".team-challenge-avatar").innerHTML = avatarMarkup(student, team, false);
	    row.querySelector("b").innerHTML = escapeHtml(student.name || "Student") + (variant === "pool" ? "<small>" + escapeHtml(team.name || team.id) + " - Q " + String(student.questionsAsked || student.attempts || 0) + "</small>" : "");
    return row;
  }

  function assignmentArrow(targetTeamId, studentId, label, ariaLabel) {
    return '<button type="button" class="assign-arrow-' + escapeAttr(targetTeamId) + '" data-assign-target="' + escapeAttr(targetTeamId) + '" data-student-id="' + escapeAttr(studentId) + '" aria-label="' + escapeAttr(ariaLabel) + '">' + label + '</button>';
  }

  function renderStatus(message) {
    var status = legacyShell.querySelector("[data-team-challenge-status]");
    if (status) {
      status.textContent = message || "";
    }
  }

  function getActiveStudent() {
    if (!state || !state.active || !Array.isArray(state.teams)) {
      return null;
    }

    for (var teamIndex = 0; teamIndex < state.teams.length; teamIndex += 1) {
      var team = state.teams[teamIndex];
      var students = team.students || [];
      for (var studentIndex = 0; studentIndex < students.length; studentIndex += 1) {
        var student = students[studentIndex];
        if (state.active.teamId === team.id && state.active.studentId === student.id) {
          return {
            team: team,
            student: student,
            teamIndex: teamIndex,
            studentIndex: studentIndex
          };
        }
      }
    }

    return null;
  }

  function findStudent(targetState, studentId) {
    if (!targetState || !Array.isArray(targetState.teams)) {
      return null;
    }
    for (var teamIndex = 0; teamIndex < targetState.teams.length; teamIndex += 1) {
      var team = targetState.teams[teamIndex];
      for (var studentIndex = 0; studentIndex < (team.students || []).length; studentIndex += 1) {
        var student = team.students[studentIndex];
        if (student.id === studentId) {
          return {
            team: team,
            student: student,
            teamIndex: teamIndex,
            studentIndex: studentIndex
          };
        }
      }
    }
    return null;
  }

	  function addOptimisticParticipant(targetState, payload) {
    if (!targetState || !Array.isArray(targetState.teams) || !targetState.teams.length) {
      return;
    }

    var id = currentUserId ? "u" + String(currentUserId) : String(payload.guestId || "");
    var name = currentStudentDisplayName(payload);
    var avatarFields = currentStudentAvatarFields();
    var targetTeam = targetState.teams[0];

    if (!id || findStudent(targetState, id)) {
      return;
    }

    if (targetState.teams[1] && (targetState.teams[1].students || []).length < (targetTeam.students || []).length) {
      targetTeam = targetState.teams[1];
    }

    if (!Array.isArray(targetTeam.students)) {
      targetTeam.students = [];
    }

    name = name || "Student";
    var student = {
      id: id,
      userId: currentUserId || 0,
      name: name,
      initials: initialsFromName(name),
      points: 0,
      attempts: 0,
      questionsAsked: 0,
      avatarUrl: avatarFields.avatarUrl || "",
      avatarFullUrl: avatarFields.avatarFullUrl || "",
      avatarSource: avatarFields.avatarSource || (currentUserId ? "wordpress_pending" : "guest"),
      avatarSeed: avatarFields.avatarSeed || id,
      isBot: false,
      isGuest: !currentUserId,
      joined: true
    };
    restoreScoreForStudent(student);
    targetTeam.students.push(student);
    recalculateScores(targetState);

    if (!targetState.active || !targetState.active.studentId) {
      targetState.active = {
        teamId: targetTeam.id,
        studentId: id
      };
    }
    targetState.nextTeamId = nextTeamId(targetTeam.id);
    targetState.winner = null;
	    targetState.lastEvent = {
	      type: payload.action,
	      message: name + " joined " + (targetTeam.name || "a team") + "."
	    };
	  }

	  function addOptimisticChatMessage(targetState, payload) {
	    var identity = currentChatIdentity(payload);
	    var target = String(payload.target || "all");
	    if (!Array.isArray(targetState.chatMessages)) {
	      targetState.chatMessages = [];
	    }
	    targetState.chatMessages.push({
	      id: "local-" + Date.now(),
	      fromId: identity.id,
	      fromName: identity.name,
	      fromRole: identity.role,
	      target: target,
	      targetLabel: chatTargetLabel(target),
	      message: String(payload.message || "").slice(0, 180),
	      createdAt: new Date().toISOString()
	    });
	    targetState.chatMessages = targetState.chatMessages.slice(-40);
	    targetState.lastEvent = {
	      type: "send_chat_message",
	      message: identity.name + " sent a class message."
	    };
	  }

	  function currentChatIdentity(payload) {
	    var profile = loadGuestProfile();
	    var name = "";
	    if (isAdmin) {
	      name = "Host";
	    } else if (currentUserId) {
	      name = currentStudentDisplayName(payload);
	    } else {
	      name = [payload.firstName || profile.firstName || "", payload.lastName || profile.lastName || ""].join(" ").trim() || "Guest";
	    }
	    return {
	      id: currentUserId ? "u" + String(currentUserId) : String(payload.guestId || profile.id || "guest"),
	      name: name,
	      role: isAdmin ? "host" : "student"
	    };
	  }

	  function chatTargetLabel(target) {
	    var value = String(target || "all");
	    var student;
	    if (value === "host") return "Host";
	    if (value === "all") return "Everyone";
	    if (value === "active") return "Active student";
	    if (value === "team:blue") return "Beta team";
	    if (value === "team:red") return "Red team";
	    if (value === "team:mine") return "My team";
	    if (value.indexOf("student:") === 0) {
	      student = findStudent(state, value.slice(8));
	      return student && student.student && student.student.name ? student.student.name : "Student";
	    }
	    return "Everyone";
	  }

	  function removeOptimisticParticipant(targetState, payload) {
    if (!targetState || !Array.isArray(targetState.teams)) {
      return;
    }

    var id = currentUserId ? "u" + String(currentUserId) : String(payload.guestId || "");
    var removed = "";

    if (!id) {
      return;
    }

    targetState.teams.forEach(function (team) {
      var students = team.students || [];
      for (var index = students.length - 1; index >= 0; index -= 1) {
        if (String(students[index].id || "") === id) {
          removed = students[index].name || "Student";
          preserveParticipantScore(students[index]);
          students.splice(index, 1);
        }
      }
    });

    if (!removed) {
      return;
    }

    if (targetState.active && targetState.active.studentId === id) {
      targetState.active = firstActive(targetState);
    }
    recalculateScores(targetState);
    targetState.winner = null;
    targetState.lastEvent = {
      type: payload.action,
      message: removed + " is watching this round."
    };
  }

  function firstOtherTeam(targetState, teamId) {
    if (!targetState || !Array.isArray(targetState.teams)) {
      return null;
    }
    for (var index = 0; index < targetState.teams.length; index += 1) {
      if (targetState.teams[index].id !== teamId) {
        return targetState.teams[index];
      }
    }
    return null;
  }

  function moveStudentInState(targetState, studentId, targetTeamId) {
    var found = findStudent(targetState, studentId);
    var targetTeam = null;
    if (!found) {
      return;
    }
    targetState.teams.forEach(function (team) {
      if (team.id === targetTeamId) {
        targetTeam = team;
      }
    });
    if (!targetTeam || found.team.id === targetTeam.id) {
      return;
    }
    found.team.students.splice(found.studentIndex, 1);
    targetTeam.students.push(found.student);
    recalculateScores(targetState);
    targetState.active = {
      teamId: targetTeam.id,
      studentId: found.student.id
    };
    targetState.nextTeamId = nextTeamId(targetTeam.id);
    targetState.lastEvent = {
      type: "assign_student",
      message: found.student.name + " assigned to " + targetTeam.name + "."
    };
  }

  function autoAssignBalanced(targetState, randomize) {
    var students = [];
    var previousActive = targetState.active || {};
    var previousNextTeamId = targetState.nextTeamId || "";
    targetState.teams.forEach(function (team) {
      (team.students || []).forEach(function (student) {
        if (randomize) {
          student.points = 0;
          student.attempts = 0;
          student.questionsAsked = 0;
        }
        students.push(student);
      });
      team.students = [];
    });

    if (randomize) {
      for (var index = students.length - 1; index > 0; index -= 1) {
        var swapIndex = Math.floor(Math.random() * (index + 1));
        var temp = students[index];
        students[index] = students[swapIndex];
        students[swapIndex] = temp;
      }
    }

    students.forEach(function (student, index) {
      var team = targetState.teams[index % targetState.teams.length];
      team.students.push(student);
    });
    recalculateScores(targetState);
    var activeMatch = previousActive.studentId ? findStudent(targetState, previousActive.studentId) : null;
    targetState.active = activeMatch ? {
      teamId: activeMatch.team.id,
      studentId: activeMatch.student.id
    } : firstActive(targetState);
    targetState.nextTeamId = randomize ? "red" : (teamById(targetState, previousNextTeamId) ? previousNextTeamId : nextTeamId((targetState.active || {}).teamId));
    targetState.winner = null;
    targetState.lastEvent = {
      type: "auto_assign",
      message: randomize ? "Teams shuffled and balanced." : "Teams auto-assigned evenly."
    };
  }

  function resetScores(targetState) {
    clearScoreLedger();
    targetState.teams.forEach(function (team) {
      team.score = 0;
      (team.students || []).forEach(function (student) {
        student.points = 0;
        student.attempts = 0;
        student.questionsAsked = 0;
      });
    });
    targetState.winner = null;
    targetState.lastScore = null;
    targetState.lastEvent = {
      type: "reset",
      message: "Scores reset to zero."
    };
  }

	  function chooseNextStudent(targetState, mode) {
	    var preferredTeamId = targetState.nextTeamId || "red";
	    var preferred = teamById(targetState, preferredTeamId);
    if (!preferred || !(preferred.students || []).length) {
      preferred = firstOtherTeam(targetState, preferredTeamId) || (targetState.teams || [])[0];
    }
    if (!preferred || !(preferred.students || []).length) {
      return;
    }

    var minQuestions = Math.min.apply(null, preferred.students.map(function (student) {
      return questionCount(student);
    }));
    var candidates = preferred.students.filter(function (student) {
      return questionCount(student) === minQuestions;
    });
	    var active = targetState.active || {};
	    var chosen = candidates[0];
	    if (mode === "fair_random" && candidates.length > 1) {
	      chosen = candidates[Math.floor(Math.random() * candidates.length)];
	    } else if (candidates.length > 1 && chosen && chosen.id === active.studentId) {
	      chosen = candidates[1];
	    }

    targetState.active = {
      teamId: preferred.id,
      studentId: chosen.id
    };
    targetState.nextTeamId = nextTeamId(preferred.id);
    targetState.lastEvent = {
      type: "auto_select_next",
      message: chosen.name + " is up next for " + preferred.name + "."
    };
  }

  function questionCount(student) {
    return Number((student && (student.questionsAsked || student.attempts)) || 0);
  }

  function teamById(targetState, teamId) {
    for (var index = 0; index < (targetState.teams || []).length; index += 1) {
      if (targetState.teams[index].id === teamId) {
        return targetState.teams[index];
      }
    }
    return null;
  }

  function nextTeamId(teamId) {
    return teamId === "red" ? "blue" : "red";
  }

  function firstActive(targetState) {
    if (!targetState || !Array.isArray(targetState.teams)) {
      return { teamId: "", studentId: "" };
    }
    for (var teamIndex = 0; teamIndex < targetState.teams.length; teamIndex += 1) {
      var team = targetState.teams[teamIndex];
      if (team.students && team.students[0]) {
        return {
          teamId: team.id,
          studentId: team.students[0].id
        };
      }
    }
    return { teamId: "", studentId: "" };
  }

  function recalculateScores(targetState) {
    targetState.teams.forEach(function (team) {
      team.score = (team.students || []).reduce(function (total, student) {
        return total + Number(student.points || 0);
      }, 0);
    });
  }

  function applyWinner(targetState, teamId) {
    var team = teamById(targetState, teamId);
    if (!team) {
      return;
    }
    var mvp = getTeamMvp(team);
    targetState.winner = {
      teamId: team.id,
      teamName: team.name,
      mvpStudentId: mvp ? mvp.id : "",
      mvpName: mvp ? mvp.name : "",
      updatedAt: new Date().toISOString()
    };
    targetState.lastEvent = {
      type: "declare_winner",
      message: team.name + " win. " + (mvp ? mvp.name + " is MVP." : "")
    };
  }

  function maybeCelebrateWinner(winner, suppressInitial) {
    if (!winner || !winner.teamId) {
      lastWinnerKey = "";
      return;
    }

    var winnerKey = [
      winner.teamId || "",
      winner.mvpStudentId || "",
      winner.mvpName || "",
      winner.updatedAt || ""
    ].join(":");

    if (winnerKey === lastWinnerKey) {
      return;
    }

    lastWinnerKey = winnerKey;
    if (suppressInitial || !state || !state.lastEvent || state.lastEvent.type !== "declare_winner") {
      return;
    }
    triggerCelebration(winner.teamId);
    showWinnerAnnouncement(winner);
    playWinnerSound();
  }

  function getTeamMvp(team) {
    var winner = null;
    (team.students || []).forEach(function (student) {
      if (!winner || Number(student.points || 0) > Number(winner.points || 0)) {
        winner = student;
      }
    });
    return winner && Number(winner.points || 0) > 0 ? winner : null;
  }

  function isTeamMvp(team, student) {
    if (state && state.winner && state.winner.mvpStudentId) {
      return state.winner.mvpStudentId === student.id;
    }
    var mvp = getTeamMvp(team);
    return !!(mvp && mvp.id === student.id);
  }

  function triggerCelebration(teamId) {
    var node = document.querySelector("[data-team-celebration]");
    if (!node) {
      return;
    }
    var palette = teamId === "red" ? ["#ef4444", "#fca5a5", "#fde68a", "#ffffff"] : ["#2563eb", "#93c5fd", "#fde68a", "#ffffff"];
    var pieces = [];
    for (var index = 0; index < 72; index += 1) {
      pieces.push('<i class="team-celebration-piece" style="--x:' + (Math.random() * 100).toFixed(2) + 'vw;--drift:' + ((Math.random() * 24) - 12).toFixed(2) + 'vw;--color:' + palette[index % palette.length] + ';--duration:' + (2.4 + Math.random() * 1.8).toFixed(2) + 's;--delay:' + (Math.random() * 0.6).toFixed(2) + 's"></i>');
    }
    for (var b = 0; b < 18; b += 1) {
      pieces.push('<i class="team-celebration-balloon" style="--x:' + (Math.random() * 100).toFixed(2) + 'vw;--drift:' + ((Math.random() * 14) - 7).toFixed(2) + 'vw;--color:' + palette[b % palette.length] + ';--duration:' + (4.2 + Math.random() * 1.6).toFixed(2) + 's;--delay:' + (Math.random() * 0.7).toFixed(2) + 's"></i>');
    }
    node.innerHTML = pieces.join("");
    window.setTimeout(function () {
      node.innerHTML = "";
    }, 6500);
  }

  function showWinnerAnnouncement(winner) {
    var node = document.querySelector("[data-team-winner-announcement]");
    if (!node || !winner) {
      return;
    }

    var teamName = winner.teamName || (winner.teamId === "red" ? "Red Blood Cells" : "Beta Blockers");
    var mvpLine = winner.mvpName ? "MVP: " + winner.mvpName : "Team Challenge complete";
    node.innerHTML = [
      '<div class="team-winner-card">',
      '<span>Winner</span>',
      '<strong>' + escapeHtml(teamName) + '</strong>',
      '<em>' + escapeHtml(mvpLine) + '</em>',
      '</div>'
    ].join("");
    node.classList.add("is-open");
    node.setAttribute("aria-hidden", "false");
    window.setTimeout(function () {
      node.classList.remove("is-open");
      node.setAttribute("aria-hidden", "true");
      node.innerHTML = "";
    }, 5200);
  }

  function playCorrectSound() {
    playRemoteSound(correctSoundUrl, function () {
      playToneSequence([
      [523.25, 0.00, 0.16, "sine", 0.18],
      [659.25, 0.05, 0.18, "sine", 0.15],
      [783.99, 0.10, 0.20, "triangle", 0.13],
      [1046.50, 0.16, 0.32, "triangle", 0.10]
      ], 0.70);
    });
  }

  function playMissedSound() {
    playRemoteSound(missedSoundUrl, function () {
      playToneSequence([
      [196.00, 0.00, 0.16, "sawtooth", 0.10],
      [155.56, 0.10, 0.22, "sawtooth", 0.08]
      ], 0.42);
    });
  }

  function playStartSound() {
    playToneSequence([
      [220.00, 0.00, 0.18, "triangle", 0.14],
      [329.63, 0.08, 0.18, "triangle", 0.13],
      [440.00, 0.16, 0.22, "triangle", 0.12],
      [659.25, 0.25, 0.42, "triangle", 0.11]
    ], 0.84);
  }

  function playWinnerSound() {
    playRemoteSound(winnerSoundUrl, function () {
      playToneSequence([
      [392.00, 0.00, 0.16, "triangle", 0.13],
      [523.25, 0.08, 0.16, "triangle", 0.13],
      [659.25, 0.16, 0.20, "triangle", 0.13],
      [783.99, 0.24, 0.20, "triangle", 0.12],
      [1046.50, 0.34, 0.48, "sine", 0.12]
      ], 1.12);
    });
  }

  function playUndoSound() {
    playToneSequence([
      [440.00, 0.00, 0.09, "triangle", 0.08],
      [349.23, 0.08, 0.12, "triangle", 0.07]
    ], 0.34);
  }

	  function playRemoteSound(url, fallback) {
	    var volume = effectsOutputVolume();
	    if (volume <= 0) {
	      return;
	    }
	    if (!url) {
	      fallback();
	      return;
	    }
    try {
      var cue = getCachedSound(url);
      if (!cue) {
        fallback();
        return;
	      }
	      cue.pause();
	      cue.currentTime = 0;
	      cue.volume = volume;
      var played = cue.play();
      if (played && played.catch) {
        played.catch(function () {
          fallback();
        });
      }
    } catch (error) {
      fallback();
    }
  }

  function preloadSounds() {
    [correctSoundUrl, missedSoundUrl, winnerSoundUrl].forEach(function (url) {
      getCachedSound(url);
    });
  }

  function primeFeedbackAudio() {
    var AudioCtor;
    var now;
    var gain;
    var osc;
    try {
      AudioCtor = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtor) {
        return;
      }
      audioContext = audioContext || new AudioCtor();
      if (audioContext.state === "suspended") {
        audioContext.resume();
      }
      now = audioContext.currentTime;
      gain = audioContext.createGain();
      osc = audioContext.createOscillator();
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.setValueAtTime(0.0001, now + 0.02);
      osc.frequency.setValueAtTime(440, now);
      osc.connect(gain);
      gain.connect(audioContext.destination);
      osc.start(now);
      osc.stop(now + 0.02);
    } catch (error) {
      // Audio priming is best-effort and should never affect gameplay.
    }
  }

  function getCachedSound(url) {
    if (!url || typeof window.Audio !== "function") {
      return null;
    }
	    if (!soundCache[url]) {
	      var cue = new Audio(url);
	      cue.preload = "auto";
	      cue.volume = effectsOutputVolume();
      try {
        cue.load();
      } catch (error) {
        // Browser preload support varies; the click handler still has the fallback tone.
      }
      soundCache[url] = cue;
    }
    return soundCache[url];
  }

	  function playToneSequence(notes, duration) {
	    try {
	      var volume = effectsOutputVolume();
	      if (volume <= 0) {
	        return;
	      }
	      var AudioCtor = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtor) {
        return;
      }
      audioContext = audioContext || new AudioCtor();
      if (audioContext.state === "suspended") {
        audioContext.resume();
      }

	      var now = audioContext.currentTime;
	      var master = audioContext.createGain();
	      master.gain.setValueAtTime(0.0001, now);
	      master.gain.exponentialRampToValueAtTime(0.22 * volume, now + 0.018);
      master.gain.exponentialRampToValueAtTime(0.0001, now + duration);
      master.connect(audioContext.destination);

      notes.forEach(function (note) {
        var osc = audioContext.createOscillator();
        var gain = audioContext.createGain();
        osc.type = note[3] || "sine";
        osc.frequency.setValueAtTime(note[0], now + note[1]);
        gain.gain.setValueAtTime(0.0001, now + note[1]);
        gain.gain.exponentialRampToValueAtTime(note[4] || 0.12, now + note[1] + 0.018);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + note[1] + note[2]);
        osc.connect(gain);
        gain.connect(master);
        osc.start(now + note[1]);
        osc.stop(now + note[1] + note[2] + 0.05);
      });
    } catch (error) {
      // Audio cues are optional and must never block the live scoring flow.
    }
  }

	  function normalizeState(nextState) {
	    if (!nextState || !Array.isArray(nextState.teams)) {
	      return nextState;
	    }
	    nextState.eventSeq = stateEventSeq(nextState);
	    nextState.sessionId = String(nextState.sessionId || "");
	    nextState.viewer = nextState.viewer && typeof nextState.viewer === "object" ? nextState.viewer : { role: "public" };
	    nextState.viewer.role = ["public", "participant", "host"].indexOf(String(nextState.viewer.role || "public")) !== -1 ? String(nextState.viewer.role || "public") : "public";
	    nextState.lifecycle = nextState.lifecycle && typeof nextState.lifecycle === "object" ? nextState.lifecycle : {};
	    nextState.lifecycle.state = lifecycleState(nextState);
	    nextState.spectatorCount = Math.max(0, Math.floor(Number(nextState.spectatorCount || 0)));
		    if (Number(nextState.currentUserId || 0) > 0) {
		      currentUserId = Number(nextState.currentUserId || 0);
		      config.currentUserId = currentUserId;
		      guestEntryMode = false;
		    }
			    nextState.sessionTitle = nextState.sessionTitle || "Live Team Challenge";
		    nextState.nextTeamId = nextState.nextTeamId || "red";
		    nextState.hostNote = String(nextState.hostNote || "").slice(0, 220);
		    nextState.chatMessages = Array.isArray(nextState.chatMessages) ? nextState.chatMessages.slice(-40) : [];
		    nextState.countdown = normalizeCountdown(nextState.countdown);
		    if (nextState.lastEvent && nextState.lastEvent.type === "reset") {
		      clearScoreLedger();
		    }
	    nextState.teams.forEach(function (team) {
      (team.students || []).forEach(function (student) {
        student.questionsAsked = Number(student.questionsAsked || student.attempts || 0);
      });
    });
	    updateLocalCurrentUserRosterEntry(nextState);
	    persistScoreLedgerFromState(nextState);
    return nextState;
  }

  function isTypingTarget(target) {
    if (!target) {
      return false;
    }
    var tag = String(target.tagName || "").toLowerCase();
    return tag === "input" || tag === "textarea" || tag === "select" || target.isContentEditable;
  }

  function hashString(value) {
    var hash = 0;
    var text = String(value || "");
    for (var index = 0; index < text.length; index += 1) {
      hash = ((hash << 5) - hash) + text.charCodeAt(index);
      hash |= 0;
    }
    return Math.abs(hash || 1);
  }

  function initialsFromName(name) {
    return String(name || "S").trim().split(/\s+/).slice(0, 2).map(function (part) {
      return part.charAt(0).toUpperCase();
    }).join("") || "S";
  }

  function cloneState(source) {
    return source ? JSON.parse(JSON.stringify(source)) : null;
  }

  function escapeHtml(value) {
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

  function escapeAttr(value) {
    return escapeHtml(value).replace(/`/g, "&#096;");
  }
})();
