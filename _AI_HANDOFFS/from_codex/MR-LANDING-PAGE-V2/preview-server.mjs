import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
const here=path.dirname(new URL(import.meta.url).pathname),root=path.resolve(here,'../../..');
http.createServer((req,res)=>{
 const u=new URL(req.url,'http://127.0.0.1:8776');
 const send=(type,body,status=200)=>{res.writeHead(status,{'Content-Type':type,'Cache-Control':'no-store','X-Robots-Tag':'noindex'});res.end(body)};
 if(req.method==='POST'&&u.pathname==='/__evidence'){
  if(req.headers.origin!=='http://127.0.0.1:8776')return send('text/plain','Forbidden',403);
  let b='';req.on('data',c=>{b+=c;if(b.length>25000000)req.destroy()});req.on('end',()=>{try{const x=JSON.parse(b);if(!/^[a-z0-9-]+\.(png|json)$/.test(x.name))throw Error();fs.writeFileSync(path.join(here,'qa',x.name),x.name.endsWith('.png')?Buffer.from(x.data,'base64'):JSON.stringify(x.data,null,2),{mode:0o600});send('text/plain','saved')}catch{send('text/plain','invalid',400)}});return;
 }
 if(u.pathname==='/')return send('text/html',execFileSync('php',[path.join(here,'../MR-MATRIX-ECOSYSTEM-0930/preview.php')]));
 const m=u.pathname.match(/^\/assets\/([a-zA-Z0-9_./-]+)$/);
 if(m&&!m[1].split('/').includes('..')){const p=path.join(root,'wp-content/mu-plugins/missionmed-mr-alternate-assets',m[1]);if(fs.existsSync(p))return send(({'.css':'text/css','.js':'text/javascript','.webp':'image/webp','.avif':'image/avif','.jpg':'image/jpeg','.png':'image/png'})[path.extname(p)]||'application/octet-stream',fs.readFileSync(p))}
 send('text/plain','Not found',404);
}).listen(8776,'127.0.0.1',()=>console.log('V2 local QA: http://127.0.0.1:8776'));
