# Amazon commerce mechanism evidence — 2026-10-05

Source base e82c03ec4d487ce5d6031189f68a9913a52ddcd7. Read-only research/browser evidence; no application, credential, account or provider mutation.

Amazon documents Creators API as the replacement for deprecated PA-API 5: https://affiliate-program.amazon.com/creatorsapi/docs/en-us/paapiv5-deprecation . The current GetItems documentation names Images, ItemInfo and OffersV2 and requires partnerTag: https://affiliate-program.amazon.com/creatorsapi/docs/en-us/api-reference/operations/get-items . These facts do not establish that ratings/review counts are available or licensed through a particular account.

Onboarding requires final Associates acceptance and qualified referred sales; only the primary account owner may register: https://affiliate-program.amazon.com/creatorsapi/docs/en-us/onboarding/register-for-creators-api . Do not create an application or credentials under current DR375 exclusions. No existing API access or secret custody has been verified.

Actual Chrome browser1 navigation to https://affiliate-program.amazon.com/creatorsapi redirected to Amazon Sign-In. Visible page title and password-form presence verified without reading form values, cookies, secrets or identifiers. No authenticated Associates tab was found in the scoped current browser tab check. Account API eligibility/access is UNKNOWN pending normal sign-in. Prior verified missionmatch-20 tracking config remains preserved, not newly account-verified in this read.

Current official SiteStripe help describes text-link generation: https://affiliate-program.amazon.com/help/node/topic/GJMMT7G4C8K4Y3AY . No compatible official rich shopping component was verified. Do not iframe product-detail pages or silently substitute old image widgets.

Implementation boundary: preserve centralized missionmatch-20 product destinations and original MissionMed editorial content. Volatile commerce fields remain provider-owned, optional, time-bound and omitted until both actual provider access and content rights are verified. Use already approved/licensed product photos; link to original photos for missing imagery. No scraped Amazon prices, ratings, review counts, Prime/deal/availability claims, or copied images. API readiness must not block otherwise compliant Phase1 commerce.
