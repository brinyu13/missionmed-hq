# B1-511 Accessibility and Responsive Review

The B1-511 additions preserve the canonical V5 shell, landmarks, focus model,
keyboard paths, reduced-motion behavior, and responsive breakpoints.

- Search has an explicit accessible name, combobox/listbox semantics, bounded
  suggestions, composition safety, and a polite result-status announcement.
- Category/use and priority controls expose pressed state.
- Submission and review state use text in addition to color.
- Administrator search and queue controls have labels and server-authorized
  result counts.
- Private-story boundaries are rendered as explanatory notes without leaking
  hidden data.
- Mentor recording state is textual and the feature remains closed in
  production pending its human canary.

The complete conformance/accessibility suite passed 72/72. Browser E2E passed
66/66. Fresh B1-511 evidence includes desktop 1440x1000, tablet 768x1024, and
mobile 390x844 Library captures. No product redesign or global style-token
change was made.
