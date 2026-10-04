// Local acceptance runtime only. Reads current Timeline-owned source directly;
// no production identity, storage, applicant API, or MyERAS writes are exposed.
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve,extname} from 'node:path';
import {createLocalLayoutCritic} from './local-layout-critic.mjs';

const product=resolve(fileURLToPath(new URL('..',import.meta.url)));
const web=resolve(product,'web');
const mime={'.html':'text/html','.css':'text/css','.js':'text/javascript','.mjs':'text/javascript','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.woff2':'font/woff2','.pdf':'application/pdf','.pptx':'application/vnd.openxmlformats-officedocument.presentationml.presentation'};
const headers={'cache-control':'no-store','content-security-policy':"default-src 'self'; img-src 'self' blob: data:; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self'; font-src 'self' data:;"};

export function createLocalAcceptanceServer({critic=createLocalLayoutCritic()}={}){
  return createServer(async(req,res)=>{
    try{
      const url=new URL(req.url,'http://127.0.0.1');
      if(await critic.handler(req,res,url,headers))return;
      if(req.method!=='GET'){res.writeHead(405,headers);res.end();return;}
      if(url.pathname==='/'){res.writeHead(302,{...headers,location:'/web/index.html'});res.end();return;}
      const matrix=url.pathname.startsWith('/matrix/');
      if(!matrix&&!url.pathname.startsWith('/web/')){res.writeHead(404,headers);res.end('Local route unavailable');return;}
      const root=matrix?resolve(product,'matrix'):web;
      const rel=decodeURIComponent(url.pathname.slice(matrix?8:5));
      const target=resolve(root,rel);
      if(!target.startsWith(root+'/'))throw Error('LOCAL_PATH_INVALID');
      const bytes=await readFile(target).catch(error=>{
        if(!matrix&&/^(assets|vendor|presentation)\//.test(rel))return readFile(resolve(product,'dist',rel));
        throw error;
      });
      res.writeHead(200,{...headers,'content-type':mime[extname(target)]||'application/octet-stream'});res.end(bytes);
    }catch{
      res.writeHead(404,headers);res.end('Local route unavailable');
    }
  });
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  createLocalAcceptanceServer().listen(8906,'127.0.0.1',()=>console.log('Timeline local acceptance runtime: http://127.0.0.1:8906/web/index.html'));
}
