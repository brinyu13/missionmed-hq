# P1-PRIQ-M0-001B frontend component map

| Path | Responsibility | Authority boundary |
|---|---|---|
| `apps/priq-web/public/index.html` | Byte-exact frozen shell, rooms, AI surface, Prepare, modal primitive, synthetic demo interactions | Must retain frozen SHA unless a new design authority supersedes it |
| `priq/bootstrap.js` | Loads recovery CSS, fetches backend snapshot, mounts adapters, exposes refresh | Local HTTP/preview only |
| `priq/api-client.js` | Typed-by-contract fetch boundary for state, flags, settings, kill, audit | No secrets or private bytes |
| `priq/state-surface.js` | Room state chips, authority footer, state matrix entry, safe preview | Fixture values arrive from backend |
| `priq/modal-component.js` | Centered ten-state matrix using frozen modal primitive | No alternate modal system |
| `priq/control-panel.js` | Backend-governed switches/settings, interlocks, accessibility names, behavioral gates, audit rendering | In-memory provisional control plane |
| `priq/recovery.css` | Small frozen-token-compatible additions | Does not replace frozen tokens/layout |
| `apps/priq-api/src/development-fixture.ts` | Ticket-authorized development identifiers | No private packet/facts/media |
| `apps/priq-api/src/state.ts` | Deterministic ten-state resolver | Backend is source of truth |

The server reads `index.html`, adds CSP nonces, injects `/priq/bootstrap.js`, and serves all other files unchanged. The build copies the same artifact and emits a truth manifest. This adapter architecture was chosen because rewriting the frozen HTML into a framework would create unnecessary parity risk during a recovery ticket.
