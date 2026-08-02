const flagMap = new Map([
  ["Admin workspace", "profileEnabled"], ["Student workspace", "studentWorkspaceEnabled"],
  ["Student workspace (global)", "studentWorkspaceEnabled"], ["Program intelligence", "profileEnabled"],
  ["Student intelligence", "profileEnabled"], ["Public-web enrichment", "researchEnabled"],
  ["Photo & video observation", "videoAnalysisEnabled"], ["Live Copilot", "liveCopilotEnabled"],
  ["Profile Lab", "profileLabEnabled"], ["Weighted Bird profiles", "weightedBirdEnabled"],
  ["Founder-note AI use", "founderNoteAiUseEnabled"], ["Student publication", "studentPublicationEnabled"],
  ["Local individual override", "studentWorkspaceOverrideEnabled"],
]);

function findSwitch(label) {
  const row = [...document.querySelectorAll(".swRow")].find((item) => item.querySelector(".sl b")?.textContent.trim() === label);
  return row?.querySelector(".sw");
}

function setSwitch(sw, value) {
  if (!sw) return;
  sw.classList.toggle("on", value);
  sw.setAttribute("aria-checked", String(value));
}

export function mountControlPanel(snapshot, api, refresh) {
  window.SWITCHES = window.SWITCHES.filter((group) => group[0] !== "Recovery controls");
  window.SWITCHES.push(["Recovery controls", [
    ["Weighted Bird profiles", "Evidence always outranks shorthand", snapshot.flags.weightedBirdEnabled, false],
    ["Founder-note AI use", "Off until each note and global gate permit", snapshot.flags.founderNoteAiUseEnabled, false],
    ["Student publication", "Founder approval required", snapshot.flags.studentPublicationEnabled, false],
    ["Human-review rule", "Locked on — cannot be disabled", snapshot.flags.humanReviewRequired, true],
  ]]);
  const originalBuild = window.buildSwitches;
  window.flip = async (sw, label) => {
    if (sw.classList.contains("locked")) return;
    const key = flagMap.get(label);
    if (!key) {
      window.toast(`${label} is a prototype-only control until its backend contract is approved. No state changed.`);
      return;
    }
    const next = !sw.classList.contains("on");
    sw.setAttribute("aria-busy", "true");
    try {
      const flags = await api.flag(key, next);
      setSwitch(sw, flags[key]);
      window.toast(`${label} is now ${flags[key] ? "ON" : "OFF"}. Backend behavior and audit changed together.`);
      await refresh();
    } catch (error) {
      window.toast(`Control rejected: ${error.message}`);
    } finally { sw.removeAttribute("aria-busy"); }
  };
  originalBuild();
  for (const row of document.querySelectorAll("#v-panel .swRow")) {
    const sw = row.querySelector(".sw");
    const label = row.querySelector(".sl b")?.textContent.trim();
    if (!sw || !label) continue;
    sw.setAttribute("role", "switch");
    sw.setAttribute("aria-label", label);
    sw.setAttribute("aria-checked", String(sw.classList.contains("on")));
    sw.setAttribute("tabindex", "0");
    if (sw.classList.contains("locked")) sw.setAttribute("aria-disabled", "true");
    if (!sw.dataset.priqKeyboard) {
      sw.dataset.priqKeyboard = "true";
      sw.addEventListener("keydown", (event) => {
        if ((event.key === "Enter" || event.key === " ") && !sw.classList.contains("locked")) {
          event.preventDefault(); sw.click();
        }
      });
    }
  }
  for (const [label, key] of flagMap) setSwitch(findSwitch(label), Boolean(snapshot.flags[key]));
  for (const label of ["Student workspace", "Student workspace (global)", "Student publication", "Local individual override"]) {
    const sw = findSwitch(label); if (!sw) continue;
    sw.classList.add("locked"); sw.setAttribute("aria-disabled", "true"); sw.title = "M0.75 interlock: student access remains OFF";
  }

  const accessRows = [...document.querySelectorAll("#v-panel .swRow")];
  const personRow = accessRows.find((row) => row.querySelector(".sl b")?.textContent === "Nadia Rahman");
  if (personRow) {
    personRow.querySelector(".sl b").textContent = snapshot.fixture.subject.displayName;
    personRow.querySelector(".sl span").textContent = "Local individual override — wins over global";
    const sw = personRow.querySelector(".sw");
    setSwitch(sw, snapshot.flags.studentWorkspaceOverrideEnabled);
    sw.onclick = () => window.flip(sw, "Local individual override");
  }

  const providerRow = [...document.querySelectorAll("#v-panel .swRow")].find((row) => row.textContent.includes("Deep reasoning route"));
  if (providerRow) {
    providerRow.querySelector(".sl span").textContent = `Primary: ${snapshot.settings.providerRoute} · local provisional`;
    const button = providerRow.querySelector("button");
    button.textContent = "Cycle";
    button.onclick = async () => {
      const routes = ["openai:gpt-5.6-sol", "openai:gpt-5.6-terra", "openai:gpt-5.6-luna"];
      const next = routes[(routes.indexOf(snapshot.settings.providerRoute) + 1) % routes.length];
      await api.setting("providerRoute", next); await refresh(); window.toast(`Provider route set to ${next}.`);
    };
  }
  const budgetRow = [...document.querySelectorAll("#v-panel .swRow")].find((row) => row.textContent.includes("Monthly budget"));
  if (budgetRow) {
    budgetRow.querySelector(".sl b").textContent = `Monthly budget — $0 of $${snapshot.settings.monthlyBudgetUsd}`;
    budgetRow.querySelectorAll("[data-priq-budget]").forEach((node) => node.remove());
    const button = document.createElement("button"); button.className = "btnGhost"; button.textContent = "+$25";
    button.dataset.priqBudget = "true";
    button.onclick = async () => { await api.setting("monthlyBudgetUsd", snapshot.settings.monthlyBudgetUsd + 25); await refresh(); };
    budgetRow.append(button);
  }
  const providerPanel = providerRow?.closest(".panel")?.querySelector(".pBody");
  if (providerPanel) {
    providerPanel.querySelectorAll("[data-priq-hydration]").forEach((node) => node.remove());
    const hydrationRow = document.createElement("div"); hydrationRow.className = "swRow"; hydrationRow.dataset.priqHydration = "true";
    const hydrationLabel = document.createElement("div"); hydrationLabel.className = "sl";
    const title = document.createElement("b"); title.textContent = `Founder hydration — ${snapshot.hydration.enabled ? "ON" : "OFF"}`;
    const detail = document.createElement("span"); detail.textContent = "No background hydration · student access remains OFF";
    hydrationLabel.append(title, detail);
    const hydrationButton = document.createElement("button"); hydrationButton.className = "btnGhost"; hydrationButton.textContent = snapshot.hydration.enabled ? "Pause" : "Hydrate";
    hydrationButton.disabled = snapshot.access.role !== "founder";
    hydrationButton.title = snapshot.access.role === "founder" ? "Explicit Dr. Brian action" : "Only Dr. Brian can change hydration";
    hydrationButton.onclick = async () => {
      try { await api.hydrate(!snapshot.hydration.enabled, snapshot.hydration.enabled ? "Dr. Brian paused M0.75 hydration" : "Dr. Brian explicitly released M0.75 hydration"); await refresh(); }
      catch (error) { window.toast(`Hydration rejected: ${error.message}`); }
    };
    hydrationRow.append(hydrationLabel, hydrationButton); providerPanel.prepend(hydrationRow);
    providerPanel.querySelectorAll("[data-cue-gap]").forEach((node) => node.remove());
    const row = document.createElement("div"); row.className = "swRow"; row.dataset.cueGap = "true";
    row.innerHTML = `<div class="sl"><b>Cue-rate limit</b><span>${snapshot.settings.cueMinGapSeconds}s minimum gap · max two visible</span></div>`;
    const button = document.createElement("button"); button.className = "btnGhost"; button.textContent = "+5s";
    button.onclick = async () => { await api.setting("cueMinGapSeconds", Math.min(120, snapshot.settings.cueMinGapSeconds + 5)); await refresh(); };
    row.append(button); providerPanel.insertBefore(row, providerPanel.querySelector(".killBtn")?.parentElement || null);
  }

  window.__PRIQ_PROTOTYPE_KILL ||= window.killSwitch;
  window.killSwitch = async (state) => {
    try {
      await api.kill(state, state ? "Founder local recovery validation" : "Founder released local recovery validation");
      window.__PRIQ_PROTOTYPE_KILL(state); await refresh();
    } catch (error) { window.toast(`Kill switch rejected: ${error.message}`); }
  };

  window.__PRIQ_PROTOTYPE_RUN_DEMO ||= window.runDemo;
  window.runDemo = () => snapshot.flags.liveCopilotEnabled
    ? window.__PRIQ_PROTOTYPE_RUN_DEMO()
    : window.toast("Live Copilot is disabled by the backend feature gate. No session started.");
  window.__PRIQ_PROTOTYPE_LAB_STEP ||= window.labStep;
  window.labStep = (direction) => snapshot.flags.profileLabEnabled
    ? window.__PRIQ_PROTOTYPE_LAB_STEP(direction)
    : window.toast("Profile Lab is disabled by the backend feature gate. No lesson state changed.");
  const demoButton = document.querySelector("#demoBtn");
  if (demoButton) {
    demoButton.disabled = !snapshot.flags.liveCopilotEnabled;
    demoButton.setAttribute("aria-disabled", String(!snapshot.flags.liveCopilotEnabled));
  }
  for (const button of document.querySelectorAll("#v-lab #labPrev,#v-lab #labNext")) {
    button.disabled = !snapshot.flags.profileLabEnabled || button.id === "labPrev" && window.labIdx === 0;
  }
  for (const bird of document.querySelectorAll(".bird")) bird.hidden = !snapshot.flags.weightedBirdEnabled;
  for (const note of document.querySelectorAll(".noteCard .lock")) {
    note.textContent = snapshot.flags.founderNoteAiUseEnabled ? "· Private to you · AI may use per-note" : "· Private to you · AI use OFF";
  }
  document.body.dataset.videoAnalysis = snapshot.flags.videoAnalysisEnabled ? "enabled" : "disabled";
}

export async function renderAudit(api) {
  const events = await api.audit();
  const list = document.querySelector("#audList");
  if (!list || events.length === 0) return;
  list.replaceChildren();
  for (const event of events.slice().reverse()) {
    const row = document.createElement("div"); row.className = "audRow";
    const when = document.createElement("span"); when.className = "when"; when.textContent = `${new Date(event.createdAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })} · ${event.actorId}`;
    const action = document.createElement("b"); action.textContent = event.action;
    row.append(when, action, document.createTextNode(` — ${event.targetId}`)); list.append(row);
  }
}
