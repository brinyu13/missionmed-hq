# StoryForge V5 Architecture Adaptation

## Decision

Build V5 as an isolated, deployable source package whose product surfaces follow the canonical artifact, while keeping its infrastructure adapters replaceable. Do not mutate the active shared runtime until the responsible owners and protected sources are available.

## Target topology

```text
WordPress / LearnDash eligibility
  -> existing signed HQ handoff
  -> future StoryForge audience + eligibility adapter
  -> short-lived StoryForge JWT
  -> StoryForge API
  -> PostgreSQL RLS/RPCs
  -> private R2 signed upload/download adapter

Protected Matrix App Mode
  -> mounts built V5 client through verified StoryForge JS/CSS owner
```

## Reversible local topology

```text
loopback-only signed fixture identity
  -> same StoryForge API authorization contract
  -> ephemeral real PostgreSQL 16
  -> V5 browser client
```

The fixture signer cannot start unless `STORYFORGE_DEV_AUTH=1` and the request is loopback. Production identity rejects the fixture path.

## Adaptations

### UI mounting

The V5 client is developed independently for testability. Its production output is intended to be mounted through the existing protected Matrix StoryForge owner after source recovery/verification. It does not replace Matrix navigation or create a competing product path.

### Authentication

The API accepts a purpose-bound StoryForge JWT containing identity, actor role, and verified eligibility. The local signer is test-only. Production issuance belongs in the existing HQ bridge so WordPress remains the identity/eligibility authority.

### Data

The schema is a versioned candidate local to the package. It uses PostgreSQL-native RLS and server-enforced functions so it can be reviewed and tested before a Supabase project is selected. It is not copied into root migrations.

### Audio

The API adapter uses private S3-compatible signed operations only when an approved StoryForge bucket is configured. Otherwise the client must disclose that recording storage is unavailable.

### AI

The client never contains model keys or synthetic answers. The server endpoint remains closed until provider, DPA, budget, flags, prompt/version persistence, PHI minimization, and evaluation gates are supplied.

## Unresolved ownership

- protected Matrix source recovery and integration;
- StoryForge Supabase project;
- production JWT issuer change;
- mentor-assignment synchronization;
- private StoryForge R2 bucket;
- retention/deletion/export/archive policy;
- admin support/private access policy;
- production path;
- staging/UAT and production go-live authority.
