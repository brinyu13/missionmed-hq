import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
const here=path.dirname(new URL(import.meta.url).pathname), root=path.resolve(here,'../../..');
http.createServer((req,res)=>{
 const url=new URL(req.url,'http://127.0.0.1:8775');
 const send=(type,body,status=200)=>{res.writeHead(status,{'Content-Type':type,'Cache-Control':'no-store','X-Robots-Tag':'noindex'});res.end(body)};
 if(req.method==='POST'&&url.pathname==='/__evidence'){
  if(req.headers.origin!=='http://127.0.0.1:8775')return send('text/plain','Forbidden',403);
  let body='';req.on('data',c=>{body+=c;if(body.length>15000000)req.destroy()});req.on('end',()=>{try{const x=JSON.parse(body);if(!/^[a-z0-9-]+\.(png|json)$/.test(x.name))throw Error();fs.mkdirSync(path.join(here,'qa'),{recursive:true});fs.writeFileSync(path.join(here,'qa',x.name),x.name.endsWith('.png')?Buffer.from(x.data,'base64'):JSON.stringify(x.data,null,2),{mode:0o600});send('text/plain','saved')}catch{send('text/plain','invalid',400)}});return;
 }
 if(url.pathname==='/')return send('text/html',execFileSync('php',[path.join(here,'preview.php')]));
 const match=url.pathname.match(/^\/assets\/([a-zA-Z0-9_./-]+)$/);
 if(match&&!match[1].split('/').includes('..')){const p=path.join(root,'wp-content/mu-plugins/missionmed-mr-alternate-assets',match[1]);if(fs.existsSync(p))return send(({'.css':'text/css','.js':'text/javascript','.webp':'image/webp','.avif':'image/avif','.jpg':'image/jpeg','.jpeg':'image/jpeg','.png':'image/png','.svg':'image/svg+xml'})[path.extname(p)]||'application/octet-stream',fs.readFileSync(p))}
 send('text/plain','Not found',404);
}).listen(8775,'127.0.0.1',()=>console.log('Ecosystem preview: http://127.0.0.1:8775'));
