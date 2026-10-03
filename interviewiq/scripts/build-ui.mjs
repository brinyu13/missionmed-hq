import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import crypto from 'node:crypto';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const names=['runtime','model','views','shell','roles','actions','opening'];
const chunks=await Promise.all(names.map(n=>fs.readFile(path.join(root,'public/source',n+'.js'),'utf8')));
await fs.writeFile(path.join(root,'public/app.js'),chunks.join('\n\n')+'\nvoid boot();\n');
const assets={};for(const n of ['index.html','styles.css','app.js']){const b=await fs.readFile(path.join(root,'public',n));assets[n]=crypto.createHash('sha256').update(b).digest('hex');}
await fs.writeFile(path.join(root,'public/release-manifest.json'),JSON.stringify({approvedPrototypeSha256:'9c6db6695507a9e6d300f01ced31150c380f2bc8d951f148139f5bb7df5d9718',assets},null,2)+'\n');
console.log(JSON.stringify({status:'BUILT',assets}));
