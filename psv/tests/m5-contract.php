<?php
/** PSV M5 static privacy, integration-boundary, and hardening gate. */
declare(strict_types=1);
$repo = dirname(__DIR__, 2);
$root = $repo . '/wp-content/plugins/missionmed-file-vault-ps';
$sim = (string) file_get_contents($root . '/includes/class-mmps-similarity.php');
$rest = (string) file_get_contents($root . '/includes/class-mmps-rest.php');
$install = (string) file_get_contents($root . '/includes/class-mmps-install.php');
$store = (string) file_get_contents($root . '/includes/class-mmps-store.php');
$ui = (string) file_get_contents($root . '/assets/mmps-app.js');
$bundle = (string) file_get_contents($root . '/includes/class-mmps-evidence-bundle.php');
$similarityTable = preg_match('/similarity_fingerprints[\s\S]*?\) \$c;/', $install, $tableMatch) ? $tableMatch[0] : '';
$pass=0; $fail=[];
function m5check(bool $ok,string $label,string $why):void{global $pass,$fail;if($ok){$pass++;fwrite(STDOUT,"PASS: {$label}\n");return;}$fail[]=$label;fwrite(STDERR,"FAIL: {$label} — {$why}\n");}
m5check(str_contains($sim, "const VERSION        = 'mmps-similarity.v1'"), 'similarity algorithm is versioned', 'Fingerprint migrations must remain auditable.');
m5check(str_contains($sim, 'hash_hmac') && str_contains($sim, "wp_salt( 'auth' )"), 'fingerprints are keyed server-side', 'Plain hashes of phrase shingles are dictionary-attackable.');
m5check($similarityTable !== '' && !preg_match('/(?:full_text|region_text|paragraph|prose)\s+(?:long)?text/i', $similarityTable), 'similarity table stores no prose column', 'No cross-student text may enter the fingerprint store.');
m5check(str_contains($install, 'signature_json text') && str_contains($install, 'exact_hmac char(64)'), 'only digest/signature material is persisted', 'The privacy mechanism needs exact and near matching without text.');
m5check(str_contains($install, "table( 'similarity_buckets' )") && str_contains($sim, 'bucket_hash IN'), 'near matching uses a bounded privacy-safe bucket index', 'Batch approval must not scan every stored signature.');
m5check(str_contains($sim, 'foreach ( $signature as $index => $value )') && !str_contains($sim, 'LIMIT 500'), 'bucket retrieval cannot false-clear an above-threshold match', 'Every equal signature position must be retrievable and candidate truncation is prohibited.');
m5check(str_contains($sim, 'mmps_similarity_read') && str_contains($sim, 'mmps_similarity_backfill_capacity') && str_contains($rest, 'is_wp_error( $similarity )'), 'similarity protection fails closed on read or backfill errors', 'A storage failure must never become CLEAR.');
m5check(str_contains($sim, 'algorithm_id') && str_contains($sim, 'f.algorithm<>%s') && str_contains($sim, 'replace_stored'), 'server-key rotation has an auditable re-key path', 'Salt rotation must not strand old fingerprints under an indistinguishable algorithm version.');
m5check(str_contains($sim, 'user_id<>%d') && !str_contains($sim, "'userId' =>"), 'cross-student comparison returns no matched identity', 'The caller needs only an opaque disposition.');
m5check(str_contains($rest, 'mmps_cross_student_exact') && str_contains($rest, 'mmps_similarity_review'), 'exact reuse blocks and near similarity requires review', 'Protection must distinguish verbatim from quality review.');
m5check(str_contains($rest, 'acknowledgeSimilarity') && str_contains($ui, 'Quality comes first'), 'near-similarity review can preserve the better writing explicitly', 'Artificial uniqueness must not outrank quality.');
m5check(str_contains($store, 'START TRANSACTION') && str_contains($store, 'MMPS_Similarity::store') && str_contains($store, 'ROLLBACK'), 'document and fingerprint persist atomically', 'A saved document must never bypass its fingerprint.');
m5check(str_contains($bundle, 'ProgramEvidenceBundle') && (bool) preg_match("/const\\s+SCHEMA\\s*=\\s*'missionmed\\.rise\\.program-evidence-bundle\\.v1'/", $bundle), 'ProgramEvidenceBundle v1 boundary remains intact', 'Future Matrix transport must not require a PSV rewrite.');
m5check(!preg_match('/class-mmed-file-vault-v2\.php|class-mmed-file-vault-repository\.php/', $sim.$rest.$store.$ui), 'M5 does not modify native File Vault implementation', 'Owner integration remains gated.');
m5check(str_contains($ui, 'aria-label="Batch generation progress"') && str_contains($ui, 'role="radiogroup"') && str_contains($ui, 'srOnly'), 'key batch, candidate and file controls retain accessible semantics', 'M5 includes accessibility hardening.');
m5check(!str_contains($ui, 'style="'), 'strict CSP remains free of inline styles', 'Inline styles would be blocked in production.');

if($fail){fwrite(STDERR,"\nPSV M5 CONTRACT: FAIL (".count($fail)." failed, {$pass} passed)\n");exit(1);}fwrite(STDOUT,"\nPSV M5 CONTRACT: PASS ({$pass} assertions)\n");
