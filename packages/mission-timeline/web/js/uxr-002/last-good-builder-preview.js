import {canonicalBoardPreview} from "./preview.js";

const lastGoodByDocument=new Map();

function documentKey(document){
  return String(document?.id||"timeline-default");
}

function validPreview(markup){
  const html=String(markup||"");
  return html.includes("<svg")&&
    !html.includes("data-render-isolated=")&&
    !/loading canonical timeline/i.test(html);
}

export function clearLastGoodBuilderPreview(documentId){
  lastGoodByDocument.delete(String(documentId||"timeline-default"));
}

export function renderLastGoodBuilderPreview(document,options={},renderer=canonicalBoardPreview){
  const key=documentKey(document);
  try{
    const next=renderer(document,options);
    if(validPreview(next)){
      lastGoodByDocument.set(key,next);
      return next;
    }
    const previous=lastGoodByDocument.get(key);
    if(!previous)return next;
    return`<div class="last-good-builder-preview" data-preview-recalculating="true">${previous}<div class="preview-progress-overlay" role="status">Updating preview…</div></div>`;
  }catch(error){
    const previous=lastGoodByDocument.get(key);
    if(!previous)throw error;
    return`<div class="last-good-builder-preview" data-preview-recovery="true">${previous}<div class="preview-progress-overlay" role="status">Keeping your last preview while this change is checked.</div></div>`;
  }
}

export function hasLastGoodBuilderPreview(documentId){
  return lastGoodByDocument.has(String(documentId||"timeline-default"));
}
