import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
const here=path.dirname(new URL(import.meta.url).pathname),root=path.resolve(here,'../../..');
const source=fs.readFileSync(path.join(root,'wp-content/mu-plugins/missionmed-mr-alternate-assets/match-day-player.php'),'utf8');
const good={enabled:true,provider:'cloudflare-stream',streamUid:'a'.repeat(32),publicUseAuthority:'TEST ONLY',masterSha256:'6ca321397fabd28d69c5e98a621c7b5d4fa7705f99d93a60daff2a5fc79d1398'};
const cases=[['valid fixture',good,true],['disabled',{...good,enabled:false},false],['string boolean',{...good,enabled:'false'},false],['no authority',{...good,publicUseAuthority:''},false],['whitespace authority',{...good,publicUseAuthority:' '},false],['wrong asset',{...good,masterSha256:'x'},false],['bad UID',{...good,streamUid:'"/><script>'},false],['wrong provider',{...good,provider:'other'},false]];
const result=[];
for(const [name,config,expected] of cases){const php=source.replace(/\$matchDayMedia = json_decode\([^\n]+\);/,()=>'$matchDayMedia = json_decode(base64_decode("'+Buffer.from(JSON.stringify(config)).toString('base64')+'"),true);');const out=execFileSync('php',[],{input:'<?php define("ABSPATH",__DIR__);function esc_html($s){return htmlspecialchars($s,ENT_QUOTES,"UTF-8");}$asset=fn($s)=>"/assets/".$s;?>'+php}).toString();assert.equal(out.includes('data-match-day-source'),expected,name);result.push({name,expectedVisible:expected,pass:true});}
fs.mkdirSync(path.join(here,'qa'),{recursive:true});fs.writeFileSync(path.join(here,'qa','publication-gates.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
