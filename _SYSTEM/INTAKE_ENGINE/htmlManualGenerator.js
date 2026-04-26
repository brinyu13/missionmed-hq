"use strict";

/**
 * MMOS htmlManualGenerator.js (v2.0)
 *
 * Purpose:
 *   Convert a deterministic workflowOutput object into a single-file HTML
 *   operator manual that visually matches the MR-1377 Workflow OS Operator
 *   Manual exactly: navy header, left sidebar tab navigation, per-phase
 *   tab panels, step-header + step-body cards, dark prompt blocks with copy
 *   buttons, gate boxes, next-action panels, status panels, and the same
 *   typography / color / spacing system.
 *
 * Contract (unchanged from v1):
 *   Input  : workflowOutput = {
 *              interpretedInput: { taskType, complexity, risk, goal,
 *                                  targets, project, ... },
 *              phases:  [ { phaseNumber, role, title, description } ],
 *              steps:   [ { phaseNumber, stepNumber, intent, action,
 *                           ai, model, thread } ],
 *              prompts: [ { promptName, threadName, promptBody } ]
 *            }
 *   Output : string (complete HTML document)
 *
 * Locked upstream modules (NOT modified by this file):
 *   generateWorkflow, generateSteps, generatePrompts.
 *   This file only consumes their output and renders HTML.
 */

/* ============================================================
   STAGE 1 - PRIMITIVE HELPERS
   ============================================================ */

function toStringOrEmpty(value) {
  if (value === null || value === undefined) return "";
  return String(value);
}

