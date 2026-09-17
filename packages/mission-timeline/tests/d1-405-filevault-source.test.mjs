import assert from "node:assert/strict";
import test from "node:test";

import {
  FILE_VAULT_SOURCE_KIND,
  FILE_VAULT_SOURCE_UNAVAILABLE,
  createUnavailableFileVaultSourceAdapter,
  normalizeFileVaultSourceDocument,
  queryFileVaultSource,
  renderFileVaultSourceChooser,
  resolveFileVaultSourceAdapter,
  selectFileVaultSourceDocument
} from "../web/js/uxr-002/filevault-source.js";

test("D1-405 File Vault source fails closed without fabricating documents",async()=>{
  const adapter=createUnavailableFileVaultSourceAdapter();
  const model=await queryFileVaultSource(adapter);
  assert.equal(adapter.kind,FILE_VAULT_SOURCE_KIND);
  assert.equal(adapter.connected,false);
  assert.equal(model.status,"unavailable");
  assert.deepEqual(model.documents,[]);
  await assert.rejects(
    ()=>selectFileVaultSourceDocument(adapter,"invented"),
    (error)=>error.code===FILE_VAULT_SOURCE_UNAVAILABLE
  );
});

test("D1-405 File Vault source accepts only the explicit connected contract",()=>{
  assert.equal(resolveFileVaultSourceAdapter({connected:true}).connected,false);
  const candidate={
    kind:FILE_VAULT_SOURCE_KIND,
    connected:true,
    async listRecent(){return[];},
    async search(){return[];},
    async select(){return null;}
  };
  assert.equal(resolveFileVaultSourceAdapter(candidate),candidate);
});

test("D1-405 File Vault source normalizes metadata-only rows and searches through the adapter",async()=>{
  const calls=[];
  const adapter={
    kind:FILE_VAULT_SOURCE_KIND,
    connected:true,
    async listRecent(){
      calls.push(["recent"]);
      return[{id:"cv-1",name:"MyERAS.pdf",mimeType:"application/pdf",updatedAt:"Jul 29, 2026",content:"never expose"}];
    },
    async search(query){
      calls.push(["search",query]);
      return[{id:"cv-2",name:"CV.docx",fileType:"DOCX",updatedAt:"Jul 30, 2026",sizeBytes:4200}];
    },
    async select(id){
      calls.push(["select",id]);
      return{id,name:"CV.docx",fileType:"DOCX",updatedAt:"Jul 30, 2026"};
    }
  };
  const recent=await queryFileVaultSource(adapter);
  assert.equal(recent.status,"ready");
  assert.deepEqual(recent.documents[0],{
    id:"cv-1",
    name:"MyERAS.pdf",
    fileType:"application/pdf",
    updatedAt:"Jul 29, 2026",
    sizeBytes:null
  });
  assert.equal("content" in recent.documents[0],false);
  const search=await queryFileVaultSource(adapter,{query:"  CV  "});
  assert.equal(search.query,"CV");
  assert.equal(search.documents[0].name,"CV.docx");
  assert.equal((await selectFileVaultSourceDocument(adapter,"cv-2")).id,"cv-2");
  assert.deepEqual(calls,[["recent"],["search","CV"],["select","cv-2"]]);
});

test("D1-405 File Vault chooser is accessible, searchable, recent-first, and truthful",()=>{
  const html=renderFileVaultSourceChooser({
    status:"unavailable",
    query:"",
    documents:[],
    message:"File Vault is not connected in this local candidate."
  });
  assert.match(html,/role="dialog" aria-modal="true" aria-labelledby="fileVaultSourceTitle"/);
  assert.match(html,/Search File Vault/);
  assert.match(html,/Recent documents/);
  assert.match(html,/Timeline Builder will read the document, suggest likely timeline entries, and wait for you to review every suggestion/);
  assert.match(html,/File Vault isn’t connected here yet\./);
  assert.match(html,/Local preview · no files fabricated/);
  assert.doesNotMatch(html,/MyERAS\.pdf|CV\.docx/);
  assert.equal(normalizeFileVaultSourceDocument({id:"",name:"bad"}),null);
});
