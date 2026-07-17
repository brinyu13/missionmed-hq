# Database, index, Cloudflare R2, and content delivery network review

Scope: storage and indexing surfaces that could confirm or contradict the runtime roster.
Status: **partially observed; upstream reconciliation blocked**. Limitation: no credentials,
tokens, cookies, environment values, or protected database rows were accessed.

Abbreviations: Cloudflare R2 object storage (R2), content delivery network (CDN), remote
procedure call (RPC), and MissionMed Headquarters/Content Intelligence Engine (HQ/CIE).

## CDN

The runtime-documented canonical mapping was checked for both artifact classes across all
105 candidates. The result is 97 available transcript objects, 99 available Nodes objects,
and 14 not-found checks. The probe used exact host/path/method allowlists, rejected redirects,
required bounded JSON responses, and retained hashes/structure only.

Individual object availability is strong evidence for current bytes. It is not equivalent
to an R2 bucket inventory: unreferenced objects, alternate prefixes, tombstones, and upstream
orphan records cannot be detected without mediated listing authority.

## Historical local database and index

An immutable, query-only historical database passed integrity checking and contains:

- 509 video rows;
- 40,197 segment rows across 509 distinct video identifiers;
- 40,197 nonempty historical speaker strings and 59 distinct labels;
- 328 classified video rows across three unlabeled buckets;
- 242 rows whose historical existence flag is true;
- 509 distinct source-transcript references.

The broad master index also contains 40,197 entries and reports 509 sources. Agreement
supports internal historical consistency, not current Dr. J completeness. The database is a
backup, its speaker strings are not adjudicated identity authority, and its source labels do
not define the current candidate roster.

## Supabase and semantic indexes

Runtime code and governing contracts describe media transcript chunks and a semantic-search
index. Current authority records conflict on the owning Supabase project: one route assigns
media registries to a growth system while the active I1Q decision assigns additive mission
tables elsewhere. Schema names alone cannot resolve that project boundary.

Direct Supabase queries were therefore not attempted. Safe resumption requires a named owner
to identify the exact project, schema, table/RPC versions, snapshot, and read-only authority.
Only aggregate counts, hashes, schema fingerprints, and privacy-safe aliases may leave the
restricted boundary.

## HQ/CIE

The HQ health surface was observed. Protected media endpoints rejected unauthenticated access.
The in-app browser had no existing signed-in session, and a direct protected API view was
blocked by the browser client. No cookies, storage, headers, or credentials were inspected.

Runtime code indicates that media-detail reads can backfill data. That route was explicitly
excluded because a discovery mission may not mutate or trigger a backfill. Only a proven
read-only list/snapshot route may be used after authenticated authority is supplied.

## Required upstream receipts

- mediated R2 object listing for the canonical artifact prefix;
- exact Supabase project pin and read-only snapshot receipt;
- authenticated HQ/CIE inventory through a proven non-mutating route;
- row-wise identity reconciliation to the owner-attested corpus roster.
