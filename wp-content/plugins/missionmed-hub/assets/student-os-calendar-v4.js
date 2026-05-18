/**
 * MissionMed Matrix Calendar v4 Override
 * Replaces basic calendar with full-featured multi-view calendar system.
 * Hooks into existing MMED_OS app framework.
 */
(function () {
  "use strict";

  var CATEGORIES = [
    {id:"drill_step1",label:"Dr. J's Drills (Step/Level 1)",color:"#0e75a8",icon:"🔬",builtin:true,defaults:{startTime:"10:00",endTime:"12:00",desc:"Step/Level 1 Drill Session"}},
    {id:"drill_step23",label:"Dr. J's Drills (Step/Level 2/3)",color:"#17a3cf",icon:"🩺",builtin:true,defaults:{startTime:"14:00",endTime:"16:00",desc:"Step/Level 2/3 Drill Session"}},
    {id:"mr_session",label:"MR Strategy Sessions",color:"#d9b85b",icon:"🎯",builtin:true,defaults:{startTime:"18:00",endTime:"19:00",desc:"Mission Residency Strategy"}},
    {id:"mock_interview",label:"Mock Interviews",color:"#f06b2f",icon:"🎤",builtin:true,defaults:{startTime:"13:00",endTime:"14:00",desc:"Mock Interview Session"}},
    {id:"nrmp_date",label:"NRMP / Application Dates",color:"#d95c5c",icon:"📋",builtin:true,defaults:{startTime:"09:00",endTime:"17:00",desc:""}},
    {id:"rotation",label:"Rotations / Clinicals",color:"#36c071",icon:"🏥",builtin:true,defaults:{startTime:"07:00",endTime:"17:00",desc:"Clinical Rotation"}},
    {id:"arena_event",label:"Arena Events",color:"#8b5cf6",icon:"⚡",builtin:true,defaults:{startTime:"19:00",endTime:"20:00",desc:"Arena Challenge"}},
    {id:"study_block",label:"Study Blocks",color:"#4a6a82",icon:"📚",builtin:true,defaults:{startTime:"08:00",endTime:"10:00",desc:"Focused Study"}}
  ];

  var TRACKER_PHASES = [
    {id:"cv",label:"CV Building",start:"2026-01-01",end:"2026-04-30",icon:"📄"},
    {id:"lors-ps",label:"LORs & PS",start:"2026-05-01",end:"2026-07-31",icon:"✍"},
    {id:"eras",label:"ERAS Application",start:"2026-08-01",end:"2026-10-31",icon:"📩"},
    {id:"interviews",label:"Interviews",start:"2026-11-01",end:"2027-01-31",icon:"🎙"},
    {id:"rank",label:"Rank List",start:"2027-02-01",end:"2027-02-28",icon:"📊"},
    {id:"match",label:"Match",start:"2027-03-01",end:"2027-03-31",icon:"🏆"}
  ];

  /* ── Audio Engine ──────────────────────────────────────────────── */
  var CalAudio = {
    ctx: null, muted: false,
    init: function () {
      if (!this.ctx) {
        try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { /* silent */ }
      }
      this.muted = localStorage.getItem("mmed_cal_muted") === "1";
    },
    play: function (type) {
      if (this.muted || !this.ctx) return;
      var o = this.ctx.createOscillator(), g = this.ctx.createGain();
      o.connect(g); g.connect(this.ctx.destination);
      g.gain.value = 0.04;
      if (type === "click") { o.frequency.value = 800; o.type = "sine"; o.start(); o.stop(this.ctx.currentTime + 0.1); }
      else if (type === "drop") { o.frequency.setValueAtTime(500, this.ctx.currentTime); o.frequency.linearRampToValueAtTime(900, this.ctx.currentTime + 0.2); o.type = "triangle"; o.start(); o.stop(this.ctx.currentTime + 0.2); }
      else if (type === "add") { o.frequency.setValueAtTime(600, this.ctx.currentTime); o.frequency.linearRampToValueAtTime(1200, this.ctx.currentTime + 0.3); o.type = "sine"; o.start(); o.stop(this.ctx.currentTime + 0.3); }
      else if (type === "nav") { o.frequency.value = 400; o.type = "sine"; o.start(); o.stop(this.ctx.currentTime + 0.08); }
    },
    toggle: function () { this.muted = !this.muted; localStorage.setItem("mmed_cal_muted", this.muted ? "1" : "0"); }
  };

  /* ── Helpers ────────────────────────────────────────────────────── */
  function esc(s) { return typeof escapeHTML === "function" ? escapeHTML(String(s || "")) : String(s || "").replace(/[&<>"]/g, function (c) { return {"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;"}[c]; }); }
  function escA(s) { return typeof escapeAttr === "function" ? escapeAttr(String(s || "")) : esc(s); }
  function catById(id) { for (var i = 0; i < CATEGORIES.length; i++) { if (CATEGORIES[i].id === id) return CATEGORIES[i]; } return null; }
  function catColor(id) { var c = catById(id); return c ? c.color : "#8ca0b2"; }
  function catIcon(id) { var c = catById(id); return c ? c.icon : "📅"; }
  function pad2(n) { return n < 10 ? "0" + n : "" + n; }
  function fmtTime(dt) { if (!dt) return ""; var d = new Date(dt); return pad2(d.getHours()) + ":" + pad2(d.getMinutes()); }
  function fmtDate(dt) { if (!dt) return ""; var d = new Date(dt); return d.toLocaleDateString(undefined, {weekday:"short",month:"short",day:"numeric"}); }
  function fmtTimeRange(s, e) { return fmtTime(s) + (e ? " - " + fmtTime(e) : ""); }
  function daysBetween(a, b) { return Math.round((new Date(b) - new Date(a)) / 86400000); }

  function loadCustomCategories() {
    try {
      var saved = JSON.parse(localStorage.getItem("mmed_custom_categories") || "[]");
      if (Array.isArray(saved)) {
        saved.forEach(function (c) {
          if (c && c.id && !catById(c.id)) { c.builtin = false; CATEGORIES.push(c); }
        });
      }
    } catch (e) { /* ignore */ }
  }

  function saveCustomCategories() {
    var custom = CATEGORIES.filter(function (c) { return !c.builtin; });
    localStorage.setItem("mmed_custom_categories", JSON.stringify(custom));
  }

  /* ── Bootstrap ─────────────────────────────────────────────────── */
  var attempts = 0;
  var bootInterval = setInterval(function () {
    attempts++;
    if (attempts > 50) { clearInterval(bootInterval); return; }
    if (!window.MMED_OS) return;
    clearInterval(bootInterval);
    boot(window.MMED_OS);
  }, 100);

  function boot(app) {
    CalAudio.init();
    loadCustomCategories();

    /* Extend state */
    var cs = app.state.calendar;
    cs.view = "month";
    cs.panelOpen = true;
    cs.todos = [];
    cs.todosLoaded = false;
    cs.filters = {};
    cs.notifications = [
      {id:1,type:"team",from:"Dr. Brian",msg:"Strategy session format updated for next week.",time:"2h ago",read:false},
      {id:2,type:"arena",from:"Arena",msg:"New Stat challenge from @MedWarrior42!",time:"5h ago",read:false},
      {id:3,type:"mentor",from:"Dr. J",msg:"Great progress on Cardiology drills. Keep it up.",time:"1d ago",read:true}
    ];
    CATEGORIES.forEach(function (c) { cs.filters[c.id] = true; });

    /* Override render */
    app.render.calendar = function () { renderCalendarV4(app); };
  }

  /* ── Main Render ───────────────────────────────────────────────── */
  function renderCalendarV4(app) {
    var cs = app.state.calendar;
    var content = document.getElementById("sos-content");
    if (!content) return;

    var month = cs.month;
    var monthLabel = month.toLocaleDateString(undefined, {month:"long",year:"numeric"});

    content.innerHTML = [
      '<section class="sos-page sos-cal4-page">',
      renderTracker(),
      '<div class="sos-cal4-shell">',
      renderLeftPanel(app),
      '<div class="sos-cal4-main">',
      renderToolbar(app, monthLabel),
      '<div class="sos-cal4-body">',
      renderCurrentView(app),
      '</div>',
      '</div>',
      '</div>',
      '</section>'
    ].join("");

    bindCalendarV4(app);
    loadEventsIfNeeded(app);
    loadTodosIfNeeded(app);
  }

  /* ── Match Cycle Tracker ───────────────────────────────────────── */
  function renderTracker() {
    var today = new Date().toISOString().slice(0, 10);
    var html = '<div class="sos-cal4-tracker">';
    TRACKER_PHASES.forEach(function (p, i) {
      var active = today >= p.start && today <= p.end;
      var done = today > p.end;
      var cls = "sos-cal4-phase" + (active ? " is-active" : "") + (done ? " is-done" : "");
      html += '<div class="' + cls + '" data-phase="' + p.id + '" title="' + escA(p.label + ": " + p.start + " to " + p.end) + '">';
      html += '<span class="sos-cal4-phase-icon">' + p.icon + '</span>';
      html += '<span class="sos-cal4-phase-label">' + esc(p.label) + '</span>';
      html += '</div>';
    });
    html += '</div>';
    return html;
  }

  /* ── Left Panel ────────────────────────────────────────────────── */
  function renderLeftPanel(app) {
    var cs = app.state.calendar;
    var open = cs.panelOpen;
    var cls = "sos-cal4-panel" + (open ? "" : " is-collapsed");

    if (!open) {
      var pendingTodos = cs.todos.filter(function (t) { return !t.completed; }).length;
      var unreadNotifs = cs.notifications.filter(function (n) { return !n.read; }).length;
      return [
        '<div class="' + cls + '">',
        '<button class="sos-cal4-collapse-btn" data-panel-toggle title="Expand panel">▶</button>',
        '<div class="sos-cal4-tabs-collapsed">',
        '<div class="sos-cal4-ptab" data-panel-tab="categories" title="Categories"><div class="sos-cal4-ptab-icon" style="background:linear-gradient(135deg,#0b78a8,#17a3cf)">🎨</div></div>',
        '<div class="sos-cal4-ptab" data-panel-tab="todos" title="To-Do List"><div class="sos-cal4-ptab-icon" style="background:linear-gradient(135deg,#36c071,#2ea85f)">✅</div>' + (pendingTodos > 0 ? '<span class="sos-cal4-badge">' + pendingTodos + '</span>' : '') + '</div>',
        '<div class="sos-cal4-ptab" data-panel-tab="notifs" title="Notifications"><div class="sos-cal4-ptab-icon" style="background:linear-gradient(135deg,#8b5cf6,#a78bfa)">🔔</div>' + (unreadNotifs > 0 ? '<span class="sos-cal4-badge">' + unreadNotifs + '</span>' : '') + '</div>',
        '</div>',
        '</div>'
      ].join("");
    }

    return [
      '<div class="' + cls + '">',
      '<button class="sos-cal4-collapse-btn" data-panel-toggle title="Collapse panel">◀</button>',
      '<div class="sos-cal4-panel-content">',
      renderCategoryFilters(app),
      renderTodoList(app),
      '</div>',
      '</div>'
    ].join("");
  }

  function renderCategoryFilters(app) {
    var cs = app.state.calendar;
    var html = '<div class="sos-cal4-section">';
    html += '<div class="sos-cal4-section-head"><span class="sos-cal4-section-title">CATEGORIES</span>';
    html += '<button class="sos-cal4-toggle-all" data-toggle-filters>Toggle All</button></div>';
    CATEGORIES.forEach(function (cat) {
      var on = cs.filters[cat.id] !== false;
      html += '<label class="sos-cal4-filter-chip' + (on ? " is-on" : " is-off") + '" draggable="true" data-cat-drag="' + escA(cat.id) + '">';
      html += '<span class="sos-cal4-filter-dot" style="background:' + cat.color + '"></span>';
      html += '<input type="checkbox" data-filter-cat="' + escA(cat.id) + '"' + (on ? " checked" : "") + ' style="display:none">';
      html += '<span>' + cat.icon + ' ' + esc(cat.label) + '</span>';
      html += '</label>';
    });
    html += '<button class="sos-cal4-add-cat-btn" data-add-category>+ Add Category</button>';
    html += '</div>';
    return html;
  }

  function renderTodoList(app) {
    var cs = app.state.calendar;
    var pending = cs.todos.filter(function (t) { return !t.completed; });
    var done = cs.todos.filter(function (t) { return t.completed; });
    var priColors = {high:"#d95c5c",medium:"#d9b85b",low:"#0e75a8"};

    var html = '<div class="sos-cal4-section">';
    html += '<div class="sos-cal4-section-head"><span class="sos-cal4-section-title">TO-DO <span class="sos-cal4-count">' + pending.length + '</span></span></div>';

    pending.forEach(function (t) {
      html += '<div class="sos-cal4-todo-item" data-todo-click="' + t.id + '">';
      html += '<input type="checkbox" data-todo-check="' + t.id + '">';
      html += '<span class="sos-cal4-todo-title">' + esc(t.title) + '</span>';
      html += '<span class="sos-cal4-todo-pri" style="background:' + (priColors[t.priority] || priColors.medium) + '">' + (t.priority || "MED").toUpperCase().slice(0, 3) + '</span>';
      if (t.meeting_url) html += '<span class="sos-cal4-join-badge" data-join-url="' + escA(t.meeting_url) + '">Join</span>';
      html += '</div>';
    });

    if (done.length > 0) {
      html += '<div class="sos-cal4-todo-done-label">' + done.length + ' completed</div>';
      done.slice(0, 3).forEach(function (t) {
        html += '<div class="sos-cal4-todo-item is-done" data-todo-click="' + t.id + '">';
        html += '<input type="checkbox" checked data-todo-check="' + t.id + '">';
        html += '<span class="sos-cal4-todo-title">' + esc(t.title) + '</span>';
        html += '</div>';
      });
    }

    html += '<div class="sos-cal4-todo-add"><input type="text" placeholder="Add a task..." data-todo-input><button data-todo-add-btn>+</button></div>';
    html += '</div>';
    return html;
  }

  /* ── Toolbar ───────────────────────────────────────────────────── */
  function renderToolbar(app, monthLabel) {
    var cs = app.state.calendar;
    var views = ["month", "week", "day", "agenda"];

    var html = '<div class="sos-cal4-toolbar">';
    html += '<div class="sos-cal4-views">';
    views.forEach(function (v) {
      html += '<button class="sos-cal4-view-btn' + (cs.view === v ? " is-active" : "") + '" data-set-view="' + v + '">' + v.charAt(0).toUpperCase() + v.slice(1) + '</button>';
    });
    html += '</div>';

    html += '<div class="sos-cal4-nav">';
    html += '<button class="sos-cal4-nav-btn" data-cal-prev>◀</button>';
    html += '<button class="sos-cal4-nav-btn sos-cal4-today-btn" data-cal-today>Today</button>';
    html += '<span class="sos-cal4-month-label">' + esc(monthLabel) + '</span>';
    html += '<button class="sos-cal4-nav-btn" data-cal-next>▶</button>';
    html += '</div>';

    html += '<div class="sos-cal4-actions">';
    html += '<button class="sos-cal4-new-btn" data-event-new>+ New Event</button>';
    html += '<button class="sos-cal4-mute-btn" data-mute-toggle title="Toggle sounds">' + (CalAudio.muted ? "🔇" : "🔊") + '</button>';
    html += '</div>';
    html += '</div>';
    return html;
  }

  /* ── View Router ───────────────────────────────────────────────── */
  function renderCurrentView(app) {
    var cs = app.state.calendar;
    var events = filterEvents(cs.events, cs.filters);
    var eventsByDay = typeof bucketEventsByDay === "function" ? bucketEventsByDay(events) : bucketLocal(events);

    switch (cs.view) {
      case "week": return renderWeekView(app, events);
      case "day": return renderDayView(app, events);
      case "agenda": return renderAgendaView(app, events);
      default: return renderMonthView(app, eventsByDay);
    }
  }

  function filterEvents(events, filters) {
    if (!events) return [];
    return events.filter(function (e) {
      var cat = e.category || e.event_type || "general";
      return filters[cat] !== false;
    });
  }

  function bucketLocal(events) {
    var map = {};
    (events || []).forEach(function (e) {
      var key = (e.start_at || "").slice(0, 10);
      if (!map[key]) map[key] = [];
      map[key].push(e);
    });
    return map;
  }

  /* ── Month View ────────────────────────────────────────────────── */
  function renderMonthView(app, eventsByDay) {
    var cs = app.state.calendar;
    var month = cs.month;
    var sm = typeof startOfMonth === "function" ? startOfMonth(month) : new Date(month.getFullYear(), month.getMonth(), 1, 12);
    var sw = typeof startOfWeek === "function" ? startOfWeek(sm) : (function () { var d = new Date(sm); d.setDate(d.getDate() - d.getDay()); return d; })();
    var labels = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
    var todayKey = new Date().toISOString().slice(0, 10);

    var html = '<div class="sos-cal4-month">';
    html += '<div class="sos-cal4-weekdays">' + labels.map(function (l) { return '<span>' + l + '</span>'; }).join("") + '</div>';
    html += '<div class="sos-cal4-grid">';

    for (var i = 0; i < 42; i++) {
      var day = new Date(sw.getTime() + i * 86400000);
      var key = day.toISOString().slice(0, 10);
      var muted = day.getMonth() !== month.getMonth();
      var selected = key === cs.selectedDate;
      var isToday = key === todayKey;
      var dayEvents = eventsByDay[key] || [];
      var cls = "sos-cal4-day" + (muted ? " is-muted" : "") + (selected ? " is-selected" : "") + (isToday ? " is-today" : "");

      html += '<div class="' + cls + '" data-date="' + key + '">';
      html += '<span class="sos-cal4-day-num">' + day.getDate() + '</span>';
      html += '<div class="sos-cal4-day-events">';
      dayEvents.slice(0, 3).forEach(function (e) {
        var color = catColor(e.category || e.event_type);
        html += '<div class="sos-cal4-chip" data-event-id="' + e.id + '" style="border-left:3px solid ' + color + '">';
        html += '<span class="sos-cal4-chip-title">' + esc(e.title) + '</span>';
        if (e.meeting_url) html += '<span class="sos-cal4-join-sm" data-join-url="' + escA(e.meeting_url) + '">Join</span>';
        html += '</div>';
      });
      if (dayEvents.length > 3) html += '<span class="sos-cal4-more">+' + (dayEvents.length - 3) + ' more</span>';
      html += '</div></div>';
    }

    html += '</div></div>';
    return html;
  }

  /* ── Week View ─────────────────────────────────────────────────── */
  function renderWeekView(app, events) {
    var cs = app.state.calendar;
    var sel = cs.selectedDate ? new Date(cs.selectedDate + "T12:00:00") : new Date();
    var weekStart = new Date(sel); weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    var labels = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
    var todayKey = new Date().toISOString().slice(0, 10);
    var hours = [];
    for (var h = 6; h <= 22; h++) hours.push(h);

    var html = '<div class="sos-cal4-week">';
    html += '<div class="sos-cal4-week-header"><div class="sos-cal4-time-gutter"></div>';
    for (var d = 0; d < 7; d++) {
      var day = new Date(weekStart.getTime() + d * 86400000);
      var dk = day.toISOString().slice(0, 10);
      html += '<div class="sos-cal4-week-col-head' + (dk === todayKey ? " is-today" : "") + '">' + labels[d] + ' <strong>' + day.getDate() + '</strong></div>';
    }
    html += '</div>';

    html += '<div class="sos-cal4-week-body">';
    html += '<div class="sos-cal4-time-gutter">';
    hours.forEach(function (h) {
      html += '<div class="sos-cal4-time-label" style="height:60px">' + (h < 10 ? "0" : "") + h + ":00</div>";
    });
    html += '</div>';

    for (var d2 = 0; d2 < 7; d2++) {
      var day2 = new Date(weekStart.getTime() + d2 * 86400000);
      var dk2 = day2.toISOString().slice(0, 10);
      var dayEvts = events.filter(function (e) { return (e.start_at || "").slice(0, 10) === dk2; });

      html += '<div class="sos-cal4-week-col" data-date="' + dk2 + '">';
      hours.forEach(function () { html += '<div class="sos-cal4-hour-slot"></div>'; });

      dayEvts.forEach(function (e) {
        var start = new Date(e.start_at);
        var end = e.end_at ? new Date(e.end_at) : new Date(start.getTime() + 3600000);
        var topMin = (start.getHours() - 6) * 60 + start.getMinutes();
        var durMin = Math.max(15, (end - start) / 60000);
        var top = Math.max(0, topMin);
        var color = catColor(e.category || e.event_type);

        html += '<div class="sos-cal4-week-event" data-event-id="' + e.id + '" style="top:' + top + 'px;height:' + durMin + 'px;border-left:3px solid ' + color + ';background:' + color + '18">';
        html += '<div class="sos-cal4-week-event-title">' + esc(e.title) + '</div>';
        html += '<div class="sos-cal4-week-event-time">' + fmtTimeRange(e.start_at, e.end_at) + '</div>';
        if (e.meeting_url) html += '<span class="sos-cal4-join-sm" data-join-url="' + escA(e.meeting_url) + '">Join</span>';
        html += '<div class="sos-cal4-resize-handle" data-resize-event="' + e.id + '"></div>';
        html += '</div>';
      });
      html += '</div>';
    }
    html += '</div></div>';
    return html;
  }

  /* ── Day View ──────────────────────────────────────────────────── */
  function renderDayView(app, events) {
    var cs = app.state.calendar;
    var dk = cs.selectedDate || new Date().toISOString().slice(0, 10);
    var dayEvts = events.filter(function (e) { return (e.start_at || "").slice(0, 10) === dk; });
    var hours = [];
    for (var h = 6; h <= 22; h++) hours.push(h);

    var html = '<div class="sos-cal4-dayview">';
    html += '<div class="sos-cal4-dayview-header">' + esc(fmtDate(dk + "T12:00:00")) + ' <span class="sos-cal4-day-count">' + dayEvts.length + ' events</span></div>';
    html += '<div class="sos-cal4-dayview-body">';
    html += '<div class="sos-cal4-time-gutter">';
    hours.forEach(function (h) {
      html += '<div class="sos-cal4-time-label" style="height:60px">' + (h < 10 ? "0" : "") + h + ":00</div>";
    });
    html += '</div>';
    html += '<div class="sos-cal4-dayview-col" data-date="' + dk + '">';
    hours.forEach(function () { html += '<div class="sos-cal4-hour-slot"></div>'; });

    dayEvts.forEach(function (e) {
      var start = new Date(e.start_at);
      var end = e.end_at ? new Date(e.end_at) : new Date(start.getTime() + 3600000);
      var topMin = (start.getHours() - 6) * 60 + start.getMinutes();
      var durMin = Math.max(15, (end - start) / 60000);
      var color = catColor(e.category || e.event_type);

      html += '<div class="sos-cal4-day-event" data-event-id="' + e.id + '" style="top:' + Math.max(0, topMin) + 'px;height:' + durMin + 'px;border-left:4px solid ' + color + ';background:' + color + '18">';
      html += '<div class="sos-cal4-day-event-title">' + catIcon(e.category || e.event_type) + ' ' + esc(e.title) + '</div>';
      html += '<div class="sos-cal4-day-event-time">' + fmtTimeRange(e.start_at, e.end_at) + '</div>';
      if (e.description) html += '<div class="sos-cal4-day-event-desc">' + esc(e.description) + '</div>';
      if (e.meeting_url) html += '<a class="sos-cal4-join-btn" href="' + escA(e.meeting_url) + '" target="_blank" rel="noopener">Join ' + esc(e.meeting_platform || "Meeting") + '</a>';
      html += '<div class="sos-cal4-resize-handle" data-resize-event="' + e.id + '"></div>';
      html += '</div>';
    });
    html += '</div></div></div>';
    return html;
  }

  /* ── Agenda View ───────────────────────────────────────────────── */
  function renderAgendaView(app, events) {
    var cs = app.state.calendar;
    var todayStr = new Date().toISOString().slice(0, 10);
    var upcoming = events.filter(function (e) { return (e.start_at || "").slice(0, 10) >= todayStr; })
      .sort(function (a, b) { return (a.start_at || "").localeCompare(b.start_at || ""); })
      .slice(0, 30);

    var grouped = {};
    upcoming.forEach(function (e) {
      var dk = (e.start_at || "").slice(0, 10);
      if (!grouped[dk]) grouped[dk] = [];
      grouped[dk].push(e);
    });

    var html = '<div class="sos-cal4-agenda">';
    html += '<div class="sos-cal4-agenda-events">';

    var days = Object.keys(grouped).sort();
    if (days.length === 0) {
      html += '<div class="sos-cal4-empty">No upcoming events. Create one to get started.</div>';
    }
    days.forEach(function (dk) {
      html += '<div class="sos-cal4-agenda-day"><div class="sos-cal4-agenda-day-head">' + esc(fmtDate(dk + "T12:00:00")) + ' <span class="sos-cal4-count">' + grouped[dk].length + '</span></div>';
      grouped[dk].forEach(function (e) {
        var color = catColor(e.category || e.event_type);
        html += '<div class="sos-cal4-agenda-item" data-event-id="' + e.id + '">';
        html += '<div class="sos-cal4-agenda-color" style="background:' + color + '"></div>';
        html += '<div class="sos-cal4-agenda-info">';
        html += '<div class="sos-cal4-agenda-title">' + catIcon(e.category || e.event_type) + ' ' + esc(e.title) + '</div>';
        html += '<div class="sos-cal4-agenda-time">' + (e.all_day ? "All day" : fmtTimeRange(e.start_at, e.end_at)) + '</div>';
        if (e.meeting_url) html += '<a class="sos-cal4-join-btn" href="' + escA(e.meeting_url) + '" target="_blank" rel="noopener">Join</a>';
        html += '</div></div>';
      });
      html += '</div>';
    });
    html += '</div>';

    /* Sidebar: Todos + Notifications */
    html += '<div class="sos-cal4-agenda-sidebar">';
    html += renderTodoList(app);
    html += renderNotifications(app);
    html += '</div>';
    html += '</div>';
    return html;
  }

  function renderNotifications(app) {
    var cs = app.state.calendar;
    var html = '<div class="sos-cal4-section"><div class="sos-cal4-section-head"><span class="sos-cal4-section-title">NOTIFICATIONS</span></div>';
    cs.notifications.forEach(function (n) {
      var typeColors = {team:"#17a3cf",arena:"#8b5cf6",mentor:"#f06b2f"};
      html += '<div class="sos-cal4-notif' + (n.read ? "" : " is-unread") + '">';
      html += '<div class="sos-cal4-notif-dot" style="background:' + (typeColors[n.type] || "#8ca0b2") + '"></div>';
      html += '<div class="sos-cal4-notif-body"><strong>' + esc(n.from) + '</strong> ' + esc(n.msg) + '<div class="sos-cal4-notif-time">' + esc(n.time) + '</div></div>';
      html += '</div>';
    });
    html += '</div>';
    return html;
  }

  /* ── Event Detail Modal ────────────────────────────────────────── */
  function showEventDetail(app, eventId) {
    var ev = null;
    app.state.calendar.events.forEach(function (e) { if (e.id === eventId) ev = e; });
    if (!ev) return;

    var color = catColor(ev.category || ev.event_type);
    var overlay = document.createElement("div");
    overlay.className = "sos-cal4-overlay";
    overlay.innerHTML = [
      '<div class="sos-cal4-modal">',
      '<div class="sos-cal4-modal-bar" style="background:' + color + '"></div>',
      '<button class="sos-cal4-modal-close" data-close>×</button>',
      '<h3>' + catIcon(ev.category || ev.event_type) + ' ' + esc(ev.title) + '</h3>',
      '<div class="sos-cal4-modal-meta">' + fmtDate(ev.start_at) + ' &middot; ' + fmtTimeRange(ev.start_at, ev.end_at) + '</div>',
      ev.description ? '<p>' + esc(ev.description) + '</p>' : '',
      ev.meeting_url ? '<div class="sos-cal4-meeting-field"><span class="sos-cal4-meeting-label">' + esc(ev.meeting_platform || "Meeting") + ' Link</span><a class="sos-cal4-join-btn" href="' + escA(ev.meeting_url) + '" target="_blank" rel="noopener">Join Now</a></div>' : '',
      '<div class="sos-cal4-modal-actions">',
      '<button class="sos-cal4-btn-danger" data-delete-event="' + ev.id + '">Delete</button>',
      '</div>',
      '</div>'
    ].join("");

    document.body.appendChild(overlay);
    overlay.querySelector("[data-close]").addEventListener("click", function () { overlay.remove(); });
    overlay.addEventListener("click", function (e) { if (e.target === overlay) overlay.remove(); });

    var delBtn = overlay.querySelector("[data-delete-event]");
    if (delBtn) {
      delBtn.addEventListener("click", function () {
        app.api.del("/events/" + ev.id).then(function () {
          overlay.remove();
          app.state.calendar.loadedKey = "";
          app.render.calendar();
          CalAudio.play("drop");
        }).catch(typeof showError === "function" ? showError : function () {});
      });
    }
  }

  /* ── New Event Modal ───────────────────────────────────────────── */
  function showNewEventModal(app, prefillDate, prefillCat) {
    var cat = prefillCat ? catById(prefillCat) : null;
    var defaults = cat && cat.defaults ? cat.defaults : {startTime:"09:00",endTime:"10:00",desc:""};
    var dk = prefillDate || app.state.calendar.selectedDate || new Date().toISOString().slice(0, 10);

    var overlay = document.createElement("div");
    overlay.className = "sos-cal4-overlay";
    var catOptions = CATEGORIES.map(function (c) {
      var sel = prefillCat === c.id ? " selected" : "";
      return '<option value="' + escA(c.id) + '"' + sel + '>' + c.icon + ' ' + esc(c.label) + '</option>';
    }).join("");

    overlay.innerHTML = [
      '<div class="sos-cal4-modal">',
      '<button class="sos-cal4-modal-close" data-close>×</button>',
      '<h3>New Event</h3>',
      '<form data-new-event-form>',
      '<label>Title<input name="title" required placeholder="Event title..." autofocus></label>',
      '<label>Date<input name="date" type="date" value="' + escA(dk) + '" required></label>',
      '<div class="sos-cal4-form-row"><label>Start<input name="start" type="time" value="' + escA(defaults.startTime) + '"></label><label>End<input name="end" type="time" value="' + escA(defaults.endTime) + '"></label></div>',
      '<label>Category<select name="category">' + catOptions + '</select></label>',
      '<label>Description<textarea name="description" rows="3">' + esc(defaults.desc) + '</textarea></label>',
      '<label>Meeting Platform<select name="meeting_platform"><option value="">None</option><option value="webex">Webex</option><option value="zoom">Zoom</option><option value="google_meet">Google Meet</option><option value="teams">Teams</option></select></label>',
      '<label>Meeting URL<input name="meeting_url" type="url" placeholder="https://..."></label>',
      '<button class="sos-cal4-submit-btn" type="submit">Save Event</button>',
      '</form>',
      '</div>'
    ].join("");

    document.body.appendChild(overlay);
    overlay.querySelector("[data-close]").addEventListener("click", function () { overlay.remove(); });
    overlay.addEventListener("click", function (e) { if (e.target === overlay) overlay.remove(); });

    overlay.querySelector("[data-new-event-form]").addEventListener("submit", function (e) {
      e.preventDefault();
      var f = e.currentTarget;
      var body = {
        title: f.elements.title.value,
        start_at: f.elements.date.value + "T" + (f.elements.start.value || "09:00") + ":00",
        end_at: f.elements.date.value + "T" + (f.elements.end.value || "10:00") + ":00",
        event_type: f.elements.category.value || "general",
        category: f.elements.category.value || "general",
        description: f.elements.description.value || "",
        meeting_platform: f.elements.meeting_platform.value || "",
        meeting_url: f.elements.meeting_url.value || ""
      };

      app.api.post("/events", body).then(function () {
        overlay.remove();
        app.state.calendar.loadedKey = "";
        app.render.calendar();
        CalAudio.play("add");
      }).catch(typeof showError === "function" ? showError : function () {});
    });
  }

  /* ── Todo Detail Popup ─────────────────────────────────────────── */
  function showTodoDetail(app, todoId) {
    var todo = null;
    app.state.calendar.todos.forEach(function (t) { if (t.id === todoId) todo = t; });
    if (!todo) return;

    var overlay = document.createElement("div");
    overlay.className = "sos-cal4-overlay";
    overlay.innerHTML = [
      '<div class="sos-cal4-modal">',
      '<button class="sos-cal4-modal-close" data-close>×</button>',
      '<h3>Task Details</h3>',
      '<form data-todo-form>',
      '<label>Title<input name="title" value="' + escA(todo.title) + '" required></label>',
      '<label>Priority<select name="priority"><option value="high"' + (todo.priority === "high" ? " selected" : "") + '>HIGH</option><option value="medium"' + (todo.priority === "medium" ? " selected" : "") + '>MEDIUM</option><option value="low"' + (todo.priority === "low" ? " selected" : "") + '>LOW</option></select></label>',
      '<label>Due Date<input name="due_date" type="date" value="' + escA(todo.due_date || "") + '"></label>',
      '<label>Notes<textarea name="notes" rows="4" placeholder="Add notes...">' + esc(todo.notes || "") + '</textarea></label>',
      '<label>Meeting Platform<select name="meeting_platform"><option value="">None</option><option value="webex"' + (todo.meeting_platform === "webex" ? " selected" : "") + '>Webex</option><option value="zoom"' + (todo.meeting_platform === "zoom" ? " selected" : "") + '>Zoom</option><option value="google_meet"' + (todo.meeting_platform === "google_meet" ? " selected" : "") + '>Google Meet</option><option value="teams"' + (todo.meeting_platform === "teams" ? " selected" : "") + '>Teams</option></select></label>',
      '<label>Meeting URL<input name="meeting_url" type="url" value="' + escA(todo.meeting_url || "") + '" placeholder="https://..."></label>',
      todo.meeting_url ? '<a class="sos-cal4-join-btn" href="' + escA(todo.meeting_url) + '" target="_blank" rel="noopener">Join Now</a>' : '',
      '<label class="sos-cal4-checkbox-label"><input type="checkbox" name="completed"' + (todo.completed ? " checked" : "") + '> Mark as completed</label>',
      '<div class="sos-cal4-modal-actions">',
      '<button class="sos-cal4-submit-btn" type="submit">Save</button>',
      '<button type="button" class="sos-cal4-btn-danger" data-delete-todo="' + todo.id + '">Delete</button>',
      '</div>',
      '</form>',
      '<p class="sos-cal4-tip">Tip: Meeting links auto-populate when enrolled in a session.</p>',
      '</div>'
    ].join("");

    document.body.appendChild(overlay);
    overlay.querySelector("[data-close]").addEventListener("click", function () { overlay.remove(); });
    overlay.addEventListener("click", function (e) { if (e.target === overlay) overlay.remove(); });

    overlay.querySelector("[data-todo-form]").addEventListener("submit", function (e) {
      e.preventDefault();
      var f = e.currentTarget;
      var body = {
        title: f.elements.title.value,
        priority: f.elements.priority.value,
        due_date: f.elements.due_date.value || null,
        notes: f.elements.notes.value || "",
        meeting_platform: f.elements.meeting_platform.value || "",
        meeting_url: f.elements.meeting_url.value || "",
        completed: f.elements.completed.checked
      };

      app.api.put("/todos/" + todo.id, body).then(function () {
        overlay.remove();
        app.state.calendar.todosLoaded = false;
        app.render.calendar();
      }).catch(typeof showError === "function" ? showError : function () {});
    });

    var delBtn = overlay.querySelector("[data-delete-todo]");
    if (delBtn) {
      delBtn.addEventListener("click", function () {
        app.api.del("/todos/" + todo.id).then(function () {
          overlay.remove();
          app.state.calendar.todosLoaded = false;
          app.render.calendar();
        }).catch(typeof showError === "function" ? showError : function () {});
      });
    }
  }

  /* ── Add Category Modal ────────────────────────────────────────── */
  function showAddCategoryModal(app) {
    var colors = ["#0e75a8","#17a3cf","#d9b85b","#f06b2f","#d95c5c","#36c071","#8b5cf6","#4a6a82","#f7f2e5","#ff8a37"];
    var overlay = document.createElement("div");
    overlay.className = "sos-cal4-overlay";
    overlay.innerHTML = [
      '<div class="sos-cal4-modal">',
      '<button class="sos-cal4-modal-close" data-close>×</button>',
      '<h3>Add Category</h3>',
      '<form data-cat-form>',
      '<label>Name<input name="name" required placeholder="Category name..."></label>',
      '<label>Icon (emoji)<input name="icon" placeholder="📌" maxlength="4"></label>',
      '<div class="sos-cal4-color-picker">' + colors.map(function (c) { return '<label class="sos-cal4-color-dot"><input type="radio" name="color" value="' + c + '"><span style="background:' + c + '"></span></label>'; }).join("") + '</div>',
      '<div class="sos-cal4-form-row"><label>Default Start<input name="startTime" type="time" value="09:00"></label><label>Default End<input name="endTime" type="time" value="10:00"></label></div>',
      '<button class="sos-cal4-submit-btn" type="submit">Add Category</button>',
      '</form>',
      '</div>'
    ].join("");

    document.body.appendChild(overlay);
    overlay.querySelector("[data-close]").addEventListener("click", function () { overlay.remove(); });
    overlay.addEventListener("click", function (e) { if (e.target === overlay) overlay.remove(); });

    overlay.querySelector("[data-cat-form]").addEventListener("submit", function (e) {
      e.preventDefault();
      var f = e.currentTarget;
      var name = f.elements.name.value.trim();
      var id = name.toLowerCase().replace(/[^a-z0-9]+/g, "_");
      if (!id || catById(id)) { alert("Category already exists or invalid name."); return; }

      var newCat = {
        id: id, label: name,
        color: f.elements.color.value || "#8ca0b2",
        icon: f.elements.icon.value || "📌",
        builtin: false,
        defaults: { startTime: f.elements.startTime.value || "09:00", endTime: f.elements.endTime.value || "10:00", desc: "" }
      };
      CATEGORIES.push(newCat);
      app.state.calendar.filters[newCat.id] = true;
      saveCustomCategories();
      overlay.remove();
      app.render.calendar();
      CalAudio.play("add");
    });
  }

  /* ── Event Binding ─────────────────────────────────────────────── */
  function bindCalendarV4(app) {
    var content = document.getElementById("sos-content");
    if (!content) return;

    /* Panel toggle */
    content.querySelectorAll("[data-panel-toggle]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        app.state.calendar.panelOpen = !app.state.calendar.panelOpen;
        app.render.calendar();
        CalAudio.play("click");
      });
    });

    /* Collapsed tabs */
    content.querySelectorAll("[data-panel-tab]").forEach(function (tab) {
      tab.addEventListener("click", function () {
        app.state.calendar.panelOpen = true;
        app.render.calendar();
        CalAudio.play("click");
      });
    });

    /* View switcher */
    content.querySelectorAll("[data-set-view]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        app.state.calendar.view = btn.getAttribute("data-set-view");
        app.render.calendar();
        CalAudio.play("nav");
      });
    });

    /* Navigation */
    var prev = content.querySelector("[data-cal-prev]");
    var next = content.querySelector("[data-cal-next]");
    var today = content.querySelector("[data-cal-today]");

    if (prev) prev.addEventListener("click", function () {
      app.state.calendar.month = typeof addMonths === "function" ? addMonths(app.state.calendar.month, -1) : new Date(app.state.calendar.month.getFullYear(), app.state.calendar.month.getMonth() - 1, 1, 12);
      app.state.calendar.loadedKey = "";
      app.render.calendar();
      CalAudio.play("nav");
    });

    if (next) next.addEventListener("click", function () {
      app.state.calendar.month = typeof addMonths === "function" ? addMonths(app.state.calendar.month, 1) : new Date(app.state.calendar.month.getFullYear(), app.state.calendar.month.getMonth() + 1, 1, 12);
      app.state.calendar.loadedKey = "";
      app.render.calendar();
      CalAudio.play("nav");
    });

    if (today) today.addEventListener("click", function () {
      app.state.calendar.month = typeof startOfMonth === "function" ? startOfMonth(new Date()) : new Date(new Date().getFullYear(), new Date().getMonth(), 1, 12);
      app.state.calendar.selectedDate = new Date().toISOString().slice(0, 10);
      app.state.calendar.loadedKey = "";
      app.render.calendar();
      CalAudio.play("nav");
    });

    /* New event */
    var newBtn = content.querySelector("[data-event-new]");
    if (newBtn) newBtn.addEventListener("click", function () { showNewEventModal(app); });

    /* Mute toggle */
    var muteBtn = content.querySelector("[data-mute-toggle]");
    if (muteBtn) muteBtn.addEventListener("click", function () {
      CalAudio.toggle();
      muteBtn.textContent = CalAudio.muted ? "🔇" : "🔊";
    });

    /* Day clicks (month view) */
    content.querySelectorAll(".sos-cal4-day").forEach(function (dayEl) {
      dayEl.addEventListener("click", function (e) {
        if (e.target.closest("[data-event-id]") || e.target.closest("[data-join-url]")) return;
        app.state.calendar.selectedDate = dayEl.getAttribute("data-date");
        app.render.calendar();
        CalAudio.play("click");
      });
      dayEl.addEventListener("dblclick", function () {
        showNewEventModal(app, dayEl.getAttribute("data-date"));
      });
    });

    /* Event chips click */
    content.querySelectorAll("[data-event-id]").forEach(function (chip) {
      chip.addEventListener("click", function (e) {
        if (e.target.closest("[data-join-url]")) return;
        var id = parseInt(chip.getAttribute("data-event-id"), 10);
        if (id) showEventDetail(app, id);
      });
    });

    /* Join buttons */
    content.querySelectorAll("[data-join-url]").forEach(function (btn) {
      btn.addEventListener("click", function (e) {
        e.stopPropagation();
        window.open(btn.getAttribute("data-join-url"), "_blank");
      });
    });

    /* Category filters */
    content.querySelectorAll("[data-filter-cat]").forEach(function (cb) {
      cb.addEventListener("change", function () {
        app.state.calendar.filters[cb.getAttribute("data-filter-cat")] = cb.checked;
        app.render.calendar();
      });
    });

    /* Toggle all filters */
    var toggleAll = content.querySelector("[data-toggle-filters]");
    if (toggleAll) toggleAll.addEventListener("click", function () {
      var anyOff = false;
      CATEGORIES.forEach(function (c) { if (app.state.calendar.filters[c.id] === false) anyOff = true; });
      CATEGORIES.forEach(function (c) { app.state.calendar.filters[c.id] = anyOff; });
      app.render.calendar();
    });

    /* Add category */
    var addCat = content.querySelector("[data-add-category]");
    if (addCat) addCat.addEventListener("click", function () { showAddCategoryModal(app); });

    /* Todo checkboxes */
    content.querySelectorAll("[data-todo-check]").forEach(function (cb) {
      cb.addEventListener("change", function (e) {
        e.stopPropagation();
        var id = parseInt(cb.getAttribute("data-todo-check"), 10);
        app.api.put("/todos/" + id, {completed: cb.checked}).then(function () {
          app.state.calendar.todosLoaded = false;
          app.render.calendar();
        }).catch(typeof showError === "function" ? showError : function () {});
      });
    });

    /* Todo click for detail */
    content.querySelectorAll("[data-todo-click]").forEach(function (el) {
      el.addEventListener("click", function (e) {
        if (e.target.closest("[data-todo-check]") || e.target.closest("[data-join-url]")) return;
        var id = parseInt(el.getAttribute("data-todo-click"), 10);
        if (id) showTodoDetail(app, id);
      });
    });

    /* Add todo */
    var todoInput = content.querySelector("[data-todo-input]");
    var todoAddBtn = content.querySelector("[data-todo-add-btn]");
    function addTodo() {
      if (!todoInput || !todoInput.value.trim()) return;
      app.api.post("/todos", {title: todoInput.value.trim(), priority: "medium"}).then(function () {
        app.state.calendar.todosLoaded = false;
        app.render.calendar();
        CalAudio.play("add");
      }).catch(typeof showError === "function" ? showError : function () {});
    }
    if (todoInput) todoInput.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); addTodo(); } });
    if (todoAddBtn) todoAddBtn.addEventListener("click", addTodo);

    /* Category drag-drop to dates */
    content.querySelectorAll("[data-cat-drag]").forEach(function (el) {
      el.addEventListener("dragstart", function (e) {
        e.dataTransfer.setData("text/plain", el.getAttribute("data-cat-drag"));
        e.dataTransfer.effectAllowed = "copy";
      });
    });

    content.querySelectorAll("[data-date]").forEach(function (dayEl) {
      dayEl.addEventListener("dragover", function (e) { e.preventDefault(); dayEl.classList.add("is-drop-target"); });
      dayEl.addEventListener("dragleave", function () { dayEl.classList.remove("is-drop-target"); });
      dayEl.addEventListener("drop", function (e) {
        e.preventDefault();
        dayEl.classList.remove("is-drop-target");
        var catId = e.dataTransfer.getData("text/plain");
        if (catId && catById(catId)) {
          showNewEventModal(app, dayEl.getAttribute("data-date"), catId);
          CalAudio.play("drop");
        }
      });
    });

    /* Tracker phase clicks */
    content.querySelectorAll("[data-phase]").forEach(function (el) {
      el.addEventListener("click", function () {
        var phase = TRACKER_PHASES.filter(function (p) { return p.id === el.getAttribute("data-phase"); })[0];
        if (phase) {
          var d = new Date(phase.start + "T12:00:00");
          app.state.calendar.month = typeof startOfMonth === "function" ? startOfMonth(d) : new Date(d.getFullYear(), d.getMonth(), 1, 12);
          app.state.calendar.selectedDate = phase.start;
          app.state.calendar.loadedKey = "";
          app.render.calendar();
        }
      });
    });
  }

  /* ── Data Loading ──────────────────────────────────────────────── */
  function loadEventsIfNeeded(app) {
    if (typeof window.MMED_OS === "undefined") return;
    var cs = app.state.calendar;
    var monthKey = cs.month.getFullYear() + "-" + cs.month.getMonth();

    if (cs.loadedKey === monthKey || cs.loading) return;

    var sm = typeof startOfMonth === "function" ? startOfMonth(cs.month) : new Date(cs.month.getFullYear(), cs.month.getMonth(), 1, 12);
    var sw = typeof startOfWeek === "function" ? startOfWeek(sm) : (function () { var d = new Date(sm); d.setDate(d.getDate() - d.getDay()); return d; })();
    var rangeEnd = new Date(sw.getTime() + 42 * 86400000);

    cs.loading = true;
    app.api.get("/events", {
      start: sw.toISOString().slice(0, 10) + "T00:00:00",
      end: rangeEnd.toISOString().slice(0, 10) + "T23:59:59"
    }).then(function (data) {
      cs.events = data && Array.isArray(data.events) ? data.events : [];
      cs.loadedKey = monthKey;
      cs.loading = false;
      if (app.state.route === "calendar") app.render.calendar();
    }).catch(function (err) {
      cs.loading = false;
      if (typeof showError === "function") showError(err);
    });
  }

  function loadTodosIfNeeded(app) {
    var cs = app.state.calendar;
    if (cs.todosLoaded) return;

    app.api.get("/todos").then(function (data) {
      cs.todos = data && Array.isArray(data.todos) ? data.todos : [];
      cs.todosLoaded = true;
      if (app.state.route === "calendar") app.render.calendar();
    }).catch(function () {
      cs.todosLoaded = true;
    });
  }

})();
