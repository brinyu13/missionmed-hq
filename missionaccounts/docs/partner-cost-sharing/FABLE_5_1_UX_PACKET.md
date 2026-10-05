# Bounded Fable5.1 UX review packet

Execution owner: Codex. Request critique only: information architecture, hierarchy, MyAccounts family fidelity, cognitive load, business-partner trust, Brian efficiency, desktop/tablet/mobile, accessibility and error states. Do not redesign the deterministic accounting/payment architecture or reinterpret historical balances.

Routes: existing Home → Overview → Review & Pay → invoice modal → pending claim → Statements & History → print/CSV/package; Services & Invoices and Payments remain direct entry points; Reconciliation/Admin is Brian only. Prototype lenses are disposable local UI fixtures, never production identity controls.

State map: UNKNOWN history + collectionOFF; NEEDS_VERIFICATION invoice; APPROVED invoice; certified immutable period; ownOPEN/PARTIAL/PAID obligation; pending self-claim; evidence-backed canonical receipt; signed explicit correction/credit; missing/corrupt original denies package; revoked/missing card consent denies dispatch; provider outage isolates adapter. Zero/multiple receipt matches queue review. Actual unresolved history stays unknown even when synthetic journal demonstration is certified.

Screenshots: evidence/PARTNER-COST-SHARING-20261004/native-journal-overview.jpg and native-dated-statement-dark.jpg are explicitly synthetic; current role/viewport captures will accompany source handoff. Original invoice screenshots are excluded to preserve private financial custody. Native theme/rail defect was fixed compatibly; source retains native theme controls. Fable unavailable does not stop implementation. Adopt only compatible UX changes; no invented current balance or active payment button.
