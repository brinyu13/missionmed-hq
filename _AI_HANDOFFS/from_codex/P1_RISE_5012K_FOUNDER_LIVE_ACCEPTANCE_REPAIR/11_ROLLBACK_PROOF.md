# Rollback proof

Rollback remains pinned and executable:

- Custody commit: `4dcc70f0a3d293a3c64d6d8fd526c1831a9f643e`
- App code: `c8c1da3f0947f8c668cc6f1a9d89d4f873eba1fa`
- Deployment: `175e3ae2-136b-4f6b-a623-cc8c44f33a55`
- Build: `rise_web_d8418b22ad24`

The 5012K changes are additive UI/projection changes plus canonical evidence promotion. Existing evidence lineage permits identifying the 1,462 promoted rows by source `rise_src_p1_rise_5012k_review`. No rollback was executed because live QA and automated checks passed.
