const SOURCE_KIND="missionmed-filevault-source";
const UNAVAILABLE_CODE="FILE_VAULT_SOURCE_UNAVAILABLE";
const UUID_PATTERN=/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
// Smart Fill is bounded by the bundled browser parser, not by the 25MB SOURCE custody
// ceiling: anything between the two used to ingest and then fail on the review screen.
const SMART_FILL_MAX_BYTES=20*1024*1024;
const SMART_FILL_MIME=new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
]);
// base64 quanta are four characters wide, so chunking on a multiple of four never splits one.
const BASE64_CHUNK_CHARS=0x10000;

function decodeBase64ToBytes(encoded){
  const normalized=String(encoded||"");
  // Runtimes that ship the native decoder skip the interpreted pass entirely, which is
  // where the real win is. The chunked fallback avoids holding one 20MB binary string
  // beside the base64 source; measured against a flat per-character loop on Node 24 it is
  // marginally slower and not measurably lighter, so treat it as equivalent, not faster.
  if(typeof Uint8Array.fromBase64==="function"){
    try{return Uint8Array.fromBase64(normalized);}catch{/* fall through to the portable path */}
  }
  const bytes=new Uint8Array(Math.ceil(normalized.length/4)*3);
  let written=0;
  for(let offset=0;offset<normalized.length;offset+=BASE64_CHUNK_CHARS){
    const chunk=atob(normalized.slice(offset,offset+BASE64_CHUNK_CHARS));
    for(let index=0;index<chunk.length;index+=1)bytes[written+index]=chunk.charCodeAt(index);
    written+=chunk.length;
  }
  return written===bytes.length?bytes:bytes.subarray(0,written);
}

