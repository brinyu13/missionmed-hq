# B release rollback readiness

READY for scoped presentation rollback; no restore drill or rollback executed. Native recovery: MissionMed Institute Live daily backup, Sep 15, 2026, 3:50 AM displayed; 14-day retention; Restore to available. Timezone, per-row expiry and note were not shown. No backup created/deleted/renamed/restored.

Private preimages: `/www/theresidencyacademy_209/private-backups/mr-b-immersive-20260915232738Z/preimage/`.

| Preimage | SHA256 |
|---|---|
| missionmed-mr-p0.php (pre-B) | f1d0d057c5b42eba738dd0755d205817d2acfdd4eecd338605e8b9f9daf94b39 |
| mission-residency.html (logged-out public preimage) | 9f0346e93064d2fb504474010ee23b2b54a433a746cd7b38191a5c92e9f1a76a |
| terms-of-agreement.html (logged-out public preimage) | 2d3e0d232abb3ab051c957c0dab57b306874afc715d4e483c767fc9542dbae48 |
| initial-b-missionmed-mr-p0.php (before final correction) | 474da0f5a9585d4f804683c6a335c05980a018f5635ae5a020867dcd98f5375c |
| initial-b-production.css | 43aa2012c20f9910394c40f2a2f2698e06c813c7c007c0e86f938e1f70af495e |

Original PHP mode: 0644. The B directory did not exist before deployment. No WordPress posts, options, products or database objects were modified. Exact source hashes and byte sizes:

