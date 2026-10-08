import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../../../',import.meta.url));
const sha=value=>createHash('sha256').update(value).digest('hex');
// An uploaded, clean tracked artifact carries this receipt. Never infer its
// identity from Railway's linked Git branch or a caller-provided source label.
export function verifyQaRelease({env=process.env,base=root,read=readFileSync}={}){
  try{
    const raw=read(resolve(base,'ivprep-v6/release-identity.json'));
    const receipt=JSON.parse(raw);
    if(!/^[a-f0-9]{40}$/.test(receipt.source)||receipt.source!==env.IVOC_QA_SOURCE_SHA
      ||sha(raw)!==env.IVOC_QA_MANIFEST_SHA256||!Array.isArray(receipt.files)||receipt.files.length<10)return {ok:false};
    for(const {path,sha256} of receipt.files){
      if(typeof path!=='string'||path.startsWith('/')||path.split('/').includes('..')||!/^[a-f0-9]{64}$/.test(sha256))return {ok:false};
      if(sha(read(resolve(base,path)))!==sha256)return {ok:false};
    }
    return {ok:true,source:receipt.source,manifestSha256:sha(raw)};
  }catch{return {ok:false};}
}
