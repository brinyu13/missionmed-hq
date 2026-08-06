# B1-511A WordPress Founder Authority Correction

## Binding correction

WordPress defines global authority and access. WordPress user `1`, username
`brinyu`, is the Founder and has `manage_options`. WordPress user `107`,
username `Brian_test`, remains an additional administrator.

## Preserved identity and ownership

| WordPress user | StoryForge UUID | Persisted StoryForge role | Result |
|---|---|---|---|
| `1` / `brinyu` | `09c3b822-75e7-4f3f-bd3f-58afc0865a78` | `student` | Keeps all seven owned stories, capture, voice, and Student View; gains signed WordPress-authorized Administrator View. |
| `107` / `Brian_test` | `56bb6d8a-4957-4ba6-abe1-7f77046061c8` | `admin` | Remains an additional administrator. |

No profile, name, email, username, WordPress role, LearnDash enrollment,
StoryForge UUID, persisted StoryForge role, or story owner is changed.

## Implementation boundary

1. The product-owned WordPress plugin signs `wordpress_admin` from
   `user_can($user, 'manage_options')`.
2. The API verifies the signed claim. It never trusts a browser-selected role.
3. The API selects `admin_mode` only around bounded administrator operations.
4. PostgreSQL requires both the signed WordPress-admin claim and server-selected
   admin mode before deriving effective role `admin`.
5. The sole V5 renderer exposes a Student View / Administrator View switch only
   when the authenticated session reports the bounded admin capability.

Private stories remain invisible to administrator review operations. The
administrator console continues to expose submitted stories only.

## Local verification

- unit suite: `277/277` pass
- focused security/unit subset: `47/47` pass
- PostgreSQL suites: `17/17` and `130/130` pass, plus the new B1-511A authority
  test pass
- browser E2E: `68/68` pass
- secret scan: pass
- deterministic release build: pass
- release candidate: `v-f31264f9b7bbcb93`

The browser test proves that the Founder student identity starts in Student
View, retains capture, switches to Administrator View, cannot obtain private
stories, and switches back without changing its persisted role.
