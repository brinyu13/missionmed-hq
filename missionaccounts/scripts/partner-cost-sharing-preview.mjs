import { createMissionAccountsServer } from '../src/server.mjs';
import { PreviewStore } from '../src/storage/supabase-rest.mjs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createHash } from 'node:crypto';
import { RECOVERED_EXPENSES } from '../src/partner-cost-sharing/recovered-data.mjs';
import { PartnerLedger } from '../src/partner-cost-sharing/ledger.mjs';
import { LocalPartnerStore } from '../src/partner-cost-sharing/store.mjs';
import { buildAccountingReview } from '../src/partner-cost-sharing/accounting-review.mjs';

// This harness is loopback-only, has no provider credentials, and is never copied into the production image.
if (process.env.NODE_ENV === 'production') throw new Error('Partner prototype cannot run in production');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const donor = '/Users/brianb/MissionMed_worktrees/partner-cost-dashboard-recovery/output/handoff/MissionMed-Myaccounts-Partner-Cost-Full-Handoff-2026-10-04';
const config = { production: false, localAuth: true, basePath: '/missionaccounts/', features: {}, stripeMode: 'disabled',
  partnerCostSharing: { enabled: true, prototype: true, privateInvoiceDirectory: path.join(donor, '05-invoices/originals') } };
const reviewFile=path.join(root,'evidence/PARTNER-COST-SHARING-20261004/_CACHE/accounting-review.json');
try{config.partnerCostSharing.accountingReview=buildAccountingReview(JSON.parse(await readFile(reviewFile,'utf8')));}catch(error){if(error.code!=='ENOENT')throw error;}
const previewDirectory = await mkdtemp(path.join(tmpdir(), 'pcs-private-previews-'));
config.partnerCostSharing.privatePreviews = {};
config.partnerCostSharing.accountingAssets = {};
for(const row of config.partnerCostSharing.accountingReview?.rows||[]){
 if(!row.originalSha256)continue;
 if(row.vendor!=='Kinsta'||!/^\d{14}$/.test(row.invoiceNumber))throw new Error('Unsupported private review original identity');
 const original=path.join(path.dirname(reviewFile),'originals','kinsta_'+row.invoiceNumber+'.pdf');
 const bytes=await readFile(original);
 if(createHash('sha256').update(bytes).digest('hex')!==row.originalSha256)throw new Error('Private review original custody mismatch');
 const output=path.join(previewDirectory,row.id);
 await promisify(execFile)('pdftoppm',['-f','1','-singlefile','-scale-to','1600','-png',original,output]);
 config.partnerCostSharing.accountingAssets[row.id]={file:original,previewFile:output+'.png',sha256:row.originalSha256,previewSha256:createHash('sha256').update(await readFile(output+'.png')).digest('hex')};
}
for (const row of RECOVERED_EXPENSES.filter(row => row.type === 'pdf')) {
  const original = path.join(config.partnerCostSharing.privateInvoiceDirectory, row.file);
  const hash = bytes => createHash('sha256').update(bytes).digest('hex');
  if (hash(await readFile(original)) !== row.sha256) throw new Error('Invoice source custody mismatch');
  const output = path.join(previewDirectory, row.id);
  await promisify(execFile)('pdftoppm', ['-f', '1', '-singlefile', '-scale-to', '1600', '-png', original, output]);
  config.partnerCostSharing.privatePreviews[row.id] = { file: `${output}.png`, sha256: hash(await readFile(`${output}.png`)) };
}
const server = createMissionAccountsServer({ config, store: new PreviewStore(), partnerStore:new LocalPartnerStore(new PartnerLedger()), publicDir: path.join(root, 'public') });
const hostHandler = server.listeners('request')[0];
server.removeListener('request', hostHandler);
server.on('request', (request, response) => {
  // Synthetic founder shell lens is an infrastructure preview only; partner ownership is separately projected by its router.
  request.headers['x-missionaccounts-local-role'] = 'founder';
  if (['/', '/missionaccounts', '/missionaccounts/'].includes(request.url?.split('?')[0])) request.url = '/index.production.html';
  hostHandler(request, response);
});
server.listen(4184, '127.0.0.1', () => console.log('Native Partner Cost Sharing prototype: http://127.0.0.1:4184/missionaccounts/#/home (local review; synthetic access; no money movement)'));

let closing=false;const cleanup=async()=>{if(closing)return;closing=true;await new Promise(resolve=>server.close(resolve));await rm(previewDirectory,{recursive:true,force:true});};
for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>cleanup().then(()=>process.exit(0)));