| Source path | SHA256 | Bytes |
|---|---|---|
|wp-content/mu-plugins/missionmed-mr-0912-assets/b-immersive/assets/brian-real.jpg|224c6a7ca99b3bea4181fe96db986a6e2c297ef8d55133f5b9bdfd6fc2e0cc82|36852|
|wp-content/mu-plugins/missionmed-mr-0912-assets/b-immersive/assets/care.jpg|c0d8f4cc95c85ed8c824183d2886f9418b99d595ab0ed2ced9353552e8c9a659|329144|
|wp-content/mu-plugins/missionmed-mr-0912-assets/b-immersive/assets/display.woff2|4c98b9d490d1698ec95f2ff17a6c7d0e72691864c0c5d7bc2a2c161b45afe5ad|90096|
|wp-content/mu-plugins/missionmed-mr-0912-assets/b-immersive/assets/gunjan.jpg|af7c44a84a97eef67813c26fe2667c91f755530a06a38d882a94297fbc23a2d5|10773|
|wp-content/mu-plugins/missionmed-mr-0912-assets/b-immersive/assets/gunjan.mp4|32a48dac43e4d43ba9fbf1894155467d8ba3cd7171262e8b19beb3f02fb49600|7588923|
|wp-content/mu-plugins/missionmed-mr-0912-assets/b-immersive/assets/hero-brian-photo-composite.png|7bddd49c76de21369e04d9c90279fdeb5cbed1d163715dd41cef589c27b64897|1708794|
|wp-content/mu-plugins/missionmed-mr-0912-assets/b-immersive/assets/marian.jpg|617c9e69f08a29b4be0bf2ddaa0b9237465f821b1f6c98ebe698b57928e22df7|18730|
|wp-content/mu-plugins/missionmed-mr-0912-assets/b-immersive/assets/marian.mp4|1e94a5c78b649873814f102085a90b2e10ad6611bf1d5c40695d65ab6abce8fa|7452612|
|wp-content/mu-plugins/missionmed-mr-0912-assets/b-immersive/assets/matrix-reference.jpeg|0376ca83f2d4915663baabfc0989d286b5c096feaa0e9766dd370d016c93ce43|297518|
|wp-content/mu-plugins/missionmed-mr-0912-assets/b-immersive/assets/missionmed-authentic.png|dcdeb16ba424fd3dc57219e2f332337bca56925d50ee4bf47676952fb8e694a5|609387|
|wp-content/mu-plugins/missionmed-mr-0912-assets/b-immersive/assets/mono.woff2|c36f509c0a8f9f85f29cb44bc8701d8a9e0b14c499e77a884f789ead7093a7ac|10052|
|wp-content/mu-plugins/missionmed-mr-0912-assets/b-immersive/assets/mr-transparent.png|8352b6bfca5950a45f051b41031c51e4ec28265dd4bada26bf0135873205231c|78410|
|wp-content/mu-plugins/missionmed-mr-0912-assets/b-immersive/assets/online-class.webp|1a7001fb12b7d71f15699e4df80a98af9763f8028e9a781fb4837c5c947bfcfd|132876|
|wp-content/mu-plugins/missionmed-mr-0912-assets/b-immersive/assets/prepare.jpg|154654c5ae26ee42302bc1d34da475daa9671922490c36a911d5a9518686c6ad|301577|
|wp-content/mu-plugins/missionmed-mr-0912-assets/b-immersive/assets/research.jpg|f8d3b0a66f1174ce6f04a5b482c71768c0de0c21d69700241ea303df6aae4c22|351923|
|wp-content/mu-plugins/missionmed-mr-0912-assets/b-immersive/assets/sans.woff2|c940764593d0fe5d596be327ca7558855e018039fb78509aa21921fd3644c3e4|48432|
|wp-content/mu-plugins/missionmed-mr-0912-assets/b-immersive/assets/serif-italic.woff2|4af9c759c8059b53923b4b50ba377ba51029876e1af1ea757efb07bc67d97896|81704|
|wp-content/mu-plugins/missionmed-mr-0912-assets/b-immersive/assets/serif.woff2|48282a415ec22e31beaf0a0666e6fae0c8cbddcd0b1f6e729f27c3ade8a64e43|67388|
|wp-content/mu-plugins/missionmed-mr-0912-assets/b-immersive/assets/yamini.jpg|0744216d072d35521dbf87b89bb584284b9bd84bb07628a9d73df33c3cb7e1a4|15450|
|wp-content/mu-plugins/missionmed-mr-0912-assets/b-immersive/assets/yamini.mp4|e97c5cda3c67a43488c3b4ddd284c4aaec37c5b95df5935d1788fb09ad820778|6420741|
|wp-content/mu-plugins/missionmed-mr-0912-assets/b-immersive/guarantee.html|c9905a00e5c55e82c672005a3ab9e20d131ae915657545b2a1af429310f1adce|1033|
|wp-content/mu-plugins/missionmed-mr-0912-assets/b-immersive/index.html|f5b9f6080ed90c11ff54c869432989c7c25fc70223bedb3391631d7fa5cd8f9b|2694|
|wp-content/mu-plugins/missionmed-mr-0912-assets/b-immersive/scripts/finalization.js|ff301543028173a2d1cb80e7cb47f3ce1b84c752f82de34dd43fe87c083a2935|31718|
|wp-content/mu-plugins/missionmed-mr-0912-assets/b-immersive/scripts/site.js|58a3dabebad64c59eafbef3bae4ec6876a6cccf31f7345a4e66de400f85e395f|27535|
|wp-content/mu-plugins/missionmed-mr-0912-assets/b-immersive/styles/finalization.css|6f01b9d933a2186a2860b8610a249d32aba36b66e591897ab9c934dea2765a93|14279|
|wp-content/mu-plugins/missionmed-mr-0912-assets/b-immersive/styles/founder-steers.css|af8c574227384cc79c73ec7681d1fca667aa7fc4f2289e7850a5cb20a9338452|3531|
|wp-content/mu-plugins/missionmed-mr-0912-assets/b-immersive/styles/production.css|a29d05873715fc39a77203101ac0ee55e2522ec84302cffda05c07deccd3043d|1876|
|wp-content/mu-plugins/missionmed-mr-0912-assets/b-immersive/styles/site.css|22de38e88275d56a9ef227206927a8b74048226547f8ae77d77e116bf3b8bd76|51303|
|wp-content/mu-plugins/missionmed-mr-p0.php|381283703b1b90f7495b0cecbd2303d2e22f995548392b032e43dd4b6fd33015|39653|


## Scoped rollback procedure

1. Renew the exact PATH authority/lease and verify no intervening drift against the released ledger.
2. Verify the private pre-B PHP hash. Stage and atomically restore only that PHP file, preserving mode0644.
3. This returns the former landing, terms and cart presentation without touching commerce.
4. If removal is necessary, move only the newly introduced b-immersive directory to private custody after a reference/drift check. Do not delete unrelated assets.
5. Purge only affected landing, terms, cart and changed-asset URLs. Recheck restored hashes and core offers.

No database restore, order/payment/entitlement rollback, product reset, global cache flush, stash or clean is authorized. Readiness is based on retrievable exact preimages; no restore drill was executed.
