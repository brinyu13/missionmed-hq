# B1-508 Production Topology

## Observed request path

```text
Founder browser
  -> Cloudflare edge (pass-through; no StoryForge worker mutation)
  -> Kinsta WordPress / Matrix route /storyforge/
  -> immutable StoryForge static release on Kinsta
  -> same-origin /storyforge/api/*
  -> Kinsta MU-plugin JWT/bootstrap and bounded proxy
  -> Railway StoryForge API, one replica
  -> Railway PostgreSQL 18.4 via least-privilege storyforge_app
```

R2 and the transcription provider are outside the active path. No R2 binding or
provider key is present, and the capability response reports
`audioAvailable:false`.

## Runtime ownership

| Layer | Exact owner/state |
|---|---|
| Public route | `https://missionmedinstitute.com/storyforge/` |
| CDN/edge | Cloudflare pass-through, dynamic HTML, no B1-508 worker change |
| WordPress host | Kinsta site `/www/theresidencyacademy_209` |
| Gateway | `missionmed-storyforge-route.php` |
| Immutable UI | Kinsta release `97ebf243...` |
| API | Railway service `dab015bf-15ef-4698-9f16-cbf8cf23de7a` |
| Deployment | `7ce159b6-226a-4e77-8335-e5e5d06519c3`, one `us-west2` replica |
| Database | Railway service `a4a66362-c3ba-475a-ae21-2aa46624bafe` |
| DB role | `storyforge_app`, LOGIN only and exact `authenticated` membership |
| Audio storage | inactive/unconfigured |
| Transcription | inactive, provider `none` |

## Security boundaries

- WordPress is the public integration and JWT authority boundary.
- Railway is API-only; root is 404 and anonymous API requests are 401.
- Bad-origin configuration access is 403.
- Student/mentor/admin role is server-derived.
- No public R2 bucket exists in this release.
- No `missionmed-hub` protected StoryForge asset was changed.
