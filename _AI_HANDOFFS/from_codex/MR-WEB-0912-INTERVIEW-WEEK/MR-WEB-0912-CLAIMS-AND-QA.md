# MR-WEB-0912 Claims and QA Evidence

## Current live preimage

Ten relevant public routes returned HTTP 200:

- corporate homepage;
- Mission Residency;
- the three comparison aliases;
- current and alias Complete product URLs;
- current and alias Essentials product URLs;
- 360 product URL.

The live preimage remains the prior release:

| Location | Observation | Classification |
|---|---|---|
| Homepage HTML source | prohibited alumni total remains in the legacy injected grid | active public source, hidden from rendered view |
| Homepage rendered text | `physicians who have matched hundreds of candidates` | active public unsupported outcome claim |
| Mission Residency and comparison pages | exact four-mock language | active public entitlement claim no longer authorized |
| Product pages | no target stale phrase in raw HTTP sweep | active public, clean for searched phrases |

The candidate output removes the legacy alumni-total paragraph at the response
boundary, replaces the unsupported `matched hundreds` phrase with neutral
teaching language, and replaces exact mock-count language with an enrollment
verification boundary. Historical/private evidence is preserved.

## Repository-wide claim sweep

Search terms included `142`, close alumni-total variants, `89.1%`,
`3,000+`, `matched hundreds`, exact four-mock language, `MatchFirst`,
six-month variants, and the expired September 12 deadline.

| Class | File count | Disposition |
|---|---:|---|
| Historical handoffs/candidates | 21 | preserved; non-executable historical evidence |
| System/log records | 4 | preserved; governance or audit evidence |
| Active MR release | 1 | only cleanup match patterns in the PHP plugin; candidate public config/page/JS is clean |
| Other `142` matches | 17 | false positives such as CSS color components, page-number citations, or unrelated medical content |
| New candidate rendered output | 0 stale hits across 12 browser checks | PASS |

The bare-number search was intentionally retained so false positives were
classified rather than silently excluded.

## Claims and statistics source matrix

| Claim | Source | Candidate treatment |
|---|---|---|
| Interview Week $500, one payment | DR-246 | displayed |
| Complete standard $3,499 | DR-246 | displayed as standard anchor, not enabled checkout |
| Early $2,799 Zelle / $3,099 card / $3,299 installments through Sept 23 | DR-246 intended terms | stored with `public_verified=false`; stripped from public runtime response |
| Complete includes Interview Week | DR-246 | displayed repeatedly; no additive-price implication |
| Approved six-date schedule | DR-246 | displayed at exact approved precision |
| Evening clock times | no approved source | omitted; `Evening` only |
| Interview Week 50+ capacity | authority requires current capacity proof | omitted |
| Complete C/D/E/J availability or 15-person capacity | no current operational proof | omitted |
| Complete Signature Mock count | current fulfillment not proved | null/omitted |
| Dr J $100 discount and $2,699 intended result | coupon/stack not operationally proved | not rendered; stripped from public runtime response |
| $500 upgrade credit | deterministic mechanism not proved | not rendered; stripped from public runtime response |
| Alumni total, match rate, scale, guarantees | no current approved business source | omitted; no replacement statistic |

## Responsive/browser matrix

The local candidate was served from the source-controlled asset directory and
opened through the browser. Each result asserted exact CSS viewport width,
`scrollWidth === clientWidth`, zero checkout anchors, visible disabled
verification state, and no stale claim text.

| View | 1440 desktop | 1024 tablet | 390 mobile |
|---|---|---|---|
| Mission Residency | PASS | PASS | PASS |
| Interview Week | PASS | PASS | PASS |
| Complete | PASS | PASS | PASS |
| Compare | PASS | PASS | PASS |

Desktop and 390px before/after screenshots were captured in the task. The
candidate uses the existing authentic MissionMed Institute logo URL. It uses no
stock-doctor imagery, generated logo, fabricated student identity, testimonial,
placement pairing, outcome statistic, scarcity count, or guarantee.

## UX result

- Clear first viewport and two-choice decision.
- Interview Week displays $500 and Complete displays $3,499 standard tuition.
- `Complete includes Interview Week` is explicit.
- No page implies $500 must be added to Complete.
- Schedule cards collapse to one column at 390px.
- Checkout is visibly unavailable pending verification.
- No clipping or horizontal overflow was observed.
