# Rollback

Preferred immediate rollback:

- code commit: `0946a448decaafb9cccbf3def5804ccf13223937`
- prior healthy deployment: `e5b5a117-3e3b-4bd6-b66a-439d5e10d53c`
- prior image: `sha256:3a757791739698ef7248526c328e4b22105ba71aeb467e475014407684f0afae`
- prior build: `rise_web_76d7ca1ccd34`
- prior manifest SHA-256: `505626df651c3e0f06e892eba95aa85262ff5f725d7032c98e8b96792f5e628f`

Full 5014A code rollback reference: `d745657f10b36a7050e7068a4a8144c16117dced`.

Pre-5014A production reference: deployment `7c8cf9a4-7ee0-4da6-ba47-db75dc5d4aaa`, build `rise_web_cbdfb1514554`.

Migration 016 is additive and data-preserving. Do not drop student data to roll back the UI/API; disable/revert the feature code and provider build pins. The controlled live acceptance restored the student's original priority order before closeout.

