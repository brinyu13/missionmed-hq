import assert from 'node:assert/strict';
import {test} from 'node:test';
import {mkdtemp,readFile,writeFile,mkdir,copyFile,rm,symlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {createHash} from 'node:crypto';
const source=fileURLToPath(new URL('../../',import.meta.url)),sha=b=>createHash('sha256').update(b).digest('hex');
test('immutable code bypasses heavy bootstrap only for verified public assets; all private paths stay protected',async()=>{
 const root=await mkdtemp(join(tmpdir(),'iiq-assets-'));let server;
 try{
  const infra=join(root,'infra/wordpress'),tests=join(root,'tests/wordpress');await mkdir(infra,{recursive:true});await mkdir(tests,{recursive:true});
  for(const file of ['missionmed-interviewiq-route.php','missionmed-interviewiq-sso.php'])await copyFile(join(source,'infra/wordpress',file),join(infra,file));
  for(const file of ['auth-gateway.test.php','http-fixture.php'])await copyFile(join(source,'tests/wordpress',file),join(tests,file));
  const fixture=join(tests,'http-fixture.php');await writeFile(fixture,(await readFile(fixture,'utf8')).replace('mmiiqg_handle();','mmiiqg_immutable_assets();\nmmiiqg_handle();'));
  const id='a'.repeat(64),release=join(infra,'missionmed-interviewiq-runtime/releases',id);await mkdir(release,{recursive:true});
  const assets={'index.html':'<html><head></head><body>private shell</body></html>','app.js':'console.log("record-free fixture");','styles.css':'body{color:white}'};
  for(const [name,body] of Object.entries(assets))await writeFile(join(release,name),body);
  const entries=Object.entries(assets).map(([n,b])=>`'${n}'=>array('sha256'=>'${sha(b)}','bytes'=>${Buffer.byteLength(b)})`).join(',');
  await writeFile(join(release,'release.php'),`<?php return array('schema'=>'missionmed.interviewiq.release.v1','release_id'=>'${id}','assets'=>array(${entries}));`);
  await symlink('releases/'+id,join(infra,'missionmed-interviewiq-runtime/current'));
  const portServer=createServer();await new Promise(r=>portServer.listen(0,'127.0.0.1',r));const port=portServer.address().port;await new Promise(r=>portServer.close(r));
  server=spawn(process.env.IIQ_PHP_BIN||'php',['-S',`127.0.0.1:${port}`,fixture],{stdio:['ignore','ignore','pipe']});let diagnostics='';server.stderr.on('data',b=>diagnostics+=b);
  const origin=`http://127.0.0.1:${port}`,headers={'X-Fixture-Anonymous':'1'};
  for(let n=0;;n++){try{await fetch(origin);break;}catch(e){if(n===50)throw Error(diagnostics);await new Promise(r=>setTimeout(r,20));}}
  for(const [alias,name] of [['app','app.js'],['styles','styles.css'],['app.js','app.js'],['styles.css','styles.css']]){
   const r=await fetch(`${origin}/interviewiq/releases/${id}/${alias}`,{headers});assert.equal(r.status,200);assert.equal(await r.text(),assets[name]);assert.equal(r.headers.get('cache-control'),'public, max-age=31536000, immutable');assert.equal(r.headers.get('x-content-type-options'),'nosniff');assert.equal(r.headers.get('cross-origin-resource-policy'),'same-origin');assert.equal(r.headers.get('set-cookie'),null);
   const head=await fetch(`${origin}/interviewiq/releases/${id}/${alias}`,{method:'HEAD',headers});assert.equal(head.status,200);assert.equal(await head.text(),'');assert.equal(Number(head.headers.get('content-length')),Buffer.byteLength(assets[name]));
  }
  for(const path of ['/interviewiq/','/interviewiq/app.js',`/interviewiq/releases/${id}/index.html`,`/interviewiq/releases/${id}/release.php`,`/interviewiq/releases/${id}/app?x=1`]){const r=await fetch(origin+path,{headers,redirect:'manual'});assert.equal(r.status,302,path);assert.match(r.headers.get('cache-control'),/private.*no-store/);}
  const html=await fetch(origin+'/interviewiq/');assert.equal(html.status,200);assert.match(html.headers.get('cache-control'),/private.*no-store/);const body=await html.text();assert.match(body,/<meta name="iiq-session-nonce" content="[A-Za-z0-9_-]+">/);assert.equal(Number(html.headers.get('content-length')),Buffer.byteLength(body));assert.equal(await readFile(join(release,'index.html'),'utf8'),assets['index.html']);
  for(const method of ['POST','PUT']){const r=await fetch(`${origin}/interviewiq/releases/${id}/app`,{method,headers,redirect:'manual'});assert.equal(r.status,405);assert.match(r.headers.get('cache-control'),/no-store/);}
  const privateApi=await fetch(origin+'/interviewiq/api/bootstrap?view=calendar',{headers,redirect:'manual'});assert.equal(privateApi.status,401);assert.match(privateApi.headers.get('cache-control'),/no-store/);
  const missing=await fetch(`${origin}/interviewiq/releases/${'b'.repeat(64)}/app`,{headers});assert.equal(missing.status,503);assert.match(missing.headers.get('cache-control'),/no-store/);
  const disabled=await fetch(`${origin}/interviewiq/releases/${id}/app`,{headers:{...headers,'X-Fixture-Disabled':'1'}});assert.equal(disabled.status,503);
  await writeFile(join(release,'app.js'),'tampered');const tampered=await fetch(`${origin}/interviewiq/releases/${id}/app`,{headers});assert.equal(tampered.status,503);assert.match(tampered.headers.get('cache-control'),/no-store/);
 }finally{if(server&&server.exitCode===null){const done=new Promise(r=>server.once('exit',r));server.kill();await done;}await rm(root,{recursive:true,force:true});}
});
