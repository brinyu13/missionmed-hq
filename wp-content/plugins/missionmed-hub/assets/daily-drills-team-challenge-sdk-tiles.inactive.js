(function () {
  "use strict";

  /**
   * Inactive long-term proof scaffold for true named participant video tiles.
   *
   * This file is intentionally not enqueued by the production preview route.
   * It documents the required handoff point for a future Webex Browser SDK
   * implementation where individual remote media streams are attached to
   * Team Challenge tile <video> elements by participant identity.
   */
  var enabled = window.MMED_ENABLE_SDK_TILES_PROOF === true;
  if (!enabled) {
    return;
  }

  window.MMEDTeamChallengeSdkTilesPrototype = {
    mode: "inactive_sdk_named_tiles_proof",
    requirements: [
      "Browser SDK meeting instance with multistream remote media enabled.",
      "Stable participant identity map from Webex attendee identity to MissionMed user/team row.",
      "Per-participant remote video stream events.",
      "Safe teardown on route change, leave meeting, and browser unload."
    ],
    attachRemoteStream: function attachRemoteStream(tile, stream) {
      if (!tile || !stream) {
        return false;
      }

      var video = tile.querySelector("video[data-team-challenge-remote-video]");
      if (!video) {
        video = document.createElement("video");
        video.setAttribute("data-team-challenge-remote-video", "1");
        video.autoplay = true;
        video.playsInline = true;
        video.muted = false;
        tile.appendChild(video);
      }

      video.srcObject = stream;
      return true;
    }
  };
})();
