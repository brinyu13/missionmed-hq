# B1-502 Routing and Cache Evidence

Recorded: 2026-07-27T16:12:50Z

Gate 4 result: **FAIL — CANDIDATE BEHAVIOR EXISTS, PRODUCTION ROUTE AUTHORITY DOES NOT**

## Candidate behavior verified by B1-501

- candidate route pattern: `missionmedinstitute.com/storyforge/*`;
- base path: `/storyforge/`;
- SPA nested paths fall back to `index.html`;
- fingerprinted assets use immutable caching;
- the HTML shell is noncached/revalidated;
- auth endpoints remain outside the static edge route;
- local precedence tests kept `/member-dashboard/` under WordPress;
- local route removal was independently reversible.

## Current protected authority

- The Critical Systems manifest registers `https://missionmedinstitute.com/member-dashboard/#storyforge`.
- The Matrix runtime lock registers legacy V2 StoryForge JS/CSS and a shell route lock at `member-dashboard/#storyforge`.
- Neither current manifest registers the V5 `/storyforge/*`, `/storyforge/assets/*`, or `/storyforge/index.html` route owner and rollback mechanism.
- B1-501 explicitly leaves the Cloudflare account/project/zone, protected `STORYFORGE_ORIGIN`, and route ownership unpinned.

Consequently, WordPress non-shadowing, deep-link behavior, cache headers, auth noncaching, route isolation, and independent production rollback could not be verified against the real target.

No DNS lookup, HTTP probe, CDN/provider inspection, cache purge, route edit, or deployment occurred.
