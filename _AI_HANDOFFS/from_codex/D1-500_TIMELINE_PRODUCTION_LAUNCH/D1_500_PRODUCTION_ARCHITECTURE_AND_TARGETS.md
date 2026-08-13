# D1-500 Production Architecture and Targets

## Request path

1. An authenticated Matrix page loads the Timeline launch adapter.
2. The adapter shows the Timeline entry only when the server-provided eligibility state permits it.
3. `/timeline/` checks WordPress session, feature stage, administrator allowlist or active LearnDash course 3893 access, and consent.
4. Eligible pre-consent users receive the consent page; acceptance of `d1-500-v1` returns to the canonical route.
5. WordPress exchanges the session for a 120-second Timeline JWT and proxies same-origin `/timeline/api/v1/**` requests.
6. The Kinsta gateway signs requests with a server-only gateway secret; Railway rejects direct public access without it.
7. Railway maps the immutable WordPress user ID to a Timeline principal and executes through `timeline_authenticated` with FORCE RLS.

## Exact providers

- Kinsta company: `60d2928a-3253-4350-89e9-8f58a0827584`.
- Kinsta site: `abb6097b-9884-4b75-a9c7-d247728395cc`.
- Kinsta production environment: `a23bbbca-55af-4d03-9447-1015a1e18dc8`.
- Kinsta root: `/www/theresidencyacademy_209/public`.
- Railway workspace: `b6ab449c-1c87-46e0-95f8-3394c3ca7b14`.
- Railway project: `295b3d56-f555-4851-91f4-eb32d7dc88e1`.
- Railway production environment: `d0705d67-83d5-4b53-942d-3862d9906529`.
- API service: `12bfaf69-f883-42b5-a380-b6beea49f251`.
- PostgreSQL service: `134e537e-d48b-4452-acf6-8c3af2ce03db`.

## Routes

- Matrix: `https://missionmedinstitute.com/member-dashboard/#timeline`.
- Application: `https://missionmedinstitute.com/timeline/`.
- Token: `https://missionmedinstitute.com/wp-json/missionmed-timeline/v1/token`.
- Same-origin API: `https://missionmedinstitute.com/timeline/api/v1/**`.
- Health: `https://mission-timeline-api-production.up.railway.app/healthz`.

Secrets exist only in approved server-side locations. No secret value is stored in Git, payloads, screenshots, reports, or this package.
