import assert from 'node:assert/strict';
import {test} from 'node:test';
import {mkdtemp,readFile,writeFile,mkdir,copyFile,rm,symlink,unlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {createHash} from 'node:crypto';
const source=fileURLToPath(new URL('../../',import.meta.url)),sha=b=>createHash('sha256').update(b).digest('hex');
test('viewer modules use the existing authenticated manifest handler without expanding the public exception',async()=>{
 const root=await mkdtemp(join(tmpdir(),'iiq-private-assets-'));let server;
 try{
  const infra=join(root,'infra/wordpress'),tests=join(root,'tests/wordpress');await mkdir(infra,{recursive:true});await mkdir(tests,{recursive:true});
  for(const file of ['missionmed-interviewiq-route.php','missionmed-interviewiq-sso.php'])await copyFile(join(source,'infra/wordpress',file),join(infra,file));
  for(const file of ['auth-gateway.test.php','http-fixture.php'])await copyFile(join(source,'tests/wordpress',file),join(tests,file));
  const fixture=join(tests,'http-fixture.php');let code=await readFile(fixture,'utf8');
  code=code.replace("$path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);","if (isset($_SERVER['HTTP_X_FIXTURE_INELIGIBLE'])) { $GLOBALS['courses'][42]=array(); $GLOBALS['grants'][42]=array(); }\n$path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);");
  await writeFile(fixture,code.replace('mmiiqg_handle();','mmiiqg_immutable_assets();\nmmiiqg_handle();'));
  const id='a'.repeat(64),release=join(infra,'missionmed-interviewiq-runtime/releases',id);await mkdir(release,{recursive:true});
  const modules=['itinerary-pdf.mjs','itinerary-worker.mjs','itinerary-fonts.mjs'];
  const assets={'index.html':'<html><head></head><body>private shell</body></html>','app.js':'console.log("public record-free fixture");','styles.css':'body{color:white}',...Object.fromEntries(modules.map((name,i)=>[name,`export const synthetic=${i};`]))};
  for(const [name,body] of Object.entries(assets))await writeFile(join(release,name),body);
  const entries=Object.entries(assets).map(([n,b])=>`'${n}'=>array('sha256'=>'${sha(b)}','bytes'=>${Buffer.byteLength(b)})`).join(',');
  await writeFile(join(release,'release.php'),`<?php return array('schema'=>'missionmed.interviewiq.release.v1','release_id'=>'${id}','assets'=>array(${entries}));`);
  await symlink('releases/'+id,join(infra,'missionmed-interviewiq-runtime/current'));
  const reservation=createServer();await new Promise(r=>reservation.listen(0,'127.0.0.1',r));const port=reservation.address().port;await new Promise(r=>reservation.close(r));
  server=spawn(process.env.IIQ_PHP_BIN||'php',['-S',`127.0.0.1:${port}`,fixture],{stdio:['ignore','ignore','pipe']});let diagnostics='';server.stderr.on('data',b=>diagnostics+=b);
  const origin=`http://127.0.0.1:${port}`;for(let n=0;;n++){try{await fetch(origin);break;}catch{if(n===50)throw Error(diagnostics);await new Promise(r=>setTimeout(r,20));}}
  for(const name of modules){
   const url=`${origin}/interviewiq/releases/${id}/${name}`;
   for(const role of ['student','admin'])for(const method of ['GET','HEAD']){const response=await fetch(url,{method,headers:{'X-Fixture-Role':role}});assert.equal(response.status,200,role+' '+method+' '+name);assert.equal(response.headers.get('content-type'),'text/javascript; charset=utf-8');assert.match(response.headers.get('cache-control'),/private.*no-store/);assert.equal(response.headers.get('x-interviewiq-release'),id);assert.equal(Number(response.headers.get('content-length')),Buffer.byteLength(assets[name]));assert.equal(await response.text(),method==='HEAD'?'':assets[name]);}
   const anonymous=await fetch(url,{headers:{'X-Fixture-Anonymous':'1'},redirect:'manual'});assert.equal(anonymous.status,302);assert.match(anonymous.headers.get('location'),/my-account/);assert.match(anonymous.headers.get('cache-control'),/no-store/);
   const denied=await fetch(url,{headers:{'X-Fixture-Ineligible':'1'},redirect:'manual'});assert.equal(denied.status,403);assert.match(denied.headers.get('cache-control'),/no-store/);assert.doesNotMatch(await denied.text(),/export const/);
  }
  const publicApp=await fetch(`${origin}/interviewiq/releases/${id}/app`,{headers:{'X-Fixture-Anonymous':'1'}});assert.equal(publicApp.status,200);assert.match(publicApp.headers.get('cache-control'),/^public/);
  for(const name of ['unlisted.mjs','release.php','../itinerary-pdf.mjs','%2e%2e/itinerary-pdf.mjs']){const response=await fetch(`${origin}/interviewiq/releases/${id}/${name}`,{redirect:'manual'});assert.notEqual(response.status,200,name);assert.match(response.headers.get('cache-control'),/no-store/);}
  const module=join(release,modules[0]);await writeFile(module,assets[modules[0]].replace('0','9'));const hashMismatch=await fetch(`${origin}/interviewiq/releases/${id}/${modules[0]}`);assert.equal(hashMismatch.status,503);assert.match(hashMismatch.headers.get('cache-control'),/no-store/);
  await writeFile(module,'different-size');assert.equal((await fetch(`${origin}/interviewiq/releases/${id}/${modules[0]}`)).status,503);
  await unlink(module);const outside=join(root,'outside.mjs');await writeFile(outside,assets[modules[0]]);await symlink(outside,module);assert.equal((await fetch(`${origin}/interviewiq/releases/${id}/${modules[0]}`)).status,503);
 }finally{if(server&&server.exitCode===null){const done=new Promise(r=>server.once('exit',r));server.kill();await done;}await rm(root,{recursive:true,force:true});}
});
