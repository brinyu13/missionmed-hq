(function () {
  "use strict";

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
  var pollTimer = null;
  var refreshInFlight = false;
  var pendingActions = 0;
  var actionQueue = Promise.resolve();
  var draggedStudent = null;
  var draggedAssignmentStudent = null;
  var audioContext = null;
  var lastWinnerKey = "";
  var pollInterval = Math.max(Number(config.pollInterval || 1000), 1000);
  var correctSoundUrl = "https://cdn.missionmedinstitute.com/html-system/LIVE/Shared/assets/Music/Announcer%20Correct%20Answer.mp3";
  var missedSoundUrl = "https://cdn.missionmedinstitute.com/html-system/LIVE/Shared/assets/Music/Child%20Voice%20Try%20Again%202.mp3";
  var winnerSoundUrl = "https://cdn.missionmedinstitute.com/html-system/LIVE/Shared/assets/Music/Cheering%20Small%20Crowd.mp3";
  var soundCache = {};
	  var scheduledSessions = Array.isArray(config.scheduledSessions) ? config.scheduledSessions.slice() : [];
	  var personalMeetingRoomUrl = String(config.personalMeetingRoomUrl || "");
	  if (!personalMeetingRoomUrl && config.meeting && isInitialPersonalMeetingRoomUrl(config.meeting.joinUrl)) {
	    personalMeetingRoomUrl = String(config.meeting.joinUrl || "");
	  }
	  var nonceRefreshPromise = null;
  var guestStorageKey = "mmedLiveTeamChallengeGuest";
  var watchingStorageKey = "mmedLiveTeamChallengeWatching";

  if (hasGuestResetParam()) {
    resetStoredGuestChoice();
  }

  function defaultRestUrl() {
    return window.location.origin.replace(/\/$/, "") + "/wp-json/mmed/v1";
  }

  function hasGuestResetParam() {
    return /(?:^|[?&])mmed_guest_reset=1(?:&|$)/.test(window.location.search || "");
  }

  function resetStoredGuestChoice() {
    try {
      window.localStorage.removeItem(guestStorageKey);
      window.localStorage.removeItem(watchingStorageKey);
    } catch (error) {}
  }

  function normalizeBootstrapConfig(rawConfig) {
    var next = rawConfig && typeof rawConfig === "object" ? rawConfig : {};
    var isPreviewRoute = /\/daily-drills-live-webex-preview\/?$/i.test(window.location.pathname || "");

    if (!next.stateUrl && isPreviewRoute) {
      next.stateUrl = defaultRestUrl() + "/live-drills-preview/team-challenge";
    }
    if (next.stateUrl) {
      next.enabled = true;
    }
    next.isAdmin = next.isAdmin === true;
    next.mode = next.isAdmin ? "admin" : (next.mode || "student");
    next.currentUserId = Number(next.currentUserId || 0);
    next.avatarBaseUrl = next.avatarBaseUrl || (window.location.origin.replace(/\/$/, "") + "/wp-content/plugins/missionmed-hub/assets/team-challenge-avatars/");
    next.meeting = next.meeting && typeof next.meeting === "object" ? next.meeting : {};
    next.scheduledSessions = Array.isArray(next.scheduledSessions) ? next.scheduledSessions : [];
    next.pollInterval = next.pollInterval || 1000;
    next.copy = next.copy || {
      studentMode: "Selected student answers live in Webex.",
      adminMode: "Select the active student, or use Auto next, then mark Correct or Missed."
    };

    return next;
  }

  document.body.classList.add("mmed-team-challenge-enabled");
  document.body.classList.toggle("mmed-team-challenge-admin", isAdmin);

  injectStyles();
  mountChallengeFrame();
  bindControls();
  preloadSounds();
  refreshState();
  pollTimer = window.setInterval(refreshState, pollInterval);
  window.addEventListener("beforeunload", function () {
    window.clearInterval(pollTimer);
  });

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
	    var requestUrl = config.stateUrl;
	    var headers = {
	      "Content-Type": "application/json"
	    };
	    if (requestMethod === "GET") {
	      requestUrl += (requestUrl.indexOf("?") === -1 ? "?" : "&") + "mmed_live_state_ts=" + Date.now();
	    }
	    if (config.nonce) {
	      headers["X-WP-Nonce"] = config.nonce;
	    }

	    return window.fetch(requestUrl, {
	      method: requestMethod,
	      credentials: "same-origin",
	      cache: "no-store",
	      headers: headers,
	      body: payload ? JSON.stringify(payload) : undefined
	    }).then(function (response) {
      if (!response.ok) {
        return response.json().catch(function () {
          return {};
        }).then(function (body) {
          throw new Error(body.message || "Team Challenge request failed.");
        });
      }
      return response.json();
    });
  }

  function requestState(method, payload) {
    return fetchState(method, payload).catch(function (error) {
      if (!isNonceError(error)) {
        throw error;
      }

      return refreshConfigNonce().then(function () {
        return fetchState(method, payload);
      });
    });
  }

  function refreshState() {
    if (refreshInFlight || pendingActions > 0) {
      return Promise.resolve();
    }

    refreshInFlight = true;
    return requestState("GET").then(function (nextState) {
      state = normalizeState(nextState);
      lastConfirmedState = cloneState(state);
      updateMeetingConfigFromState(nextState);
      renderState();
    }).catch(function (error) {
      renderStatus(error.message || "Team Challenge unavailable.");
    }).then(function () {
      refreshInFlight = false;
    });
  }

  function sendAction(payload, options) {
    options = options || {};
    if (!isAdmin && ["join_in", "opt_out", "guest_join", "guest_opt_out"].indexOf(payload.action) === -1) {
      return;
    }

    if (options.optimistic) {
      applyOptimistic(payload);
    } else {
      renderStatus("Updating Team Challenge...");
    }

    pendingActions += 1;
    actionQueue = actionQueue.catch(function () {
      return null;
    }).then(function () {
      return requestState("POST", payload).then(function (nextState) {
        var confirmedState = normalizeState(nextState);
        lastConfirmedState = cloneState(confirmedState);
        updateMeetingConfigFromState(nextState);
        if (pendingActions <= 1) {
          state = confirmedState;
          renderState();
        }
      }).catch(function (error) {
        if (lastConfirmedState && pendingActions <= 1) {
          state = cloneState(lastConfirmedState);
          renderState();
        }
        renderStatus(error.message || "Team Challenge update failed.");
      }).then(function () {
        pendingActions = Math.max(0, pendingActions - 1);
        if (pendingActions === 0 && lastConfirmedState) {
          state = cloneState(lastConfirmedState);
          renderState();
        }
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
      chooseNextStudent(nextState);
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
      "@keyframes mmedTeamWinnerGlow{0%,100%{filter:brightness(1);transform:scale(1)}45%{filter:brightness(1.28);transform:scale(1.01)}}",
      "@keyframes mmedConfettiFall{0%{transform:translate3d(var(--x),-12vh,0) rotate(0deg);opacity:0}12%{opacity:1}100%{transform:translate3d(calc(var(--x) + var(--drift)),112vh,0) rotate(720deg);opacity:0}}",
      "@keyframes mmedBalloonRise{0%{transform:translate3d(var(--x),105vh,0) scale(.8);opacity:0}14%{opacity:.95}100%{transform:translate3d(calc(var(--x) + var(--drift)),-18vh,0) scale(1.04);opacity:0}}",
      "html:has(body.mmed-team-challenge-enabled),body.mmed-team-challenge-enabled{height:100%;overflow:hidden}",
      "body.mmed-team-challenge-enabled{background:#030712}",
      ".mmed-team-challenge-enabled .preview-chrome,.mmed-team-challenge-enabled .shell-title,.mmed-team-challenge-enabled .header-right,.mmed-team-challenge-enabled .participant-strip,.mmed-team-challenge-enabled [data-note],.mmed-team-challenge-enabled .self-report,.mmed-team-challenge-enabled .drill-question-zone{display:none!important}",
      ".mmed-team-challenge-enabled .shell.is-active{display:block;height:100vh;overflow:hidden}",
      ".mmed-team-challenge-enabled .mm-drill{height:100vh;min-height:0;padding:8px;overflow:hidden}",
      ".mmed-team-challenge-enabled .mm-drill .app{height:calc(100vh - 16px);min-height:0;max-width:none;grid-template-columns:clamp(180px,20vw,300px) minmax(380px,1fr) clamp(180px,20vw,300px);grid-template-rows:58px minmax(0,1fr);gap:8px;margin:0}",
      ".mmed-team-challenge-enabled .mm-drill .brand-header{min-height:0;height:58px;padding:8px 12px;border-radius:10px}",
      ".mmed-team-challenge-enabled .brand-logo{width:38px;height:38px;border-radius:8px}",
      ".mmed-team-challenge-enabled .mode-badge{font-size:22px;white-space:nowrap}",
      ".mmed-team-challenge-enabled .brand-logo-wrap p{display:none}",
      ".team-session-title{margin-left:12px;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#c8d4f4;font-size:14px;font-weight:900;letter-spacing:.06em;text-transform:uppercase}",
      ".mmed-team-challenge-enabled .center-column{min-height:0;display:grid;grid-template-rows:minmax(420px,1fr) minmax(250px,auto);gap:8px;overflow:hidden}",
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
	      ".team-challenge-adminbar{display:none;gap:10px;padding:10px;border:1px solid rgba(250,204,21,.3);border-radius:10px;background:rgba(3,6,18,.86);min-height:250px;max-height:min(390px,42vh);overflow:auto}",
      ".team-challenge-joinbar{display:none;position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);z-index:99998;width:min(720px,calc(100vw - 36px));padding:22px;border:2px solid rgba(250,204,21,.78);border-radius:22px;background:radial-gradient(circle at 18% 18%,rgba(250,204,21,.26),transparent 32%),linear-gradient(135deg,rgba(15,23,42,.98),rgba(4,8,20,.96));box-shadow:0 30px 100px rgba(0,0,0,.62),0 0 70px rgba(250,204,21,.24),inset 0 1px 0 rgba(255,255,255,.12)}",
      ".mmed-team-challenge-admin .team-challenge-adminbar{display:grid;grid-template-columns:minmax(560px,1.35fr) minmax(420px,.85fr);grid-template-rows:auto;align-items:stretch}",
      "body:not(.mmed-team-challenge-admin) .team-challenge-joinbar{display:grid;grid-template-columns:minmax(0,1fr);gap:18px;text-align:center}",
      ".team-challenge-joinbar.is-joined{position:fixed;left:50%;top:auto;bottom:18px;transform:translateX(-50%);width:min(520px,calc(100vw - 36px));padding:12px 14px;border-width:1px;border-radius:14px;background:rgba(3,6,18,.94);box-shadow:0 18px 48px rgba(0,0,0,.42)}",
      ".team-challenge-joinbar.is-watching{position:fixed;left:50%;top:auto;bottom:18px;transform:translateX(-50%);width:min(520px,calc(100vw - 36px));padding:12px 14px;border-width:1px;border-radius:14px;background:rgba(3,6,18,.94);box-shadow:0 18px 48px rgba(0,0,0,.42)}",
      ".team-challenge-joinbar:before{content:'DR J SAYS';width:max-content;margin:0 auto -8px;padding:4px 10px;border-radius:999px;background:rgba(250,204,21,.16);border:1px solid rgba(250,204,21,.42);color:#fde68a;font-size:11px;font-weight:1000;letter-spacing:.18em;text-transform:uppercase}",
      ".team-challenge-joinbar.is-joined:before,.team-challenge-joinbar.is-watching:before{display:none}",
      ".team-challenge-adminbar p{margin:0;color:#c8d4f4;font-size:12px;line-height:1.25}",
      ".team-challenge-joinbar p{margin:0;color:#dbeafe;font-size:16px;line-height:1.32}",
      ".team-challenge-joinbar p b{display:block;color:#fff;font-size:clamp(38px,7vw,72px);line-height:.9;letter-spacing:.08em;text-transform:uppercase;text-shadow:0 0 30px rgba(250,204,21,.38)}",
      ".team-challenge-joinbar.is-joined p b,.team-challenge-joinbar.is-watching p b{font-size:22px;letter-spacing:.08em}",
      ".team-guest-fields{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;text-align:left}",
      ".team-guest-fields label{display:grid;gap:5px;color:#cbd5e1;font-size:11px;font-weight:900;letter-spacing:.1em;text-transform:uppercase}",
      ".team-guest-fields label[data-guest-email-wrap]{grid-column:1/-1}",
      ".team-guest-fields input{width:100%;height:48px;border:1px solid rgba(250,204,21,.34);border-radius:13px;background:rgba(5,10,24,.92);color:#fff;padding:0 13px;font-size:16px;font-weight:850;letter-spacing:.02em;box-shadow:inset 0 1px 0 rgba(255,255,255,.08)}",
      ".team-guest-fields input:focus{outline:2px solid rgba(250,204,21,.65);outline-offset:2px}",
      ".team-challenge-joinbar.is-logged-in .team-guest-fields,.team-challenge-joinbar.is-joined .team-guest-fields,.team-challenge-joinbar.is-watching .team-guest-fields{display:none}",
      ".team-join-actions{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;align-items:stretch}",
      ".team-admin-stack{min-width:0;display:grid;gap:7px;align-content:start}",
      ".team-control-banner{display:flex;align-items:center;gap:7px;min-width:0;width:100%;max-width:100%;min-height:22px;padding:3px 8px;border:1px solid rgba(250,204,21,.48);border-radius:999px;background:linear-gradient(180deg,rgba(250,204,21,.2),rgba(15,23,42,.68));color:#fef3c7;box-shadow:0 0 18px rgba(250,204,21,.14);overflow:hidden}",
      ".team-control-banner strong{font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:#fff}",
      ".team-control-banner span{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:10px;font-weight:900;letter-spacing:.08em;text-transform:uppercase;color:#fde68a}",
      ".team-meeting-current{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#93a4cd;font-size:11px;font-weight:800;letter-spacing:.02em}",
      ".team-session-controls{display:grid;grid-template-columns:minmax(0,1fr) minmax(96px,.22fr) minmax(82px,.16fr);gap:7px;align-items:center;min-width:0;max-width:100%;overflow:hidden}",
      ".team-session-controls input{width:100%;min-width:0;height:40px;border:1px solid rgba(127,149,197,.32);border-radius:10px;background:rgba(10,18,40,.92);color:#fff;padding:0 11px;font-size:13px;font-weight:850;letter-spacing:.03em;overflow:hidden;text-overflow:ellipsis}",
	      ".team-meeting-controls{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:7px;align-items:center;min-width:0;max-width:100%;overflow:hidden}",
      ".team-meeting-controls input{grid-column:1/-1;width:100%;min-width:0;height:40px;border:1px solid rgba(127,149,197,.32);border-radius:10px;background:rgba(10,18,40,.92);color:#fff;padding:0 11px;font-size:13px;font-weight:850;letter-spacing:.02em;overflow:hidden;text-overflow:ellipsis}",
      ".team-schedule-controls{display:grid;grid-template-columns:minmax(0,1fr) minmax(150px,.24fr) minmax(150px,.24fr);gap:7px;align-items:center;min-width:0;max-width:100%;overflow:hidden}",
      ".team-schedule-controls select{grid-column:auto}",
      ".team-schedule-controls select,.team-schedule-form input{width:100%;min-width:0;height:40px;border:1px solid rgba(127,149,197,.32);border-radius:10px;background:rgba(10,18,40,.92);color:#fff;padding:0 11px;font-size:13px;font-weight:850;letter-spacing:.02em;overflow:hidden;text-overflow:ellipsis}",
      ".team-schedule-controls select{min-width:0}",
      ".team-schedule-form{display:none;grid-template-columns:minmax(0,1fr) minmax(126px,.44fr) minmax(58px,.16fr) minmax(90px,.22fr);gap:7px;align-items:center;min-width:0;max-width:100%;overflow:hidden}",
      ".team-schedule-form.is-open{display:grid}",
      ".team-schedule-note{color:#9ba8c8;font-size:10.5px;line-height:1.2}",
      ".team-challenge-actions{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;align-content:start;align-items:stretch}",
      ".team-challenge-actions button,.team-session-controls button,.team-meeting-controls button,.team-schedule-controls button,.team-schedule-form button{min-width:0;max-width:100%;min-height:40px;border:1px solid rgba(127,149,197,.28);border-radius:10px;padding:8px 10px;color:#fff;font-size:11px;font-weight:950;letter-spacing:.06em;text-transform:uppercase;background:#101a38;white-space:normal;line-height:1.08;overflow:hidden;text-overflow:ellipsis}",
      ".team-challenge-joinbar button{min-height:64px;border:1px solid rgba(127,149,197,.28);border-radius:16px;padding:12px 18px;color:#fff;font-size:15px;font-weight:1000;letter-spacing:.09em;text-transform:uppercase;background:#101a38}",
      ".team-challenge-joinbar [data-join-in]{border-color:rgba(134,239,172,.8);background:linear-gradient(180deg,#22c55e,#14532d);box-shadow:0 0 34px rgba(34,197,94,.24)}",
      ".team-challenge-joinbar [data-opt-out]{border-color:rgba(191,219,254,.45);background:linear-gradient(180deg,#1f2f5f,#0f172a)}",
      ".team-challenge-joinbar.is-joined .team-join-actions,.team-challenge-joinbar.is-watching .team-join-actions{grid-template-columns:1fr}",
      ".team-challenge-joinbar.is-joined [data-join-in]{display:none}",
      ".team-challenge-joinbar.is-watching [data-opt-out]{display:none}",
      "body:not(.mmed-team-challenge-admin):has([data-live-stage].is-webex-embedding) .team-challenge-joinbar,body:not(.mmed-team-challenge-admin):has([data-live-stage].is-webex-embedded) .team-challenge-joinbar{display:none!important}",
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
      "@media(max-height:860px){.mmed-team-challenge-enabled .center-column{grid-template-rows:minmax(390px,1fr) minmax(250px,auto)}.team-challenge-adminbar{min-height:250px;max-height:min(360px,44vh)}.team-challenge-actions [data-score]{height:52px}.team-challenge-actions button,.team-session-controls button,.team-meeting-controls button,.team-schedule-controls button,.team-schedule-form button{min-height:38px;padding:7px 8px;font-size:10px}}",
      "@media(max-width:1180px){.mmed-team-challenge-enabled .mm-drill .app{grid-template-columns:clamp(154px,20vw,230px) minmax(340px,1fr) clamp(154px,20vw,230px)}.team-challenge-head{height:50px;padding:8px 10px}.team-challenge-head h3{font-size:14px}.team-challenge-total{min-width:36px;font-size:28px}.team-challenge-name{font-size:12px}.team-active-avatar-card{display:none}.team-session-title{display:none}.mmed-team-challenge-admin .team-challenge-adminbar{grid-template-columns:minmax(0,1fr);grid-template-rows:auto auto}.team-challenge-actions{grid-template-columns:repeat(4,minmax(0,1fr));gap:5px}.team-challenge-actions button,.team-session-controls button,.team-meeting-controls button,.team-schedule-controls button,.team-schedule-form button{min-height:34px;padding:5px 7px;font-size:9.5px;letter-spacing:.045em}.team-challenge-actions [data-score]{height:44px;font-size:13px}.team-meeting-controls{grid-template-columns:repeat(4,minmax(0,1fr))}.team-schedule-controls{grid-template-columns:repeat(2,minmax(0,1fr))}.team-schedule-controls select{grid-column:1/-1}}",
      "@media(max-width:980px){.mmed-team-challenge-enabled .mm-drill{padding:6px}.mmed-team-challenge-enabled .mm-drill .app{height:calc(100vh - 12px);grid-template-columns:minmax(138px,170px) minmax(300px,1fr) minmax(138px,170px);grid-template-rows:50px minmax(0,1fr);gap:6px}.mmed-team-challenge-enabled .mm-drill .brand-header{height:50px;padding:6px 9px}.mmed-team-challenge-enabled .brand-logo{width:32px;height:32px}.mmed-team-challenge-enabled .mode-badge{font-size:18px}.mmed-team-challenge-enabled .player-shell{grid-template-rows:22px minmax(0,1fr)}.mmed-team-challenge-enabled .player-topbar{height:22px}.team-challenge-head{height:46px}.team-challenge-head h3{font-size:12px;letter-spacing:.07em}.team-challenge-count{font-size:9px;padding:1px 6px}.team-challenge-total{font-size:25px}.team-challenge-list{grid-auto-rows:50px;gap:5px;padding:7px}.team-challenge-student{grid-template-columns:30px minmax(0,1fr) 58px 30px;height:50px;min-height:50px;max-height:50px;gap:5px;padding:3px 6px 3px 3px}.team-challenge-student.is-active:after{right:68px}.team-challenge-avatar{width:28px;height:28px}.team-challenge-name{font-size:10.5px}.team-challenge-asked{height:34px;min-width:58px}.team-challenge-asked span{font-size:10px}.team-challenge-asked strong{font-size:19px}.team-challenge-points{font-size:18px}.team-challenge-adminbar{min-height:0;padding:6px;gap:5px}.team-control-banner{min-height:20px;padding:2px 7px}.team-control-banner strong{font-size:9px}.team-control-banner span{font-size:9px}.team-meeting-current,.team-challenge-status{font-size:10px}.team-session-controls{grid-template-columns:minmax(100px,1fr) minmax(60px,.38fr) minmax(52px,.28fr);gap:4px}.team-meeting-controls{grid-template-columns:repeat(4,minmax(0,1fr));gap:4px}.team-schedule-controls{grid-template-columns:repeat(2,minmax(0,1fr));gap:4px}.team-schedule-form{grid-template-columns:minmax(120px,1fr) minmax(128px,.8fr) 54px minmax(74px,.45fr)}.team-session-controls input,.team-schedule-controls select,.team-schedule-form input{height:30px;font-size:10px;padding:0 7px}.team-meeting-controls input{height:30px;font-size:9.5px;padding:0 7px}.team-challenge-actions{grid-template-columns:repeat(4,minmax(0,1fr));gap:4px}.team-challenge-actions button,.team-session-controls button,.team-meeting-controls button,.team-schedule-controls button,.team-schedule-form button{min-height:30px;border-radius:8px;padding:4px 5px;font-size:8.5px;letter-spacing:.035em}.team-challenge-actions [data-score]{height:38px;font-size:12px}}",
      "@media(max-width:820px){.mmed-team-challenge-enabled .mm-drill .app{grid-template-columns:minmax(112px,140px) minmax(260px,1fr) minmax(112px,140px);gap:5px}.team-challenge-actions{grid-template-columns:repeat(3,minmax(0,1fr))}.team-challenge-actions [data-score]{grid-column:span 1}.team-schedule-form{grid-template-columns:minmax(0,1fr) minmax(0,1fr);}.team-challenge-actions button,.team-session-controls button,.team-meeting-controls button,.team-schedule-controls button,.team-schedule-form button{font-size:8px;padding:4px}.team-challenge-head h3{font-size:10.5px}.team-challenge-total{font-size:22px}.team-challenge-name{font-size:9.5px}}",
      ".mmed-team-challenge-enabled .team-admin-stack,.mmed-team-challenge-enabled .team-session-controls,.mmed-team-challenge-enabled .team-meeting-controls,.mmed-team-challenge-enabled .team-schedule-controls,.mmed-team-challenge-enabled .team-schedule-form{min-width:0;max-width:100%;overflow:hidden}",
      ".mmed-team-challenge-enabled .team-meeting-controls button,.mmed-team-challenge-enabled .team-schedule-controls button,.mmed-team-challenge-enabled .team-session-controls button{white-space:normal;line-height:1.05}",
      "@media(max-width:760px){.team-challenge-joinbar{top:52%;width:calc(100vw - 24px);padding:18px}.team-challenge-joinbar p b{font-size:36px}.team-join-actions{grid-template-columns:1fr}.team-challenge-joinbar button{min-height:56px}}"
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
      adminbar.innerHTML = [
        '<div class="team-admin-stack">',
        '<div class="team-control-banner" aria-label="Admin control mode"><strong>Admin control mode</strong><span>Scoring enabled. Select or paste the Webex meeting, then join as host inside this browser stage or use the Webex app fallback.</span></div>',
        '<div class="team-meeting-current" data-current-meeting-label>Meeting: not set</div>',
        '<div class="team-session-controls">',
        '<input type="text" maxlength="80" data-session-title-input aria-label="Live drill session title" placeholder="Session title">',
        '<button type="button" data-session-title-save>Save title</button>',
        '<button type="button" data-session-start>Start</button>',
        '</div>',
	        '<div class="team-meeting-controls">',
	        '<input type="url" data-meeting-link-input aria-label="Webex meeting link" placeholder="Paste the active Webex meeting link">',
		        '<button type="button" data-meeting-link-active>Find live</button>',
		        '<button type="button" data-meeting-link-pmr>Use PMR</button>',
		        '<button type="button" data-meeting-start-now>Start Webex now</button>',
		        '<button type="button" data-meeting-link-save>Use link</button>',
		        '<button type="button" data-host-webex-start>Join host</button>',
        '</div>',
        '<div class="team-schedule-controls">',
        '<select data-scheduled-session-select aria-label="Scheduled Live Drills Webex sessions"></select>',
        '<button type="button" data-scheduled-session-use>Use selected</button>',
        '<button type="button" data-schedule-session-toggle>Schedule ahead</button>',
        '</div>',
        '<div class="team-schedule-form" data-schedule-session-form hidden>',
        '<input type="text" maxlength="120" data-scheduled-title aria-label="New scheduled Webex title" placeholder="Scheduled Webex title">',
        '<input type="datetime-local" data-scheduled-start aria-label="Eastern Time start">',
        '<input type="number" min="15" max="240" step="15" value="60" data-scheduled-duration aria-label="Duration minutes">',
        '<button type="button" data-scheduled-session-create>Create Webex</button>',
        '</div>',
        '<div class="team-schedule-note">Schedule ahead, invite students with the normal Webex link or Matrix room link, then choose that exact session here.</div>',
        '<div class="team-challenge-status" data-team-challenge-status></div>',
        '</div>',
        '<div class="team-challenge-actions">',
	        '<button type="button" data-auto-next>Auto next</button>',
	        '<button type="button" data-score="correct">Correct <span>(C)</span></button>',
	        '<button type="button" data-score="incorrect">Missed <span>(M)</span></button>',
	        '<button type="button" data-undo-score>Undo score <span>(U)</span></button>',
	        '<button type="button" data-team-assign>Assign teams</button>',
        '<button type="button" data-balance-teams>Balance Teams</button>',
        '<button type="button" data-winner="blue">Winner: Beta</button>',
        '<button type="button" data-winner="red">Winner: Red</button>',
        '<button type="button" data-reset>Reset</button>',
        '</div>'
      ].join("");
      player.insertAdjacentElement("afterend", adminbar);
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
        '<p data-join-prompt><b>JUMPING IN?</b><br>Are you playing in Team Challenge, or watching this round?</p>',
        '<div class="team-guest-fields" data-guest-fields>',
        '<label>First name<input type="text" autocomplete="given-name" data-guest-first placeholder="First name"></label>',
        '<label>Last name<input type="text" autocomplete="family-name" data-guest-last placeholder="Last name"></label>',
        '<label data-guest-email-wrap>Email<input type="email" autocomplete="email" data-guest-email placeholder="you@example.com"></label>',
        '</div>',
        '<div class="team-join-actions">',
        "<button type=\"button\" data-join-in>Yes, I'm jumping in</button>",
        '<button type="button" data-opt-out>No, just watching</button>',
        '</div>'
      ].join("");
      document.body.appendChild(joinbar);
    }
    if (stage) {
      var staleActiveAvatar = stage.querySelector("[data-team-active-avatar-card]");
      if (staleActiveAvatar) {
        staleActiveAvatar.remove();
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

  function setGuestWatching(value) {
    try {
      if (window.localStorage) {
        window.localStorage.setItem(watchingStorageKey, value ? "1" : "0");
      }
    } catch (error) {
      // Local watching state is only used to keep the prompt out of the way.
    }
  }

  function guestIsWatching() {
    try {
      return !!(window.localStorage && window.localStorage.getItem(watchingStorageKey) === "1");
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

  function fillGuestFields() {
    var joinbar = document.querySelector("[data-team-challenge-joinbar]");
    var profile = loadGuestProfile();
    if (!joinbar || currentUserId) {
      return;
    }
    var first = joinbar.querySelector("[data-guest-first]");
    var last = joinbar.querySelector("[data-guest-last]");
    var email = joinbar.querySelector("[data-guest-email]");
    if (first && profile.firstName) {
      first.value = profile.firstName;
    }
    if (last && profile.lastName) {
      last.value = profile.lastName;
    }
    if (email && profile.email) {
      email.value = profile.email;
    }
  }

  function collectGuestPayload() {
    var joinbar = document.querySelector("[data-team-challenge-joinbar]");
    var profile = loadGuestProfile();
    var first = joinbar && joinbar.querySelector("[data-guest-first]");
    var last = joinbar && joinbar.querySelector("[data-guest-last]");
    var email = joinbar && joinbar.querySelector("[data-guest-email]");
    var firstName = first ? first.value.trim() : "";
    var lastName = last ? last.value.trim() : "";
    var emailValue = email ? email.value.trim() : "";

    if (!firstName || !lastName || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailValue)) {
      renderStatus("Enter first name, last name, and email, then click Yes, I'm jumping in.");
      if (!firstName && first) {
        first.focus();
      } else if (!lastName && last) {
        last.focus();
      } else if (email) {
        email.focus();
      }
      return null;
    }

    profile.firstName = firstName;
    profile.lastName = lastName;
    profile.email = emailValue;
    profile.id = ensureGuestId(profile);
    saveGuestProfile(profile);

    return {
      guestId: profile.id,
      firstName: firstName,
      lastName: lastName,
      email: emailValue
    };
  }

  function submitJoinIn(joinButton) {
    var payload;
    setGuestWatching(false);
    if (joinButton) {
      joinButton.disabled = true;
      joinButton.textContent = "Adding you...";
    }

    if (currentUserId) {
      sendAction({ action: "join_in" }, { optimistic: true }).then(function () {
        if (joinButton) {
          joinButton.disabled = false;
        }
      });
      return;
    }

    payload = collectGuestPayload();
    if (!payload) {
      if (joinButton) {
        joinButton.disabled = false;
        joinButton.textContent = "Yes, I'm jumping in";
      }
      return;
    }

    payload.action = "guest_join";
    sendAction(payload, { optimistic: true }).then(function () {
      if (joinButton) {
        joinButton.disabled = false;
      }
    });
  }

  function submitOptOut(optOutButton) {
    var profile = loadGuestProfile();
    setGuestWatching(true);
    if (optOutButton) {
      optOutButton.disabled = true;
      optOutButton.textContent = "Updating...";
    }

    if (currentUserId) {
      sendAction({ action: "opt_out" }, { optimistic: true }).then(function () {
        if (optOutButton) {
          optOutButton.disabled = false;
        }
      });
      return;
    }

    sendAction({
      action: "guest_opt_out",
      guestId: profile.id || "",
      email: profile.email || ""
    }, { optimistic: true }).then(function () {
      if (optOutButton) {
        optOutButton.disabled = false;
      }
    });
  }

  function bindControls() {
    document.addEventListener("click", function (event) {
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
      }
    });

    legacyShell.addEventListener("click", function (event) {
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

      if (event.target.closest("[data-auto-next]")) {
        sendAction({ action: "auto_select_next" }, { optimistic: true });
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
    });

    document.addEventListener("keydown", function (event) {
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
	    sendAction({
	      action: "score",
	      correct: !!correct
	    }, { optimistic: true });
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
	      renderStatus(isPersonalMeetingRoomUrl(joinUrl) ? "Personal Meeting Room is saved for this live session. Roster kept. Click Join host to start inside the app." : "This exact Webex meeting link is saved. Roster kept. Start students when ready.");
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
      renderStatus("Scheduled live Webex meeting selected. Roster kept. Start students when ready.");
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
		      renderStatus("Fresh Webex room created and selected. Opening host video inside the app...");
		      window.setTimeout(openHostWebexMeeting, 500);
		    }).catch(function (error) {
		      renderStatus(error.message || "Could not create a fresh Webex room.");
		    }).then(function () {
		      pendingActions = Math.max(0, pendingActions - 1);
		    });
		  }

		  function openHostWebexMeeting() {
    if (!isAdmin) {
      return;
    }

    var meeting = (config.meeting && typeof config.meeting === "object") ? config.meeting : {};
    var input = legacyShell.querySelector("[data-meeting-link-input]");
    var joinUrl = input && input.value ? String(input.value).trim() : String(meeting.joinUrl || "").trim();
    if (!isLikelyWebexUrl(joinUrl)) {
      renderStatus("Choose or paste the Webex meeting first, then join the in-app host stage.");
      return;
    }

    if (window.MMEDLiveDrillsEmbeddedWebex && typeof window.MMEDLiveDrillsEmbeddedWebex.start === "function") {
      window.MMEDLiveDrillsEmbeddedWebex.start({ allowAdmin: true, hostMode: true });
      renderStatus("Joining Webex inside the Daily Drills stage as host with the connected Webex account. Keep the desktop Webex app muted or closed to avoid echo.");
      return;
    }

    renderStatus("In-app Webex video is not ready on this page yet. Use the stage Join in app as host button or the Webex app fallback.");
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
    if (!sessionId) {
      renderStatus("Choose a scheduled Webex session first.");
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

    updateSessionTitle();
    updateMeetingLabel();
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
    renderAssignmentModal();

    var eventMessage = state.lastEvent && state.lastEvent.message ? state.lastEvent.message : "";
    renderStatus(eventMessage || ((config.copy && config.copy.studentMode) || ""));

    maybeCelebrateWinner(state.winner);
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

    joinbar.classList.toggle("is-joined", joined);
    joinbar.classList.toggle("is-watching", watching);
    joinbar.classList.toggle("is-logged-in", !!currentUserId);
    fillGuestFields();

    if (prompt) {
      prompt.innerHTML = joined
        ? "<b>YOU ARE JUMPING IN.</b><br>You are on a team roster for scoring."
        : watching
          ? "<b>JUST WATCHING.</b><br>You are off the scoring roster for this round."
          : "<b>JUMPING IN?</b><br>Are you playing in Team Challenge, or watching this round?";
    }
    if (joinButton) {
      joinButton.textContent = joined ? "I am in" : watching ? "Jump in now" : "Yes, I'm jumping in";
      joinButton.disabled = joined;
    }
    if (optOutButton) {
      optOutButton.textContent = joined ? "No, remove me" : "No, just watching";
    }
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
      targetId = guestProfile && guestProfile.id ? String(guestProfile.id) : "";
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
    }
    if (input && document.activeElement !== input) {
      input.value = title;
    }
  }

	  function updateMeetingLabel() {
	    var meeting = (config.meeting && typeof config.meeting === "object") ? config.meeting : {};
	    var title = meeting.title || "No Webex meeting selected";
	    var label = legacyShell.querySelector("[data-current-meeting-label]");
	    var input = legacyShell.querySelector("[data-meeting-link-input]");
	    if (isPersonalMeetingRoomUrl(meeting.joinUrl) && (!title || /drills live|team challenge|webex-test|not set/i.test(title))) {
	      title = "Dr Brian Personal Meeting Room";
	    }
	    if (label) {
	      label.textContent = "Meeting: " + title;
	    }
    if (input && document.activeElement !== input && !input.value && meeting.joinUrl) {
      input.value = meeting.joinUrl;
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
    select.innerHTML = '<option value="">Scheduled sessions...</option>';
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
    var name = currentUserId ? "You" : [payload.firstName || "", payload.lastName || ""].join(" ").trim();
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
    targetTeam.students.push({
      id: id,
      userId: currentUserId || 0,
      name: name,
      initials: initialsFromName(name),
      points: 0,
      attempts: 0,
      questionsAsked: 0,
      avatarUrl: "",
      avatarFullUrl: "",
      avatarSource: currentUserId ? "wordpress_pending" : "guest",
      avatarSeed: id,
      isBot: false,
      isGuest: !currentUserId,
      joined: true
    });

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
    targetState.teams.forEach(function (team) {
      team.score = 0;
      (team.students || []).forEach(function (student) {
        student.points = 0;
        student.attempts = 0;
        student.questionsAsked = 0;
      });
    });
    targetState.active = firstActive(targetState);
    targetState.nextTeamId = "red";
    targetState.winner = null;
    targetState.lastEvent = {
      type: "reset",
      message: "Team Challenge reset."
    };
  }

  function chooseNextStudent(targetState) {
    var preferredTeamId = targetState.nextTeamId || "red";
    var preferred = teamById(targetState, preferredTeamId);
    if (!preferred || !(preferred.students || []).length) {
      preferred = firstOtherTeam(targetState, preferredTeamId) || (targetState.teams || [])[0];
    }
    if (!preferred || !(preferred.students || []).length) {
      return;
    }

    var minQuestions = Math.min.apply(null, preferred.students.map(function (student) {
      return Number(student.questionsAsked || student.attempts || 0);
    }));
    var candidates = preferred.students.filter(function (student) {
      return Number(student.questionsAsked || student.attempts || 0) === minQuestions;
    });
    var active = targetState.active || {};
    var activeIndex = preferred.students.findIndex(function (student) {
      return student.id === active.studentId;
    });
    var chosen = candidates[0];
    for (var index = 0; index < preferred.students.length; index += 1) {
      var nextIndex = (activeIndex + 1 + index + preferred.students.length) % preferred.students.length;
      if (candidates.indexOf(preferred.students[nextIndex]) !== -1) {
        chosen = preferred.students[nextIndex];
        break;
      }
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

  function maybeCelebrateWinner(winner) {
    if (!winner || !winner.teamId) {
      lastWinnerKey = "";
      return;
    }

    var winnerKey = [
      winner.teamId || "",
      winner.mvpStudentId || "",
      winner.mvpName || ""
    ].join(":");

    if (winnerKey === lastWinnerKey) {
      return;
    }

    lastWinnerKey = winnerKey;
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

  function playRemoteSound(url, fallback) {
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
      cue.volume = 0.88;
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

  function getCachedSound(url) {
    if (!url || typeof window.Audio !== "function") {
      return null;
    }
    if (!soundCache[url]) {
      var cue = new Audio(url);
      cue.preload = "auto";
      cue.volume = 0.88;
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
      master.gain.exponentialRampToValueAtTime(0.22, now + 0.018);
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
    nextState.sessionTitle = nextState.sessionTitle || "Live Team Challenge";
    nextState.nextTeamId = nextState.nextTeamId || "red";
    nextState.teams.forEach(function (team) {
      (team.students || []).forEach(function (student) {
        student.questionsAsked = Number(student.questionsAsked || student.attempts || 0);
      });
    });
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
