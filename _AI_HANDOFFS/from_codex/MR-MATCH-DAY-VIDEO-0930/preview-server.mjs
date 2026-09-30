// Private test server. Bind loopback only; exact media allowlist; no production credentials.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
const here=path.dirname(new URL(import.meta.url).pathname),root=path.resolve(here,'../../..');
const media='/Users/brianb/.codex/media-custody/mr-match-day-0930/match-day-540p.mp4';
const headers={'Cache-Control':'no-store','X-Robots-Tag':'noindex, nofollow'};
http.createServer((req,res)=>{
 const route=new URL(req.url,'http://127.0.0.1:8774').pathname;
 const send=(type,body,status=200)=>{res.writeHead(status,{...headers,'Content-Type':type});res.end(body);};
 if(req.method==='POST'&&route==='/__evidence'){
  if(req.headers.origin!=='http://127.0.0.1:8774')return send('text/plain','Forbidden',403);
  let body='';req.on('data',c=>{body+=c;if(body.length>12000000)req.destroy();});
  req.on('end',()=>{try{const x=JSON.parse(body);if(!/^[a-z0-9-]+\.(json|png)$/.test(x.name))throw Error('name');const dir=path.join(here,'qa');fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,x.name),x.name.endsWith('.png')?Buffer.from(x.data,'base64'):JSON.stringify(x.data,null,2),{mode:0o600});send('text/plain','saved');}catch{send('text/plain','invalid',400);}});return;
 }
 if(route==='/'||route==='/baseline')return send('text/html',execFileSync('php',[path.join(here,'preview.php'),route==='/baseline'?'baseline':'candidate']));
 if(route==='/media.mp4'){
  const size=fs.statSync(media).size,range=req.headers.range?.match(/^bytes=(\d+)-(\d*)$/);
  if(req.headers.range&&!range)return send('text/plain','Invalid range',416);
  const start=range?+range[1]:0,end=range&&range[2]?Math.min(+range[2],size-1):size-1;
  if(start> end||start>=size){res.writeHead(416,{'Content-Range':`bytes */${size}`});return res.end();}
  res.writeHead(range?206:200,{...headers,'Content-Type':'video/mp4','Accept-Ranges':'bytes','Content-Length':end-start+1,...(range?{'Content-Range':`bytes ${start}-${end}/${size}`}:{})});
  return fs.createReadStream(media,{start,end}).pipe(res);
 }
 const hlsFile=route.match(/^\/00000000000000000000000000000000\/manifest\/(video\.m3u8|segment-\d{3}\.ts)$/);
 if(hlsFile){const p=path.join('/Users/brianb/.codex/media-custody/mr-match-day-0930/hls-preview',hlsFile[1]);return fs.existsSync(p)?send(hlsFile[1].endsWith('.ts')?'video/mp2t':'application/vnd.apple.mpegurl',fs.readFileSync(p)):send('text/plain','Not found',404);}
 const match=route.match(/^\/(baseline-assets|assets)\/([a-zA-Z0-9_./-]+)$/);
 if(match&&!match[2].split('/').includes('..')){
  const rel='wp-content/mu-plugins/missionmed-mr-alternate-assets/'+match[2],p=path.join(root,rel);
  if(!fs.existsSync(p))return send('text/plain','Not found',404);
  let data=match[1]==='baseline-assets'&&['alternate.css','alternate.js'].includes(match[2])?execFileSync('git',['-C',root,'show','b6490e47f2593504a57432b3f48ab2a9617bc2ca:'+rel]):fs.readFileSync(p);
  if(match[2]==='alternate.js')data=data.toString().replaceAll('https://customer-wiw9vmb43wmdkdp7.cloudflarestream.com','http://127.0.0.1:8774');
  const types={'.css':'text/css','.js':'text/javascript','.webp':'image/webp','.avif':'image/avif','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml'};
  return send(types[path.extname(p)]||'application/octet-stream',data);
 }
 return send('text/plain','Not found',404);
}).listen(8774,'127.0.0.1',()=>console.log('Private fixture: http://127.0.0.1:8774 (no public upload, no production change)'));