function asInteger(value) {
  if (Number.isInteger(value)) return value;
  const parsed = parseInt(value, 10);
  return Number.isInteger(parsed) ? parsed : null;
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function esc(value) {
  return toStringOrEmpty(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function titleCase(value) {
  const s = toStringOrEmpty(value).trim().toLowerCase();
  if (!s) return "";
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function safeUpper(value) {
  return toStringOrEmpty(value).trim().toUpperCase();
}

/* ============================================================
   STAGE 2 - INPUT NORMALIZATION
   ============================================================ */

function inferProjectLetter(workflowOutput) {
  const output = workflowOutput && typeof workflowOutput === "object" ? workflowOutput : {};
  const interpretedInput =
    output.interpretedInput && typeof output.interpretedInput === "object"
      ? output.interpretedInput
      : {};
  const direct = toStringOrEmpty(output.project || interpretedInput.project).trim().toUpperCase();
  if (/^[A-Z]$/.test(direct)) return direct;

  const prompts = asArray(output.prompts);
  if (prompts.length > 0) {
    const promptName = toStringOrEmpty(prompts[0].promptName);
    const match = promptName.match(/^\(([A-Z])\)-/);
    if (match && match[1]) return match[1];
  }
  return "M";
}

function normalizeTargets(interpretedInput, workflowOutput) {
  const fromInterpreted = asArray(interpretedInput.targets);
  if (fromInterpreted.length > 0) {
    return fromInterpreted.map(toStringOrEmpty).map((s) => s.trim()).filter(Boolean);
  }
  const fromWorkflow = asArray(workflowOutput.targets);
  if (fromWorkflow.length > 0) {
    return fromWorkflow.map(toStringOrEmpty).map((s) => s.trim()).filter(Boolean);
  }
  return [];
}

function inferGoal(workflowOutput, interpretedInput, targets) {
  const candidates = [
    interpretedInput.goal,
    workflowOutput.goal,
    interpretedInput.objective,
    workflowOutput.objective,
  ];
  for (let i = 0; i < candidates.length; i += 1) {
    const candidate = toStringOrEmpty(candidates[i]).trim();
    if (candidate.length > 0) return candidate;
  }
  const taskType = safeUpper(interpretedInput.taskType) || "WORKFLOW";
  if (targets.length > 0) {
    return "Execute " + taskType + " workflow for " + targets.join(", ") + ".";
  }
  return "Execute " + taskType + " workflow for defined targets.";
}

function getStepsForPhase(steps, phaseNumber) {
  const safe = asInteger(phaseNumber);
  return steps.filter((step) => asInteger(step.phaseNumber) === safe);
}

function getPromptForStep(prompts, globalIndex) {
  if (globalIndex < 0 || globalIndex >= prompts.length) return {};
  const p = prompts[globalIndex];
  return p && typeof p === "object" ? p : {};
}

/* ============================================================
   STAGE 3 - SEMANTIC CLASSIFIERS (badges, slugs)
   ============================================================ */

function aiBadgeClass(ai) {
  const v = safeUpper(ai);
  if (v === "CODEX") return "step-ai step-ai-codex";
  return "step-ai step-ai-claude"; // CLAUDE default
}

function aiBadgeLabel(ai) {
  const v = safeUpper(ai);
  if (v === "CODEX") return "Codex";
  if (v === "CLAUDE") return "Claude";
  return titleCase(ai) || "Claude";
}

function modelBadgeClass(model) {
  const v = toStringOrEmpty(model).trim().toLowerCase();
  if (v === "opus") return "step-meta meta-opus";
  if (v === "sonnet") return "step-meta meta-sonnet";
  if (v === "codex" || v === "high" || v === "low" || v === "med" || v === "medium") {
    return "step-meta meta-codex";
  }
  return "step-meta meta-tokens";
}

function modelBadgeLabel(model) {
  const v = toStringOrEmpty(model).trim().toLowerCase();
  if (v === "opus") return "Opus Required";
  if (v === "sonnet") return "Sonnet OK";
  if (v === "high") return "High";
  if (v === "low") return "Low";
  if (v === "med" || v === "medium") return "Medium";
  if (v === "codex") return "Codex";
  return titleCase(model) || "Default";
}

function threadBadgeLabel(thread) {
  const v = safeUpper(thread);
  if (v === "NEW") return "New thread";
  if (v === "SAME") return "Same thread";
  if (v === "STARTER" || v === "THREAD STARTER") return "New thread";
  if (v === "CONTINUATION" || v === "THREAD CONTINUATION") return "Same thread";
  return titleCase(thread) || "Same thread";
}

function riskBadgeClass(risk) {
  const v = safeUpper(risk);
  if (v === "HIGH") return "badge b-r";
  if (v === "MED" || v === "MEDIUM") return "badge b-y";
  if (v === "LOW") return "badge b-g";
  return "badge b-b";
}

function phaseSlug(phaseNumber) {
  return "ph" + String(asInteger(phaseNumber) === null ? 0 : asInteger(phaseNumber));
}

function phaseShortLabel(phase) {
  const role = toStringOrEmpty(phase.role).trim();
  const title = toStringOrEmpty(phase.title).trim();
  if (role) return titleCase(role);
  if (title) {
    const cleaned = title.replace(/^PH\d+\s*[:\-]\s*/i, "").replace(/\s*[\-]\s*.+$/, "");
    return cleaned.slice(0, 28) || "Phase";
  }
  return "Phase";
}

/* ============================================================
   STAGE 4 - CSS SYSTEM (lifted verbatim from MR-1377)
   ============================================================ */

function buildCSS() {
  return `*,*::before,*::after{margin:0;padding:0;box-sizing:border-box}
:root{
  --navy:#0F2A44;--navy-sec:#1B2F4A;--charcoal:#2A2A2A;--accent:#B23A3A;
  --white:#FFF;--light:#F4F5F7;--mid:#E2E4E8;--text2:#6B7280;
  --green:#2E7D32;--amber:#E65100;
  --shadow:0 1px 3px rgba(0,0,0,.08),0 4px 12px rgba(0,0,0,.04);
  --shadow-h:0 2px 8px rgba(0,0,0,.12),0 8px 24px rgba(0,0,0,.06);
  --r:12px;--rs:8px;--t:.25s ease;
}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;background:var(--light);color:var(--charcoal);line-height:1.65;-webkit-font-smoothing:antialiased}
.header{background:var(--navy);padding:0 32px;height:68px;display:flex;align-items:center;gap:20px;position:sticky;top:0;z-index:100;box-shadow:0 2px 12px rgba(0,0,0,.2)}
.header-logo{height:38px;width:auto;flex-shrink:0}
.header-title{color:var(--white);font-size:17px;font-weight:600;letter-spacing:-.2px}
.header-badge{background:var(--accent);color:var(--white);font-size:11px;font-weight:600;padding:3px 10px;border-radius:20px;letter-spacing:.5px;text-transform:uppercase}
.layout{display:flex;min-height:calc(100vh - 68px)}
.sidebar{width:260px;min-width:260px;background:var(--white);border-right:1px solid var(--mid);padding:24px 0;overflow-y:auto;position:sticky;top:68px;height:calc(100vh - 68px)}
.sidebar-label{font-size:10px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;color:var(--text2);padding:0 24px;margin-bottom:12px;margin-top:16px}
.sidebar-label:first-child{margin-top:0}
.sidebar-div{height:1px;background:var(--mid);margin:16px 24px}
.tab-btn{display:flex;align-items:center;gap:10px;width:100%;padding:10px 24px;border:none;background:none;cursor:pointer;font-size:13px;font-weight:500;color:var(--charcoal);text-align:left;transition:all var(--t);position:relative;line-height:1.4}
.tab-btn:hover{background:var(--light);color:var(--navy)}
.tab-btn.active{background:rgba(15,42,68,.06);color:var(--navy);font-weight:600}
.tab-btn.active::before{content:'';position:absolute;left:0;top:4px;bottom:4px;width:3px;background:var(--accent);border-radius:0 3px 3px 0}
.tab-num{display:inline-flex;align-items:center;justify-content:center;min-width:22px;height:22px;border-radius:6px;background:var(--mid);color:var(--text2);font-size:11px;font-weight:700;flex-shrink:0;transition:all var(--t);padding:0 4px}
.tab-btn.active .tab-num{background:var(--navy);color:var(--white)}
.content{flex:1;padding:32px 40px 60px;max-width:1020px;overflow-y:auto}
.tab-content{display:none;animation:fadeIn .3s ease}
.tab-content.active{display:block}
@keyframes fadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
.section-header{margin-bottom:28px}
.section-header h1{font-size:26px;font-weight:700;color:var(--navy);margin-bottom:8px;letter-spacing:-.3px}
.section-intro{font-size:15px;color:var(--text2);line-height:1.6;max-width:700px}
.card{background:var(--white);border-radius:var(--r);padding:28px;margin-bottom:20px;box-shadow:var(--shadow);transition:box-shadow var(--t)}
.card:hover{box-shadow:var(--shadow-h)}
.card h2{font-size:17px;font-weight:700;color:var(--navy);margin-bottom:12px;letter-spacing:-.2px}
.card h3{font-size:15px;font-weight:600;color:var(--navy-sec);margin-top:20px;margin-bottom:8px}
.card p{font-size:14.5px;color:var(--charcoal);margin-bottom:12px;line-height:1.7}
.card ul{margin:8px 0 12px 20px;font-size:14.5px}
.card ul li{margin-bottom:6px;line-height:1.6}
.card ol{margin:8px 0 12px 20px;font-size:14.5px}
.card ol li{margin-bottom:8px;line-height:1.6}
.hl{background:rgba(15,42,68,.04);border-left:3px solid var(--navy);padding:16px 20px;border-radius:0 var(--rs) var(--rs) 0;margin:16px 0;font-size:14px;color:var(--navy-sec);line-height:1.65}
.hl strong{color:var(--navy)}
.hl-a{background:rgba(178,58,58,.04);border-left:3px solid var(--accent);padding:16px 20px;border-radius:0 var(--rs) var(--rs) 0;margin:16px 0;font-size:14px;color:var(--charcoal);line-height:1.65}
.hl-a strong{color:var(--accent)}
.hl-g{background:rgba(46,125,50,.04);border-left:3px solid var(--green);padding:16px 20px;border-radius:0 var(--rs) var(--rs) 0;margin:16px 0;font-size:14px;color:var(--charcoal);line-height:1.65}
.hl-g strong{color:var(--green)}
.hl-w{background:#FFF8E1;border-left:3px solid #F9A825;padding:16px 20px;border-radius:0 var(--rs) var(--rs) 0;margin:16px 0;font-size:14px;color:var(--charcoal);line-height:1.65}
.hl-w strong{color:#E65100}
.st{width:100%;border-collapse:collapse;margin:12px 0;font-size:14px}
.st th{background:var(--navy);color:var(--white);font-weight:600;padding:10px 16px;text-align:left;font-size:13px;letter-spacing:.3px}
.st th:first-child{border-radius:var(--rs) 0 0 0}.st th:last-child{border-radius:0 var(--rs) 0 0}
.st td{padding:10px 16px;border-bottom:1px solid var(--mid)}
.st tr:last-child td{border-bottom:none}.st tr:nth-child(even) td{background:rgba(0,0,0,.015)}
.badge{display:inline-block;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:700;letter-spacing:.4px;text-transform:uppercase}
.b-g{background:#E8F5E9;color:#2E7D32}.b-y{background:#FFF3E0;color:#E65100}.b-r{background:#FFEBEE;color:#C62828}.b-b{background:var(--mid);color:var(--text2)}
.b-claude{background:#E8EAF6;color:#283593}.b-codex{background:#E0F2F1;color:#00695C}

.verdict-box{background:var(--navy);color:var(--white);border-radius:var(--r);padding:32px;margin:20px 0}
.verdict-box h2{color:#2FE7B0;font-size:20px;margin-bottom:16px}
.verdict-box p{color:rgba(255,255,255,.85);line-height:1.7;font-size:15px;margin-bottom:12px}

.status-panel{background:linear-gradient(135deg,#0F2A44 0%,#1B2F4A 100%);color:var(--white);border-radius:var(--r);padding:20px 24px;margin:20px 0;font-size:13px;line-height:1.8}
.status-panel .sp-title{font-size:11px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;color:#2FE7B0;margin-bottom:8px}
.status-panel .sp-row{display:flex;gap:8px}.status-panel .sp-label{color:rgba(255,255,255,.5);min-width:140px;flex-shrink:0}.status-panel .sp-val{color:var(--white);font-weight:600}

.prompt-block{position:relative;background:#1a1a2e;color:#e0e0e0;border-radius:var(--r);padding:24px;margin:16px 0;font-family:'SF Mono',Consolas,'Courier New',monospace;font-size:13px;line-height:1.8;white-space:pre-wrap;overflow-x:auto}
.prompt-block .prompt-label{position:absolute;top:0;left:0;background:var(--accent);color:var(--white);font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;padding:4px 12px;border-radius:var(--r) 0 var(--rs) 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif}
.prompt-block .copy-btn{position:absolute;top:8px;right:8px;background:rgba(255,255,255,.12);color:#ccc;border:none;border-radius:6px;padding:6px 14px;font-size:11px;font-weight:600;cursor:pointer;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;transition:all .2s}
.prompt-block .copy-btn:hover{background:rgba(255,255,255,.25);color:#fff}
.prompt-block .prompt-body{display:block;margin-top:24px}
.prompt-meta{display:flex;flex-wrap:wrap;gap:8px;margin:10px 0 4px 0;font-size:12px}
.prompt-meta span{background:var(--light);border:1px solid var(--mid);border-radius:6px;padding:4px 10px;color:var(--navy-sec);font-weight:600}
.prompt-meta span strong{color:var(--text2);font-weight:600;margin-right:6px;text-transform:uppercase;letter-spacing:.4px;font-size:10px}

.step-header{background:var(--navy);color:var(--white);border-radius:var(--r) var(--r) 0 0;padding:16px 24px;margin-top:24px;font-size:15px;font-weight:700;display:flex;align-items:center;gap:12px;flex-wrap:wrap}
.step-header .step-ai{font-size:11px;font-weight:700;padding:3px 10px;border-radius:20px;letter-spacing:.4px;text-transform:uppercase}
.step-ai-claude{background:#C5CAE9;color:#1A237E}
.step-ai-codex{background:#B2DFDB;color:#004D40}
.step-meta{font-size:11px;font-weight:600;padding:3px 10px;border-radius:20px;letter-spacing:.3px}
.meta-opus{background:rgba(197,202,233,.3);color:#C5CAE9}
.meta-sonnet{background:rgba(178,223,219,.3);color:#B2DFDB}
.meta-codex{background:rgba(178,223,219,.3);color:#B2DFDB}
.meta-time{background:rgba(255,255,255,.1);color:rgba(255,255,255,.7)}
.meta-tokens{background:rgba(255,255,255,.1);color:rgba(255,255,255,.7)}
.step-body{background:var(--white);border:1px solid var(--mid);border-top:none;border-radius:0 0 var(--r) var(--r);padding:24px;margin-bottom:8px;box-shadow:var(--shadow)}
.step-body p{font-size:14.5px;margin-bottom:10px;line-height:1.7}

.gate-box{background:#1a1a2e;color:#e0e0e0;border-radius:var(--r);padding:20px 24px;margin:16px 0;font-family:'SF Mono',Consolas,'Courier New',monospace;font-size:13px;line-height:1.8;white-space:pre-wrap}
.gate-box .gate-label{display:inline-block;background:var(--accent);color:var(--white);font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;padding:3px 10px;border-radius:4px;margin-bottom:12px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif}
.gate-box .hi{color:#2FE7B0}.gate-box .kw{color:#82AAFF}.gate-box .cm{color:#6B7280}

.next-box{background:linear-gradient(135deg,#1B5E20 0%,#2E7D32 100%);color:var(--white);border-radius:var(--r);padding:16px 20px;margin:16px 0;font-size:14px;font-weight:600}
.next-box .next-label{font-size:10px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;color:#A5D6A7;margin-bottom:4px}

.phase-loc{display:flex;align-items:center;gap:10px;background:var(--accent);color:var(--white);border-radius:var(--r);padding:12px 20px;margin-bottom:20px;font-size:13px;font-weight:700;letter-spacing:.3px}
.phase-loc .loc-dot{width:10px;height:10px;border-radius:50%;background:#FFF;animation:pulse 1.5s ease-in-out infinite}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}

.step-control{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:12px 0;font-size:13px}
.sc-item{background:var(--light);border-radius:var(--rs);padding:10px 14px;border:1px solid var(--mid)}
.sc-label{font-size:10px;font-weight:700;letter-spacing:.8px;text-transform:uppercase;color:var(--text2);margin-bottom:4px}
.sc-val{font-weight:600;color:var(--navy)}

.conf-box{background:rgba(15,42,68,.03);border:1px dashed var(--navy);border-radius:var(--rs);padding:12px 16px;margin:12px 0;font-size:13px;color:var(--navy-sec)}
.conf-box .conf-label{font-size:10px;font-weight:700;letter-spacing:.8px;text-transform:uppercase;color:var(--text2);margin-bottom:6px}

.footer{text-align:center;padding:24px;font-size:12px;color:var(--text2);border-top:1px solid var(--mid);margin-top:40px}`;
}

/* ============================================================
   STAGE 5 - LAYOUT BLOCKS
   ============================================================ */

function renderHeader(projectLetter) {
  return [
    '<div class="header">',
    '<img src="https://missionmedinstitute.com/wp-content/uploads/2025/06/mission-med-logo.png" alt="MissionMed" class="header-logo" onerror="this.style.display=\'none\'">',
    '<span class="header-title">MMOS Workflow Operator Manual</span>',
    '<span class="header-badge">Project (' + esc(projectLetter) + ')</span>',
    "</div>",
  ].join("");
}

function renderSidebar(phases) {
  const phaseTabs = phases
    .map((phase, i) => {
      const num = asInteger(phase.phaseNumber);
      const safeNum = num === null ? i + 1 : num;
      const slug = phaseSlug(safeNum);
      const label = phaseShortLabel(phase);
      return (
        '<button class="tab-btn" data-tab="' +
        esc(slug) +
        '"><span class="tab-num">' +
        esc(safeNum) +
        "</span> " +
        esc(label) +
        "</button>"
      );
    })
    .join("");

  return [
    '<nav class="sidebar">',
    '<div class="sidebar-label">Start</div>',
    '<button class="tab-btn active" data-tab="overview"><span class="tab-num">0</span> Overview</button>',
    '<div class="sidebar-div"></div>',
    '<div class="sidebar-label">Execute</div>',
    phaseTabs,
    '<div class="sidebar-div"></div>',
    '<div class="sidebar-label">Reference</div>',
    '<button class="tab-btn" data-tab="tracker"><span class="tab-num">T</span> Progress Tracker</button>',
    '<button class="tab-btn" data-tab="rules"><span class="tab-num">R</span> Execution Rules</button>',
    "</nav>",
  ].join("");
}

/* ============================================================
   STAGE 6 - OVERVIEW TAB
   ============================================================ */

function renderOverviewTab(ctx) {
  const targetMarkup =
    ctx.targets.length > 0
      ? "<ul>" +
        ctx.targets.map((t) => "<li>" + esc(t) + "</li>").join("") +
        "</ul>"
      : "<p>No explicit targets provided.</p>";

  const verdict = [
    '<div class="verdict-box" style="margin-bottom:24px">',
    '<h2>STEP 0 - ASSIGN PROJECT BUCKET</h2>',
    '<p>Project letter for this workstream: <strong>(' + esc(ctx.projectLetter) + ')</strong></p>',
    '<p>All prompt names below carry the <code>(' + esc(ctx.projectLetter) + ')</code> prefix. Keep all related work grouped under this letter. Different projects get different letters. Never mix letters within one build.</p>',
    "</div>",
  ].join("");

  const status = [
    '<div class="status-panel">',
    '<div class="sp-title">Build Summary</div>',
    '<div class="sp-row"><span class="sp-label">Task Type:</span><span class="sp-val">' + esc(ctx.taskType) + "</span></div>",
    '<div class="sp-row"><span class="sp-label">Complexity:</span><span class="sp-val">' + esc(ctx.complexity) + "</span></div>",
    '<div class="sp-row"><span class="sp-label">Risk Level:</span><span class="sp-val">' + esc(ctx.risk) + "</span></div>",
    '<div class="sp-row"><span class="sp-label">Total Phases:</span><span class="sp-val">' + esc(ctx.phaseCount) + "</span></div>",
    '<div class="sp-row"><span class="sp-label">Total Steps:</span><span class="sp-val">' + esc(ctx.stepCount) + "</span></div>",
    '<div class="sp-row"><span class="sp-label">Total Prompts:</span><span class="sp-val">' + esc(ctx.promptCount) + "</span></div>",
    '<div class="sp-row"><span class="sp-label">Naming Format:</span><span class="sp-val">(' + esc(ctx.projectLetter) + ')-MMOS-PH{#}-{AI}-{LEVEL}-{###}</span></div>',
    "</div>",
  ].join("");

  const goalCard = [
    '<div class="card">',
    '<h2>Objective</h2>',
    '<p>' + esc(ctx.goal) + '</p>',
    '<h3>Targets</h3>',
    targetMarkup,
    "</div>",
  ].join("");

  const phasesCard = [
    '<div class="card">',
    '<h2>Phase Map</h2>',
    '<table class="st">',
    '<thead><tr><th>#</th><th>Role</th><th>Title</th><th>Steps</th></tr></thead>',
    "<tbody>",
    ctx.phases
      .map((phase, i) => {
        const num = asInteger(phase.phaseNumber);
        const safeNum = num === null ? i + 1 : num;
        const phaseSteps = getStepsForPhase(ctx.steps, safeNum);
        const role = toStringOrEmpty(phase.role).trim() || "UNSPECIFIED";
        const title = toStringOrEmpty(phase.title).trim() || "Untitled phase";
        return (
          "<tr><td><strong>" +
          esc(safeNum) +
          "</strong></td><td>" +
          esc(role) +
          "</td><td>" +
          esc(title) +
          "</td><td>" +
          esc(phaseSteps.length) +
          "</td></tr>"
        );
      })
      .join(""),
    "</tbody></table>",
    "</div>",
  ].join("");

  const formatCard = [
    '<div class="card">',
    '<h2>Required AI Response Format</h2>',
    '<p>Every AI response to a prompt from this manual MUST begin with:</p>',
    '<div class="gate-box"><span class="gate-label">Result Header</span>',
    "RESULT: COMPLETE / FAILED / PARTIAL\nSUMMARY: [1-2 lines describing what was done]</div>",
    '<p>If the AI does not begin with this header, ask it to re-format before continuing.</p>',
    "</div>",
  ].join("");

  const firstPhaseLabel =
    ctx.phases.length > 0
      ? "Phase " +
        (asInteger(ctx.phases[0].phaseNumber) === null
          ? 1
          : asInteger(ctx.phases[0].phaseNumber)) +
        " - " +
        (toStringOrEmpty(ctx.phases[0].title).trim() || phaseShortLabel(ctx.phases[0]))
      : "the first phase";

  const next = [
    '<div class="next-box">',
    '<div class="next-label">Next Step</div>',
    "Open " + esc(firstPhaseLabel) + " in the sidebar. Execute step 1.",
    "</div>",
  ].join("");

  return [
    '<div class="tab-content active" id="tab-overview">',
    '<div class="section-header">',
    '<h1>MMOS Workflow Operator Manual</h1>',
    '<p class="section-intro">One document. Start at the top. Run the prompts. Pass the gates. Done.</p>',
    "</div>",
    verdict,
    status,
    goalCard,
    phasesCard,
    formatCard,
    next,
    "</div>",
  ].join("");
}

/* ============================================================
   STAGE 7 - PER-STEP RENDERING
   ============================================================ */

function renderStepHeader(step, indexInPhase) {
  const phaseNum = asInteger(step.phaseNumber) || 0;
  const localNum = indexInPhase + 1;
  const heading =
    "STEP " +
    phaseNum +
    "." +
    localNum +
    ": " +
    (titleCase(step.intent) || "Action") +
    " - " +
    (toStringOrEmpty(step.action).trim() || "execute");

  const aiBadge =
    '<span class="' +
    aiBadgeClass(step.ai) +
    '">' +
    esc(aiBadgeLabel(step.ai)) +
    "</span>";

  const modelBadge =
    '<span class="' +
    modelBadgeClass(step.model) +
    '">' +
    esc(modelBadgeLabel(step.model)) +
    "</span>";

  const threadBadge =
    '<span class="step-meta meta-time">' + esc(threadBadgeLabel(step.thread)) + "</span>";

  return (
    '<div class="step-header">' +
    esc(heading) +
    aiBadge +
    modelBadge +
    threadBadge +
    "</div>"
  );
}

function renderStepBody(step, prompt) {
  const intent = toStringOrEmpty(step.intent).trim() || "execute";
  const action = toStringOrEmpty(step.action).trim() || "Execute the defined step.";
  const ai = aiBadgeLabel(step.ai);
  const model = modelBadgeLabel(step.model);
  const thread = threadBadgeLabel(step.thread);

  const control = [
    '<div class="step-control">',
    '<div class="sc-item"><div class="sc-label">Intent</div><div class="sc-val">' +
      esc(intent) +
      '</div><div style="font-size:12px;color:var(--text2);margin-top:2px">' +
      esc(action) +
      "</div></div>",
    '<div class="sc-item"><div class="sc-label">Routing</div><div class="sc-val">' +
      esc(ai) +
      " / " +
      esc(model) +
      '</div><div style="font-size:12px;color:var(--text2);margin-top:2px">' +
      esc(thread) +
      "</div></div>",
    "</div>",
  ].join("");

  const promptName = toStringOrEmpty(prompt.promptName).trim() || "Unnamed prompt";
  const threadName = toStringOrEmpty(prompt.threadName).trim() || "Unnamed thread";
  const promptBody = toStringOrEmpty(prompt.promptBody);

  const promptMeta = [
    '<div class="prompt-meta">',
    '<span><strong>Prompt</strong>' + esc(promptName) + "</span>",
    '<span><strong>Thread</strong>' + esc(threadName) + "</span>",
    "</div>",
  ].join("");

  const promptBlock = promptBody
    ? [
        '<div class="prompt-block">',
        '<span class="prompt-label">Copy This Prompt</span>',
        '<button class="copy-btn" onclick="copyPrompt(this)">Copy</button>',
        '<span class="prompt-body">' + esc(promptBody) + "</span>",
        "</div>",
      ].join("")
    : '<div class="hl-w"><strong>No prompt body produced.</strong> Run generatePrompts again for this step.</div>';

  return [
    '<div class="step-body">',
    '<p><strong>What you do:</strong> Open ' +
      esc(ai) +
      " (" +
      esc(model) +
      "), " +
      esc(thread.toLowerCase()) +
      ", paste the prompt below, run it.</p>",
    control,
    promptMeta,
    promptBlock,
    '<p><strong>Success:</strong> Response begins with <code>RESULT: COMPLETE</code> and the SUCCESS CRITERIA in the prompt are satisfied.</p>',
    "</div>",
  ].join("");
}

/* ============================================================
   STAGE 8 - PER-PHASE TAB
   ============================================================ */

function renderPhaseTab(phase, phaseIndex, ctx) {
  const num = asInteger(phase.phaseNumber);
  const safeNum = num === null ? phaseIndex + 1 : num;
  const slug = phaseSlug(safeNum);
  const role = toStringOrEmpty(phase.role).trim() || "UNSPECIFIED";
  const title = toStringOrEmpty(phase.title).trim() || "Phase " + safeNum;
  const description =
    toStringOrEmpty(phase.description).trim() || "Execute all steps in order. Pass the gate before moving on.";

  const phaseSteps = getStepsForPhase(ctx.steps, safeNum);

  let stepIndexCursor = 0;
  for (let i = 0; i < ctx.steps.length; i += 1) {
    if (ctx.steps[i] === phaseSteps[0]) {
      stepIndexCursor = i;
      break;
    }
  }

  const stepBlocks = phaseSteps
    .map((step, indexInPhase) => {
      const globalIndex = stepIndexCursor + indexInPhase;
      const prompt = getPromptForStep(ctx.prompts, globalIndex);
      return renderStepHeader(step, indexInPhase) + renderStepBody(step, prompt);
    })
    .join("");

  const gateChecks = phaseSteps
    .map((step, i) => {
      const intent = toStringOrEmpty(step.intent).trim() || "step " + (i + 1);
      return "  [  ] Step " + safeNum + "." + (i + 1) + " (" + intent + ") returned RESULT: COMPLETE";
    })
    .join("\n");

  const gate = [
    '<div class="gate-box"><span class="gate-label">Gate: Phase ' +
      esc(safeNum) +
      ' to next phase</span>',
    '<span class="kw">CHECKS:</span>',
    esc(gateChecks),
    "",
    '<span class="kw">ALL PASS?</span> Run: <span class="hi">git add -A &amp;&amp; git commit -m "MMOS-CHECKPOINT: Phase ' +
      esc(safeNum) +
      ' complete"</span>',
    '<span class="kw">ANY FAIL?</span> Fix the failing step. Re-run.</div>',
  ].join("\n");

  const isLast = phaseIndex === ctx.phases.length - 1;
  const nextLabel = isLast
    ? "Build complete. Final commit: <code>git add -A &amp;&amp; git commit -m &quot;MMOS-COMPLETE: System operational&quot;</code>"
    : "Phase " +
      (safeNum + 1) +
      ": open the next tab in the sidebar and run its first step.";

  const next = [
    '<div class="next-box">',
    '<div class="next-label">Next</div>',
    nextLabel,
    "</div>",
  ].join("");

  return [
    '<div class="tab-content" id="tab-' + esc(slug) + '">',
    '<div class="phase-loc"><span class="loc-dot"></span> YOU ARE HERE: Phase ' +
      esc(safeNum) +
      " - " +
      esc(role) +
      "</div>",
    '<div class="section-header">',
    "<h1>" + esc(title) + "</h1>",
    '<p class="section-intro">' + esc(description) + "</p>",
    "</div>",
    stepBlocks ||
      '<div class="hl-w"><strong>No steps generated for this phase.</strong> Re-run generateSteps with non-empty input.</div>',
    gate,
    next,
    "</div>",
  ].join("");
}

/* ============================================================
   STAGE 9 - REFERENCE TABS (Tracker + Rules)
   ============================================================ */

function renderTrackerTab(ctx) {
  const rows = ctx.steps
    .map((step, i) => {
      const phaseNum = asInteger(step.phaseNumber) || "";
      const stepNum = asInteger(step.stepNumber) === null ? i + 1 : asInteger(step.stepNumber);
      const intent = toStringOrEmpty(step.intent).trim() || "step";
      const ai = aiBadgeLabel(step.ai);
      const model = modelBadgeLabel(step.model);
      const thread = threadBadgeLabel(step.thread);
      const prompt = getPromptForStep(ctx.prompts, i);
      const promptName = toStringOrEmpty(prompt.promptName).trim() || "-";
      return (
        "<tr><td>" +
        esc(phaseNum) +
        "</td><td>" +
        esc(stepNum) +
        " - " +
        esc(intent) +
        "</td><td><code>" +
        esc(promptName) +
        "</code></td><td>" +
        esc(ai) +
        "</td><td>" +
        esc(model) +
        "</td><td>" +
        esc(thread) +
        '</td><td><span class="badge b-b">PENDING</span></td></tr>'
      );
    })
    .join("");

  return [
    '<div class="tab-content" id="tab-tracker">',
    '<div class="section-header">',
    '<h1>Progress Tracker</h1>',
    '<p class="section-intro">One row per step. Mark each as you go.</p>',
    "</div>",
    '<div class="card">',
    '<table class="st">',
    '<thead><tr><th>Phase</th><th>Step</th><th>Prompt ID</th><th>AI</th><th>Model</th><th>Thread</th><th>Status</th></tr></thead>',
    "<tbody>",
    rows,
    "</tbody></table>",
    "</div>",
    "</div>",
  ].join("");
}

function renderRulesTab(ctx) {
  return [
    '<div class="tab-content" id="tab-rules">',
    '<div class="section-header">',
    '<h1>Execution Rules</h1>',
    '<p class="section-intro">Non-negotiable rules for every step in this manual.</p>',
    "</div>",
    '<div class="card">',
    '<h2>Five Execution Rules</h2>',
    "<ol>",
    "<li><strong>Never skip steps.</strong> Run them in the order shown in the sidebar.</li>",
    "<li><strong>Always pass the gate.</strong> After every phase, the gate-box checks must all pass before moving on.</li>",
    "<li><strong>Use the right AI.</strong> The badge on every step header tells you which AI and model to use. Do not substitute.</li>",
    "<li><strong>Git checkpoint after every phase.</strong> The gate-box gives you the exact commit command.</li>",
    "<li><strong>Begin every AI response with the RESULT header.</strong> If it does not, ask it to re-format before continuing.</li>",
    "</ol>",
    "</div>",
    '<div class="card">',
    '<h2>FAIL FAST Rule</h2>',
    '<div class="hl-a"><strong>If any step or gate fails:</strong><br>1. STOP.<br>2. Do not advance.<br>3. Fix the issue.<br>4. Re-run the step.<br>5. Continue only after RESULT: COMPLETE.</div>',
    "</div>",
    '<div class="card">',
    '<h2>Required Response Format</h2>',
    '<div class="gate-box"><span class="gate-label">Mandatory</span>',
    "RESULT: COMPLETE / FAILED / PARTIAL\nSUMMARY: [1-2 lines describing what was done]</div>",
    "</div>",
    '<div class="footer">Generated by htmlManualGenerator.js v2.0 / Project (' +
      esc(ctx.projectLetter) +
      ") / " +
      esc(ctx.taskType) +
      "</div>",
    "</div>",
  ].join("");
}

/* ============================================================
   STAGE 10 - JS (tab switch + copy)
   ============================================================ */

function buildJS() {
  return `function copyPrompt(btn){
  var block=btn.closest('.prompt-block');
  var bodyEl=block.querySelector('.prompt-body');
  var text=bodyEl?bodyEl.innerText:block.textContent.replace('Copy This Prompt','').replace('Copy','').trim();
  navigator.clipboard.writeText(text).then(function(){btn.textContent='Copied!';setTimeout(function(){btn.textContent='Copy'},1500)}).catch(function(){btn.textContent='Failed'});
}
(function(){
  var tabs=document.querySelectorAll('.tab-btn');
  var contents=document.querySelectorAll('.tab-content');
  tabs.forEach(function(btn){
    btn.addEventListener('click',function(){
      var t=this.getAttribute('data-tab');
      tabs.forEach(function(b){b.classList.remove('active')});
      contents.forEach(function(c){c.classList.remove('active')});
      this.classList.add('active');
      var el=document.getElementById('tab-'+t);
      if(el)el.classList.add('active');
      var c=document.querySelector('.content');
      if(c)c.scrollTop=0;
    });
  });
})();`;
}

/* ============================================================
   STAGE 11 - PUBLIC ENTRY POINT
   ============================================================ */

function generateHTMLManual(workflowOutput) {
  const output = workflowOutput && typeof workflowOutput === "object" ? workflowOutput : {};
  const interpretedInput =
    output.interpretedInput && typeof output.interpretedInput === "object"
      ? output.interpretedInput
      : {};

  const phases = asArray(output.phases);
  const steps = asArray(output.steps);
  const prompts = asArray(output.prompts);

  const projectLetter = inferProjectLetter(output);
  const targets = normalizeTargets(interpretedInput, output);
  const goal = inferGoal(output, interpretedInput, targets);

  const ctx = {
    projectLetter: projectLetter,
    taskType: safeUpper(interpretedInput.taskType) || "WORKFLOW",
    complexity: safeUpper(interpretedInput.complexity) || "UNSPECIFIED",
    risk: safeUpper(interpretedInput.risk) || "UNSPECIFIED",
    goal: goal,
    targets: targets,
    phases: phases,
    steps: steps,
    prompts: prompts,
    phaseCount: phases.length,
    stepCount: steps.length,
    promptCount: prompts.length,
  };

  const head =
    '<!DOCTYPE html><html lang="en"><head>' +
    '<meta charset="UTF-8">' +
    '<meta name="viewport" content="width=device-width, initial-scale=1.0">' +
    "<title>MMOS Workflow Operator Manual</title>" +
    "<style>" +
    buildCSS() +
    "</style>" +
    "</head><body>";

  const headerHTML = renderHeader(projectLetter);
  const sidebarHTML = renderSidebar(phases);
  const overviewHTML = renderOverviewTab(ctx);
  const phaseTabsHTML = phases.map((p, i) => renderPhaseTab(p, i, ctx)).join("");
  const trackerHTML = renderTrackerTab(ctx);
  const rulesHTML = renderRulesTab(ctx);

  const layout =
    '<div class="layout">' +
    sidebarHTML +
    '<main class="content">' +
    overviewHTML +
    phaseTabsHTML +
    trackerHTML +
    rulesHTML +
    "</main>" +
    "</div>";

  const tail = "<script>" + buildJS() + "</script></body></html>";

  return head + headerHTML + layout + tail;
}

module.exports = {
  generateHTMLManual,
};