function escapeHtml(value){
  return String(value??"")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

function stableUnavailableError(reason){
  const error=new Error(reason||"File Vault is not connected in this local candidate.");
  error.code=UNAVAILABLE_CODE;
  return error;
}

export function createUnavailableFileVaultSourceAdapter({
  reason="File Vault is not connected in this local candidate."
}={}){
  return Object.freeze({
    kind:SOURCE_KIND,
    connected:false,
    reason,
    async listRecent(){return[];},
    async search(){return[];},
    async select(){throw stableUnavailableError(reason);}
  });
}

export function resolveFileVaultSourceAdapter(candidate){
  if(
    candidate?.kind===SOURCE_KIND &&
    candidate.connected===true &&
    typeof candidate.listRecent==="function" &&
    typeof candidate.search==="function" &&
    typeof candidate.select==="function"
  ){
    return candidate;
  }
  return createUnavailableFileVaultSourceAdapter();
}

export function createAuthenticatedFileVaultSourceAdapter({request}={}){
  if(typeof request!=="function")return createUnavailableFileVaultSourceAdapter();
  const load=async(query="")=>{
    const normalized=String(query||"").trim();
    const payload=await request(normalized?`?query=${encodeURIComponent(normalized)}`:"");
    return Array.isArray(payload?.documents)?payload.documents:[];
  };
  return Object.freeze({
    kind:SOURCE_KIND,
    connected:true,
    provider:"missionmed-filevault-v2",
    async listRecent(){return load();},
    async search(query){return load(query);},
    async select(documentId,{timelineDocumentId,versionId}={}){
      const id=String(documentId||"").trim();
      if(!/^[1-9][0-9]{0,18}$/.test(id)){
        throw stableUnavailableError("That File Vault document is not available.");
      }
      if(timelineDocumentId&&versionId){
        const requestedVersion=String(versionId||"");
        if(!UUID_PATTERN.test(requestedVersion)){
          throw stableUnavailableError("That File Vault document version is not available.");
        }
        const payload=await request(`/${encodeURIComponent(id)}/ingestions`,{
          method:"POST",body:{timelineDocumentId:String(timelineDocumentId),versionId:requestedVersion}
        });
        const document=payload?.document||null;
        const source=payload?.source||null;
        const encoded=String(payload?.contentBase64||"");
        if(!document||!source?.objectId||!encoded)throw stableUnavailableError("Timeline could not safely import that File Vault document.");
        const returnedVersion=String(document.versionId||"");
        if(!UUID_PATTERN.test(returnedVersion)||returnedVersion!==requestedVersion){
          throw stableUnavailableError("Timeline could not safely import that File Vault document version.");
        }
        const mimeType=String(document.mimeType||source.mimeType||"");
        if(!SMART_FILL_MIME.has(mimeType))throw stableUnavailableError("Smart Fill reads PDF and DOCX documents only.");
        const bytes=decodeBase64ToBytes(encoded);
        const declared=Number(source.byteSize);
        if(!bytes.byteLength||(Number.isFinite(declared)&&declared>0&&bytes.byteLength!==declared)){
          throw stableUnavailableError("Timeline could not safely import that File Vault document.");
        }
        if(bytes.byteLength>SMART_FILL_MAX_BYTES){
          throw stableUnavailableError(`Smart Fill reads documents up to ${Math.round(SMART_FILL_MAX_BYTES/1024/1024)} MB.`);
        }
        const file=new File([bytes],String(document.name||"MissionMed document"),{
          type:mimeType,lastModified:Date.parse(String(document.updatedAt||""))||Date.now()
        });
        Object.defineProperty(file,"timelineSourceObject",{value:Object.freeze({...source,provider:"missionmed-filevault-v2",vaultFileId:id,versionId:returnedVersion}),enumerable:false});
        return{...document,file,source:file.timelineSourceObject};
      }
      const payload=await request(`/${encodeURIComponent(id)}`);
      return payload?.document||null;
    }
  });
}

export function normalizeFileVaultSourceDocument(record){
  const id=String(record?.id||"").trim();
  const name=String(record?.name||"").trim();
  if(!id||!name)return null;
  return Object.freeze({
    id,
    name,
    provider:String(record?.provider||"missionmed-filevault-v2"),
    documentType:String(record?.documentType||"other"),
    versionId:String(record?.versionId||""),
    mimeType:String(record?.mimeType||""),
    fileType:String(record?.fileType||record?.mimeType||record?.documentType||"Document"),
    updatedAt:String(record?.updatedAt||""),
    sizeBytes:Number.isFinite(Number(record?.sizeBytes))
      ?Math.max(0,Number(record.sizeBytes))
      :null
  });
}

export async function queryFileVaultSource(adapter,{query=""}={}){
  const source=resolveFileVaultSourceAdapter(adapter);
  const normalizedQuery=String(query||"").trim();
  if(!source.connected){
    return Object.freeze({
      status:"unavailable",
      query:normalizedQuery,
      documents:[],
      message:String(source.reason||"File Vault is unavailable.")
    });
  }
  const records=normalizedQuery
    ?await source.search(normalizedQuery)
    :await source.listRecent();
  const documents=(Array.isArray(records)?records:[])
    .map(normalizeFileVaultSourceDocument)
    .filter(Boolean)
    .slice(0,20);
  return Object.freeze({
    status:documents.length?"ready":"empty",
    query:normalizedQuery,
    documents,
    message:documents.length
      ?"Choose one document to continue."
      :(normalizedQuery?"No matching documents.":"No recent documents.")
  });
}

export async function selectFileVaultSourceDocument(adapter,documentId,options={}){
  const source=resolveFileVaultSourceAdapter(adapter);
  if(!source.connected)throw stableUnavailableError(source.reason);
  const raw=await source.select(String(documentId||""),options);
  const selected=normalizeFileVaultSourceDocument(raw);
  if(!selected)throw stableUnavailableError("File Vault returned an invalid document descriptor.");
  return Object.freeze({...selected,...(raw?.file?{file:raw.file,source:raw.source}:{} )});
}

export function renderFileVaultSourceChooser(model){
  const documents=Array.isArray(model?.documents)?model.documents:[];
  const unavailable=model?.status==="unavailable";
  const rows=documents.length
    ?`<fieldset class="fileVaultSourceRows">
        <legend class="sr-only">File Vault documents</legend>
        ${documents.map((document)=>`<label class="fileVaultSourceRow">
          <input type="radio" name="file-vault-source" value="${escapeHtml(document.id)}" data-file-vault-version="${escapeHtml(document.versionId)}">
          <span class="fileVaultSourceIcon" aria-hidden="true">▤</span>
          <span><strong>${escapeHtml(document.name)}</strong><small>${escapeHtml(document.fileType)}${document.updatedAt?` · ${escapeHtml(document.updatedAt)}`:""}</small></span>
        </label>`).join("")}
      </fieldset>`
    :`<div class="fileVaultSourceEmpty" role="status">
        <span aria-hidden="true">◇</span>
        <strong>${unavailable?"File Vault isn’t connected here yet.":"No documents found."}</strong>
        <p>${escapeHtml(model?.message||"No documents are available.")}</p>
      </div>`;
  return `<section class="fileVaultSourceDialog" role="dialog" aria-modal="true" aria-labelledby="fileVaultSourceTitle" data-file-vault-source-dialog>
    <header>
      <div>
        <p class="subt">FASTER START · FILE VAULT</p>
        <h2 id="fileVaultSourceTitle">Choose a document</h2>
      </div>
      <button type="button" class="btnD alt sm" data-file-vault-source-close>Close</button>
    </header>
    <p class="fileVaultSourceIntro">Timeline Builder will read the document, suggest likely timeline entries, and wait for you to review every suggestion before adding anything.</p>
    <label class="fileVaultSourceSearch">
      <span>Search File Vault</span>
      <input type="search" value="${escapeHtml(model?.query||"")}" placeholder="Search by file name" data-file-vault-source-search autocomplete="off">
    </label>
    <div class="fileVaultSourceRecent">
      <h3>${model?.query?"Search results":"Recent documents"}</h3>
      ${rows}
    </div>
    <footer>
      <span>${unavailable?"Local preview · no files fabricated":"One document at a time"}</span>
      <button type="button" class="btnD go sm" data-file-vault-source-continue ${documents.length?"disabled":'disabled title="Choose a document first"'}>USE THIS DOCUMENT ▸</button>
    </footer>
  </section>`;
}

/**
 * The chooser already knows the exact version of every row it drew, so selection must not
 * spend a second round trip asking the detail route for it again.
 */
export function readFileVaultSourceSelection(root){
  const selected=root?.querySelector?.('input[name="file-vault-source"]:checked')||null;
  if(!selected)return null;
  return Object.freeze({
    documentId:String(selected.value||""),
    versionId:String(selected.dataset?.fileVaultVersion||selected.getAttribute?.("data-file-vault-version")||"")
  });
}

export const FILE_VAULT_SOURCE_KIND=SOURCE_KIND;
export const FILE_VAULT_SOURCE_UNAVAILABLE=UNAVAILABLE_CODE;
export const FILE_VAULT_SMART_FILL_MAX_BYTES=SMART_FILL_MAX_BYTES;
export const FILE_VAULT_SMART_FILL_MIME_TYPES=Object.freeze([...SMART_FILL_MIME]);
