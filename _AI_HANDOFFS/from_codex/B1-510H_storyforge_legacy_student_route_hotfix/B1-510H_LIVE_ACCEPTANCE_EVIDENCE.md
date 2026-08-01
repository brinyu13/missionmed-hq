# B1-510H Live Acceptance Evidence

The pre-deployment defect reproduction remains preserved in:

- `evidence/B1-510H_affected_student_before_legacy.png`
- `evidence/B1-510H_affected_student_before_direct_denial.png`

After deployment, the existing authenticated Founder student session entered
through Matrix, redirected to the canonical `/storyforge/` application, showed
no Bootstrap Demo markers, and remained current after refresh:

- `evidence/B1-510H_founder_after_route.png`

The full server-side student/token/isolation matrix, explicit browser limits,
and monitoring result are in `B1-510H_LIVE_STUDENT_ACCEPTANCE.md`.
