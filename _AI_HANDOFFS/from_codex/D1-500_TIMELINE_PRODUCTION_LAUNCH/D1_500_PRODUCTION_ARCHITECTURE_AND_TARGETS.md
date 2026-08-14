# D1-500 Production Architecture and Targets

The canonical route is `https://missionmedinstitute.com/timeline/` on the current
WordPress origin. WordPress owns session, live LearnDash entitlement, consent,
principal mapping, and short-lived JWT issuance. The same-origin gateway strips
WordPress cookies and forwards only a bounded gateway credential and Timeline
JWT to the isolated API. PostgreSQL owns Timeline records and forces RLS.

Verified targets:

- Kinsta company: `Brian's company`.
- Kinsta site: `MissionMed Institute`.
- Kinsta environment: `Live`.
- Kinsta company ID: `60d2928a-3253-4350-89e9-8f58a0827584`.
- Kinsta site ID: `abb6097b-9884-4b75-a9c7-d247728395cc`.
- Kinsta environment ID: `a23bbbca-55af-4d03-9447-1015a1e18dc8`.
- Kinsta public root: `/www/theresidencyacademy_209/public`.
- Railway workspace ID: `b6ab449c-1c87-46e0-95f8-3394c3ca7b14`.
- Railway project: `missionmed-timeline`
  (`295b3d56-f555-4851-91f4-eb32d7dc88e1`).
- Production environment: `d0705d67-83d5-4b53-942d-3862d9906529`.
- Staging environment: `2dd3eedd-c029-41ad-9e03-ae4e63ff7bf8`.
- API service: `mission-timeline-api`
  (`12bfaf69-f883-42b5-a380-b6beea49f251`).
- PostgreSQL service ID: `134e537e-d48b-4452-acf6-8c3af2ce03db`;
  provider display name is currently `Postgres` pending bounded rename or
  Founder acceptance of the stable ID.

Supabase, DNS, Cloudflare, StoryForge resources, and shared Railway services are
outside this topology and were not modified.
