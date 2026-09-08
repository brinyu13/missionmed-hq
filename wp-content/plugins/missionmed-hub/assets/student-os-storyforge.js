(function () {
	"use strict";

	var mountNode = null;
	var activeContext = null;
	var state = {
		tab: "library",
		role: "student",
		selectedStoryId: 1,
		sort: "rank",
		query: ""
	};

	var tabs = [
		{ id: "library", label: "Story Library" },
		{ id: "workshop", label: "Workshop" },
		{ id: "match", label: "Interview Match" },
		{ id: "review", label: "Advisor Review" },
		{ id: "readiness", label: "Readiness" }
	];

	var traitLabels = {
		patient_care: "Patient Care",
		communication: "Communication",
		resilience: "Resilience",
		failure: "Failure",
		leadership: "Leadership",
		teamwork: "Teamwork",
		ethics: "Ethics",
		service: "Service",
		research: "Research",
		humility: "Humility",
		advocacy: "Advocacy"
	};

	// MX-007/MX-008 data contract placeholder: stories, questionMap, reviewQueue, readinessGates.
	// The records below are static bootstrap data. Nothing is saved, uploaded, selected, or persisted.
	var stories = [
		{ id: 1, rank: 1, title: "The One Where I Held the Patient's Hand", sub: "ICU rotation, third year", score: 9, status: "Gold Story", maturity: "Interview Ready", tags: ["patient_care", "communication", "resilience"], questions: ["Patient who impacted you", "Going above and beyond", "Why medicine"], premise: "Stayed after shift to calm a terrified ICU patient during visitor restrictions.", conflict: "Workflow pressure versus a patient in visible distress.", action: "Explained each monitor alarm in plain language and stayed until the patient stopped pulling at lines.", result: "The patient calmed, the team regained control, and the attending recognized the intervention.", lesson: "Clinical presence can be a clinical intervention.", note: "Strongest patient-care story. Use with intention." },
		{ id: 2, rank: 2, title: "The One Where I Failed Organic Chemistry", sub: "Sophomore year, pre-med crisis", score: 9, status: "Gold Story", maturity: "Polished", tags: ["failure", "resilience"], questions: ["Tell me about a failure", "Greatest challenge"], premise: "A D+ in organic chemistry forced a serious recommitment to medicine.", conflict: "Advisor doubt, family disappointment, and a shaken identity.", action: "Worked as an EMT, changed study methods, hired a tutor, and retook the course.", result: "Earned an A- on retake and rebuilt the study system.", lesson: "Failure is information, not identity.", note: "Clean failure arc with concrete recovery." },
		{ id: 3, rank: 3, title: "The One Where the Translator Didn't Show Up", sub: "Free clinic, language barrier", score: 8, status: "Interview Ready", maturity: "Reviewed", tags: ["communication", "service", "humility"], questions: ["Cultural competency", "Communication"], premise: "A translator called in sick while a parent needed care instructions.", conflict: "Language barrier, scared parent, and no perfect support.", action: "Used drawings, slow speech, phone terms, and extra time.", result: "The parent understood the plan and antibiotics were started.", lesson: "Communication barriers are problems to solve, not excuses.", note: "Good cross-cultural story. Strengthen the ending moment." },
		{ id: 4, rank: 4, title: "The One Where I Led the Study Group Mutiny", sub: "Step prep, second year", score: 8, status: "Gold Story", maturity: "Polished", tags: ["leadership", "teamwork"], questions: ["Leadership", "Conflict with colleague"], premise: "An ineffective study group was wasting the last three weeks before Step 1.", conflict: "Confronting a peer leader without fracturing the group.", action: "Proposed evidence-based restructuring and organized sub-groups.", result: "Most members beat practice averages and the original leader later thanked the student.", lesson: "Leadership sometimes means saying the useful hard thing.", note: "Strong leadership and conflict story." },
		{ id: 5, rank: 5, title: "The One Where I Almost Missed the Diagnosis", sub: "Internal medicine clerkship", score: 8, status: "Needs Work", maturity: "Structured", tags: ["humility", "patient_care", "failure"], questions: ["Weakness", "Patient safety"], premise: "Anchoring on pneumonia almost missed an MI.", conflict: "Overconfidence and a near miss.", action: "Reviewed the full approach and created a personal checklist.", result: "The patient received cardiac care in time.", lesson: "Overconfidence is the most dangerous clinical bias.", note: "Add the emotional moment when the troponin came back." },
		{ id: 6, rank: 6, title: "The One Where I Taught the EMTs", sub: "Rural EMS summer", score: 7, status: "Interview Ready", maturity: "Reviewed", tags: ["teaching", "leadership"], questions: ["Teaching experience", "Initiative"], premise: "A young team member noticed a pediatric protocol knowledge gap.", conflict: "Low authority but real patient-care stakes.", action: "Built peer training from real local cases.", result: "Monthly sessions were adopted.", lesson: "Teaching works best from shared experience.", note: "Needs one specific patient outcome." },
		{ id: 7, rank: 7, title: "The One Where I Sat With Grief", sub: "Hospice volunteer, first death", score: 9, status: "Gold Story", maturity: "Interview Ready", tags: ["patient_care", "communication", "humility"], questions: ["Death and dying", "Empathy"], premise: "The first patient death created a moment with no obvious words.", conflict: "Fear of saying the wrong thing.", action: "Stayed present and silent.", result: "The daughter said the silence helped most.", lesson: "Presence without performance is its own care.", note: "High emotional power. Do not overuse." },
		{ id: 8, rank: 8, title: "The One Where My Research Went Nowhere", sub: "Summer research fellowship", score: 7, status: "Needs Work", maturity: "Structured", tags: ["research", "failure", "resilience"], questions: ["Research experience", "Dealing with failure"], premise: "Negative biomarker results felt like a wasted summer.", conflict: "No publication and a disappointed PI.", action: "Presented the negative result honestly.", result: "A postdoc avoided a dead-end pathway.", lesson: "Negative results are still results.", note: "Middle needs more specificity." },
		{ id: 9, rank: 9, title: "The One Where I Called the Ethics Consult", sub: "Surgery clerkship, consent issue", score: 10, status: "Gold Story", maturity: "Interview Ready", tags: ["ethics", "advocacy", "patient_care"], questions: ["Ethical dilemma", "Advocacy"], premise: "A consent conversation did not meet the patient's needs.", conflict: "Power imbalance and fear of retaliation.", action: "Escalated after careful deliberation.", result: "The patient received proper consent.", lesson: "Advocacy is not comfortable.", note: "Strongest ethical dilemma. Use sparingly." },
		{ id: 10, rank: 10, title: "The One Where I Built the Schedule", sub: "Student government logistics", score: 6, status: "Too Generic", maturity: "Structured", tags: ["leadership", "service"], questions: ["Organizational challenge"], premise: "A charity event needed a coordinator after the original lead quit.", conflict: "No system, no time, and 40 volunteers.", action: "Built a shift map and confirmed each person.", result: "The event ran smoothly and fundraising doubled.", lesson: "Operational excellence is leadership.", note: "Needs a near-disaster moment." },
		{ id: 11, rank: 11, title: "The One Where I Learned to Listen to My Mom", sub: "Family dinner revelation", score: 8, status: "Interview Ready", maturity: "Reviewed", tags: ["humility", "teamwork"], questions: ["Teamwork", "Interprofessional respect"], premise: "A nurse in the family called out a blind spot.", conflict: "MD-track arrogance versus clinical reality.", action: "Sought nurse input deliberately on rotations.", result: "Caught details that would have been missed.", lesson: "Clinical insight does not follow hierarchy.", note: "Personal angle makes it memorable." },
		{ id: 12, rank: 12, title: "The One Where I Stood in the Rain", sub: "Community health screening", score: 7, status: "Needs Work", maturity: "Structured", tags: ["service", "resilience", "patient_care"], questions: ["Community involvement", "Persistence"], premise: "A health screening nearly collapsed because of weather.", conflict: "Volunteers cancelled and turnout looked low.", action: "Stayed through the full session.", result: "One person with undiagnosed hypertension was identified.", lesson: "Showing up is the foundation of service.", note: "Add the patient conversation." }
	];

	var questionMap = [
		{ text: "Tell me about yourself.", coverage: "3 stories", primary: 2, backup: [1, 9] },
		{ text: "Tell me about a time you failed.", coverage: "3 stories", primary: 2, backup: [8, 5] },
		{ text: "Describe a time you showed leadership.", coverage: "2 stories", primary: 4, backup: [6] },
		{ text: "Tell me about an ethical dilemma.", coverage: "2 stories", primary: 9, backup: [] },
		{ text: "Tell me about a patient who impacted you.", coverage: "3 stories", primary: 1, backup: [7, 3] },
		{ text: "How do you handle criticism?", coverage: "Gap", primary: null, backup: [] }
	];

	var reviewQueue = [
		{ student: "Mentor Preview Locked", title: "Student story review queue", state: "Future role-gated workflow" },
		{ student: "Mentor Preview Locked", title: "Score and coaching notes", state: "Not active in this bootstrap ticket" },
		{ student: "Mentor Preview Locked", title: "Student selection", state: "No real student list is exposed here" }
	];

	var readinessGates = [
		{ name: "Story Volume", current: 12, required: 10 },
		{ name: "Scored 8+", current: 6, required: 5 },
		{ name: "Adversity / Failure", current: 3, required: 2 },
		{ name: "Teamwork / Leadership", current: 3, required: 2 },
		{ name: "Why Medicine", current: 1, required: 1 },
		{ name: "Personal Growth", current: 0, required: 1 }
	];

	function escapeHTML(value) {
		return String(value == null ? "" : value)
			.replace(/&/g, "&amp;")
			.replace(/</g, "&lt;")
			.replace(/>/g, "&gt;")
			.replace(/"/g, "&quot;")
			.replace(/'/g, "&#039;");
	}

	function canUseMentorMode() {
		var auth = activeContext && activeContext.auth ? activeContext.auth : {};
		var access = auth.access || {};
		var profile = auth.profile || {};
		return !!(access.admin_full_access || access.is_admin || profile.admin_full_access || profile.is_admin);
	}

	function canUseStudentWorkspace() {
		var auth = activeContext && activeContext.auth ? activeContext.auth : {};
		var access = auth.access || {};
		var permissions = access.module_permissions && typeof access.module_permissions === "object" ? access.module_permissions : {};
		var storyforge = access.storyforge && typeof access.storyforge === "object" ? access.storyforge : {};

		return canUseMentorMode() || !!(permissions.storyforge || storyforge.unlocked || storyforge.mode === "student_bootstrap");
	}

	function selectedStory() {
		return stories.filter(function (story) {
			return story.id === state.selectedStoryId;
		})[0] || stories[0];
	}

	function sortedStories() {
		var query = state.query.toLowerCase();
		var list = stories.filter(function (story) {
			return !query || (story.title + " " + story.sub + " " + story.questions.join(" ")).toLowerCase().indexOf(query) !== -1;
		}).slice();

		if (state.sort === "score") {
			list.sort(function (a, b) { return b.score - a.score; });
		} else if (state.sort === "recent") {
			list.sort(function (a, b) { return b.id - a.id; });
		} else {
			list.sort(function (a, b) { return a.rank - b.rank; });
		}

		return list;
	}

	function storyTone(story) {
		if (story.score >= 9) return "is-gold";
		if (story.score >= 8) return "is-ready";
		if (story.score >= 7) return "is-work";
		return "is-muted";
	}

	function render() {
		if (!mountNode) return;

		if (!canUseStudentWorkspace()) {
			renderLockedState();
			return;
		}

		mountNode.innerHTML = [
			'<section class="sos-page sos-runtime-v2-page sos-storyforge-app" data-runtime-route="storyforge">',
			'<header class="sos-storyforge-topbar">',
			'<a class="sos-storyforge-dashboard-return" href="#dashboard" data-matrix-dashboard-return="true" aria-label="Return to Matrix Dashboard"><span>D</span><strong>Return to Matrix Dashboard</strong></a>',
			'<div class="sos-storyforge-titleblock"><span>StoryForge</span><h1>StoryForge</h1><p>Build the stories that power your application, interviews, and advisor conversations.</p></div>',
			'<div class="sos-storyforge-state"><b>Bootstrap demo</b><span>Static sample data. Not persistent yet.</span></div>',
			"</header>",
			'<div class="sos-storyforge-modebar">',
			modeButton("student", "Student View"),
			modeButton("mentor", "Mentor Preview"),
			'<button type="button" class="sos-storyforge-new" data-sf-action="new-story">New Story</button>',
			"</div>",
			'<nav class="sos-storyforge-tabs" aria-label="StoryForge sections">',
			tabs.map(tabButton).join(""),
			"</nav>",
			'<div class="sos-storyforge-panel">',
			renderActivePanel(),
			"</div>",
			'<div class="sos-storyforge-toast" role="status" aria-live="polite" hidden></div>',
			"</section>"
		].join("");
	}

	function renderLockedState() {
		mountNode.innerHTML = [
			'<section class="sos-page sos-runtime-v2-page sos-storyforge-app" data-runtime-route="storyforge">',
			'<header class="sos-storyforge-topbar">',
			'<a class="sos-storyforge-dashboard-return" href="#dashboard" data-matrix-dashboard-return="true" aria-label="Return to Matrix Dashboard"><span>D</span><strong>Return to Matrix Dashboard</strong></a>',
			'<div class="sos-storyforge-titleblock"><span>StoryForge</span><h1>StoryForge</h1><p>A Matrix storytelling workspace for applications, interviews, and advisor review.</p></div>',
			'<div class="sos-storyforge-state"><b>Coming soon</b><span>Bootstrap disabled for students.</span></div>',
			"</header>",
			'<div class="sos-storyforge-panel">',
			'<div class="sos-storyforge-card sos-storyforge-locked-review">',
			'<span class="sos-storyforge-lockmark">SF</span>',
			'<h2>StoryForge is being prepared.</h2>',
			'<p>Student story building is locked until persistence, role-gated advisor review, and backend data wiring are ready. This route is present only as a protected Matrix app shell.</p>',
			'<div class="sos-storyforge-preview-grid">',
			'<div><b>Student access</b><span>Coming soon. No demo workspace is active.</span></div>',
			'<div><b>Persistence</b><span>Not wired. Nothing is saved or uploaded.</span></div>',
			'<div><b>Advisor review</b><span>Requires a later role-gated backend ticket.</span></div>',
			"</div>",
			"</div>",
			"</div>",
			"</section>"
		].join("");
	}

	function modeButton(role, label) {
		var locked = role === "mentor" && !canUseMentorMode();
		var active = state.role === role ? " is-active" : "";
		return '<button type="button" class="sos-storyforge-mode' + active + (locked ? " is-locked" : "") + '" data-sf-role="' + role + '"' + (locked ? ' aria-disabled="true"' : "") + ">" + escapeHTML(label) + (locked ? "<small>Locked</small>" : "") + "</button>";
	}

	function tabButton(tab) {
		var active = state.tab === tab.id ? " is-active" : "";
		return '<button type="button" class="sos-storyforge-tab' + active + '" data-sf-tab="' + escapeHTML(tab.id) + '">' + escapeHTML(tab.label) + "</button>";
	}

	function renderActivePanel() {
		if (state.tab === "workshop") return renderWorkshop();
		if (state.tab === "match") return renderMatch();
		if (state.tab === "review") return renderReview();
		if (state.tab === "readiness") return renderReadiness();
		return renderLibrary();
	}

	function renderLibrary() {
		var list = sortedStories();
		var story = selectedStory();
		return [
			'<div class="sos-storyforge-tools">',
			'<label class="sos-storyforge-search"><span>Search</span><input type="search" value="' + escapeHTML(state.query) + '" data-sf-search placeholder="Search story title, category, or question"></label>',
			'<div class="sos-storyforge-sort">',
			sortButton("rank", "Rank"),
			sortButton("score", "Score"),
			sortButton("recent", "New"),
			"</div>",
			"</div>",
			'<div class="sos-storyforge-library">',
			'<aside class="sos-storyforge-stack">' + list.map(storyCard).join("") + "</aside>",
			'<main class="sos-storyforge-detail">' + storyDetail(story) + "</main>",
			'<aside class="sos-storyforge-intel">' + storyIntel() + "</aside>",
			"</div>"
		].join("");
	}

	function sortButton(id, label) {
		return '<button type="button" class="' + (state.sort === id ? "is-active" : "") + '" data-sf-sort="' + id + '">' + label + "</button>";
	}

	function storyCard(story) {
		var active = story.id === state.selectedStoryId ? " is-selected" : "";
		return [
			'<button type="button" class="sos-storyforge-story ' + storyTone(story) + active + '" data-sf-story="' + story.id + '">',
			'<span class="sos-storyforge-score">' + story.score + "</span>",
			'<span class="sos-storyforge-storybody"><strong>' + escapeHTML(story.title) + "</strong><small>" + escapeHTML(story.sub) + "</small></span>",
			'<span class="sos-storyforge-chip">' + escapeHTML(story.maturity) + "</span>",
			"</button>"
		].join("");
	}

	function storyDetail(story) {
		return [
			'<article class="sos-storyforge-card sos-storyforge-selected">',
			'<div class="sos-storyforge-selected-head"><span class="sos-storyforge-orb ' + storyTone(story) + '">' + story.score + '</span><div><h2>' + escapeHTML(story.title) + '</h2><p>' + escapeHTML(story.sub) + '</p></div></div>',
			'<div class="sos-storyforge-tags">' + story.tags.map(function (tag) { return '<span>' + escapeHTML(traitLabels[tag] || tag) + '</span>'; }).join("") + "</div>",
			storyArc("Premise", story.premise),
			storyArc("Conflict", story.conflict),
			storyArc("Action", story.action),
			storyArc("Result", story.result),
			storyArc("Lesson", story.lesson),
			'<div class="sos-storyforge-note"><b>Advisor note</b><span>' + escapeHTML(story.note) + "</span></div>",
			'<div class="sos-storyforge-actions"><button type="button" data-sf-action="continue">Continue Workshop</button><button type="button" data-sf-action="map">Map to Question</button><button type="button" data-sf-action="review">Submit for Review</button></div>',
			"</article>"
		].join("");
	}

	function storyArc(label, copy) {
		return '<div class="sos-storyforge-arc"><span>' + escapeHTML(label) + '</span><p>' + escapeHTML(copy) + "</p></div>";
	}

	function storyIntel() {
		var gold = stories.filter(function (story) { return story.score >= 9; }).length;
		var ready = stories.filter(function (story) { return story.maturity === "Interview Ready"; }).length;
		return [
			'<div class="sos-storyforge-card"><h3>Story Intelligence</h3>',
			intelRow("Total Stories", stories.length),
			intelRow("Gold Stories", gold),
			intelRow("Avg Score", "7.8"),
			intelRow("Interview Ready", ready),
			"</div>",
			'<div class="sos-storyforge-card"><h3>Question Coverage</h3>',
			intelRow("Covered", "18 / 30"),
			'<div class="sos-storyforge-meter"><span style="width:60%"></span></div>',
			"</div>",
			'<div class="sos-storyforge-card is-warning"><h3>Gaps to Fill</h3><p>Receiving criticism, adapting communication, and why this specialty.</p></div>'
		].join("");
	}

	function intelRow(label, value) {
		return '<div class="sos-storyforge-intel-row"><span>' + escapeHTML(label) + '</span><b>' + escapeHTML(value) + "</b></div>";
	}

	function renderWorkshop() {
		var steps = [
			["Raw Memory", "What happened before the story had structure?"],
			["Tension", "What made the moment difficult?"],
			["Action", "What did you choose to do?"],
			["Result", "What changed because of that choice?"],
			["Growth", "What does this prove about you now?"]
		];
		return [
			'<div class="sos-storyforge-workshop">',
			'<aside class="sos-storyforge-card"><h3>Build Steps</h3>' + steps.map(function (step, index) { return '<button type="button" class="sos-storyforge-step" data-sf-action="step"><span>' + (index + 1) + '</span><b>' + escapeHTML(step[0]) + '</b></button>'; }).join("") + '</aside>',
			'<main class="sos-storyforge-card sos-storyforge-editor"><h2>Story Workshop</h2><p>Turn a raw memory into structured, scoreable, interview-ready evidence.</p>' + steps.map(function (step) { return '<label><span>' + escapeHTML(step[0]) + '</span><textarea readonly>' + escapeHTML(step[1]) + '</textarea></label>'; }).join("") + '<div class="sos-storyforge-actions"><button type="button" data-sf-action="draft">Save Draft</button><button type="button" data-sf-action="review">Submit for Review</button></div></main>',
			'<aside class="sos-storyforge-card"><h3>Coaching Tips</h3><p>The strongest stories have tension, specific action, and evidence of growth.</p><p class="sos-storyforge-muted">Inputs are readonly in this bootstrap. Draft storage comes in a later data ticket.</p></aside>',
			"</div>"
		].join("");
	}

	function renderMatch() {
		return [
			'<div class="sos-storyforge-match">',
			'<aside class="sos-storyforge-card"><h3>Coverage</h3>' + intelRow("Covered", "18 / 30") + intelRow("High confidence", "8") + intelRow("Open gaps", "4") + '<div class="sos-storyforge-oncall"><b>Interview On-Call</b><span>Coming soon</span><p>Recorded answers will suggest stronger story matches later.</p></div></aside>',
			'<main class="sos-storyforge-question-list">',
			questionMap.map(questionCard).join(""),
			"</main>",
			"</div>"
		].join("");
	}

	function questionCard(question) {
		var primary = question.primary ? stories.filter(function (story) { return story.id === question.primary; })[0] : null;
		return [
			'<article class="sos-storyforge-card sos-storyforge-question">',
			'<div><h3>' + escapeHTML(question.text) + '</h3><span class="' + (primary ? "is-covered" : "is-gap") + '">' + escapeHTML(question.coverage) + '</span></div>',
			primary ? '<p><b>Primary:</b> ' + escapeHTML(primary.title) + '</p>' : '<p>No story mapped yet. Build a new story or map an existing one.</p>',
			'<button type="button" data-sf-action="question">Refine Match</button>',
			"</article>"
		].join("");
	}

	function renderReview() {
		var unlocked = canUseMentorMode();
		if (!unlocked) {
			return [
				'<div class="sos-storyforge-card sos-storyforge-locked-review">',
				'<span class="sos-storyforge-lockmark">SF</span>',
				'<h2>Advisor Review is locked for this bootstrap.</h2>',
				'<p>Mentor queues, student selection, scoring writes, and coaching notes require a later role-gated service capability. No real student authority is exposed in this source ticket.</p>',
				'<div class="sos-storyforge-preview-grid">' + reviewQueue.map(function (item) { return '<div><b>' + escapeHTML(item.title) + '</b><span>' + escapeHTML(item.state) + '</span></div>'; }).join("") + "</div>",
				"</div>"
			].join("");
		}

		return [
			'<div class="sos-storyforge-review">',
			'<aside class="sos-storyforge-card"><h3>Mentor Preview</h3>' + intelRow("Pending", "17") + intelRow("Students", "8") + '<p class="sos-storyforge-muted">Preview only. No scoring is written.</p></aside>',
			'<main class="sos-storyforge-card"><h2>Story Review Preview</h2><p>Sample review controls are disabled until the role-gated workflow is wired.</p><div class="sos-storyforge-score-dots">' + [1,2,3,4,5,6,7,8,9,10].map(function (n) { return '<button type="button" data-sf-action="score">' + n + '</button>'; }).join("") + '</div><textarea readonly>Coaching notes preview.</textarea><div class="sos-storyforge-actions"><button type="button" data-sf-action="skip">Skip</button><button type="button" data-sf-action="score-next">Score and Next</button></div></main>',
			"</div>"
		].join("");
	}

	function renderReadiness() {
		var met = readinessGates.filter(function (gate) { return gate.current >= gate.required; }).length;
		return [
			'<div class="sos-storyforge-readiness">',
			'<section class="sos-storyforge-card sos-storyforge-readiness-hero"><span>Almost Ready</span><h2>' + met + ' / ' + readinessGates.length + ' gates met</h2><p>Your library is close to interview readiness. Add one personal growth story to close the final gap.</p></section>',
			'<div class="sos-storyforge-readiness-grid">' + readinessGates.map(readinessGate).join("") + "</div>",
			'<section class="sos-storyforge-card"><h3>Recommended Next Actions</h3><ol><li>Write a personal growth story.</li><li>Strengthen one score-6 story with a specific tension moment.</li><li>Add a receiving-criticism answer.</li></ol></section>',
			"</div>"
		].join("");
	}

	function readinessGate(gate) {
		var percent = Math.min(100, Math.round((gate.current / gate.required) * 100));
		var met = gate.current >= gate.required;
		return '<article class="sos-storyforge-card sos-storyforge-gate"><div><h3>' + escapeHTML(gate.name) + '</h3><span class="' + (met ? "is-covered" : "is-gap") + '">' + (met ? "Met" : "Needs work") + '</span></div><div class="sos-storyforge-meter"><span style="width:' + percent + '%"></span></div><p>' + gate.current + " of " + gate.required + " complete</p></article>";
	}

	function onClick(event) {
		var target = event.target && event.target.closest ? event.target : event.target && event.target.parentElement;
		if (!target) return;

		var roleButton = target.closest("[data-sf-role]");
		var tabButton = target.closest("[data-sf-tab]");
		var storyButton = target.closest("[data-sf-story]");
		var sortButton = target.closest("[data-sf-sort]");
		var actionButton = target.closest("[data-sf-action]");

		if (roleButton) {
			var nextRole = roleButton.getAttribute("data-sf-role");
			if (nextRole === "mentor" && !canUseMentorMode()) {
				showToast("Mentor preview is locked until role-gated capability is wired.");
				return;
			}
			state.role = nextRole;
			if (state.role === "mentor") state.tab = "review";
			render();
			return;
		}

		if (tabButton) {
			state.tab = tabButton.getAttribute("data-sf-tab") || "library";
			render();
			return;
		}

		if (storyButton) {
			state.selectedStoryId = parseInt(storyButton.getAttribute("data-sf-story"), 10) || state.selectedStoryId;
			render();
			return;
		}

		if (sortButton) {
			state.sort = sortButton.getAttribute("data-sf-sort") || "rank";
			render();
			return;
		}

		if (actionButton) {
			showToast("Not wired yet. This bootstrap uses static demo data only.");
		}
	}

	function onInput(event) {
		if (event.target && event.target.matches("[data-sf-search]")) {
			state.query = event.target.value || "";
			render();
		}
	}

	function showToast(message) {
		if (!mountNode) return;
		var toast = mountNode.querySelector(".sos-storyforge-toast");
		if (!toast) return;
		toast.textContent = message;
		toast.hidden = false;
		window.clearTimeout(showToast.timer);
		showToast.timer = window.setTimeout(function () {
			if (toast) toast.hidden = true;
		}, 2600);
	}

	function mount(context) {
		activeContext = context || {};
		mountNode = activeContext.refs && activeContext.refs.content ? activeContext.refs.content : null;
		if (!mountNode) {
			throw new Error("StoryForge mount target missing.");
		}
		state.role = canUseMentorMode() ? "mentor" : "student";
		state.tab = canUseMentorMode() ? "review" : "library";
		mountNode.addEventListener("click", onClick);
		mountNode.addEventListener("input", onInput);
		render();
	}

	function unmount() {
		if (mountNode) {
			mountNode.removeEventListener("click", onClick);
			mountNode.removeEventListener("input", onInput);
			mountNode.innerHTML = "";
		}
		mountNode = null;
		activeContext = null;
	}

	window.MMEDStoryForge = {
		mount: mount,
		unmount: unmount
	};
}());
