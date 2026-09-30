# MissionMed site-icon assets

Source package: Founder-supplied `missionmed-favicon-package.zip`.

- `favicon.ico`, 16 px, 32 px, and 48 px are byte-identical to the supplied package.
- The supplied 180 px, 192 px, and 512 px files contained detached wordmark residue to the right of the crest. Only those detached pixels were removed; the remaining crest pixels were translated intact to the horizontal center of the original transparent canvas.
- No crest pixel, color, proportion, or internal artwork was regenerated or retouched.
- No web-app manifest is introduced by this release.

The canonical WordPress `site_icon` remains the primary metadata source. The MU plugin injects these versioned assets only for custom HTML renderers that bypass `wp_head()` and therefore omit WordPress site-icon tags.
