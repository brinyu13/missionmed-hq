<?php
/** Self-contained M5 fingerprint privacy and similarity tests. */
declare(strict_types=1);
define('ABSPATH', __DIR__ . '/');
function wp_salt(string $scheme='auth'):string{return 'unit-test-server-secret-'.$scheme;}
require dirname(__DIR__, 2) . '/wp-content/plugins/missionmed-file-vault-ps/includes/class-mmps-similarity.php';
$pass=0;
function m5runtime(bool $ok,string $label):void{global $pass;if(!$ok){fwrite(STDERR,"FAIL: {$label}\n");exit(1);}$pass++;fwrite(STDOUT,"PASS: {$label}\n");}
$base='I value careful clinical reasoning, direct feedback, and the chance to remain accountable to patients as responsibility grows. At Lakeview Internal Medicine Residency, I would carry that deliberate approach into a new clinical community. I hope to contribute curiosity, follow-through, and respect for the people who make difficult work possible.';
$near='I value careful clinical reasoning, direct feedback, and the chance to remain accountable to patients as responsibility grows. At Lakeview Internal Medicine Residency, I would carry that deliberate approach into a new clinical community. I hope to contribute curiosity, follow-through, and reflection for the people who make difficult work possible.';
$other='Training near my family would give residency a stable personal foundation. Harbor City offers the community setting I am seeking, while the program name gives this application a verified point of specificity. I would enter ready to learn local priorities and support my colleagues.';
$a=MMPS_Similarity::fingerprint($base);$b=MMPS_Similarity::fingerprint($base);$n=MMPS_Similarity::fingerprint($near);$o=MMPS_Similarity::fingerprint($other);
m5runtime($a===$b,'same paragraph yields a deterministic fingerprint');
m5runtime($a['exactHmac']!==hash('sha256',mb_strtolower($base,'UTF-8')),'exact digest is keyed rather than a plain content hash');
m5runtime(MMPS_Similarity::score($a['signature'],$n['signature'])>=MMPS_Similarity::NEAR_THRESHOLD,'small wording change is detected as near similarity');
m5runtime(MMPS_Similarity::score($a['signature'],$o['signature'])<MMPS_Similarity::NEAR_THRESHOLD,'different valid rhetoric is not penalized as near duplication');
$serialized=json_encode($a);
m5runtime(!str_contains($serialized,'careful clinical')&&!str_contains($serialized,'Lakeview'),'fingerprint payload contains no source phrase');
m5runtime(count($a['signature'])===MMPS_Similarity::SIGNATURE_SIZE&&count($a['buckets'])===MMPS_Similarity::SIGNATURE_SIZE,'every MinHash position has a privacy-safe lookup bucket');
m5runtime(MMPS_Similarity::score($a['signature'],$n['signature'])<MMPS_Similarity::NEAR_THRESHOLD||count(array_intersect($a['buckets'],$n['buckets']))>0,'every above-threshold near match is retrievable by at least one bucket');
fwrite(STDOUT,"PSV M5 RUNTIME: PASS ({$pass} assertions)\n");
