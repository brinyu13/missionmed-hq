(() => {
  "use strict";

  const status = document.getElementById("status");
  const section = document.getElementById("moment");
  const player = document.getElementById("player");
  const replayRegion = document.getElementById("replay-region");
  const safeId = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,179}$/u;

  function unavailable() {
    section.hidden = true;
    status.textContent = "This Moment is unavailable or your access has ended.";
  }

  function text(id, value, fallback = "Unavailable") {
    document.getElementById(id).textContent = typeof value === "string" && value.trim() ? value : fallback;
  }

  function formatRange(moment) {
    const start = (moment.t0_ms / 1000).toFixed(1);
    const end = (moment.t1_ms / 1000).toFixed(1);
    return `${start}s-${end}s`;
  }

  async function load() {
    const parts = window.location.pathname.split("/").filter(Boolean);
    if (parts.length !== 3 || parts[0] !== "review" || !safeId.test(parts[1]) || !safeId.test(parts[2])) return unavailable();
    try {
      const response = await fetch(`/v1/cie/review/${encodeURIComponent(parts[1])}/${encodeURIComponent(parts[2])}`, {
        credentials: "same-origin",
        headers: { accept: "application/json" }
      });
      if (!response.ok) return unavailable();
      const envelope = await response.json();
      if (!envelope?.ok || envelope.data?.state !== "READY") return unavailable();
      const { moment, priorities, replay } = envelope.data;
      text("moment-title", moment.label);
      text("moment-note", moment.note, "No private note was added.");
      text("claim-badge", moment.provenance.badge);
      text("range", formatRange(moment));
      text("source", moment.source === "mentor" ? "Mentor-selected replay range" : "Student-selected replay range");
      text("claim", moment.provenance.statement);
      text("limitations", moment.provenance.limitations, "This range supports replay and human review only; it does not establish a trait, score, or outcome.");

      const priority = document.getElementById("priority");
      if (priorities?.spotlight_snapshot_id) {
        priority.hidden = false;
        text("priority-copy", priorities.supporting_snapshot_id ? "One Spotlight and one Supporting skill are active for the next rep." : "One Spotlight skill is active for the next rep.");
      }

      const capability = replay.playback_capability;
      if (capability?.url) {
        replayRegion.hidden = false;
        section.classList.remove("playback-unavailable");
        const source = new URL(capability.url, window.location.origin);
        if (source.protocol !== "https:" && source.hostname !== "127.0.0.1" && source.hostname !== "localhost") return unavailable();
        player.src = source.href;
        player.addEventListener("loadedmetadata", () => { player.currentTime = replay.seek_to_ms / 1000; }, { once: true });
        player.addEventListener("timeupdate", () => {
          if (player.currentTime * 1000 >= replay.stop_at_ms) {
            player.pause();
            player.currentTime = replay.stop_at_ms / 1000;
          }
        });
        status.textContent = "Moment authorized. Replay is ready.";
      } else {
        replayRegion.hidden = true;
        section.classList.add("playback-unavailable");
        status.textContent = "Moment authorized. Playback authorization is unavailable in this local foundation environment.";
      }
      section.hidden = false;
    } catch {
      unavailable();
    }
  }

  load();
})();
