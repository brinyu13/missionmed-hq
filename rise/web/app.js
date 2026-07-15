const viewport = document.querySelector("#viewport");
const appShell = document.querySelector("#app");
const viewName = document.querySelector("#view-name");
const viewPath = document.querySelector("#view-path");
const backdrop = document.querySelector("#layer-backdrop");
const dialog = document.querySelector("#app-dialog");
const dialogKicker = document.querySelector("#dialog-kicker");
const dialogTitle = document.querySelector("#dialog-title");
const dialogBody = document.querySelector("#dialog-body");
const toastRoot = document.querySelector("#toast-root");
const routeAnnouncer = document.querySelector("#route-announcer");
const skipLink = document.querySelector("#skip-link");

const FIELD_GROUPS = {
  overview: [
    "Program Website", "Program Best Described As", "Program Length", "First Year Positions",
    "Residents Per Year", "Total Residents", "Official Program Description", "Curriculum Summary",
  ],
  training: [
    "Salary PGY1", "Salary PGY2", "Salary PGY3", "Vacation", "Meal Allowance",
    "Educational Stipend", "Average Work Hours", "Research Track", "Research Opportunities",
    "Night Float", "Call Schedule", "Clinic Structure", "Moonlighting", "Simulation Center",
    "Didactics", "Career Mentorship", "Benefits", "Wellness",
  ],
  application: [
    "Application Deadline", "Application Service", "Applicant Interview Format", "ERAS Participates",
    "NRMP Main Match Participation", "Minimum LOR", "Maximum LOR", "Specialty Specific LOR Required",
    "Requires Previous GME", "Offers Preliminary Positions", "Required Away Rotations",
    "Required Supplemental Information", "Osteopathic Recognition", "Medical School Graduation Timeline",
    "COMLEX Accepted", "Step Preferences", "US MD Step 1 Required", "IMG Step 1 Required",
    "IMG Step 2 Required", "DO COMLEX Level 1 Required", "DO COMLEX Level 2 Required",
    "DO Step 1 Required", "DO Step 2 Required", "Visa Sponsorship", "J1", "H1B", "F1 OPT First Year",
  ],
  people: [
    "Program Director", "Program Director Credentials", "Program Coordinator", "Coordinator Email",
    "Coordinator Phone", "International Graduates", "US Graduates", "DO Graduates Percent",
    "US MD Graduates Percent", "IMG Graduates Percent",
  ],
};

const COMPARE_FIELDS = [
  "Program Best Described As", "Program Length", "First Year Positions", "Total Residents",
  "Salary PGY1", "Vacation", "Average Work Hours", "Applicant Interview Format",
  "Application Deadline", "J1", "H1B", "COMLEX Accepted", "Research Track",
];

