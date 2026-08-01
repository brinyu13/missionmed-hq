# B1-510H Live Student Acceptance

## Server-side live matrix

- eligible students: 439;
- mapped eligible students: 439;
- student JWTs issued: 439;
- Founder acceptance roster: 11/11 resolved, entitled, mapped, and token-issued;
- one ordinary eligible student `/storyforge/api/session`: HTTP 200, student
  role, matching identity, `voice_capture=false`;
- the same account `/api/stories`: HTTP 200 with zero visible stories, proving
  no Founder-story exposure;
- one live ineligible account: denied;
- Founder student: mapping and token remain valid;
- Founder administrator: mapping and token remain valid;
- anonymous session: HTTP 401;
- anonymous WordPress bootstrap: HTTP 401;
- health endpoint: HTTP 200 with the bounded StoryForge service response.

## Browser acceptance

In the existing authenticated Founder student Chrome session:

1. `https://missionmedinstitute.com/member-dashboard/#storyforge` redirected to
   `https://missionmedinstitute.com/storyforge/`.
2. The current StoryForge V5 navigation rendered.
3. Legacy `Bootstrap demo` and static-demo markers were absent.
4. Refresh remained on the current application.

Screenshot:

- `evidence/B1-510H_founder_after_route.png`
- SHA-256:
  `2991f57e013e724616b45a11f48121ac7e01c583149cabe269d426fb5752d3a1`

The eleven student passwords/sessions were not available and were not reset or
impersonated. Their live identity, entitlement, mapping, token, API routing, and
data-isolation gates were verified server-side rather than claiming eleven
separate interactive browser logins.

## Production-write canary boundary

No synthetic WordPress user was created because Founder authority expressly
prohibited new WordPress accounts. No real student's story data was modified to
simulate the requested canary. Create/save/reload/archive is covered by the
passing local browser and authorization suites; the live identity/routing
operation itself wrote no story content.

## Monitoring

- last-hour Railway HTTP 5xx query: zero results;
- last-hour application-error query: zero results;
- no JWT/UUID mismatch observed;
- no cross-user exposure observed.
