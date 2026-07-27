# StoryForge V5

This is the isolated, reversible B1-500 implementation source. The pinned canonical V5 artifact is the only product authority.

The package is not independently authorized for production deployment. It must be integrated through the verified protected Matrix StoryForge owner after the database, identity, storage, staging, and founder gates are resolved.

## Verification

```sh
npm install
npm test
npm run test:postgres
npm run test:e2e
```

The PostgreSQL and browser suites create temporary databases under `/tmp`. Browser identities are locally signed fixtures, available only on loopback with `STORYFORGE_DEV_AUTH=1`.
