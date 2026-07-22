# 07 Asset Broker and Media Boundary

RESULT: `OPAQUE_MEDIA_BOUNDARY_LOCALLY_VERIFIED`

## Broker guarantees

- Public identity is an opaque asset handle; native paths are never returned.
- The default native-path adapter denies.
- Registration validates bounded stream size, declared byte length, MIME, magic bytes, and SHA-256.
- Metadata is immutable and bound to tenant, environment, subject, assignment, source object, fixture/live class, and authority grants.
- Grants are server-attested opaque objects; serialization/forgery loses authority.
- Register/open/read/revoke recheck current async authority and require literal `true`.
- Grant expiry and broker timestamps use an injected server clock plus the shared strict RFC 3339 contract; impossible calendar dates/JavaScript rollover and offsets beyond `14:00` fail closed. Caller context has no accepted `now` field and cannot revive a grant with a forged old time.
- Revoked reads are fenced and public errors disclose no path or provider detail.
- Revocation holds a per-handle lock, captures exact context/grant references, and revalidates after every asynchronous authority check. Context mutation during the wait cannot retarget the revocation; 100 concurrent revocations converge on one revoked state.

## Idempotency

The scoped registration identity is `(tenant, environment, subject, kind, requestId)`. Its semantic hash binds source object ID, expected content SHA-256, MIME, and byte length. Exact replay returns the original frozen handle after authority recheck. Any semantic rebinding returns `MMC_ASSET_IDEMPOTENCY_CONFLICT`.

One hundred concurrent identical registrations produced one handle. Handle and receipt commit together; injected error cannot leave one without the other. Tests advance the broker clock beyond grant expiry, prove that a forged old caller timestamp is rejected, and exercise concurrent revocation/TOCTOU behavior.

## Webex boundary

The historical Webex pull foundation now requires dedicated MMC configuration names, exact `https://webexapis.com`, explicit redirect handling, trigger allowlisting (including `[MM-ADV]`), record/byte bounds, fixture-only roots, and safe error translation. The fixture root and target are checked by `lstat`/`realpath` plus device/inode continuity; symlink roots and swap races fail closed before temp/link work. It does not read ambient browser credentials or expose tokens. Compatibility routes remain sealed; no recording was downloaded.

## Not claimed

No production object-store adapter, malware scanner, media retention job, live Webex OAuth proof, R2/Stream write, or raw-media transfer occurred. These are release/integration work after the trust kernel, not implicit capabilities.
