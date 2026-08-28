# All-Program Registry Report

## Verified current internal corpus

The current pinned workbook bytes still match the governed corpus:

```text
workbook SHA-256 = c627397c69d2fad42c07a0b66951f3f3a4957a86c231d93a5bd925cdb2d87b9e
content SHA-256  = 40d86561cf08ff56ede703d999849740bad36ac536518da23495cbada1262494
raw specialty rows = 6,346
active rows = 6,345
quarantined rows = 1
unique canonical programs = 6,139
specialty tabs = 31
additional browse memberships = 206
```

The values are bound to the same workbook/content hashes used by the current configuration and the 4102 identity receipts; the source did not drift during 5007.

## Defensible student projection

```text
student-visible rights-safe identities = 26
student-visible specialties = 3
deep research = 0
partial research = 0
basic profiles = 26
published SOAP joins = 0
internal canonical identities excluded = 6,139
rights-blocked canonical fields = 196
```

The 26 HRSA THCGME records are a separate rights-safe public-domain projection, not a proven one-to-one subset of the FREIDA-derived 6,139 identities; therefore `6,139 - 26` must not be represented as a reconciled hidden count. All 6,139 internal identities remain excluded as an internal corpus.

The broad all-program build cannot be released from the current source. ACGME's public Program Search does not establish a bulk-republication grant, and ACGME's legal terms state that reproduction or distribution requires prior written approval: https://www.acgme.org/about/legal/ . No approved independent all-program export was found.

Evidence:

- `rise/config/dataset.v1.json`
- `rise/releases/student-rights-safe/api-index.json`
- `rise/releases/student-rights-safe/internal-full-rise-manifest.json`
- `rise/governance/RIGHTS_REVIEW_REQUIRED.csv`

