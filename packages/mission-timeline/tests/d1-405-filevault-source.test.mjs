import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import test from "node:test";

import {
  FILE_VAULT_SMART_FILL_MAX_BYTES,
  FILE_VAULT_SOURCE_KIND,
  FILE_VAULT_SOURCE_UNAVAILABLE,
  createAuthenticatedFileVaultSourceAdapter,
  createUnavailableFileVaultSourceAdapter,
  normalizeFileVaultSourceDocument,
  queryFileVaultSource,
  readFileVaultSourceSelection,
  renderFileVaultSourceChooser,
  resolveFileVaultSourceAdapter,
  selectFileVaultSourceDocument
} from "../web/js/uxr-002/filevault-source.js";

const plugin=await readFile(new URL("../../../wp-content/plugins/missionmed-timeline-sso/missionmed-timeline-sso.php",import.meta.url),"utf8");

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
    provider:"missionmed-filevault-v1",
    documentType:"other",
    versionId:"",
    mimeType:"application/pdf",
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

test("D1-405 authenticated adapter uses only the bounded source routes",async()=>{
  const calls=[];
  const id="11111111-1111-4111-8111-111111111111";
  const adapter=createAuthenticatedFileVaultSourceAdapter({request:async(suffix)=>{
    calls.push(suffix);
    return suffix.startsWith("/")
      ?{document:{id,name:"CV.pdf",provider:"missionmed-filevault-v1",documentType:"cv",versionId:"22222222-2222-4222-8222-222222222222"}}
      :{documents:[{id,name:"CV.pdf"}]};
  }});
  assert.equal(adapter.connected,true);
  assert.equal(adapter.provider,"missionmed-filevault-v1");
  assert.equal((await adapter.listRecent()).length,1);
  assert.equal((await adapter.search(" my cv ")).length,1);
  assert.equal((await adapter.select(id)).versionId,"22222222-2222-4222-8222-222222222222");
  await assert.rejects(()=>adapter.select("not-a-vault-id"),(error)=>error.code===FILE_VAULT_SOURCE_UNAVAILABLE);
  assert.deepEqual(calls,["","?query=my%20cv",`/${id}`]);
});

test("D1-405 authenticated adapter performs an exact-version one-use ingestion without exposing a signed URL",async()=>{
  const calls=[];
  const id="11111111-1111-4111-8111-111111111111";
  const versionId="22222222-2222-4222-8222-222222222222";
  const contentBase64=Buffer.from("bounded cv bytes").toString("base64");
  const adapter=createAuthenticatedFileVaultSourceAdapter({request:async(suffix,options={})=>{
    calls.push([suffix,options]);
    return{
      document:{id,name:"CV.pdf",provider:"missionmed-filevault-v1",documentType:"cv",versionId,mimeType:"application/pdf"},
      source:{objectId:"object_filevault_12345678",sha256:"a".repeat(64),mimeType:"application/pdf"},
      contentBase64
    };
  }});
  const selected=await selectFileVaultSourceDocument(adapter,id,{timelineDocumentId:"timeline_filevault_1",versionId});
  assert.equal(selected.file.name,"CV.pdf");
  assert.equal(selected.file.timelineSourceObject.objectId,"object_filevault_12345678");
  assert.equal(await selected.file.text(),"bounded cv bytes");
  assert.deepEqual(calls,[[`/${id}/ingestions`,{method:"POST",body:{timelineDocumentId:"timeline_filevault_1",versionId}}]]);
  assert.equal(JSON.stringify(selected).includes("signed"),false);
});

