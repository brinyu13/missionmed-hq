import { openStateMatrix } from "./modal-component.js";

const surfaceSelectors = {
  today: "#v-today .greetRow",
  students: "#v-student .idRow",
  programs: "#v-program .idRow",
  copilot: "#v-copilot .liveBar",
  lab: "#v-lab .liveBar",
  panel: "#v-panel .idRow",
};

function chip(state) {
  const button = document.createElement("button");
  button.className = `recovery-state-chip ${state.code === "FOUNDATION_READY" ? "ready" : "blocked"}`;
  button.type = "button";
  button.textContent = state.label;
  button.title = state.detail;
  return button;
}

function replacePreview(fixture, states) {
  const subjectName = fixture.subject.displayName;
  const preview = document.querySelector("#preview");
  const intake = states.find((state) => state.code === "STUDENT_INTAKE_BLOCKED");
  const publication = states.find((state) => state.code === "STUDENT_PUBLICATION_DISABLED");
  preview.innerHTML = `
    <div class="pvBar">👁 Previewing as ${subjectName} — resolved through the local policy surface<button onclick="closePreview()">Exit preview</button></div>
    <div class="pvBody recovery-preview">
      <div class="pvHello"><span class="eyebrow">DR. BRIAN’S ASSESSMENT, PROFILE & RECOMMENDATIONS</span><h2>Your private preparation space is <em>not published yet.</em></h2><p>This bounded preview contains no private student materials, inferred traits, founder notes, transcripts, or media observations.</p></div>
      <div class="pvGrid">
        <div class="panel"><div class="pHead"><div class="h2">Intake <em>state</em></div></div><div class="pBody"><div class="recovery-empty"><b>${intake?.label || "Authorized materials required"}</b><span>${intake?.detail || "No packet is present."}</span></div></div></div>
        <div class="panel"><div class="pHead"><div class="h2">Publication <em>state</em></div></div><div class="pBody"><div class="recovery-empty"><b>${publication?.label || "Publication disabled"}</b><span>${publication?.detail || "Founder review is required."}</span></div></div></div>
        <div class="panel"><div class="pHead"><div class="h2">Program <em>context</em></div></div><div class="pBody"><div class="recovery-empty"><b>${fixture.program.name} · ${fixture.program.specialty}</b><span>Public professional context only. No assessment has been generated.</span></div></div></div>
      </div>
    </div>`;
}

export function mountStateSurface(snapshot) {
  document.querySelectorAll(".recovery-state-chip,.recovery-authority,.recovery-state-button").forEach((node) => node.remove());
  for (const state of snapshot.states.filter((item) => item.active && item.surface !== "ai")) {
    const host = document.querySelector(surfaceSelectors[state.surface]);
    if (host) host.append(chip(state));
  }
  const aiBlocker = snapshot.states.find((state) => state.active && state.surface === "ai");
  if (aiBlocker) {
    document.querySelector("#aiState").textContent = aiBlocker.label;
    document.querySelector("#aiLightTx").textContent = snapshot.flags.mirEnabled ? "PRIQ · Limited" : "PRIQ · Paused";
  }
  const panelHead = document.querySelector("#v-panel .idRow");
  const statesButton = document.createElement("button");
  statesButton.className = "btnGhost recovery-state-button";
  statesButton.textContent = "◫ State matrix";
  statesButton.onclick = () => openStateMatrix(snapshot.states);
  panelHead?.append(statesButton);
  const authority = document.createElement("span");
  authority.className = "recovery-authority";
  authority.textContent = "LOCAL · IN-MEMORY · MIGRATIONS UNAPPLIED";
  document.querySelector("#foot")?.append(authority);
  const subjectName = snapshot.fixture.subject.displayName;
  const previewButton = [...document.querySelectorAll("#v-panel button")].find((button) => button.textContent.includes("Preview as"));
  if (previewButton) previewButton.textContent = `👁 Preview as ${subjectName.split(" ")[0]}`;
  replacePreview(snapshot.fixture, snapshot.states);
}
