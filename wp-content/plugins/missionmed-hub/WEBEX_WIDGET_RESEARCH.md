# Webex Embedded Meeting Research

Date: 2026-05-19

## Sources Checked

- Webex Widgets documentation: https://developer.webex.com/messaging/docs/widgets
- Webex Meetings SDK join guide: https://developer.webex.com/docs/sdks/webex-meetings-sdk-web-join-a-meeting
- Webex Meetings SDK quickstart: https://developer.webex.com/meeting/docs/sdks/webex-meetings-sdk-web-quickstart
- Webex JS SDK API docs: https://web-sdk.webex.com/api/
- Webex Embedded Apps overview: https://developer.webex.com/create/docs/embedded-apps
- Webex Embedded Apps API reference: https://developer.webex.com/docs/embedded-apps-api-reference
- NPM package metadata checked with `npm view @webex/widgets`, `npm view webex`, and `npm view @webex/plugin-meetings`.

## Option A: @webex/widgets NPM Package

Availability:

- Package exists on npm as `@webex/widgets`.
- Current npm metadata checked locally: version `1.28.2`, last modified `2026-04-08T10:23:32.292Z`.
- Unpacked package size reported by npm: `9233370` bytes.
- Webex documentation says the Meetings Widget is available on NPM and has no CDN distribution at this time.

Meetings Widget:

- The official docs list Space Widget, Recents Widget, and Meetings Widget.
- The docs show `WebexMeetingsWidget` imported from `@webex/widgets`.
- The widget accepts an access token and meeting destination.
- Guest tokens are not accepted directly, but the docs allow using the access token produced by the guest token exchange flow. The current plugin already creates a guest `accessToken` through the Service App `/guests` flow.

Dependencies:

- Peer dependencies from npm metadata: `react@18.3.1`, `react-dom@18.3.1`, `prop-types`, and `webex@2.60.4`.
- Direct dependencies include `webex@2.60.4`, `@webex/components`, `@webex/sdk-component-adapter`, and adapter interfaces.
- Webex docs state Widgets are supported on Node.js v20 and below.

Bundle and build fit:

- A WordPress plugin can technically build a bundle that exposes a small `window.MmedWebexWidget.init()` adapter.
- The build should be isolated under `build/`, compiled into `assets/webex-widget-bundle.min.js`, and gated by `webex_embedded_widget`.
- This repository is currently running Node `v24.14.0`, which is outside the documented widget build support window.
- Because there is no CDN path, shipping this safely requires a pinned Node 20 build environment and browser validation with a real Webex guest token.

Complexity:

- Medium if the widget builds cleanly under Node 20.
- Higher operational risk than the external-link fallback because it introduces React, CSS, Webex widget CSS, CSP allowances, guest token exchange behavior, and media permission UX inside the SPA.

Recommendation:

- Viable for a controlled Node 20 prototype, not viable for direct production enablement in this pass.

## Option B: Webex JS SDK Meetings Plugin

Availability:

- `@webex/webex-js-sdk` was not found on npm.
- The modern npm package path is `webex`, with `@webex/plugin-meetings` as the meetings plugin package.
- Local npm metadata checked:
  - `webex` version `3.12.0`, last modified `2026-05-18T16:17:27.538Z`, unpacked size `56101625` bytes.
  - `@webex/plugin-meetings` version `3.12.0`, last modified `2026-05-18T16:15:34.236Z`, unpacked size `9156898` bytes.

Browser build:

- The Webex Meetings SDK quickstart documents a browser script path through `https://unpkg.com/webex/umd/meetings.min.js`.
- The SDK exposes `webex.meetings`, device registration, meeting creation or lookup, join flows, media setup, and events.

Meeting join and media:

- The Web SDK join guide covers fetching a Meeting instance, registering the device, joining, adding media, screen sharing, and handling meeting events.
- A custom UI would need to handle device selection, preview, mute states, roster, local and remote video rendering, leave flow, errors, reconnection, and mobile behavior.

Bundle and browser support:

- The full `webex` npm package is large.
- The SDK path can be more flexible than the widget but requires substantially more application code and media QA.

Complexity:

- High. This is the correct fallback if the widget cannot be shipped, but it is closer to building a meeting client than adding a widget.

Recommendation:

- Keep as the long-term custom embedded option after the widget prototype is proven or rejected.

## Option C: Webex Embedded Apps Framework

Availability:

- Webex Embedded Apps Framework is documented for apps that run inside the Webex app or Meeting Center context.
- The overview says it surfaces third party web apps inside Webex meetings and spaces.
- The v1 API reference documents the embedded app SDK script URL, but also notes v1 deprecation and points new work to v2.

Fit for MissionMed Hub:

- This framework is not a direct iframe-based way to place a Webex meeting inside MissionMed.
- It is the inverse model: MissionMed content can run inside Webex as an embedded app.
- It requires Webex Developer Portal app setup, HTTPS public URLs, organization/user availability, and in-Webex testing.

Complexity:

- Medium for showing MissionMed tools inside Webex.
- Not useful for joining a Webex meeting inside the WordPress SPA.

Recommendation:

- Do not use this as the embedded meeting path.

## RECOMMENDED PATH

Keep the `webex_embedded_widget` flag off by default and preserve the external Webex join link as the production fallback.

Next safe step:

1. Create a separate Node 20 build spike for `@webex/widgets`.
2. Build an isolated `window.MmedWebexWidget.init(el, token, destination)` adapter.
3. Commit the built bundle only after local build success, WordPress enqueue verification, browser media permission validation, and a real guest token join test.
4. If the widget fails on guest-token, CSP, or bundle constraints, move to the Webex Meetings SDK path with a deliberately scoped custom UI plan.

No webpack prototype was committed in this pass because the current local Node runtime is `v24.14.0`, while the official Webex Widgets documentation states support for Node.js v20 and below.