const state = {
  status: null,
  session: null,
  currentSearch: null,
  profile: null,
  profileTab: "overview",
  compareIds: readCompareIds(),
  layerReturnFocus: null,
  commandAbort: null,
  routeFocusRequested: false,
  routeGeneration: 0,
  routeController: null,
};

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function safeUrl(value, protocols = new Set(["http:", "https:"])) {
  try {
    const url = new URL(String(value));
    return protocols.has(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}

function formatNumber(value) {
  return new Intl.NumberFormat("en-US").format(Number(value) || 0);
}

function formatValue(fieldName, value, assertionClass) {
  if (typeof value === "boolean") {
    const reporter = assertionClass === "synthetic_fixture" ? "Synthetic fixture reports" : "Source reports";
    return `${reporter} ${value ? "Yes" : "No"}`;
  }
  if (/^Salary PGY\d$/.test(fieldName) && Number.isFinite(Number(value))) {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
  }
  if (Array.isArray(value)) return value.join(", ");
  if (value && typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function displayFieldName(name) {
  return ({
    "Visa Sponsorship": "Visa information listed by source (current or conditional sponsorship not established)",
    J1: "J-1 listed by source (current or conditional sponsorship not established)",
    H1B: "H-1B listed by source (current or conditional sponsorship not established)",
    "F1 OPT First Year": "F-1 OPT employment authorization listed by source (not visa sponsorship)",
    "International Graduates": "Graduates of medical schools outside the U.S. (cohort and reporting period unavailable)",
    "IMG Graduates Percent": "Medical-school-outside-U.S. composition (cohort and reporting period unavailable)",
  })[name] || name;
}

function knownField(record, name) {
  const field = record?.fields?.[name];
  return field?.knowledge?.state === "known" ? { field, value: field.knowledge.value } : null;
}

function programIdentityLabel(record) {
  const name = record?.display?.programName || "Unnamed program";
  const designation = record?.designation || "designation unavailable";
  const location = [record?.display?.city, record?.display?.state].filter(Boolean).join(", ") || "location unavailable";
  const id = record?.programSpecialtyId || "ID unavailable";
  return `${name}; ${designation}; ${location}; program-specialty ID ${id}`;
}

function compareActionLabel(record, selected = state.compareIds.includes(record.programSpecialtyId)) {
  return `${selected ? "Remove" : "Add"} ${programIdentityLabel(record)} ${selected ? "from" : "to"} comparison`;
}

function assertionClassLabel(value) {
  const labels = {
    program_reported: "Program-reported",
    synthetic_fixture: "Synthetic fixture",
    editorial: "MissionMed editorial",
    derived: "Derived",
  };
  if (!value) return "Not stated";
  if (labels[value]) return labels[value];
  const words = String(value).replaceAll("_", " ").trim();
  return words ? `${words.charAt(0).toUpperCase()}${words.slice(1)}` : "Not stated";
}

function metadataValue(value) {
  if (value === null || value === undefined || value === "" || value === "not_stated") return "Not stated";
  return String(value);
}

function reportingPeriodValue(field, source) {
  const period = field?.reportingPeriod ?? field?.period ?? source?.reportingPeriod ?? source?.period;
  if (!period || period === "not_stated" || period?.kind === "not_stated") return "Not stated";
  if (typeof period !== "object") return metadataValue(period);
  if (period.label) return metadataValue(period.label);
  if (period.start || period.end) return [period.start, period.end].filter(Boolean).join(" to ");
  if (period.year) return metadataValue(period.year);
  return JSON.stringify(period);
}

function fieldProvenance(record, fieldName, compact = false) {
  const field = record?.fields?.[fieldName] || {};
  const source = record?.source || {};
  const items = [
    ["Assertion class", assertionClassLabel(field.assertionClass)],
    ["Source authority", metadataValue(field.authority ?? source.authority)],
    ["Survey received", metadataValue(field.surveyReceivedAt ?? source.surveyReceivedAt)],
    ["Source updated", metadataValue(field.sourceUpdatedAt ?? source.sourceUpdatedAt)],
    ["Retrieved", metadataValue(field.retrievedAt ?? source.retrievedAt)],
    ["MissionMed verified", metadataValue(field.missionMedVerifiedAt ?? source.missionMedVerifiedAt)],
    ["MissionMed verifier", metadataValue(field.missionMedVerifiedBy ?? source.missionMedVerifiedBy)],
    ["Reporting period", reportingPeriodValue(field, source)],
    ["Source locator", metadataValue(field.sourceLocator)],
    ["Snapshot ID", metadataValue(field.snapshotId)],
    ["Parser version", metadataValue(field.parserVersion)],
    ["Claim SHA-256", metadataValue(field.contentSha256)],
  ];
  return `<dl class="field-provenance${compact ? " field-provenance-compact" : ""}" aria-label="Provenance for ${escapeHtml(displayFieldName(fieldName))}">
    ${items.map(([label, value]) => `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`).join("")}
  </dl>`;
}

function evidenceBand(percent) {
  if (percent >= 65) return "high";
  if (percent >= 40) return "medium";
  return "low";
}

function createIcons() {
  window.lucide?.createIcons?.({ attrs: { "aria-hidden": "true" } });
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: { Accept: "application/json", ...(options.body ? { "Content-Type": "application/json" } : {}), ...options.headers },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(body.error?.message || `Request failed (${response.status})`);
    error.status = response.status;
    error.code = body.error?.code || "REQUEST_FAILED";
    error.details = body.error?.details;
    throw error;
  }
  return body;
}

function routeFromHash() {
  const raw = window.location.hash.slice(1) || "home";
  const [path, query = ""] = raw.split("?", 2);
  const [route, ...parts] = path.split("/").filter(Boolean);
  return { route: route || "home", parts, params: new URLSearchParams(query) };
}

function navigate(route) {
  const next = `#${route}`;
  state.routeFocusRequested = true;
  if (window.location.hash === next) renderRoute();
  else window.location.hash = next;
}

function beginRouteRender() {
  state.routeController?.abort();
  const controller = new AbortController();
  const context = {
    controller,
    signal: controller.signal,
    generation: state.routeGeneration + 1,
    hash: window.location.hash,
  };
  state.routeController = controller;
  state.routeGeneration = context.generation;
  return context;
}

function isCurrentRoute(context) {
  return Boolean(context) &&
    !context.signal.aborted &&
    state.routeController === context.controller &&
    state.routeGeneration === context.generation &&
    window.location.hash === context.hash;
}

function focusRenderedControl(selector, fallbackSelector) {
  const target = (selector && viewport.querySelector(selector)) ||
    (fallbackSelector && viewport.querySelector(fallbackSelector)) ||
    (selector && document.querySelector(selector)) ||
    (fallbackSelector && document.querySelector(fallbackSelector));
  if (!(target instanceof HTMLElement)) return false;
  target.focus({ preventScroll: true });
  return true;
}

function readCompareIds() {
  try {
    const parsed = JSON.parse(sessionStorage.getItem("rise-compare") || "[]");
    return Array.isArray(parsed) ? parsed.filter((item) => typeof item === "string").slice(0, 4) : [];
  } catch {
    return [];
  }
}

function saveCompareIds() {
  sessionStorage.setItem("rise-compare", JSON.stringify(state.compareIds));
  document.querySelectorAll("[data-compare-count]").forEach((node) => {
    node.textContent = String(state.compareIds.length);
  });
}

function setActiveNavigation(route) {
  const activeRoute = route === "profile" ? "explorer" : route;
  document.querySelectorAll("[data-route]").forEach((button) => {
    const active = button.dataset.route === activeRoute;
    button.classList.toggle("is-active", active);
    if (active) button.setAttribute("aria-current", "page");
    else button.removeAttribute("aria-current");
  });
}

function setHeading(name, path) {
  viewName.textContent = name;
  viewPath.textContent = path;
  document.title = `${name} | MissionMed RISE`;
}

function renderLoading(label = "Loading registry data") {
  viewport.innerHTML = `
    <div class="content-width loading-state" role="status" aria-label="${escapeHtml(label)}">
      <div class="skeleton-lines" aria-hidden="true">
        <div class="skeleton-line"></div><div class="skeleton-line"></div><div class="skeleton-line"></div>
      </div>
    </div>`;
  appendRegistryNotices();
}

function renderError(title, message, action = "") {
  viewport.innerHTML = `
    <div class="content-width error-state">
      <div class="state-inner">
        <span class="state-icon"><i data-lucide="circle-alert"></i></span>
        <h1>${escapeHtml(title)}</h1>
        <p>${escapeHtml(message)}</p>
        ${action}
      </div>
    </div>`;
  createIcons();
  appendRegistryNotices();
}

function statusTag(text, tone = "gold") {
  return `<span class="status-tag status-tag-${tone}">${escapeHtml(text)}</span>`;
}

function renderHome() {
  const counts = state.status.counts;
  const synthetic = state.status.dataClassification === "synthetic_test_fixture";
  const activationCopy = synthetic
    ? "Synthetic interaction fixture; never deployable"
    : "Source rights recorded; runtime authority still required";
  const sourceCopy = synthetic
    ? "Synthetic data for interaction testing only"
    : "Dated FREIDA GME census; program-reported";
  const evidenceCopy = synthetic
    ? "synthetic-fixture assertions"
    : "source-attributed assertions";
  setHeading("Command", "RISE / Registry");
  viewport.innerHTML = `
    <div class="content-width">
      <header class="page-header">
        <div>
          <h1>Residency intelligence registry</h1>
          <p>Immutable release ${escapeHtml(state.status.registryReleaseId)} with ${escapeHtml(evidenceCopy)} and explicit unknown states.</p>
        </div>
        <div class="page-actions">
          <button type="button" class="button button-primary" data-route="explorer"><i data-lucide="search"></i>Explore programs</button>
          <button type="button" class="button button-quiet" data-open-status><i data-lucide="activity"></i>Release status</button>
        </div>
      </header>

      <section class="truth-bar" aria-label="Registry release totals">
        ${truthStat(counts.uniquePrograms, "Unique programs")}
        ${truthStat(counts.programSpecialties, "Exact designations")}
        ${truthStat(counts.additionalBrowseMemberships, "Component-specialty browse projections")}
        ${truthStat(counts.evidenceLabeledClaims, "Source-attributed claims")}
        ${truthStat(counts.matchableClaims, "Hard-match claims")}
      </section>

      <section class="band band-grid" aria-labelledby="release-heading">
        <div>
          <h2 class="section-heading" id="release-heading">Release posture</h2>
          <ul class="status-list">
            ${statusRow("Registry", state.status.registryReleaseId, statusTag("immutable", "teal"))}
            ${statusRow("Activation", activationCopy, statusTag(synthetic ? "test only" : "offline shadow", "gold"))}
            ${statusRow("Source class", sourceCopy, statusTag("labeled", "teal"))}
            ${statusRow("FREIDA", synthetic ? "Not present in this test fixture" : "Written AMA authorization recorded", statusTag(synthetic ? "fixture" : "authorized", synthetic ? "gold" : "teal"))}
            ${statusRow("Residency Explorer", synthetic ? "Not present in this test fixture" : "Excluded unless separately authorized", statusTag(synthetic ? "fixture" : "policy gate", synthetic ? "gold" : "red"))}
            ${statusRow("Matching", "No current-cycle, source-located hard claims", statusTag("disabled", "red"))}
          </ul>
        </div>
        <div>
          <h2 class="section-heading">Data boundaries</h2>
          <div class="callout">
            <strong>Unknown is not no.</strong>
            <p>Missing or ambiguous values remain unknown and never become negative eligibility signals.</p>
          </div>
          <ul class="plain-list compact-list">
            ${plainRow("Included source observations", formatNumber(counts.activeSourceRows))}
            ${plainRow("Quarantined observations", formatNumber(counts.quarantinedSourceRows))}
            ${plainRow("Explicit unknown claims", formatNumber(counts.unknownClaimsFromAmbiguousNegatives))}
            ${plainRow("Omitted blank cells", formatNumber(counts.omittedBlankCells))}
          </ul>
        </div>
      </section>

      <section class="band" aria-labelledby="systems-heading">
        <h2 class="section-heading" id="systems-heading">Ecosystem handoffs</h2>
        <div class="integration-grid">
          ${integrationRow("ACTN", "network", "Relationship context", "actn")}
          ${integrationRow("CAM", "messages-square", "Interview context", "cam")}
          ${integrationRow("StoryForge", "sparkles", "Narrative context", "storyforge")}
          ${integrationRow("Matrix", "table-properties", "Matching remains isolated", "matrix", true)}
        </div>
      </section>
    </div>`;
  createIcons();
  appendDecisionBoundary();
}

function truthStat(value, label) {
  return `<div class="truth-stat"><strong>${escapeHtml(formatNumber(value))}</strong><span>${escapeHtml(label)}</span></div>`;
}

function statusRow(label, value, status) {
  return `<li class="status-row"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong>${status}</li>`;
}

function plainRow(label, value) {
  return `<li class="plain-row"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></li>`;
}

function integrationRow(name, icon, description, integration, matrix = false) {
  return `
    <div class="integration-row">
      <span class="integration-icon"><i data-lucide="${escapeHtml(icon)}"></i></span>
      <span class="integration-copy"><strong>${escapeHtml(name)}</strong><span>${escapeHtml(description)}</span></span>
      ${matrix
        ? `<button type="button" class="button button-quiet" data-matrix-status aria-label="Inspect Matrix status">Inspect</button>`
        : `<button type="button" class="button button-quiet" data-integration="${escapeHtml(integration)}" aria-label="Check ${escapeHtml(name)} status">Check</button>`}
    </div>`;
}

function option(value, label, selectedValue) {
  return `<option value="${escapeHtml(value)}"${value === selectedValue ? " selected" : ""}>${escapeHtml(label)}</option>`;
}

function renderExplorerShell(params) {
  const filters = state.currentSearch?.filterOptions || { specialties: [], states: [] };
  const specialty = params.get("specialty") || "";
  const jurisdiction = params.get("jurisdiction") || "";
  const region = params.get("region") || "";
  const programType = params.get("programType") || "";
  const visa = params.get("visa") || "";
  const evidence = params.get("evidence") || "";
  const sort = params.get("sort") || "name";
  const q = params.get("q") || "";
  const includeCombined = params.get("includeCombined") !== "false";
  const advancedFiltersOpen = Boolean(region || programType || visa || evidence);
  setHeading("Explorer", "RISE / Programs");
  viewport.innerHTML = `
    <div class="content-width">
      <header class="page-header">
        <div><h1>Program Explorer</h1><p>Browse exact specialty designations and their source-attributed component-specialty browse projections.</p></div>
      </header>
      <form id="explorer-form" novalidate>
        <div class="explorer-controls">
          <div class="field">
            <label for="program-search">Search Programs</label>
            <input class="text-input" id="program-search" name="q" type="search" value="${escapeHtml(q)}" placeholder="Program, institution, city">
          </div>
          <div class="field">
            <label for="specialty-filter">Specialty</label>
            <select class="select-input" id="specialty-filter" name="specialty">
              ${option("", "All specialties", specialty)}
              ${filters.specialties.map((item) => option(item, item, specialty)).join("")}
            </select>
          </div>
          <div class="field">
            <label for="jurisdiction-filter">Jurisdiction</label>
            <select class="select-input" id="jurisdiction-filter" name="jurisdiction">
              ${option("", "All jurisdictions", jurisdiction)}
              ${filters.states.map((item) => option(item, item, jurisdiction)).join("")}
            </select>
          </div>
          <div class="field">
            <label for="sort-filter">Sort Results</label>
            <select class="select-input" id="sort-filter" name="sort">
              ${option("name", "Program name", sort)}
              ${option("jurisdiction", "Jurisdiction", sort)}
              ${option("evidence", "Source-attributed field completeness", sort)}
            </select>
          </div>
        </div>
        <button type="button" class="button button-quiet filter-more-toggle" data-toggle-more-filters aria-controls="filter-more-fields" aria-expanded="${advancedFiltersOpen}"><i data-lucide="sliders-horizontal"></i><span>${advancedFiltersOpen ? "Hide" : "More"} filters</span></button>
        <div class="filter-more${advancedFiltersOpen ? " is-open" : ""}" id="filter-more-fields">
          <div class="field">
            <label for="region-filter">Region</label>
            <select class="select-input" id="region-filter" name="region">
              ${option("", "All regions", region)}
              ${["Northeast", "Midwest", "South", "West", "Territory / Other"].map((item) => option(item, item, region)).join("")}
            </select>
          </div>
          <div class="field">
            <label for="program-type-filter">Program Type</label>
            <input class="text-input" id="program-type-filter" name="programType" value="${escapeHtml(programType)}" placeholder="e.g. university">
          </div>
          <div class="field">
            <label for="visa-filter">Visa Listed In Source (Not Current Sponsorship)</label>
            <select class="select-input" id="visa-filter" name="visa">
              ${option("", "Any source state", visa)}
              ${option("J1", "J-1 listed", visa)}
              ${option("H1B", "H-1B listed", visa)}
            </select>
          </div>
          <div class="field">
            <label for="evidence-filter">Source-attributed Field Completeness</label>
            <select class="select-input" id="evidence-filter" name="evidence">
              ${option("", "All completeness ranges", evidence)}
              ${option("high", "65% or greater", evidence)}
              ${option("medium", "40–64%", evidence)}
              ${option("low", "Under 40%", evidence)}
            </select>
          </div>
        </div>
        <div class="filter-actions">
          <label class="check-field"><input type="checkbox" name="includeCombined"${includeCombined ? " checked" : ""}>Include component-specialty browse projections</label>
          <div class="filter-action-group">
            <button type="button" class="button button-quiet" data-clear-filters><i data-lucide="rotate-ccw"></i>Clear</button>
            <button type="submit" class="button button-primary"><i data-lucide="list-filter"></i>Apply filters</button>
          </div>
        </div>
      </form>
      <div id="explorer-results"></div>
    </div>`;
  createIcons();
  appendRegistryNotices();
}

function renderExplorerResults(result) {
  const container = document.querySelector("#explorer-results");
  if (!container) return;
  if (!result.records.length) {
    container.innerHTML = `
      <div class="empty-state"><div class="state-inner">
        <span class="state-icon"><i data-lucide="search-x"></i></span>
        <h2>No programs found</h2><p>The selected evidence and program filters returned no records.</p>
        <div class="state-actions"><button type="button" class="button button-quiet" data-clear-filters>Clear filters</button></div>
      </div></div>`;
    createIcons();
    return;
  }
  container.innerHTML = `
    <div class="result-meta"><span>${formatNumber(result.total)} program-specialty entries</span><span>Page ${result.page} of ${result.totalPages}</span></div>
    <div class="program-list">${result.records.map(programCard).join("")}</div>
    <nav class="pager" aria-label="Program result pages">
      <button type="button" class="button button-quiet" data-page="${result.page - 1}"${result.page <= 1 ? " disabled" : ""}><i data-lucide="chevron-left"></i>Previous</button>
      <span>${result.page} / ${result.totalPages}</span>
      <button type="button" class="button button-quiet" data-page="${result.page + 1}"${result.page >= result.totalPages ? " disabled" : ""}>Next<i data-lucide="chevron-right"></i></button>
    </nav>`;
  createIcons();
}

function programCard(record) {
  const combined = record.kind === "combined" || record.browseMemberships.some((item) => item.relationship === "RELATED_COMBINED");
  const band = evidenceBand(record.evidence.coveragePercent);
  const place = [record.display.institution, record.display.city, record.display.state].filter(Boolean).join(" · ");
  const inCompare = state.compareIds.includes(record.programSpecialtyId);
  const titleId = `program-title-${String(record.programSpecialtyId).replace(/[^a-zA-Z0-9_-]/g, "-")}`;
  const identityLabel = programIdentityLabel(record);
  const compareLabel = compareActionLabel(record, inCompare);
  return `
    <article class="program-card" aria-label="${escapeHtml(identityLabel)}">
      <div class="program-identity">
        <h2 class="program-name" id="${escapeHtml(titleId)}">${escapeHtml(record.display.programName)}</h2>
        <div class="program-place">${escapeHtml(place)}</div>
        <div class="program-tags">
          <span class="specialty-tag">${escapeHtml(record.designation)}</span>
          ${combined ? `<span class="specialty-tag specialty-tag-combined">Combined</span>` : ""}
        </div>
      </div>
      <div class="program-metrics">
        <div class="metric-cell"><span>Source-attributed completeness</span><strong>${escapeHtml(record.evidence.coveragePercent)}%</strong></div>
        <div class="metric-cell"><span>Visa source listing; current sponsorship not established</span><strong>${visaSummary(record.visa)}</strong></div>
      </div>
      <div class="program-actions">
        <button type="button" class="button button-primary" data-open-program="${escapeHtml(record.programSpecialtyId)}" aria-label="Open profile for ${escapeHtml(identityLabel)}">Open profile</button>
        <button type="button" class="icon-button${inCompare ? " is-selected" : ""}" data-toggle-compare="${escapeHtml(record.programSpecialtyId)}" aria-label="${escapeHtml(compareLabel)}" data-tooltip="${inCompare ? "Remove from compare" : "Add to compare"}"><i data-lucide="${inCompare ? "check" : "plus"}"></i></button>
      </div>
    </article>`;
}

function visaSummary(visa) {
  const known = [];
  if (visa?.j1 === "known_yes") known.push("J-1");
  if (visa?.h1b === "known_yes") known.push("H-1B");
  return escapeHtml(known.length ? `Source lists: ${known.join(" / ")}` : "Not established");
}

async function renderExplorer(params, context) {
  renderExplorerShell(params);
  const results = document.querySelector("#explorer-results");
  results.innerHTML = `<div class="loading-state" role="status"><div class="skeleton-lines" aria-hidden="true"><div class="skeleton-line"></div><div class="skeleton-line"></div><div class="skeleton-line"></div></div><span class="sr-only">Loading program results</span></div>`;
  const apiParams = new URLSearchParams(params);
  if (!apiParams.has("includeCombined")) apiParams.set("includeCombined", "true");
  apiParams.set("pageSize", "24");
  try {
    const search = await fetchJson(`/api/rise/v1/programs?${apiParams}`, { signal: context.signal });
    if (!isCurrentRoute(context)) return;
    state.currentSearch = search;
    renderExplorerShell(params);
    renderExplorerResults(state.currentSearch);
  } catch (error) {
    if (error.name === "AbortError" || !isCurrentRoute(context)) return;
    results.innerHTML = `<div class="error-state"><div class="state-inner"><h2>Explorer unavailable</h2><p>${escapeHtml(error.message)}</p></div></div>`;
  }
}

async function renderProfile(programSpecialtyId, context) {
  setHeading("Program Profile", "RISE / Programs / Profile");
  renderLoading("Loading program profile");
  try {
    const response = await fetchJson(`/api/rise/v1/program-specialties/${encodeURIComponent(programSpecialtyId)}`, { signal: context.signal });
    if (!isCurrentRoute(context)) return;
    state.profile = response.program;
    state.profileTab = "overview";
    drawProfile();
  } catch (error) {
    if (error.name === "AbortError" || !isCurrentRoute(context)) return;
    renderError("Program unavailable", error.message, `<div class="state-actions"><button class="button button-quiet" type="button" data-route="explorer">Return to Explorer</button></div>`);
  }
}

function drawProfile() {
  const record = state.profile;
  const identityLabel = programIdentityLabel(record);
  const place = [record.display.institution, record.display.hospital, record.display.city, record.display.state, record.display.zip].filter(Boolean).join(" · ");
  const combinedMemberships = record.browseMemberships.filter((item) => item.relationship === "RELATED_COMBINED");
  viewport.innerHTML = `
    <div class="content-width">
      <button type="button" class="button button-quiet profile-back" data-route="explorer"><i data-lucide="arrow-left"></i>Explorer</button>
      <header class="profile-header">
        <div>
          <h1>${escapeHtml(record.display.programName)}</h1>
          <p>${escapeHtml(place)}</p>
          <div class="program-tags">
            <span class="specialty-tag">${escapeHtml(record.designation)}</span>
            ${record.kind === "combined" ? `<span class="specialty-tag specialty-tag-combined">Combined designation</span>` : ""}
            ${combinedMemberships.map((item) => `<span class="specialty-tag specialty-tag-combined">Browse: ${escapeHtml(item.browseSpecialty)}</span>`).join("")}
            <span class="evidence-tag evidence-${evidenceBand(record.evidence.coveragePercent)}">${escapeHtml(record.evidence.coveragePercent)}% source-attributed field completeness</span>
          </div>
        </div>
        <div class="profile-actions">
          <button type="button" class="button button-primary" data-toggle-compare="${escapeHtml(record.programSpecialtyId)}" aria-label="${escapeHtml(compareActionLabel(record))}" data-program-identity="${escapeHtml(identityLabel)}"><i data-lucide="columns-3"></i>${state.compareIds.includes(record.programSpecialtyId) ? "Remove from compare" : "Add to compare"}</button>
        </div>
      </header>
      <div class="tabs" role="tablist" aria-label="Program profile sections">
        ${profileTab("overview", "Overview")}${profileTab("training", "Training")}${profileTab("application", "Application")}${profileTab("people", "People")}${profileTab("evidence", "Evidence")}
      </div>
      <section class="tab-panel" id="profile-tab-panel" role="tabpanel" tabindex="0" aria-labelledby="tab-${escapeHtml(state.profileTab)}">
        ${profilePanel(record, state.profileTab)}
      </section>
    </div>`;
  createIcons();
  appendDecisionBoundary();
}

function profileTab(id, label) {
  const selected = state.profileTab === id;
  return `<button type="button" class="tab-button" id="tab-${id}" role="tab" aria-selected="${selected}" aria-controls="profile-tab-panel" tabindex="${selected ? "0" : "-1"}" data-profile-tab="${id}">${escapeHtml(label)}</button>`;
}

function profilePanel(record, tab) {
  if (tab === "evidence") return renderEvidencePanel(record);
  const fields = FIELD_GROUPS[tab] || FIELD_GROUPS.overview;
  const midpoint = Math.ceil(fields.length / 2);
  return `<div class="profile-grid">${fieldList(record, fields.slice(0, midpoint))}${fieldList(record, fields.slice(midpoint))}</div>`;
}

function fieldList(record, fieldNames) {
  return `<dl class="field-list">${fieldNames.map((name) => fieldRow(record, name)).join("")}</dl>`;
}

function fieldRow(record, name) {
  const known = knownField(record, name);
  const label = displayFieldName(name);
  if (!known) return `<div class="field-row"><dt>${escapeHtml(label)}</dt><dd><span class="unknown-value">Unknown</span>${fieldProvenance(record, name)}</dd></div>`;
  const formatted = formatValue(name, known.value, known.field.assertionClass);
  const link = /(?:URL|Website)$/.test(name) ? safeUrl(known.value) : null;
  const email = name === "Coordinator Email" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(known.value))
    ? `mailto:${String(known.value)}`
    : null;
  return `<div class="field-row"><dt>${escapeHtml(label)}</dt><dd>
    <span class="field-value">${link ? `<a href="${escapeHtml(link)}" target="_blank" rel="noreferrer">${escapeHtml(formatted)}</a>` : email ? `<a href="${escapeHtml(email)}">${escapeHtml(formatted)}</a>` : escapeHtml(formatted)}</span>
    ${fieldProvenance(record, name)}
  </dd></div>`;
}

function renderEvidencePanel(record) {
  const sourceUrls = record.source.urls.map((url) => safeUrl(url)).filter(Boolean);
  const displayedFields = [...new Set(Object.values(FIELD_GROUPS).flat())];
  const fallbackKnown = displayedFields.filter((fieldName) => knownField(record, fieldName)).length;
  const fallbackAbsent = displayedFields.filter((fieldName) => !Object.hasOwn(record.fields, fieldName)).length;
  const known = Number.isFinite(record.evidence.knownSelectedClaims)
    ? record.evidence.knownSelectedClaims
    : fallbackKnown;
  const unknown = Number.isFinite(record.evidence.unknownSelectedClaims)
    ? record.evidence.unknownSelectedClaims
    : displayedFields.length - fallbackKnown;
  const absent = Number.isFinite(record.evidence.absentSelectedClaims)
    ? record.evidence.absentSelectedClaims
    : fallbackAbsent;
  return `
    <div class="profile-grid">
      <div>
        <h2 class="section-heading">Claim posture</h2>
        <ul class="status-list">
          ${statusRow("Known selected claims", formatNumber(known), statusTag("known", "teal"))}
          ${statusRow("Unknown selected claims", formatNumber(unknown), statusTag("unknown", "gold"))}
          ${statusRow("Absent selected fields", formatNumber(absent), statusTag("included as unknown", "gold"))}
          ${statusRow("All source-attributed claims", formatNumber(record.evidence.evidenceLabeledClaims), statusTag(`${record.evidence.coveragePercent}% selected-field completeness`, evidenceBand(record.evidence.coveragePercent) === "high" ? "teal" : "gold"))}
          ${statusRow("Quarantined claims", formatNumber(record.evidence.quarantinedClaims), statusTag("excluded", "red"))}
          ${statusRow("Hard-match claims", formatNumber(record.evidence.matchableClaims), statusTag("disabled", "red"))}
        </ul>
      </div>
      <div>
        <h2 class="section-heading">Source record</h2>
        <div class="source-block">
          <p><strong>${escapeHtml(record.source.authority)}</strong></p>
          <dl class="field-provenance" aria-label="Source record metadata">
            <div><dt>Assertion class</dt><dd>${escapeHtml(assertionClassLabel(record.source.assertionClass))}</dd></div>
            <div><dt>Survey received</dt><dd>${escapeHtml(metadataValue(record.source.surveyReceivedAt))}</dd></div>
            <div><dt>Source updated</dt><dd>${escapeHtml(metadataValue(record.source.sourceUpdatedAt))}</dd></div>
            <div><dt>Retrieved</dt><dd>${escapeHtml(metadataValue(record.source.retrievedAt))}</dd></div>
            <div><dt>MissionMed verified</dt><dd>${escapeHtml(metadataValue(record.source.missionMedVerifiedAt))}</dd></div>
            <div><dt>MissionMed verifier</dt><dd>${escapeHtml(metadataValue(record.source.missionMedVerifiedBy))}</dd></div>
            <div><dt>Reporting period</dt><dd>${escapeHtml(reportingPeriodValue({}, record.source))}</dd></div>
          </dl>
          ${sourceUrls.map((url) => `<p><a href="${escapeHtml(url)}" target="_blank" rel="noreferrer">${escapeHtml(url)}</a></p>`).join("")}
        </div>
      </div>
    </div>`;
}

async function renderCompare(context) {
  setHeading("Compare", "RISE / Comparison");
  if (!state.compareIds.length) {
    viewport.innerHTML = `<div class="content-width empty-state"><div class="state-inner"><span class="state-icon"><i data-lucide="columns-3"></i></span><h1>No programs selected</h1><p>Programs selected in Explorer appear here for evidence-aware comparison.</p><div class="state-actions"><button class="button button-primary" type="button" data-route="explorer">Open Explorer</button></div></div></div>`;
    createIcons();
    appendDecisionBoundary();
    return;
  }
  renderLoading("Loading program comparison");
  try {
    const responses = await Promise.all(state.compareIds.map((id) => fetchJson(
      `/api/rise/v1/program-specialties/${encodeURIComponent(id)}`,
      { signal: context.signal },
    )));
    if (!isCurrentRoute(context)) return;
    const programs = responses.map((item) => item.program);
    viewport.innerHTML = `
      <div class="content-width">
        <header class="page-header"><div><h1>Program comparison</h1><p>${programs.length} of 4 program slots selected. Unknown values remain visibly unknown.</p></div><div class="page-actions"><button type="button" class="button button-quiet" data-clear-compare><i data-lucide="trash-2"></i>Clear</button></div></header>
        <div class="compare-table-wrap"><table class="compare-table">
          <thead><tr><th scope="col">Field</th>${programs.map((program) => `<th scope="col"><span class="compare-program-name">${escapeHtml(program.display.programName)}</span><button type="button" class="link-button compare-remove" data-toggle-compare="${escapeHtml(program.programSpecialtyId)}" aria-label="${escapeHtml(compareActionLabel(program, true))}"><i data-lucide="x"></i>Remove</button></th>`).join("")}</tr></thead>
          <tbody>
            ${compareRow(programs, "Specialty", (program) => program.designation)}
            ${compareRow(programs, "Location", (program) => [program.display.city, program.display.state].filter(Boolean).join(", "))}
            ${compareRow(programs, "Source-attributed field completeness", (program) => `${program.evidence.coveragePercent}%`)}
            ${COMPARE_FIELDS.map((name) => compareFieldRow(programs, name)).join("")}
          </tbody>
        </table></div>
      </div>`;
    createIcons();
    appendDecisionBoundary();
  } catch (error) {
    if (error.name === "AbortError" || !isCurrentRoute(context)) return;
    renderError("Comparison unavailable", error.message);
  }
}

function compareRow(programs, label, getter, fieldName = label) {
  return `<tr><th scope="row">${escapeHtml(label)}</th>${programs.map((program) => {
    const value = getter(program);
    return `<td class="${value === undefined || value === null || value === "" ? "unknown-value" : ""}">${escapeHtml(value === undefined || value === null || value === "" ? "Unknown" : formatValue(fieldName, value))}</td>`;
  }).join("")}</tr>`;
}

function compareFieldRow(programs, fieldName) {
  return `<tr><th scope="row">${escapeHtml(displayFieldName(fieldName))}</th>${programs.map((program) => {
    const known = knownField(program, fieldName);
    const value = known ? formatValue(fieldName, known.value, known.field.assertionClass) : "Unknown";
    return `<td${known ? "" : ' class="unknown-value"'}><span class="compare-cell-value">${escapeHtml(value)}</span>${fieldProvenance(program, fieldName, true)}</td>`;
  }).join("")}</tr>`;
}

function renderActn() {
  setHeading("ACTN", "RISE / Integrations");
  viewport.innerHTML = `
    <div class="content-width">
      <header class="page-header"><div><h1>Ecosystem handoffs</h1><p>Integration contracts are present; activation requires an authorized backend and current source governance.</p></div></header>
      <section class="band">
        <div class="integration-grid">
          ${integrationRow("ACTN", "network", "Relationship context handoff", "actn")}
          ${integrationRow("CAM", "messages-square", "Interview context handoff", "cam")}
          ${integrationRow("StoryForge", "sparkles", "Narrative context handoff", "storyforge")}
          ${integrationRow("Matrix", "table-properties", "Protected runtime remains untouched", "matrix", true)}
        </div>
      </section>
      <div class="callout"><strong>Activation hold.</strong><p>No cross-system write is performed from this offline shadow release.</p></div>
    </div>`;
  createIcons();
}

async function renderQueue(context) {
  setHeading("Queue", "RISE / Operations");
  renderLoading("Checking operator queue");
  try {
    await fetchJson("/api/rise/v1/operator/queue", { signal: context.signal });
    if (!isCurrentRoute(context)) return;
  } catch (error) {
    if (error.name === "AbortError" || !isCurrentRoute(context)) return;
    viewport.innerHTML = `
      <div class="content-width">
        <header class="page-header"><div><h1>Operator queue</h1><p>Registry quarantine is visible without exposing an unauthorized mutation surface.</p></div></header>
        <div class="callout"><strong>${escapeHtml(error.code)}</strong><p>${escapeHtml(error.message)}</p></div>
        <ul class="status-list queue-status">
          ${statusRow("Quarantined source rows", formatNumber(error.details?.quarantinedSourceRows ?? state.status.counts.quarantinedSourceRows), statusTag("reviewed", "gold"))}
          ${statusRow("Operator backend", "No approved runtime", statusTag("disabled", "red"))}
          ${statusRow("Write capability", "Unavailable", statusTag("blocked", "red"))}
        </ul>
      </div>`;
    createIcons();
  }
}

async function renderRoute({ focusSelector = null, fallbackFocusSelector = null } = {}) {
  const context = beginRouteRender();
  const route = routeFromHash();
  setActiveNavigation(route.route);
  closeLayer();
  if (!state.status) {
    renderLoading();
    return;
  }
  try {
    if (route.route === "home") renderHome();
    else if (route.route === "explorer") await renderExplorer(route.params, context);
    else if (route.route === "profile" && route.parts[0]) await renderProfile(decodeURIComponent(route.parts[0]), context);
    else if (route.route === "compare") await renderCompare(context);
    else if (route.route === "actn") renderActn();
    else if (route.route === "queue") await renderQueue(context);
    else renderError("View not found", "The requested RISE view does not exist.", `<div class="state-actions"><button class="button button-primary" type="button" data-route="home">Return to Command</button></div>`);
    if (!isCurrentRoute(context)) return;
    appendDecisionBoundary();
  } catch (error) {
    if (error.name === "AbortError" || !isCurrentRoute(context)) return;
    renderError("RISE unavailable", error.message);
  } finally {
    if (!isCurrentRoute(context)) return;
    routeAnnouncer.textContent = `${viewName.textContent} view loaded`;
    const focusedControl = focusRenderedControl(focusSelector, fallbackFocusSelector);
    if (!focusedControl && state.routeFocusRequested) {
      const previousScrollBehavior = viewport.style.scrollBehavior;
      viewport.style.scrollBehavior = "auto";
      viewport.scrollTop = 0;
      viewport.scrollLeft = 0;
      viewport.focus({ preventScroll: true });
      if (previousScrollBehavior) viewport.style.scrollBehavior = previousScrollBehavior;
      else viewport.style.removeProperty("scroll-behavior");
    }
    if (focusedControl || state.routeFocusRequested) state.routeFocusRequested = false;
  }
}

function appendDecisionBoundary() {
  appendRegistryNotices();
  const content = viewport.querySelector(".content-width");
  if (!content || content.querySelector(".decision-boundary")) return;
  const evidenceClass = state.status?.dataClassification === "synthetic_test_fixture"
    ? "synthetic-fixture"
    : "source-attributed";
  content.insertAdjacentHTML("beforeend", `
    <aside class="decision-boundary" aria-label="RISE decision boundary">
      RISE compares selected ${evidenceClass} fields. Visa listings do not establish current or conditional sponsorship, and F-1 OPT is employment authorization rather than visa sponsorship. RISE does not determine eligibility, interview likelihood, rank, visa approval, fellowship placement, or Match outcome.
    </aside>`);
}

function appendRegistryNotices() {
  const content = viewport.querySelector(".content-width");
  if (!content || content.querySelector(".registry-notices")) return;
  const synthetic = state.status?.dataClassification === "synthetic_test_fixture";
  content.insertAdjacentHTML("afterbegin", `
    <div class="registry-notices" aria-label="Registry limitations">
      ${synthetic ? `<aside class="registry-notice registry-notice-synthetic" role="note"><strong>Synthetic test fixture.</strong><span>All program records and assertions in this view are invented for interaction testing and are not residency facts.</span></aside>` : ""}
      <aside class="registry-notice registry-notice-current" role="note"><strong>Current program availability is not established.</strong><span>Current accreditation, recruitment, application participation, deadlines, and position availability require verification with official current sources.</span></aside>
    </div>`);
}

function toggleCompare(id) {
  const existing = state.compareIds.indexOf(id);
  const initiatingRecord = state.profile?.programSpecialtyId === id
    ? state.profile
    : state.currentSearch?.records?.find((record) => record.programSpecialtyId === id);
  if (existing >= 0) {
    state.compareIds.splice(existing, 1);
    showToast("Program removed from comparison");
  } else if (state.compareIds.length >= 4) {
    showToast("Comparison is limited to four programs", "error");
    return;
  } else {
    state.compareIds.push(id);
    showToast("Program added to comparison");
  }
  saveCompareIds();
  const route = routeFromHash().route;
  if (route === "compare") {
    const nextId = state.compareIds.length ? state.compareIds[Math.min(existing, state.compareIds.length - 1)] : null;
    const selector = nextId ? `[data-toggle-compare="${CSS.escape(nextId)}"]` : '[data-route="explorer"]';
    renderRoute({ focusSelector: selector, fallbackFocusSelector: "[data-clear-compare], [data-route=explorer]" });
  } else if (route === "profile") {
    drawProfile();
    focusRenderedControl(`[data-toggle-compare="${CSS.escape(id)}"]`);
  }
  else document.querySelectorAll(`[data-toggle-compare="${CSS.escape(id)}"]`).forEach((button) => {
    const selected = state.compareIds.includes(id);
    button.classList.toggle("is-selected", selected);
    if (initiatingRecord) button.setAttribute("aria-label", compareActionLabel(initiatingRecord, selected));
    button.dataset.tooltip = selected ? "Remove from compare" : "Add to compare";
    button.innerHTML = `<i data-lucide="${selected ? "check" : "plus"}"></i>`;
  });
  createIcons();
}

function showToast(message, tone = "info") {
  const duplicate = [...toastRoot.children].find((item) => item.dataset.message === message);
  if (duplicate) {
    duplicate.remove();
    toastRoot.append(duplicate);
    return;
  }
  const max = window.matchMedia("(max-width: 700px)").matches ? 1 : 2;
  while (toastRoot.children.length >= max) toastRoot.firstElementChild?.remove();
  const toast = document.createElement("div");
  toast.className = `toast${tone === "error" ? " toast-error" : ""}`;
  toast.dataset.message = message;
  toast.setAttribute("role", tone === "error" ? "alert" : "status");
  toast.textContent = message;
  toastRoot.append(toast);
  window.setTimeout(() => toast.remove(), 3800);
}

function focusableElements() {
  return [...dialog.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')]
    .filter((node) => !node.hidden && node.getClientRects().length);
}

function openLayer({ kicker = "RISE", title, body, returnFocus = document.activeElement, initialFocus }) {
  state.layerReturnFocus = returnFocus instanceof HTMLElement ? returnFocus : null;
  dialogKicker.textContent = kicker;
  dialogTitle.textContent = title;
  dialogBody.innerHTML = body;
  backdrop.hidden = false;
  appShell.inert = true;
  document.body.classList.add("layer-open");
  createIcons();
  window.requestAnimationFrame(() => {
    const focusables = focusableElements();
    const requested = initialFocus ? dialog.querySelector(initialFocus) : null;
    (requested || focusables[0] || dialogTitle).focus();
  });
}

function closeLayer() {
  if (backdrop.hidden) return;
  backdrop.hidden = true;
  appShell.inert = false;
  document.body.classList.remove("layer-open");
  dialogBody.replaceChildren();
  state.layerReturnFocus?.focus?.();
  state.layerReturnFocus = null;
  state.commandAbort?.abort();
  state.commandAbort = null;
}

function openStatusDialog(trigger) {
  const counts = state.status.counts;
  openLayer({
    kicker: "Release status",
    title: "Offline shadow registry",
    returnFocus: trigger,
    body: `<ul class="status-list">
      ${statusRow("Release", state.status.registryReleaseId, statusTag("immutable", "teal"))}
      ${statusRow("Snapshot", state.status.sourceSnapshotId, statusTag("pinned", "teal"))}
      ${statusRow("Unique programs", formatNumber(counts.uniquePrograms), statusTag("loaded", "teal"))}
      ${statusRow("Source rights", state.status.sourceRightsApproved ? "Recorded for this data class" : "Not approved", statusTag(state.status.sourceRightsApproved ? "recorded" : "blocked", state.status.sourceRightsApproved ? "teal" : "red"))}
      ${statusRow("Hard-match claims", formatNumber(counts.matchableClaims), statusTag("disabled", "red"))}
      ${statusRow("Runtime", "Local authenticated preview", statusTag("not production", "gold"))}
    </ul>`,
  });
}

function openMatrixDialog(trigger) {
  openLayer({
    kicker: "Protected system",
    title: "Matrix remains isolated",
    returnFocus: trigger,
    body: `<div class="callout"><strong>No mutation attempted.</strong><p>The selected Matrix runtime has unresolved source lineage and drift. RISE does not read or write it in this release.</p></div>`,
  });
}

function openCommandPalette(trigger) {
  openLayer({
    kicker: "Command palette",
    title: "Search RISE",
    returnFocus: trigger,
    initialFocus: "#command-search",
    body: `<div class="field"><label for="command-search">Program or view</label><input class="text-input" id="command-search" type="search" autocomplete="off" placeholder="Search programs" aria-describedby="command-status"></div><div class="sr-only" id="command-status" aria-live="polite" aria-atomic="true">One view available</div><div class="command-results" id="command-results"><button type="button" class="command-result" data-route="explorer"><span class="command-result-icon"><i data-lucide="search"></i></span><span class="command-result-copy"><strong>Program Explorer</strong><span>Browse the registry</span></span><small>View</small></button></div>`,
  });
}

async function commandSearch(query) {
  const container = document.querySelector("#command-results");
  const status = document.querySelector("#command-status");
  if (!container) return;
  state.commandAbort?.abort();
  if (!query.trim()) {
    container.innerHTML = `<button type="button" class="command-result" data-route="explorer"><span class="command-result-icon"><i data-lucide="search"></i></span><span class="command-result-copy"><strong>Program Explorer</strong><span>Browse the registry</span></span><small>View</small></button>`;
    if (status) status.textContent = "One view available";
    createIcons();
    return;
  }
  const controller = new AbortController();
  state.commandAbort = controller;
  try {
    const result = await fetchJson(`/api/rise/v1/programs?q=${encodeURIComponent(query)}&includeCombined=true&pageSize=6`, { signal: controller.signal });
    if (!result.records.length) {
      container.innerHTML = `<div class="empty-inline">No programs found</div>`;
      if (status) status.textContent = "No programs found";
      return;
    }
    container.innerHTML = result.records.map((record) => `
      <button type="button" class="command-result" data-open-program="${escapeHtml(record.programSpecialtyId)}" aria-label="Open profile for ${escapeHtml(programIdentityLabel(record))}">
        <span class="command-result-icon"><i data-lucide="building-2"></i></span>
        <span class="command-result-copy"><strong>${escapeHtml(record.display.programName)}</strong><span>${escapeHtml(record.designation)} · ${escapeHtml(record.display.city)}, ${escapeHtml(record.display.state)}</span></span>
        <small>${escapeHtml(record.evidence.coveragePercent)}%</small>
      </button>`).join("");
    if (status) status.textContent = `${result.records.length} program results available`;
    createIcons();
  } catch (error) {
    if (error.name !== "AbortError") {
      container.innerHTML = `<div class="empty-inline">Search unavailable</div>`;
      if (status) status.textContent = "Search unavailable";
    }
  }
}

async function checkIntegration(name, trigger) {
  trigger.disabled = true;
  try {
    await fetchJson(`/api/rise/v1/handoffs/${encodeURIComponent(name)}`, { method: "POST", body: JSON.stringify({ intent: "status_check" }) });
  } catch (error) {
    openLayer({
      kicker: `${name.toUpperCase()} contract`,
      title: "Integration disabled",
      returnFocus: trigger,
      body: `<div class="callout"><strong>${escapeHtml(error.code)}</strong><p>${escapeHtml(error.message)}</p></div><ul class="status-list"><li class="status-row"><span>Write performed</span><strong>No</strong>${statusTag("safe", "teal")}</li><li class="status-row"><span>Activation</span><strong>Requires authorized backend</strong>${statusTag("blocked", "red")}</li></ul>`,
    });
  } finally {
    trigger.disabled = false;
  }
}

function applyExplorerForm(form) {
  const data = new FormData(form);
  const params = new URLSearchParams();
  for (const [key, value] of data.entries()) {
    if (key === "includeCombined" || String(value).trim()) params.set(key, String(value).trim());
  }
  params.set("includeCombined", form.elements.includeCombined.checked ? "true" : "false");
  navigate(`explorer?${params}`);
}

document.addEventListener("click", (event) => {
  const routeButton = event.target.closest("[data-route]");
  if (routeButton) {
    event.preventDefault();
    navigate(routeButton.dataset.route);
    return;
  }
  const openProgram = event.target.closest("[data-open-program]");
  if (openProgram) {
    closeLayer();
    navigate(`profile/${encodeURIComponent(openProgram.dataset.openProgram)}`);
    return;
  }
  const compare = event.target.closest("[data-toggle-compare]");
  if (compare) {
    toggleCompare(compare.dataset.toggleCompare);
    return;
  }
  const page = event.target.closest("[data-page]");
  if (page && !page.disabled) {
    const route = routeFromHash();
    route.params.set("page", page.dataset.page);
    navigate(`explorer?${route.params}`);
    return;
  }
  if (event.target.closest("[data-clear-filters]")) {
    navigate("explorer");
    return;
  }
  if (event.target.closest("[data-clear-compare]")) {
    state.compareIds = [];
    saveCompareIds();
    renderRoute({ focusSelector: '[data-route="explorer"]' });
    showToast("Comparison cleared");
    return;
  }
  const moreFilters = event.target.closest("[data-toggle-more-filters]");
  if (moreFilters) {
    const fields = document.querySelector(`#${CSS.escape(moreFilters.getAttribute("aria-controls"))}`);
    const expanded = moreFilters.getAttribute("aria-expanded") === "true";
    moreFilters.setAttribute("aria-expanded", String(!expanded));
    fields?.classList.toggle("is-open", !expanded);
    const label = moreFilters.querySelector("span");
    if (label) label.textContent = `${expanded ? "More" : "Hide"} filters`;
    return;
  }
  const tab = event.target.closest("[data-profile-tab]");
  if (tab) activateProfileTab(tab.dataset.profileTab, true);
  const integration = event.target.closest("[data-integration]");
  if (integration) checkIntegration(integration.dataset.integration, integration);
  const status = event.target.closest("[data-open-status]");
  if (status) openStatusDialog(status);
  const matrix = event.target.closest("[data-matrix-status]");
  if (matrix) openMatrixDialog(matrix);
});

document.addEventListener("submit", (event) => {
  if (event.target.matches("#explorer-form")) {
    event.preventDefault();
    applyExplorerForm(event.target);
  }
});

let commandTimer;
document.addEventListener("input", (event) => {
  if (event.target.matches("#command-search")) {
    window.clearTimeout(commandTimer);
    commandTimer = window.setTimeout(() => commandSearch(event.target.value), 180);
  }
});

function activateProfileTab(id, focus = false) {
  if (!state.profile || !FIELD_GROUPS[id] && id !== "evidence") return;
  state.profileTab = id;
  document.querySelectorAll("[data-profile-tab]").forEach((button) => {
    const selected = button.dataset.profileTab === id;
    button.setAttribute("aria-selected", String(selected));
    button.tabIndex = selected ? 0 : -1;
    if (selected && focus) button.focus();
  });
  const panel = document.querySelector("#profile-tab-panel");
  if (panel) {
    panel.setAttribute("aria-labelledby", `tab-${id}`);
    panel.innerHTML = profilePanel(state.profile, id);
  }
}

document.addEventListener("keydown", (event) => {
  if (!backdrop.hidden) {
    if (event.key === "Escape") {
      event.preventDefault();
      closeLayer();
      return;
    }
    if (event.key === "Tab") {
      const focusables = focusableElements();
      if (!focusables.length) return;
      const first = focusables[0];
      const last = focusables.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  }
  const tab = event.target.closest?.("[data-profile-tab]");
  if (tab && ["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) {
    event.preventDefault();
    const tabs = [...document.querySelectorAll("[data-profile-tab]")];
    const index = tabs.indexOf(tab);
    let next = index;
    if (event.key === "ArrowLeft") next = (index - 1 + tabs.length) % tabs.length;
    if (event.key === "ArrowRight") next = (index + 1) % tabs.length;
    if (event.key === "Home") next = 0;
    if (event.key === "End") next = tabs.length - 1;
    activateProfileTab(tabs[next].dataset.profileTab, true);
  }
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
    event.preventDefault();
    openCommandPalette(document.querySelector("#command-button"));
  }
});

document.querySelector("#dialog-close").addEventListener("click", closeLayer);
backdrop.addEventListener("mousedown", (event) => {
  if (event.target === backdrop) closeLayer();
});
document.querySelector("#command-button").addEventListener("click", (event) => openCommandPalette(event.currentTarget));
document.querySelector("#compare-button").addEventListener("click", () => navigate("compare"));
skipLink.addEventListener("click", (event) => {
  event.preventDefault();
  viewport.scrollTop = 0;
  viewport.focus({ preventScroll: true });
});
window.addEventListener("hashchange", () => {
  state.routeFocusRequested = true;
  renderRoute();
});

async function boot() {
  saveCompareIds();
  renderLoading();
  try {
    [state.status, state.session] = await Promise.all([
      fetchJson("/api/rise/v1/status"),
      fetchJson("/api/rise/v1/session"),
    ]);
    document.querySelector("#sidebar-registry").textContent = state.status.registryReleaseId.replace("rise_registry_", "").slice(0, 18);
    await renderRoute();
  } catch (error) {
    setHeading("Unavailable", "RISE / Error");
    renderError("RISE could not start", error.message);
  }
}

boot();
