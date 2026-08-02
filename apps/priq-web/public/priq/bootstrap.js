import { api } from "./api-client.js";
import { mountStateSurface } from "./state-surface.js";
import { mountControlPanel, renderAudit } from "./control-panel.js";
import { mountAiRuntime } from "./runtime-bindings.js";

const css = document.createElement("link");
css.rel = "stylesheet"; css.href = "/priq/recovery.css"; document.head.append(css);

let mounting = false;
async function refresh() {
  if (mounting) return;
  mounting = true;
  try {
    const snapshot = await api.state();
    mountStateSurface(snapshot);
    mountControlPanel(snapshot, api, refresh);
    mountAiRuntime(snapshot, api, refresh);
    await renderAudit(api);
    document.documentElement.dataset.priqRecovery = "ready";
    window.PRIQ_RECOVERY = { snapshot, refresh, api };
  } catch (error) {
    document.documentElement.dataset.priqRecovery = "blocked";
    window.toast?.(`Backend binding unavailable: ${error.message}`);
  } finally { mounting = false; }
}

await refresh();
