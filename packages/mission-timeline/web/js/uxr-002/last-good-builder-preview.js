import {previewCacheIdentity} from "../presentation/last-good-render-cache.js";
import {canonicalBoardPreview} from "./preview.js";

const lastGoodByDocument=new Map();

function documentKeys(documentId){
  return [...lastGoodByDocument.keys()].filter(key=>JSON.parse(key)[0]===String(documentId));
}

function validPreview(markup){
  const html=String(markup||"");
  return html.includes("<svg")&&
    !html.includes("data-render-isolated=")&&
    !/loading canonical timeline/i.test(html);
}

export function clearLastGoodBuilderPreview(documentId){
  for(const key of documentKeys(documentId))lastGoodByDocument.delete(key);
}

export function renderLastGoodBuilderPreview(document,options={},renderer=canonicalBoardPreview){
  const key=previewCacheIdentity(document,options);
  try{
    const next=renderer(document,options);
    if(validPreview(next)){
      if(key)lastGoodByDocument.set(key,next);
      return next;
    }
    const previous=key?lastGoodByDocument.get(key):null;
    if(!previous)return next;
    return`<div class="last-good-builder-preview" data-preview-recalculating="true">${previous}<div class="preview-progress-overlay" role="status">Updating preview…</div></div>`;
  }catch(error){
    const previous=key?lastGoodByDocument.get(key):null;
    if(!previous)throw error;
    return`<div class="last-good-builder-preview" data-preview-recovery="true">${previous}<div class="preview-progress-overlay" role="status">Keeping your last preview while this change is checked.</div></div>`;
  }
}

export function hasLastGoodBuilderPreview(documentId){
  return documentKeys(documentId).length>0;
}
