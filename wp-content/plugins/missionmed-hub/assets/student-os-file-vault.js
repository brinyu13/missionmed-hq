(function () {
	"use strict";

	var app = window.MMED_OS || {};
	var state = {
		mode: "student",
		view: "list",
		selectedFolder: "",
		selectedFile: null,
		folders: [],
		files: [],
		shared: [],
		students: [],
		queue: [],
		audit: [],
		comments: [],
		versions: [],
		score: null,
		filtersOpen: false,
		search: "",
		loading: false,
		error: "",
		storageReady: false,
		schemaReady: false
	};

	var statusMeta = {
		draft: ["Draft", "draft"],
		submitted: ["Submitted", "sub"],
		in_review: ["In Review", "rev"],
		reviewed: ["Reviewed", "revd"],
		needs_changes: ["Needs Changes", "need"],
		final: ["Final", "final"],
		archived: ["Archived", "arch"]
	};

	var docLabels = {
		personal_statement: "Personal Statement",
		lor: "Letter of Recommendation",
		cv: "CV",
		timeline: "Timeline",
		certificate: "Certificate",
		application: "Application",
		other: "Document"
	};
	var routeGuardTimer = null;
	var routeObserver = null;
	var patchPoll = null;
	var patchPollStop = null;

	function apiGet(endpoint, params) {
		return app.api && app.api.get ? app.api.get(endpoint, params) : Promise.reject(new Error("Matrix API unavailable."));
	}

	function apiGetSoft(endpoint, fallback) {
		var settled = false;
		return new Promise(function (resolve) {
			var timer = window.setTimeout(function () {
				settled = true;
				resolve(fallback || {});
			}, 4500);
			apiGet(endpoint).then(function (data) {
				if (settled) return;
				settled = true;
				window.clearTimeout(timer);
				resolve(data || fallback || {});
			}).catch(function () {
				if (settled) return;
				settled = true;
				window.clearTimeout(timer);
				resolve(fallback || {});
			});
		});
	}

	function apiPost(endpoint, body) {
		return app.api && app.api.post ? app.api.post(endpoint, body) : Promise.reject(new Error("Matrix API unavailable."));
	}

	function apiPut(endpoint, body) {
		return app.api && app.api.put ? app.api.put(endpoint, body) : Promise.reject(new Error("Matrix API unavailable."));
	}

	function renderFileVaultV1() {
		var root = document.getElementById("sos-content");
		if (!root) return;
		setRouteChrome(true);
		root.innerHTML = shell();
		bindShell(root);
		loadStudentData().then(function () {
			if (isAdmin() && state.mode === "admin") return loadAdminData();
			if (state.mode === "docdocs" && state.selectedFile) return loadFileDetail(state.selectedFile.id);
		}).then(draw).catch(showError);
	}

	function shell() {
		return [
			'<section class="sos-page sos-filevault-v1">',
			'<header class="hdr">',
			'<div class="logo"><img src="https://missionmedinstitute.com/wp-content/uploads/2026/02/608a69b125647f6e63b56f87b823b1e60dbdaebf4916b1d5d5edcc408b8ab3fe.png" alt="MissionMed"><div class="crumb"><span>Matrix</span> / <b>' + crumbTitle() + '</b></div></div>',
			'<div class="badges"><a class="fv-return" href="#dashboard" aria-label="Return to Matrix Dashboard"><span aria-hidden="true">&larr;</span> Matrix Dashboard</a><span class="sec sec-priv">&#128274; Private Vault</span><span class="sec sec-sign">&#9989; Signed Downloads</span><span class="sec sec-course">No Public Links</span></div>',
			'</header>',
			'<div class="nav">',
			modeToggle(),
			'<div class="srch"><span class="si">&#128269;</span><input type="search" data-fv-search placeholder="Search files, comments, scores, versions..." value="' + escAttr(state.search) + '"><span class="sk">&#8984;K</span></div>',
			'<div class="tg" data-fv-view><button data-view="list" class="' + onClass(state.view === "list") + '">&#9776; List</button><button data-view="grid" class="' + onClass(state.view === "grid") + '">&#9638; Grid</button></div>',
			'<button class="btn btn-g" data-fv-filter>&#9881; Filters</button>',
			'<button class="btn btn-p" data-fv-open-upload>&#8679; Upload</button>',
			"</div>",
			filterDrawer(),
			state.error ? '<div class="fv-alert">' + esc(state.error) + "</div>" : "",
			'<div data-fv-body>' + loadingMarkup() + "</div>",
			"</section>"
		].join("");
	}

	function modeToggle() {
		var adminButton = isAdmin() ? '<button data-mode="admin" class="' + onClass(state.mode === "admin") + '">&#128736; Admin</button>' : "";
		return '<div class="tg" data-fv-mode><button data-mode="student" class="' + onClass(state.mode === "student") + '">&#128100; Student</button>' + adminButton + '<button data-mode="docdocs" class="' + onClass(state.mode === "docdocs") + '">&#128196; Doc Docs</button></div>';
	}

	function crumbTitle() {
		if (state.mode === "admin") return "Admin Command Center";
		if (state.mode === "docdocs") return "Doc Docs Studio";
		return "File Vault";
	}

	function filterDrawer() {
		return [
			'<div class="fdr' + (state.filtersOpen ? ' open' : '') + '"><div class="fdr-grid">',
			filterGroup("Division", ["All", "Mission Residency", "USMLE / Dr J", "Clinicals"]),
			filterGroup("Document Type", ["Personal Statement", "LOR", "CV", "Timeline"]),
			filterGroup("Status", ["Draft", "Submitted", "In Review", "Needs Changes", "Final"]),
			filterGroup("Review State", ["All", "Not Viewed", "Viewed", "Reviewed"]),
			filterGroup("Score Range", ["Not Scored", "1-40 Not Ready", "41-65 Needs Work", "66-80 Competitive", "81-90 Strong", "91+ Final Ready"]),
			filterGroup("Date", ["Today", "This Week", "This Month"]),
			"</div></div>"
		].join("");
	}

	function filterGroup(label, values) {
		return '<div class="fg"><div class="fg-lab">' + esc(label) + '</div><div class="fc">' + values.map(function (value, index) {
			return '<button class="chip' + (index === 0 ? ' on' : '') + '" type="button">' + esc(value) + "</button>";
		}).join("") + "</div></div>";
	}

	function draw() {
		var body = document.querySelector(".sos-filevault-v1 [data-fv-body]");
		if (!body) return;
		if (state.loading) {
			body.innerHTML = loadingMarkup();
			return;
		}
		if (state.mode === "admin" && isAdmin()) {
			body.innerHTML = adminView();
		} else if (state.mode === "docdocs") {
			body.innerHTML = docDocsView();
		} else {
			body.innerHTML = studentView();
		}
		bindBody(body);
	}

	function studentView() {
		return [
			'<div class="view on" id="v-student"><div class="nx-lay">',
			'<aside class="nx-left">',
			'<div class="side-sec"><div class="side-label">Mission Residency</div><div class="side-nav">' + state.folders.map(folderNav).join("") + "</div></div>",
			'<div class="side-sec"><div class="side-label">Quick Actions</div><button class="btn btn-p btn-sm side-wide" data-fv-open-upload>&#8679; Upload File</button><button class="btn btn-s btn-sm side-wide" data-fv-new-folder>&#128193; New Folder</button></div>',
			'<div class="side-sec"><div class="side-label">Document Health</div><div class="side-health">' + state.folders.map(folderHealth).join("") + "</div></div>",
			'<div class="side-sec"><div class="side-label">Next Recommended</div><div class="next-card">&#9888;&#65039; ' + esc(nextActionText()) + '<br><span>Due: May 25, 2026</span></div></div>',
			"</aside>",
			'<main class="nx-main">',
			uploadDropZone(),
			'<div class="demo-section-head"><h3>My Folders</h3><span>' + esc(folderSummary()) + "</span></div>",
			'<div class="fold-grid">' + state.folders.map(folderCard).join("") + "</div>",
			'<div class="demo-section-head"><h3>Recent Files</h3><div><button class="chip on" type="button">All</button><button class="chip" type="button"><span class="dot dot-need"></span>Needs Changes</button><button class="chip" type="button"><span class="dot dot-rev"></span>In Review</button></div></div>',
			state.view === "grid" ? fileGrid(filteredFiles()) : fileList(filteredFiles()),
			'<div class="demo-section-head"><h3>&#128230; Shared With Me / MissionMed Downloads</h3><span class="sec sec-course">&#128274; Course Access</span></div>',
			sharedList(),
			"</main>",
			'<aside class="nx-right">' + detailPanel() + "</aside>",
			"</div></div>"
		].join("");
	}

	function adminView() {
		var needsReview = state.queue.length;
		var inReview = state.queue.filter(function (item) { return item.status === "in_review"; }).length;
		var finalCount = state.files.filter(function (item) { return item.status === "final"; }).length;
		return [
			'<div class="view on" id="v-admin"><div class="cl-lay"><div class="bn">',
			statCard("Needs Review", needsReview, "var(--red)", 80),
			statCard("In Review", inReview, "var(--amber)", 40),
			statCard("Final", finalCount, "var(--green)", 100),
			statCard("Missing Docs", "V1.5", "var(--red)", 60),
			'<div class="bc span-8 no-pad">' + panelHeader("Review Queue", '<div class="queue-tabs"><button class="chip on" type="button">Needs Review</button><button class="chip" type="button">Not Viewed</button><button class="chip" type="button">Returned</button><button class="chip" type="button">New Version</button><button class="chip" type="button">Final Candidates</button></div>') + queueList() + "</div>",
			'<div class="bc span-4 no-pad">' + panelHeader("Student Attention", "") + '<div class="heat-wrap">' + heatmap() + "</div>" + panelHeader("Activity Feed", "") + activityList() + "</div>",
			'<div class="bc span-8 no-pad">' + panelHeader("Student Folder Browser", '<span class="cnt">' + state.students.length + " students</span>") + studentBrowser() + "</div>",
			'<div class="bc span-4">' + '<div class="mini-title">Missing Required</div>' + missingRadar() + adminActions() + "</div>",
			'<div class="bc span-12 no-pad">' + panelHeader("Audit Trail", '<span class="cnt">Last 48 hours</span>') + auditTrail() + "</div>",
			"</div></div></div>"
		].join("");
	}

	function statCard(label, value, color, width) {
		return '<div class="bc span-3"><div class="stat-label">' + esc(label) + '</div><div class="stat-value" style="color:' + escAttr(color) + '">' + esc(value) + '</div><div class="hm"><div class="hb"><div class="hf" style="width:' + Number(width || 0) + '%;background:' + escAttr(color) + '"></div></div></div></div>';
	}

	function docDocsView() {
		var file = state.selectedFile || state.files[0] || null;
		var score = state.score || {};
		var adminControls = isAdmin() ? '<button class="btn btn-p btn-sm" data-fv-admin-status="final">&#9989; Mark Final</button><button class="btn btn-d btn-sm" data-fv-admin-status="needs_changes">&#8617;&#65039; Request Changes</button>' : "";
		return [
			'<div class="view on" id="v-docdocs"><div class="dd-lay">',
			'<main class="dd-canvas">',
			'<div class="pan doc-top"><div><span class="doc-title">&#128196; ' + esc(file ? docLabel(file.document_type) : "Doc Docs Studio") + "</span>" + (file ? statusBadge(file.status) : '<span class="sb sb-draft">No Document Selected</span>') + '<span class="sec sec-priv">&#128274; Private</span></div><div>' + (file ? '<button class="btn btn-s btn-sm" data-fv-download="' + escAttr(file.id) + '">&#128190; Download</button>' + adminControls + '<button class="btn btn-s btn-sm" data-fv-version>&#128228; Upload New Version</button>' : '<button class="btn btn-p btn-sm" data-fv-open-upload>&#8679; Upload File</button>') + "</div></div>",
			lineEditToolbar(),
			documentCanvas(file),
			"</main>",
			'<aside class="dd-side">',
			scorePanel(score),
			timeMachine(),
			commentsPanel(),
			changelogPanel(),
			"</aside>",
			"</div></div>"
		].join("");
	}

	function uploadDropZone() {
		return [
			'<div class="dz" data-fv-drop>',
			'<input type="file" data-fv-file-input hidden>',
			'<div class="dzi">&#128451;</div>',
			'<div class="dzt">Drop files here or click to upload</div>',
			'<div class="dzh">DOCX, PDF, XLSX, PNG, JPG &bull; Max 25MB &bull; No public links</div>',
			state.storageReady ? "" : '<div class="storage-note">Private storage enablement flag is currently closed.</div>',
			"</div>"
		].join("");
	}

	function documentCanvas(file) {
		if (!file) {
			return '<div class="doc-prev empty-doc"><div class="dp-content"><h2>Doc Docs Studio</h2><p>Select a file or upload a harmless draft to open the secure review workspace.</p><p><span class="marker strong">Comments</span>, <span class="marker keep">version history</span>, <span class="marker tone">scoring</span>, and <span class="marker revise">line-edit scaffolds</span> remain visible even when the file list is empty.</p></div></div>';
		}
		return '<div class="doc-prev"><div class="dp-content"><h2>' + esc(file.display_name || docLabel(file.document_type)) + '</h2><p><span class="marker strong">Secure document preview scaffold<span class="mtip">Strong Line: V2 editor marker scaffold</span></span> keeps advisor comments and status workflow in one place while the original file remains private.</p><p>The canonical display name is <span class="marker keep">' + esc(shortName(file.canonical_name || "generated after upload")) + '<span class="mtip">Private metadata, signed download only</span></span>.</p><p><span class="marker generic">Full body rendering and inline DOCX editing remain V2<span class="mtip">V1.5/V2: not falsely claimed complete</span></span>; V1 focuses on signed downloads, comments, version history, scoring metadata, and finalization.</p></div></div>';
	}

	function folderCard(folder) {
		var selected = folder.id && state.selectedFolder === folder.id ? " is-selected" : "";
		return '<button class="fold' + selected + '" data-fv-folder="' + escAttr(folder.id || "") + '"><span class="fi">' + folderIcon(folder.slug) + '</span><span class="fn">' + esc(folder.name || "Folder") + '</span><span class="fm"><span>' + countForFolder(folder.id) + ' files</span><span>' + esc(shortDate(folder.updated_at) || "Ready") + '</span></span>' + ring(folderCompletion(folder), folderTone(folder)) + "</button>";
	}

	function folderNav(folder) {
		var selected = folder.id && state.selectedFolder === folder.id ? " is-selected" : "";
		return '<button class="side-link' + selected + '" data-fv-folder="' + escAttr(folder.id || "") + '"><span>' + folderIcon(folder.slug) + " " + esc(folder.name || "Folder") + "</span><b>" + countForFolder(folder.id) + "</b></button>";
	}

	function folderHealth(folder) {
		var percent = folderCompletion(folder);
		return '<div class="hm side-hm"><span>' + esc(folder.name || "") + '</span><div class="hb"><div class="hf" style="width:' + percent + '%;background:' + escAttr(folderTone(folder)) + '"></div></div><b class="hl">' + percent + "%</b></div>";
	}

	function fileList(files) {
		if (!files.length) return emptyPanel("No files in this view", "Upload metadata and review status will appear here.");
		return '<div class="fl">' + files.map(function (file) {
			return '<button class="fr' + selectedClass(file) + '" data-fv-file="' + escAttr(file.id) + '"><span class="fic ' + fileTypeClass(file) + '">' + fileType(file) + '</span><span class="fname">' + esc(file.display_name || file.original_filename || "File") + '<span class="canon">' + esc(shortName(file.canonical_name || "")) + '</span></span><time class="fdate">' + esc(shortDate(file.updated_at || file.created_at)) + "</time>" + statusBadge(file.status) + '<span class="fsize">' + esc(formatSize(file.file_size)) + '</span><span class="fview">' + esc(reviewState(file.status)) + '</span><span class="file-actions">&#8942;</span></button>';
		}).join("") + "</div>";
	}

	function fileGrid(files) {
		if (!files.length) return emptyPanel("No files in this view", "Upload metadata and review status will appear here.");
		return '<div class="fg-grid">' + files.map(function (file) {
			return '<button class="fg-c' + selectedClass(file) + '" data-fv-file="' + escAttr(file.id) + '"><span class="gic fic ' + fileTypeClass(file) + '">' + fileType(file) + '</span><span class="gn">' + esc(file.display_name || "File") + '</span><span class="gm">' + esc(docLabel(file.document_type)) + '</span><span class="gs">' + statusBadge(file.status) + "</span></button>";
		}).join("") + "</div>";
	}

	function sharedList() {
		if (!state.shared.length) return emptyPanel("No shared downloads yet", "MissionMed course resources will appear here when granted.");
		return '<div class="shared-list">' + state.shared.map(function (item) {
			return '<button class="fr shared-row" data-fv-shared-download="' + escAttr(item.id) + '"><span class="fic pdf">PDF</span><span class="fname">' + esc(item.title || "Shared Resource") + '<span class="canon">' + esc(item.category || "course") + '</span></span><span class="sec sec-sign">Signed download</span></button>';
		}).join("") + "</div>";
	}

	function detailPanel() {
		var file = state.selectedFile || state.files[0];
		if (!file) return '<div class="empty-detail"><div class="empty-icon">&#128196;</div><strong>Select a file to preview</strong><span>Canonical names, review states, comments, version history, and security state appear here.</span></div>';
		return [
			'<div class="pan detail-pan"><div class="pan-h"><h3>File Detail</h3><span class="sec sec-priv">&#128274; Private</span></div><div class="detail-body">',
			'<h3>' + esc(file.display_name || file.original_filename || "File") + "</h3>",
			statusBadge(file.status),
			'<dl><dt>Canonical</dt><dd>' + esc(file.canonical_name || "Generated after upload") + '</dd><dt>Document Type</dt><dd>' + esc(docLabel(file.document_type)) + '</dd><dt>Security</dt><dd>Private metadata, signed URL only</dd></dl>',
			'<div class="detail-actions"><button class="btn btn-s btn-sm" data-fv-download="' + escAttr(file.id) + '">&#128190; Download</button><button class="btn btn-p btn-sm" data-fv-status="submitted">Submit for Review</button><button class="btn btn-s btn-sm" data-fv-docdocs>Open Doc Docs</button></div>',
			"</div></div>"
		].join("");
	}

	function queueList() {
		if (!state.queue.length) return emptySmall("No submitted files are waiting.");
		return '<div class="queue-list">' + state.queue.map(function (item) {
			return '<button class="rqi" data-fv-admin-file="' + escAttr(item.id) + '"><span class="av">' + initials(item.student_name || "Student") + '</span><span class="si"><span class="sn">' + esc(item.student_name || "Student") + '</span><span class="dt">' + esc(docLabel(item.document_type)) + ' &bull; ' + esc(item.draft_version || "Draft") + '</span></span><time>' + esc(shortDate(item.updated_at || item.created_at)) + '</time>' + statusBadge(item.status) + '<span class="score-mini">' + esc(item.total_score || "--") + '</span><span class="btn btn-p btn-sm">Review</span></button>';
		}).join("") + "</div>";
	}

	function studentBrowser() {
		if (!state.students.length) return emptySmall("No student rows available.");
		return '<div class="student-list">' + state.students.map(function (student) {
			return '<button class="student-row" data-fv-student="' + escAttr(student.id) + '"><span class="av">' + initials(student.name || "Student") + '</span><span><strong>' + esc(student.name || "Student") + '</strong><small>' + esc(student.course || "MissionMed") + " &bull; Session " + esc(student.session || "X") + '</small></span><b>' + esc(student.files || 0) + ' files</b><em>' + esc(student.pending_review || 0) + ' pending</em><time>' + esc(shortDate(student.last_activity_at || student.updated_at)) + '</time><span class="attention">&#9888; ' + esc(student.attention_score || "") + '</span><span class="score-mini">' + esc(student.top_score || "--") + '/100</span><span>Browse &#8594;</span></button>';
		}).join("") + "</div>";
	}

	function heatmap() {
		var cells = state.students.slice(0, 24);
		if (!cells.length) cells = [{ attention_score: 0 }, { attention_score: 1 }, { attention_score: 2 }, { attention_score: 3 }];
		return '<div class="heat">' + cells.map(function (student) {
			var level = Math.min(4, Number(student.attention_score || 0));
			return '<span class="hc lv' + level + '" title="' + escAttr(student.name || "Attention") + '">' + esc(initials(student.name || "")) + "</span>";
		}).join("") + "</div>";
	}

	function activityList() {
		if (!state.audit.length) return emptySmall("Audit events will appear here.");
		return '<div class="afeed">' + state.audit.slice(0, 6).map(function (event, index) {
			return '<div class="ai"><span class="adot lv' + (index % 5) + '"></span><span class="atxt"><b>' + esc(event.action || "event") + "</b> " + esc(event.resource_type || "") + '</span><span class="ago">' + esc(shortDate(event.created_at)) + "</span></div>";
		}).join("") + "</div>";
	}

	function missingRadar() {
		return '<div class="mdr"><div class="mi"><div class="mn">Timeline</div><div class="md">Due: May 25, 2026</div></div><div class="mi"><div class="mn">LOR #2</div><div class="md">Due: Jun 1, 2026</div></div><div class="mi"><div class="mn">CV / Resume</div><div class="md">V1.5 deadline scaffold</div></div></div>';
	}

	function adminActions() {
		return '<div class="fv-admin-actions"><button class="btn btn-p btn-sm">&#128230; Share Resource</button><button class="btn btn-s btn-sm">&#128203; Export Audit Log</button><button class="btn btn-s btn-sm">&#128202; Score Overview</button></div>';
	}

	function auditTrail() {
		if (!state.audit.length) return emptySmall("No audit rows are available yet.");
		return '<div class="clog audit-list">' + state.audit.map(function (event, index) {
			return '<div class="le"><span class="li sts">' + (index + 1) + '</span><span class="lt"><b>' + esc(event.action || "event") + '</b> ' + esc(event.resource_type || "resource") + '</span><time class="ltime">' + esc(shortDate(event.created_at)) + "</time></div>";
		}).join("") + "</div>";
	}

	function lineEditToolbar() {
		var markers = ["Too Generic", "Needs Specificity", "Strong Line", "Program Fit", "Tone Issue", "Red Flag", "Grammar", "Keep This", "Revise Opening", "Strengthen Closing"];
		return '<div class="le-toolbar">' + markers.map(function (item, index) {
			return '<button type="button" class="' + (index === 2 ? 'active' : '') + '">' + markerIcon(item) + " " + esc(item) + "</button>";
		}).join("") + "</div>";
	}

	function scorePanel(score) {
		var total = Number(score.total_score || 0);
		var ready = score.readiness_label || readiness(total);
		var rows = ["Overall Strength", "Authenticity", "Specificity", "Structure", "Residency Fit", "Red Flag Handling", "Opening Hook", "Closing Strength", "Grammar/Polish", "Interview Alignment"];
		return '<div class="score-panel"><h4>&#127919; Document Score</h4><div class="score-total"><div class="st-num">' + (total || "--") + '</div><div><div class="st-label">Overall Strength</div><div class="st-delta up">&#9650; Schema-ready scoring</div><span class="st-ready sr-strong">' + esc(ready) + '</span></div></div>' + rows.map(function (row, index) {
			var value = total ? Math.max(25, Math.min(95, total - index * 2)) : 0;
			return '<div class="score-row"><span class="srl">' + esc(row) + '</span><span class="srbar"><span class="srf" style="width:' + value + '%;background:' + scoreColor(value) + '"></span></span><span class="srv">' + (value || "V1.5") + "</span></div>";
		}).join("") + '<div class="score-trend"><div class="trend-lab">Score Trend by Version</div><div class="trend-bars"><span class="trend-bar" style="height:45%"></span><span class="trend-bar" style="height:62%"></span><span class="trend-bar" style="height:81%"></span></div><div class="trend-labels"><span>D1</span><span>D2</span><span>D3</span></div></div></div>';
	}

	function timeMachine() {
		var versions = state.versions.length ? state.versions : [{ version_label: "Draft 1", created_at: "", version_number: 1, upload_confirmed: false }];
		return '<div class="tm"><h4>&#128336; Time Machine</h4><div class="vt">' + versions.map(function (version, index) {
			return '<button class="vn' + (index === 0 ? ' cur' : '') + '" data-fv-version-download="' + escAttr(version.id || "") + '"><span class="vl">' + esc(version.version_label || ("Draft " + version.version_number)) + '</span><span class="vm">' + esc(shortDate(version.created_at) || "Awaiting upload") + '</span><span class="vc">' + (version.upload_confirmed ? "Confirmed upload" : "Pending upload") + '</span></button>';
		}).join("") + "</div></div>";
	}

	function commentsPanel() {
		return '<div class="cms"><h4>&#128172; Comments <span class="uc">' + state.comments.filter(function (comment) { return !comment.is_resolved; }).length + ' unresolved</span></h4>' + (state.comments.length ? state.comments.map(function (comment) {
			return '<article class="cm ' + (comment.author_role === "admin" ? "adm" : "") + (comment.is_resolved ? " res" : "") + '"><div class="ch"><span class="ca">' + esc(comment.author_role || "advisor") + '</span><span class="ct">' + esc(shortDate(comment.created_at)) + '</span></div><p class="cb">' + esc(comment.body || "") + '</p><div class="cact"><button class="btn btn-s btn-sm" type="button">Reply</button><button class="btn btn-s btn-sm" type="button">Resolve</button></div></article>';
		}).join("") : emptySmall("Comment threads will appear here.")) + '<form class="cm-inp" data-fv-comment-form><input name="body" placeholder="Add a comment..."><button class="btn btn-p btn-sm">Send</button></form></div>';
	}

	function changelogPanel() {
		return '<div class="clog"><h4>&#128203; Changelog</h4><div class="le"><span class="li upl">&#8679;</span><span class="lt"><b>Upload and review events</b> write to audit/review tables.</span></div><div class="le"><span class="li sts">&#8635;</span><span class="lt"><b>Status changes</b> persist as File Vault review events.</span></div></div>';
	}

	function bindShell(root) {
		root.querySelectorAll("[data-mode]").forEach(function (button) {
			button.addEventListener("click", function () {
				state.mode = button.getAttribute("data-mode") || "student";
				if (state.mode === "admin" && !isAdmin()) state.mode = "student";
				state.error = "";
				draw();
				if (state.mode === "admin") loadAdminData().then(draw).catch(showError);
				if (state.mode === "docdocs" && state.selectedFile) loadFileDetail(state.selectedFile.id).then(draw).catch(showError);
			});
		});
		root.querySelectorAll("[data-view]").forEach(function (button) {
			button.addEventListener("click", function () {
				state.view = button.getAttribute("data-view") || "list";
				draw();
			});
		});
		var filter = root.querySelector("[data-fv-filter]");
		if (filter) filter.addEventListener("click", function () {
			state.filtersOpen = !state.filtersOpen;
			renderFileVaultV1();
		});
		var search = root.querySelector("[data-fv-search]");
		if (search) search.addEventListener("input", function () {
			state.search = search.value || "";
			draw();
		});
		root.querySelectorAll("[data-fv-open-upload]").forEach(function (button) {
			button.addEventListener("click", openUploadWizard);
		});
	}

	function bindBody(body) {
		body.querySelectorAll("[data-fv-folder]").forEach(function (button) {
			button.addEventListener("click", function () {
				state.selectedFolder = button.getAttribute("data-fv-folder") || "";
				draw();
			});
		});
		body.querySelectorAll("[data-fv-file]").forEach(function (button) {
			button.addEventListener("click", function () {
				pickFile(button.getAttribute("data-fv-file"));
			});
		});
		body.querySelectorAll("[data-fv-open-upload], [data-fv-drop]").forEach(function (el) {
			el.addEventListener("click", openUploadWizard);
		});
		body.querySelectorAll("[data-fv-download]").forEach(function (button) {
			button.addEventListener("click", function (event) {
				event.stopPropagation();
				downloadFile(button.getAttribute("data-fv-download"));
			});
		});
		body.querySelectorAll("[data-fv-status]").forEach(function (button) {
			button.addEventListener("click", function () {
				updateStudentStatus(button.getAttribute("data-fv-status"));
			});
		});
		body.querySelectorAll("[data-fv-admin-status]").forEach(function (button) {
			button.addEventListener("click", function () {
				updateAdminStatus(button.getAttribute("data-fv-admin-status"));
			});
		});
		body.querySelectorAll("[data-fv-shared-download]").forEach(function (button) {
			button.addEventListener("click", function () {
				downloadShared(button.getAttribute("data-fv-shared-download"));
			});
		});
		body.querySelectorAll("[data-fv-version-download]").forEach(function (button) {
			button.addEventListener("click", function () {
				downloadVersion(button.getAttribute("data-fv-version-download"));
			});
		});
		body.querySelectorAll("[data-fv-version]").forEach(function (button) {
			button.addEventListener("click", openVersionWizard);
		});
		body.querySelectorAll("[data-fv-admin-file]").forEach(function (button) {
			button.addEventListener("click", function () {
				var id = button.getAttribute("data-fv-admin-file");
				state.selectedFile = state.queue.filter(function (file) { return String(file.id) === String(id); })[0] || state.selectedFile;
				state.mode = "docdocs";
				loadFileDetail(id).then(draw).catch(showError);
			});
		});
		body.querySelectorAll("[data-fv-student]").forEach(function (button) {
			button.addEventListener("click", function () {
				loadAdminStudent(button.getAttribute("data-fv-student")).then(draw).catch(showError);
			});
		});
		var docdocs = body.querySelector("[data-fv-docdocs]");
		if (docdocs) docdocs.addEventListener("click", function () {
			state.mode = "docdocs";
			if (state.selectedFile) loadFileDetail(state.selectedFile.id).then(draw).catch(showError);
			draw();
		});
		var commentForm = body.querySelector("[data-fv-comment-form]");
		if (commentForm) commentForm.addEventListener("submit", submitComment);
	}

	function loadStudentData() {
		state.loading = true;
		draw();
		return Promise.all([
			apiGetSoft("/folders", { folders: fallbackFolders(), schema_configured: true }),
			apiGetSoft("/files", { files: [], storage_configured: true, schema_configured: true }),
			apiGetSoft("/shared-resources", { resources: [] })
		]).then(function (responses) {
			var folders = responses[0] || {};
			var files = responses[1] || {};
			var shared = responses[2] || {};
			state.folders = Array.isArray(folders.folders) ? folders.folders : [];
			state.files = Array.isArray(files.files) ? files.files : [];
			state.shared = Array.isArray(shared.resources) ? shared.resources : [];
			state.storageReady = files.storage_configured === true;
			state.schemaReady = files.schema_configured !== false && folders.schema_configured !== false;
			if (!state.selectedFile && state.files.length) state.selectedFile = state.files[0];
			state.loading = false;
		});
	}

	function loadAdminData() {
		if (!isAdmin()) return Promise.resolve();
		return Promise.all([
			apiGetSoft("/admin/students/files", { students: [] }),
			apiGetSoft("/admin/review-queue", { queue: [] }),
			apiGetSoft("/admin/audit-log", { events: [] })
		]).then(function (responses) {
			state.students = Array.isArray(responses[0].students) ? responses[0].students : [];
			state.queue = Array.isArray(responses[1].queue) ? responses[1].queue : [];
			state.audit = Array.isArray(responses[2].events) ? responses[2].events : [];
		});
	}

	function loadFileDetail(fileId) {
		if (!fileId) return Promise.resolve();
		return Promise.all([
			apiGet("/files/" + encodeURIComponent(fileId)),
			apiGet("/files/" + encodeURIComponent(fileId) + "/versions"),
			apiGet("/files/" + encodeURIComponent(fileId) + "/comments"),
			apiGet("/files/" + encodeURIComponent(fileId) + "/scores")
		]).then(function (responses) {
			var detail = responses[0] && responses[0].file ? responses[0].file : null;
			if (detail) state.selectedFile = detail;
			state.versions = Array.isArray(responses[1].versions) ? responses[1].versions : [];
			state.comments = Array.isArray(responses[2].comments) ? responses[2].comments : [];
			state.score = responses[3] ? responses[3].latest_score : null;
		});
	}

	function pickFile(id) {
		state.selectedFile = state.files.filter(function (file) { return String(file.id) === String(id); })[0] || state.selectedFile;
		draw();
	}

	function openUploadWizard() {
		var existing = document.querySelector(".fv-modal");
		if (existing) existing.remove();
		var defaultFolder = state.selectedFolder || (state.folders[0] && state.folders[0].id) || "";
		var html = [
			'<div class="fv-modal modal-bg vis"><form class="wiz" data-fv-upload-form>',
			'<div class="wiz-h"><h2>&#128451; Upload to File Vault</h2><button type="button" class="wiz-x" data-fv-close>&times;</button></div>',
			'<div class="wiz-b">',
			fileFieldMarkup("file", "Choose File", "No file selected"),
			'<div class="fv-form-grid">',
			'<div class="ws"><label>Division</label><select name="division"><option>Mission Residency</option><option>USMLE / Dr J Exam Prep</option><option>Clinicals</option></select></div>',
			'<div class="ws"><label>Course / Program</label><select name="course"><option>360 Elite</option><option>Complete</option><option>Foundation</option></select></div>',
			'<div class="ws"><label>Session Letter</label><select name="session">' + sessionOptions("A") + "</select></div>",
			'<div class="ws"><label>Folder</label><select name="folder_id">' + state.folders.map(function (folder) { return '<option value="' + escAttr(folder.id || "") + '"' + (folder.id === defaultFolder ? " selected" : "") + '>' + esc(folder.name || "Folder") + "</option>"; }).join("") + "</select></div>",
			'<div class="ws"><label>Document Type</label><select name="document_type"><option value="personal_statement">Personal Statement</option><option value="lor">Letter of Recommendation</option><option value="cv">CV / Resume</option><option value="timeline">Timeline</option><option value="other">Other</option></select></div>',
			'<div class="ws"><label>Draft / Version</label><select name="draft_version">' + versionOptions(1) + "</select></div>",
			'<div class="ws"><label>Replacing Previous Version?</label><select name="replacing_previous"><option value="">No, new document</option><option value="1">Yes, replace prior draft</option></select></div>',
				'<div class="ws"><label>Ready for Review?</label><select name="ready_for_review"><option value="">Save as Draft</option><option value="1">Submit after upload</option></select></div>',
				"</div>",
				'<div class="ws"><label>Note to Advisor</label><textarea name="note_to_advisor" placeholder="Revised intro paragraph per advisor feedback."></textarea></div>',
				'<div class="fnprev"><div class="fpl">Generated Filename</div><div class="fpo">Original filename stays out of private object keys.</div><div class="fpc" data-fv-name-preview>Choose a file to preview</div><div class="fpd">Final canonical naming is generated server-side.</div></div>',
				"</div>",
				'<div class="wiz-f"><div class="fv-upload-feedback" data-fv-upload-feedback aria-live="polite"></div><button type="button" class="btn btn-s" data-fv-close>Cancel</button><button class="btn btn-p" data-fv-upload-submit>&#8679; Upload File</button></div>',
				"</form></div>"
		].join("");
		modalHost().insertAdjacentHTML("beforeend", html);
		var modal = document.querySelector(".fv-modal");
		modal.querySelectorAll("[data-fv-close]").forEach(function (button) { button.addEventListener("click", function () { modal.remove(); }); });
		["file", "document_type", "draft_version", "session"].forEach(function (name) {
			var field = modal.querySelector('[name="' + name + '"]');
			if (field) field.addEventListener("change", updateUploadPreview);
			if (field) field.addEventListener("input", updateUploadPreview);
		});
		updateUploadPreview({ currentTarget: modal.querySelector("[data-fv-upload-form]") });
		modal.querySelector("[data-fv-upload-form]").addEventListener("submit", submitUpload);
	}

	function openVersionWizard() {
		if (!state.selectedFile) return;
		var existing = document.querySelector(".fv-modal");
		if (existing) existing.remove();
		var html = [
				'<div class="fv-modal modal-bg vis"><form class="wiz" data-fv-version-form>',
				'<div class="wiz-h"><h2>&#128228; Upload New Version</h2><button type="button" class="wiz-x" data-fv-close>&times;</button></div>',
				'<div class="wiz-b">' + fileFieldMarkup("file", "Choose New Version", "No file selected"),
				'<div class="ws"><label>Note to Advisor</label><textarea name="note_to_advisor" placeholder="What changed in this draft?"></textarea></div>',
				'<div class="fnprev"><div class="fpl">Version Target</div><div class="fpc">' + esc(state.selectedFile.display_name || state.selectedFile.canonical_name || "Selected file") + '</div><div class="fpd">Server generates the next canonical filename.</div></div></div>',
				'<div class="wiz-f"><div class="fv-upload-feedback" data-fv-upload-feedback aria-live="polite"></div><button type="button" class="btn btn-s" data-fv-close>Cancel</button><button class="btn btn-p" data-fv-upload-submit>Upload Version</button></div>',
				"</form></div>"
		].join("");
		modalHost().insertAdjacentHTML("beforeend", html);
		var modal = document.querySelector(".fv-modal");
		modal.querySelectorAll("[data-fv-close]").forEach(function (button) { button.addEventListener("click", function () { modal.remove(); }); });
		var fileField = modal.querySelector('[name="file"]');
		if (fileField) fileField.addEventListener("change", updateFileChoice);
		modal.querySelector("[data-fv-version-form]").addEventListener("submit", submitVersionUpload);
	}

	function submitUpload(event) {
		event.preventDefault();
		var form = event.currentTarget;
		var file = form.elements.file.files[0];
		if (!file) {
			setUploadFeedback(form, "Choose a file before uploading.", true);
			return;
		}
		var body = {
			filename: file.name,
			mime_type: file.type || "application/octet-stream",
			folder_id: form.elements.folder_id.value || "",
			document_type: form.elements.document_type.value || "other",
			draft_version: form.elements.draft_version ? form.elements.draft_version.value : "",
			replacing_previous: form.elements.replacing_previous ? form.elements.replacing_previous.value === "1" : false,
			note_to_advisor: form.elements.note_to_advisor.value || "",
			ready_for_review: form.elements.ready_for_review.value === "1"
		};
		if (!state.storageReady) {
			setUploadFeedback(form, "Private storage is not enabled for this account yet. No file was uploaded.", true);
			return;
		}
		setUploadBusy(form, true, "Requesting secure upload...");
		apiPost("/files/upload-url", body).then(function (data) {
			setUploadFeedback(form, "Uploading to private storage...", false);
			return putFile(data.upload_url, file).then(function () {
				setUploadFeedback(form, "Confirming upload...", false);
				return apiPost("/files/" + encodeURIComponent(data.file_id) + "/confirm", {
					version_id: data.version_id,
					file_size: file.size,
					ready_for_review: body.ready_for_review
				});
			});
		}).then(function () {
			var modal = document.querySelector(".fv-modal");
			if (modal) modal.remove();
			return loadStudentData();
		}).then(draw).catch(function (error) {
			setUploadBusy(form, false);
			setUploadFeedback(form, error && error.message ? error.message : "Upload failed. Please try again.", true);
		});
	}

	function submitVersionUpload(event) {
		event.preventDefault();
		if (!state.selectedFile) return;
		var form = event.currentTarget;
		var file = form.elements.file.files[0];
		if (!file) {
			setUploadFeedback(form, "Choose a file before uploading.", true);
			return;
		}
		if (!state.storageReady) {
			setUploadFeedback(form, "Private storage is not enabled for this account yet. No file was uploaded.", true);
			return;
		}
		setUploadBusy(form, true, "Requesting secure version upload...");
		apiPost("/files/" + encodeURIComponent(state.selectedFile.id) + "/versions", {
			filename: file.name,
			mime_type: file.type || "application/octet-stream",
			note_to_advisor: form.elements.note_to_advisor.value || ""
		}).then(function (data) {
			setUploadFeedback(form, "Uploading new version to private storage...", false);
			return putFile(data.upload_url, file).then(function () {
				setUploadFeedback(form, "Confirming new version...", false);
				return apiPost("/files/" + encodeURIComponent(data.file_id) + "/confirm", {
					version_id: data.version_id,
					file_size: file.size,
					ready_for_review: true
				});
			});
		}).then(function () {
			var modal = document.querySelector(".fv-modal");
			if (modal) modal.remove();
			return loadStudentData();
		}).then(function () {
			return loadFileDetail(state.selectedFile.id);
		}).then(draw).catch(function (error) {
			setUploadBusy(form, false);
			setUploadFeedback(form, error && error.message ? error.message : "Version upload failed. Please try again.", true);
		});
	}

	function putFile(url, file) {
		return new Promise(function (resolve, reject) {
			var xhr = new XMLHttpRequest();
			xhr.open("PUT", url, true);
			xhr.onload = function () { xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error("Upload failed with status " + xhr.status)); };
			xhr.onerror = function () { reject(new Error("Upload failed.")); };
			xhr.send(file);
		});
	}

	function updateUploadPreview(event) {
		var form = event && event.currentTarget && event.currentTarget.matches && event.currentTarget.matches("[data-fv-upload-form]")
			? event.currentTarget
			: document.querySelector("[data-fv-upload-form]");
		if (!form) return;
		var preview = form.querySelector("[data-fv-name-preview]");
		if (!preview) return;
		var file = form.elements.file && form.elements.file.files ? form.elements.file.files[0] : null;
		updateFileChoice({ currentTarget: form.elements.file });
		var extension = file && file.name.indexOf(".") !== -1 ? file.name.split(".").pop().toLowerCase() : "ext";
		var doc = form.elements.document_type ? docLabel(form.elements.document_type.value || "other") : "Document";
		var draft = form.elements.draft_version ? form.elements.draft_version.value || "Draft 1" : "Draft 1";
		var session = form.elements.session ? form.elements.session.value || "A" : "A";
		preview.textContent = "MissionMed-Course_Session-" + sanitizePreviewPart(session) + "_" + sanitizePreviewPart(doc) + "_" + sanitizePreviewPart(draft) + "_YYYY-MM-DD." + sanitizePreviewPart(extension);
	}

	function fileFieldMarkup(name, actionLabel, emptyLabel) {
		return [
				'<div class="ws fv-file-picker">',
				'<label>File</label>',
				'<input class="fv-file-input" type="file" name="' + escAttr(name) + '" id="fv-file-input-' + escAttr(name) + '">',
			'<label class="fv-file-control" for="fv-file-input-' + escAttr(name) + '">',
			'<span class="fv-file-icon" aria-hidden="true">&#128196;</span>',
			'<span class="fv-file-copy"><strong>' + esc(actionLabel) + '</strong><small data-fv-file-label>' + esc(emptyLabel) + '</small></span>',
			"</label>",
			"</div>"
		].join("");
	}

	function sessionOptions(selected) {
		return "ABCDEFGHIJK".split("").map(function (letter) {
			return '<option value="' + letter + '"' + (letter === selected ? " selected" : "") + ">" + letter + "</option>";
		}).join("");
	}

	function versionOptions(selected) {
		var options = [];
		for (var i = 1; i <= 12; i += 1) {
			options.push('<option value="Draft ' + i + '"' + (i === selected ? " selected" : "") + ">" + i + "</option>");
		}
		return options.join("");
	}

	function updateFileChoice(event) {
		var input = event && event.currentTarget;
		if (!input || !input.form || !input.files) return;
		var label = input.form.querySelector("[data-fv-file-label]");
		if (!label) return;
		var file = input.files[0];
		label.textContent = file ? file.name + " - " + formatSize(file.size) : "No file selected";
	}

	function setUploadBusy(form, busy, label) {
		var button = form ? form.querySelector("[data-fv-upload-submit]") : null;
		if (!button) return;
		button.disabled = !!busy;
		button.classList.toggle("is-busy", !!busy);
		button.textContent = busy ? (label || "Uploading...") : (form.matches("[data-fv-version-form]") ? "Upload Version" : "\u21e7 Upload File");
	}

	function setUploadFeedback(form, message, isError) {
		var feedback = form ? form.querySelector("[data-fv-upload-feedback]") : null;
		if (!feedback) return;
		feedback.textContent = message || "";
		feedback.classList.toggle("is-error", !!isError);
		feedback.classList.toggle("is-visible", !!message);
	}

	function downloadFile(id) {
		apiGet("/files/" + encodeURIComponent(id) + "/download").then(function (data) {
			if (data && data.url) window.open(data.url, "_blank", "noopener");
		}).catch(showError);
	}

	function downloadShared(id) {
		apiGet("/shared-resources/" + encodeURIComponent(id) + "/download").then(function (data) {
			if (data && data.url) window.open(data.url, "_blank", "noopener");
		}).catch(showError);
	}

	function downloadVersion(id) {
		if (!state.selectedFile || !id) return;
		apiGet("/files/" + encodeURIComponent(state.selectedFile.id) + "/versions/" + encodeURIComponent(id) + "/download").then(function (data) {
			if (data && data.url) window.open(data.url, "_blank", "noopener");
		}).catch(showError);
	}

	function updateStudentStatus(status) {
		if (!state.selectedFile) return;
		apiPut("/files/" + encodeURIComponent(state.selectedFile.id) + "/status", { status: status }).then(function () {
			return loadStudentData();
		}).then(draw).catch(showError);
	}

	function updateAdminStatus(status) {
		if (!state.selectedFile) return;
		apiPut("/admin/files/" + encodeURIComponent(state.selectedFile.id) + "/status", { status: status }).then(function () {
			return loadStudentData();
		}).then(function () {
			return loadFileDetail(state.selectedFile.id);
		}).then(draw).catch(showError);
	}

	function submitComment(event) {
		event.preventDefault();
		if (!state.selectedFile) return;
		var body = event.currentTarget.elements.body.value || "";
		apiPost("/files/" + encodeURIComponent(state.selectedFile.id) + "/comments", { body: body }).then(function () {
			return loadFileDetail(state.selectedFile.id);
		}).then(draw).catch(showError);
	}

	function loadAdminStudent(id) {
		if (!isAdmin() || !id) return Promise.resolve();
		return Promise.all([
			apiGet("/admin/students/" + encodeURIComponent(id) + "/folders"),
			apiGet("/admin/students/" + encodeURIComponent(id) + "/files")
		]).then(function (responses) {
			state.folders = Array.isArray(responses[0].folders) ? responses[0].folders : [];
			state.files = Array.isArray(responses[1].files) ? responses[1].files : [];
			state.selectedFile = state.files[0] || null;
			state.mode = state.selectedFile ? "docdocs" : "admin";
			return state.selectedFile ? loadFileDetail(state.selectedFile.id) : Promise.resolve();
		});
	}

	function filteredFiles() {
		var files = state.files.slice();
		if (state.selectedFolder) {
			files = files.filter(function (file) { return file.folder_id === state.selectedFolder; });
		}
		if (state.search) {
			var q = state.search.toLowerCase();
			files = files.filter(function (file) {
				return [file.display_name, file.original_filename, file.canonical_name, file.document_type, file.status].join(" ").toLowerCase().indexOf(q) !== -1;
			});
		}
		return files;
	}

	function isAdmin() {
		var profile = app.profile || (app.state && app.state.profile) || {};
		return !!profile.is_admin;
	}

	function selectedClass(file) {
		return state.selectedFile && state.selectedFile.id === file.id ? " is-selected" : "";
	}

	function statusBadge(status) {
		var key = statusMeta[status] ? status : "draft";
		return '<span class="sb sb-' + statusMeta[key][1] + '">' + esc(statusMeta[key][0]) + "</span>";
	}

	function countForFolder(folderId) {
		return state.files.filter(function (file) { return file.folder_id === folderId; }).length;
	}

	function folderCompletion(folder) {
		var count = countForFolder(folder.id);
		return Math.max(0, Math.min(100, count ? 75 : folder.placeholder ? 20 : 35));
	}

	function folderTone(folder) {
		if (folder.slug === "timeline") return "var(--fv-amber)";
		if (folder.slug === "cv") return "var(--fv-red)";
		if (countForFolder(folder.id) > 0) return "var(--fv-green)";
		return "var(--fv-blue)";
	}

	function folderSummary() {
		return state.folders.length + " folders, " + state.files.length + " files";
	}

	function nextActionText() {
		var timeline = state.folders.filter(function (folder) { return folder.slug === "timeline"; })[0];
		return timeline && !countForFolder(timeline.id) ? "Upload your Timeline document." : "Review files needing comments or final status.";
	}

	function folderIcon(slug) {
		return ({ "personal-statement": "&#128221;", lors: "&#128231;", cv: "&#128203;", timeline: "&#128197;", misc: "&#128194;" })[slug] || "&#128193;";
	}

	function fileType(file) {
		var name = (file.original_filename || file.canonical_name || "").toLowerCase();
		if (name.indexOf(".pdf") > -1) return "PDF";
		if (name.indexOf(".xls") > -1) return "XLS";
		if (name.indexOf(".png") > -1 || name.indexOf(".jpg") > -1 || name.indexOf(".jpeg") > -1) return "IMG";
		return "DOC";
	}

	function fileTypeClass(file) {
		var type = fileType(file).toLowerCase();
		return type === "xls" ? "xlsx" : (type === "doc" ? "docx" : type);
	}

	function reviewState(status) {
		if (status === "final") return "Final";
		if (status === "reviewed") return "Reviewed";
		if (status === "needs_changes") return "Needs Changes";
		if (status === "in_review") return "Viewed";
		return "Not Viewed";
	}

	function readiness(score) {
		if (score >= 91) return "Final Ready";
		if (score >= 81) return "Strong";
		if (score >= 66) return "Competitive";
		if (score >= 41) return "Needs Work";
		return "Not Ready";
	}

	function docLabel(type) {
		return docLabels[type] || "Document";
	}

	function ring(value, color) {
		return '<span class="cring" style="--p:' + value + ';--c:' + escAttr(color) + '"><b class="ct">' + value + "%</b></span>";
	}

	function panel(title, body) {
		return '<div class="fv-panel"><header><h3>' + esc(title) + "</h3></header><div>" + body + "</div></div>";
	}

	function panelHeader(title, count) {
		return '<div class="pan-h"><h3>' + esc(title) + '</h3>' + (count || "") + "</div>";
	}

	function sectionTitle(title, meta) {
		return '<div class="fv-section-title"><h2>' + esc(title) + '</h2><span>' + esc(meta || "") + "</span></div>";
	}

	function emptyPanel(title, copy) {
		return '<div class="fv-empty"><strong>' + esc(title) + "</strong><span>" + esc(copy || "") + "</span></div>";
	}

	function emptySmall(copy) {
		return '<div class="fv-empty-small">' + esc(copy || "Nothing to show yet.") + "</div>";
	}

	function loadingMarkup() {
		return '<div class="fv-loading">Loading File Vault...</div>';
	}

	function shortName(value) {
		value = String(value || "");
		return value.length > 58 ? value.slice(0, 58) + "..." : value;
	}

	function sanitizePreviewPart(value) {
		return String(value || "")
			.replace(/[^A-Za-z0-9]+/g, "-")
			.replace(/^-+|-+$/g, "")
			.slice(0, 40) || "File";
	}

	function shortDate(value) {
		if (!value) return "";
		var date = new Date(value);
		return isNaN(date.getTime()) ? String(value).slice(0, 16) : date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
	}

	function initials(name) {
		return String(name || "MM").split(/\s+/).map(function (part) { return part.charAt(0); }).join("").slice(0, 2).toUpperCase();
	}

	function on(condition) {
		return condition ? "is-on" : "";
	}

	function onClass(condition) {
		return condition ? "on" : "";
	}

	function markerIcon(item) {
		return ({
			"Too Generic": "&#128312;",
			"Needs Specificity": "&#128313;",
			"Strong Line": "&#128994;",
			"Program Fit": "&#128309;",
			"Tone Issue": "&#128995;",
			"Red Flag": "&#128308;",
			"Grammar": "&#9898;",
			"Keep This": "&#128154;",
			"Revise Opening": "&#9999;&#65039;",
			"Strengthen Closing": "&#128170;"
		})[item] || "&#9679;";
	}

	function scoreColor(value) {
		if (value >= 81) return "var(--green)";
		if (value >= 66) return "var(--blue)";
		if (value >= 41) return "var(--amber)";
		return "var(--red)";
	}

	function formatSize(bytes) {
		var size = Number(bytes || 0);
		if (!size) return "--";
		if (size < 1024) return size + " B";
		if (size < 1024 * 1024) return Math.round(size / 1024) + " KB";
		return (size / (1024 * 1024)).toFixed(1) + " MB";
	}

	function showError(error) {
		state.loading = false;
		state.error = error && error.message ? error.message : "File Vault request failed.";
		draw();
	}

	function esc(value) {
		return String(value === undefined || value === null ? "" : value).replace(/[&<>"']/g, function (char) {
			return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[char];
		});
	}

	function escAttr(value) {
		return esc(value).replace(/`/g, "&#096;");
	}

	function isFileVaultRoute() {
		return (window.location.hash || "").replace(/^#\/?/, "").split(/[?&]/)[0] === "filevault";
	}

	function rootElement() {
		return document.getElementById("sos-content");
	}

	function modalHost() {
		return document.getElementById("student-os-root") || document.body;
	}

	function fallbackFolders() {
		return [
			{ id: "fallback-personal-statement", slug: "personal-statement", name: "Personal Statement", updated_at: "" },
			{ id: "fallback-lors", slug: "lors", name: "LORs", updated_at: "" },
			{ id: "fallback-cv", slug: "cv", name: "CV", updated_at: "" },
			{ id: "fallback-timeline", slug: "timeline", name: "Timeline", updated_at: "" },
			{ id: "fallback-misc", slug: "misc", name: "Misc", updated_at: "" }
		];
	}

	function setRouteChrome(active) {
		if (window.MMEDMatrixAppMode && typeof window.MMEDMatrixAppMode.set === "function") {
			var route = String((window.MMED_OS && window.MMED_OS.state && window.MMED_OS.state.route) || window.location.hash.replace(/^#\/?/, "") || "");
			if (active) {
				window.MMEDMatrixAppMode.set(true, "filevault");
			} else if (!window.MMEDMatrixAppMode.isStandaloneRoute || !window.MMEDMatrixAppMode.isStandaloneRoute(route)) {
				window.MMEDMatrixAppMode.set(false, "");
			}
		} else if (window.MMEDMatrixAppMode && typeof window.MMEDMatrixAppMode.activate === "function") {
			if (active) {
				window.MMEDMatrixAppMode.activate("filevault");
			} else if (typeof window.MMEDMatrixAppMode.deactivate === "function") {
				window.MMEDMatrixAppMode.deactivate("filevault");
			}
		}
		var method = active ? "add" : "remove";
		if (document.documentElement && document.documentElement.classList) document.documentElement.classList[method]("mmed-filevault-fullscreen");
		if (document.body && document.body.classList) document.body.classList[method]("mmed-filevault-fullscreen");
		if (!active) restoreMatrixShell();
		var matrixRoot = document.getElementById("student-os-root");
		if (!matrixRoot) return;
		if (matrixRoot.classList) {
			matrixRoot.classList[method]("mmed-filevault-fullscreen");
			matrixRoot.classList.remove("mmed-filevault-embedded");
		}
	}

	function restoreMatrixShell() {
		if (document.documentElement && document.documentElement.classList) document.documentElement.classList.remove("mmed-filevault-fullscreen");
		if (document.body && document.body.classList) document.body.classList.remove("mmed-filevault-fullscreen");
		ensureRouteStyle(false);
		var matrixRoot = document.getElementById("student-os-root");
		if (!matrixRoot) return;
		delete matrixRoot.dataset.filevaultOverlay;
		matrixRoot.style.position = "";
		matrixRoot.style.inset = "";
		matrixRoot.style.zIndex = "";
		matrixRoot.style.width = "";
		matrixRoot.style.height = "";
		matrixRoot.style.overflow = "";
		matrixRoot.style.background = "";
		if (window.__MMEDFileVaultRootPlaceholder && window.__MMEDFileVaultRootPlaceholder.parentNode) {
			window.__MMEDFileVaultRootPlaceholder.parentNode.insertBefore(matrixRoot, window.__MMEDFileVaultRootPlaceholder);
			window.__MMEDFileVaultRootPlaceholder.parentNode.removeChild(window.__MMEDFileVaultRootPlaceholder);
		}
		window.__MMEDFileVaultRootPlaceholder = null;
	}

	function ensureRouteStyle(active) {
		var id = "mmed-filevault-route-overlay-style";
		var existing = document.getElementById(id);
		if (existing && existing.parentNode) existing.parentNode.removeChild(existing);
	}

	function needsV1Render(root) {
		if (!isFileVaultRoute() || !root) return false;
		if (!root.querySelector(".sos-filevault-v1")) return true;
		return root.textContent && root.textContent.indexOf("Private student file metadata with direct R2 upload wiring") !== -1;
	}

	function scheduleRouteGuard(delay) {
		if (routeGuardTimer) window.clearTimeout(routeGuardTimer);
		routeGuardTimer = window.setTimeout(function () {
			var root = rootElement();
			if (needsV1Render(root)) renderFileVaultV1();
			if (isFileVaultRoute()) patchRenderer();
		}, delay || 0);
	}

	// Direct hash loads can let the legacy async renderer paint after V1; reclaim the route if that happens.
	function startRouteGuard() {
		var root = rootElement();
		if (!root || routeObserver || !window.MutationObserver) return;
		routeObserver = new window.MutationObserver(function () {
			if (needsV1Render(root)) scheduleRouteGuard(25);
		});
		routeObserver.observe(root, { childList: true });
	}

	function patchRenderer() {
		app = window.MMED_OS || app;
		setRouteChrome(isFileVaultRoute());
		if (!app.render) return;
		app.render.fileVault = renderFileVaultV1;
		startRouteGuard();
		if (isFileVaultRoute()) {
			if (needsV1Render(rootElement())) renderFileVaultV1();
			[150, 500, 1200].forEach(function (delay) {
				window.setTimeout(function () {
					if (needsV1Render(rootElement())) renderFileVaultV1();
				}, delay);
			});
		}
	}

	function startPatchPoll() {
		patchRenderer();
		if (patchPoll) return;
		patchPoll = window.setInterval(function () {
			patchRenderer();
			if (!isFileVaultRoute() && patchPollStop) return;
			if (!isFileVaultRoute()) {
				patchPollStop = window.setTimeout(function () {
					if (isFileVaultRoute()) return;
					if (patchPoll) window.clearInterval(patchPoll);
					patchPoll = null;
					patchPollStop = null;
				}, 15000);
			}
		}, 500);
	}

	window.MMED_FILE_VAULT_V1 = {
		render: renderFileVaultV1
	};

	if (document.readyState === "loading") {
		document.addEventListener("DOMContentLoaded", startPatchPoll);
	} else {
		startPatchPoll();
	}
	window.addEventListener("load", startPatchPoll);
	window.addEventListener("hashchange", startPatchPoll);
}());
