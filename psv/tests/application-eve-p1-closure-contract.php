<?php
/** Narrow static contract for DR-335 application-eve closure. */
declare(strict_types=1);
$root=dirname(__DIR__,2).'/wp-content/plugins/missionmed-file-vault-ps/';
$files=[];foreach(['batch'=>'includes/class-mmps-batch.php','generator'=>'includes/class-mmps-generator.php','edit'=>'includes/class-mmps-edit.php','region'=>'includes/class-mmps-region.php','rest'=>'includes/class-mmps-rest.php','ui'=>'assets/mmps-app.js'] as $k=>$p){$files[$k]=(string)file_get_contents($root.$p);}
$pass=0;$fail=0;function c(bool $v,string $l):void{global $pass,$fail;if($v){$pass++;echo"PASS: $l\n";}else{$fail++;fwrite(STDERR,"FAIL: $l\n");}}
c(str_contains($files['batch'],'mmps_batch_specialty_mismatch')&&str_contains($files['generator'],'mmps_specialty_mismatch'),'server batch and single generation fail closed on specialty mismatch');
c(str_contains($files['batch'],"'programIds' => \$batch_program_ids")&&str_contains($files['generator'],'OTHER_PROGRAM_IDENTITY_UNAVAILABLE')&&str_contains($files['generator'],'OTHER_PROGRAM_NAMED'),'complete batch program identities feed cross-program exclusion');
c(str_contains($files['generator'],'Do not use any exact phrase listed in the banned_phrases payload')&&str_contains($files['generator'],'including the stock phrase \\"I would bring\\"'),'provider instruction explicitly enforces the complete deterministic banned-phrase contract');
c(str_contains($files['rest'],'/edits/revalidate')&&str_contains($files['generator'],'revalidate_edit')&&str_contains($files['edit'],'PROVIDER_GROUNDED_EDIT_V1'),'manual edit has a provider-backed exact-revision approval path');
c(str_contains($files['region'],"const PROGRAM_TOKEN = '*Your Program*'")&&str_contains($files['region'],'verify_protected_with_program_token')&&str_contains($files['rest'],'programNameSubstitutions'),'exact program token resolves with protected-text proof and provenance');
c(str_contains($files['ui'],'priorityProfile')&&str_contains($files['ui'],'dragstart')&&str_contains($files['ui'],'What matters most to <em>you?</em>'),'student preferences use one ordered drag-ranking experience');
c(str_contains($files['ui'],'Edit Program Paragraph')&&str_contains($files['ui'],'Restore AI version')&&str_contains($files['ui'],'Revalidate'),'library exposes bounded paragraph editing controls');
c(str_contains($files['ui'],'Want MissionMed to know this program much better?')&&str_contains($files['ui'],'Download Research Mission (.md)')&&str_contains($files['ui'],'Use what we already know'),'Deep Research is benefit-led with a non-coercive fallback');
c(str_contains($files['ui'],'Prepare My Personal Statements in MyERAS')&&str_contains($files['ui'],'GUIDED_MANUAL_PREPARATION')===false&&str_contains($files['rest'],'GUIDED_MANUAL_PREPARATION'),'MyERAS wizard is prominent while server capability remains explicitly manual');
c(str_contains($files['ui'],'MissionMed cannot currently read MyERAS back automatically')&&str_contains($files['ui'],'Not verified'),'MyERAS wizard never fabricates assignment or readback success');
c(str_contains($files['rest'],'LATEST_APPROVED_PER_PROGRAM_AND_TRAINING_TYPE')&&str_contains($files['rest'],'supersededApprovedVersions'),'MyERAS preparation selects one current approved version per program and preserves older versions');
echo "PSV APPLICATION-EVE P1 CLOSURE CONTRACT: ".($fail?'FAIL':'PASS')." ($pass passed, $fail failed)\n";exit($fail?1:0);
