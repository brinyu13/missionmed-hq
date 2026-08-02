function addAiLine(label, text, className = "aiLine show") {
  const stream = document.querySelector("#aiStream");
  if (!stream) return;
  const line = document.createElement("div"); line.className = className;
  const tag = document.createElement("span"); tag.className = "lbl"; tag.textContent = label;
  line.append(tag, document.createTextNode(text)); stream.append(line); stream.scrollTop = stream.scrollHeight;
}

function hydrationRequired(snapshot) {
  if (snapshot.hydration?.enabled) return false;
  window.toast("AI hydration is OFF. Dr. Brian must release hydration in the Control Panel before any model call.");
  return true;
}

export function mountAiRuntime(snapshot, api, refresh) {
  window.__PRIQ_PROTOTYPE_ASK ||= window.ask;
  window.ask = async () => {
    const input = document.querySelector("#askIn");
    const question = input?.value.trim(); if (!question) return;
    input.value = ""; addAiLine("You asked", question);
    if (hydrationRequired(snapshot)) return;
    addAiLine("PRIQ", "Thinking from the approved source registry…", "aiLine doing show");
    try {
      const result = await api.ask(question);
      addAiLine("PRIQ", result.output.answer);
    } catch (error) { addAiLine("PRIQ", `Request blocked: ${error.message}`); }
  };

  window.__PRIQ_PROTOTYPE_PREPARE ||= window.runPrepare;
  window.runPrepare = async () => {
    if (hydrationRequired(snapshot)) return;
    try {
      const result = await api.profile();
      window.__PRIQ_PROTOTYPE_PREPARE();
      window.toast(`Real OpenAI profile draft created ${result.claimsCreated} evidence-bound claim(s). Founder review is required; student publication remains OFF.`);
      await refresh();
    } catch (error) { window.toast(`Profile generation blocked: ${error.message}`); }
  };

  window.__PRIQ_RUNTIME_DEMO ||= window.runDemo;
  window.runDemo = async () => {
    if (hydrationRequired(snapshot)) return;
    try {
      const result = await api.copilot("Synthetic practice: I improved a handoff process, um, by creating a paper backup during extended downtime.", true);
      const cues = Array.isArray(result.output.cues) ? result.output.cues.length : 0;
      window.toast(`OpenAI Copilot route verified on synthetic practice (${cues} cue${cues === 1 ? "" : "s"}). Starting the frozen demo.`);
      window.__PRIQ_RUNTIME_DEMO();
    } catch (error) { window.toast(`Copilot blocked: ${error.message}`); }
  };

  window.__PRIQ_RUNTIME_LAB_STEP ||= window.labStep;
  window.labStep = async (direction) => {
    if (direction <= 0) { window.__PRIQ_RUNTIME_LAB_STEP(direction); return; }
    if (hydrationRequired(snapshot)) return;
    try {
      const title = document.querySelector("#labStage .st-t")?.textContent || "Separate observations, interpretations, alternatives, and preparation.";
      await api.profileLab(title); window.__PRIQ_RUNTIME_LAB_STEP(direction);
      window.toast("Profile Lab step checked by the real evidence-bound route; the frozen lesson remains the visible teaching surface.");
    } catch (error) { window.toast(`Profile Lab blocked: ${error.message}`); }
  };

  window.__PRIQ_PROTOTYPE_CAPTURE ||= window.capSave;
  window.capSave = async () => {
    const input = document.querySelector("#capIn"); const note = input?.value.trim(); if (!note) return;
    if (!snapshot.flags.founderNoteAiUseEnabled) { window.__PRIQ_PROTOTYPE_CAPTURE(); return; }
    if (hydrationRequired(snapshot)) return;
    try { await api.founderNote(note); input.value = ""; window.toast("Founder note processed under the private-data gate; nothing was published to a student."); }
    catch (error) { window.toast(`Founder-note AI use blocked: ${error.message}`); }
  };

  window.__PRIQ_PROTOTYPE_END_DEMO ||= window.endDemo;
  window.endDemo = (manual) => {
    window.__PRIQ_PROTOTYPE_END_DEMO(manual);
    if (!snapshot.hydration?.enabled) return;
    void api.debrief({ synthetic: true, cueIds: ["synthetic:copilot-demo"], founderNotes: [] })
      .then(() => window.toast("Synthetic debrief route completed. No student record was hydrated or published."))
      .catch((error) => window.toast(`Debrief route blocked: ${error.message}`));
  };
}
