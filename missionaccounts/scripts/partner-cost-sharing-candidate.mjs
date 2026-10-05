import { readFile,readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
const root=path.resolve(new URL('..',import.meta.url).pathname);
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
async function walk(dir){return (await Promise.all((await readdir(dir,{withFileTypes:true})).map(async x=>x.isDirectory()?walk(path.join(dir,x.name)):[path.join(dir,x.name)]))).flat();}
const moduleFiles=[...(await walk(path.join(root,'src/partner-cost-sharing'))),...(await walk(path.join(root,'public/partner-cost-sharing'))),
 ...(await walk(path.join(root,'docs/partner-cost-sharing')))];
const adapters=['.dockerignore','Dockerfile','public/index.production.html','src/server.mjs'];
const testFiles=(await readdir(path.join(root,'tests'))).filter(x=>/^partner-cost-sharing.*\.test\.mjs$/.test(x)).map(x=>'tests/'+x);
const scriptFiles=(await readdir(path.join(root,'scripts'))).filter(x=>/^partner-cost-sharing.*\.mjs$/.test(x)).map(x=>'scripts/'+x);
const files=[...moduleFiles,...adapters.map(x=>path.join(root,x)),...testFiles.map(x=>path.join(root,x)),...scriptFiles.map(x=>path.join(root,x)),...(await readdir(path.join(root,'supabase/migrations'))).filter(x=>/^\d{14}_partner_cost_sharing.*\.sql$/.test(x)).map(x=>path.join(root,'supabase/migrations',x))].sort();
const entries=[];
for(const f of files){const bytes=await readFile(f);if(/\.(pdf|zip|png|jpg|jpeg|env)$/i.test(f))throw Error('Private or binary source candidate prohibited');entries.push({path:path.relative(root,f),bytes:bytes.length,sha256:sha(bytes)});}
const shell=await readFile(path.join(root,'public/index.production.html'),'utf8');
if(!shell.includes('PartnerCostSharing?.handles')||!shell.includes('src="./assets/partner-cost-sharing"'))throw Error('Native module mount missing');
const ignore=await readFile(path.join(root,'.dockerignore'),'utf8'),docker=await readFile(path.join(root,'Dockerfile'),'utf8');
if(!ignore.includes('!public/partner-cost-sharing/**')||!docker.includes('public/partner-cost-sharing ./public/partner-cost-sharing'))throw Error('Isolated UI build context missing');
const original=execFileSync('git',['show','1024e30d6bbbc435d70ea2710d1def7e1cbc0b61:missionaccounts/.dockerignore'],{cwd:root,encoding:'utf8'});
if(ignore!==original+'!public/partner-cost-sharing/\n!public/partner-cost-sharing/**\n')throw Error('Unexpected build allowlist change');
const dirtyHash=sha(await readFile(path.join(root,'../supabase/.temp/cli-latest')));
if(dirtyHash!=='008368133cc42a3c2209c6e9dbf2612e56f28a1534b4c60383ec6403ea4d556f')throw Error('Pre-existing dirty state drift');
for(const f of files.filter(x=>/\.(mjs|js)$/.test(x)))execFileSync(process.execPath,['--check',f],{stdio:'pipe'});
console.log(JSON.stringify({mission:'PARTNER-COST-SHARING-20261004',base:'1024e30d6bbbc435d70ea2710d1def7e1cbc0b61',targetProject:'dwwsahpzblgrgducxtzw',productionMigrationFiles:['supabase/migrations/20261005012837_partner_cost_sharing_production_foundation.sql','supabase/migrations/20261005013002_partner_cost_sharing_production_review.sql'],retiredUnappliedSource:'supabase/migrations/20261004213308_partner_cost_sharing_private_ledger.sql',migrationApplied:false,imageBuilt:false,providersEnabled:false,moneyMoved:false,dirtyHash,manifestHash:sha(JSON.stringify(entries)),files:entries},null,2));
