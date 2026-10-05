# V2 production deployment custody

Source commit 4ddb39d9ec1f58639dae4040f2b1b9009565a947. Root sole integrator.

2026-10-05: exact scoped leases positively released after each publication.

CDN LIVE admin SHA256 f673584d90414f1577eee3ec8c031c0c79dc7d78fd67bbccb8b7fe26abee2c97, 265889 bytes. R2 guarded old67d762 preimage, exact direct readback and public readback PASS.

WordPress page5979 existing brinyu actor1, unchanged capabilities/filter and InnoDB transaction, guarded raw58d938 preimage. Published wrapper e92b89d97a2297c43d1ee4c0cc08ec48343019195849f1b5b15bda628044e63a; exact database readback PASS. Only this page content modified.

Existing C18 gateway deployment dd1ee4ed-b06b-4049-afb8-92bdaaadf5f0 remains unchanged. Applicant asset05f460 remains unchanged. No auth, API, database schema, provider, plugin, theme or runtime dependency release.

Rollback assets: local rollback/usce_admin_before_v2.html and owned R2 rollback_20261005/usce_admin.html exact67d762; WordPress raw rollback58d938. Scoped reviewed updater restore/publish modes retained. Live recovery exercise pending.

NonQA88 requests fingerprint66bbcc60fa8e7e4059de5f67f77c61c8 unchanged at post-deploy readback. No V2 test send yet.

Global critical manifest changed only the USCE admin asset SHA/source custody; sibling fields and assets JSON equality verified. Independent live acceptance pending.

Actual recovery exercise PASS: scoped CDN f673584d -> exact67d762 -> exactf673584d; WP wrapper e92b89 -> exactraw58d938 -> exacte92b89. All direct R2/database hashes read back before next operation, both leases positively released. No backend/data/auth changes. Actual normal Brian Chrome WP entry1329x610; outerdoc same dimensions/scroll0, adminbar32+siteheader94.54, iframe483.455/fullheight196pxrail; Guide/Viewrequest/Offer/Coordinator accessible. Safe Main screenshot /tmp/usce-v2-live-main-20261004.jpg.