test("D1-405 Timeline gateway is read-only, nonce-bound, entitled, and owner-filtered",()=>{
  assert.match(plugin,/MMTL_REST_FILEVAULT_SOURCES_ROUTE = '\/file-vault\/sources'/);
  assert.match(plugin,/function mmtl_filevault_source_permission/);
  assert.match(plugin,/wp_verify_nonce\(\$nonce, 'wp_rest'\)/);
  assert.match(plugin,/mmtl_access_state\(\$user\)/);
  assert.match(plugin,/mmtl_principal_for_user\(\(int\) \$user->ID\)/);
  assert.match(plugin,/rest_do_request\(\$request\)/);
  assert.match(plugin,/absint\(\$record\['owner_id'\] \?\? 0\) !== absint\(\$owner_id\)/);
  assert.match(plugin,/provider' => 'missionmed-filevault-v1'/);
  assert.match(plugin,/current_version_id/);
  assert.match(plugin,/upload_confirmed/);
  assert.match(plugin,/\$upstream\['file'\] \?\? \$upstream/);
  assert.match(plugin,/\$detail\['file'\] \?\? \$detail/);
  assert.match(plugin,/File Vault is temporarily unavailable\. You can still upload a CV from this device\./);
  assert.match(plugin,/function mmtl_filevault_ingestion_endpoint/);
  assert.match(plugin,/X-File-Vault-Version/);
  assert.match(plugin,/const MMTL_FILEVAULT_SMART_FILL_MAX_BYTES = 20 \* 1024 \* 1024;/);
  assert.match(plugin,/limit_response_size' => MMTL_FILEVAULT_SMART_FILL_MAX_BYTES \+ 1/);
  assert.match(plugin,/function mmtl_filevault_source_smart_fill_ready/);
  assert.match(plugin,/mmtl_filevault_source_descriptor\(\$record, \$owner_id, true\)/);
  assert.match(plugin,/'byteSize' => \$byte_size,/);
  assert.match(plugin,/contentBase64' => base64_encode\(\$bytes\)/);
  const descriptor=plugin.match(/function mmtl_filevault_source_descriptor[\s\S]*?\n}/)?.[0]||"";
  assert.doesNotMatch(descriptor,/r2_key|signed|url|contents|note_to_advisor/);
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

const VAULT_ID="11111111-1111-4111-8111-111111111111";
const VERSION_ID="22222222-2222-4222-8222-222222222222";

function ingestionAdapter({bytes,mimeType="application/pdf",byteSize}={}){
  const body=bytes??Buffer.from("bounded cv bytes");
  return createAuthenticatedFileVaultSourceAdapter({request:async()=>({
    document:{id:VAULT_ID,name:"CV.pdf",provider:"missionmed-filevault-v1",documentType:"cv",versionId:VERSION_ID,mimeType},
    source:{objectId:"object_filevault_12345678",sha256:"a".repeat(64),mimeType,...(byteSize===undefined?{}:{byteSize})},
    contentBase64:Buffer.from(body).toString("base64")
  })});
}

test("D1-405 File Vault import decodes large payloads without a character-at-a-time main-thread pass",async()=>{
  const bytes=Buffer.alloc(1024*1024+7);
  for(let index=0;index<bytes.length;index+=1)bytes[index]=index%251;
  const selected=await selectFileVaultSourceDocument(ingestionAdapter({bytes,byteSize:bytes.length}),VAULT_ID,{
    timelineDocumentId:"timeline_filevault_1",versionId:VERSION_ID
  });
  const decoded=new Uint8Array(await selected.file.arrayBuffer());
  assert.equal(decoded.byteLength,bytes.length);
  assert.equal(Buffer.compare(Buffer.from(decoded),bytes),0);

  // Browsers without the native base64 decoder take the chunked path, which must agree byte for byte.
  const native=Uint8Array.fromBase64;
  delete Uint8Array.fromBase64;
  try{
    const fallback=await selectFileVaultSourceDocument(ingestionAdapter({bytes,byteSize:bytes.length}),VAULT_ID,{
      timelineDocumentId:"timeline_filevault_1",versionId:VERSION_ID
    });
    assert.equal(Buffer.compare(Buffer.from(new Uint8Array(await fallback.file.arrayBuffer())),bytes),0);
  }finally{
    if(native)Uint8Array.fromBase64=native;
  }
});

test("D1-405 File Vault import refuses a payload Smart Fill would reject instead of reporting success",async()=>{
  await assert.rejects(
    ()=>selectFileVaultSourceDocument(ingestionAdapter({mimeType:"image/png"}),VAULT_ID,{timelineDocumentId:"t_1",versionId:VERSION_ID}),
    (error)=>error.code===FILE_VAULT_SOURCE_UNAVAILABLE&&/PDF and DOCX/.test(error.message)
  );
  await assert.rejects(
    ()=>selectFileVaultSourceDocument(ingestionAdapter({byteSize:999}),VAULT_ID,{timelineDocumentId:"t_1",versionId:VERSION_ID}),
    (error)=>error.code===FILE_VAULT_SOURCE_UNAVAILABLE
  );
  assert.equal(FILE_VAULT_SMART_FILL_MAX_BYTES,20*1024*1024);
});

test("D1-405 File Vault chooser carries the version it already listed so selection costs one round trip",()=>{
  const html=renderFileVaultSourceChooser({
    status:"ready",
    query:"",
    documents:[normalizeFileVaultSourceDocument({id:VAULT_ID,name:"CV.pdf",versionId:VERSION_ID,mimeType:"application/pdf"})],
    message:"Choose one document to continue."
  });
  assert.match(html,new RegExp(`value="${VAULT_ID}" data-file-vault-version="${VERSION_ID}"`));
  const radio={value:VAULT_ID,dataset:{fileVaultVersion:VERSION_ID}};
  assert.deepEqual(
    readFileVaultSourceSelection({querySelector:(selector)=>selector.includes(":checked")?radio:null}),
    {documentId:VAULT_ID,versionId:VERSION_ID}
  );
  assert.equal(readFileVaultSourceSelection({querySelector:()=>null}),null);
});
