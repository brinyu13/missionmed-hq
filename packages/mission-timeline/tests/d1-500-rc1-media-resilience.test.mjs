import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import test from "node:test";

import {omitFailedMediaFromKernelModel} from "../web/js/d1-411a/kernel-host.js";
import {productionMediaSource,remoteSyncPresentation,timelineRenderSignature} from "../web/js/407f-engineering-adapter.js";

const routeSource=await readFile(
  new URL("../infra/wordpress/missionmed-timeline-route.php",import.meta.url),
  "utf8"
);

function model(){
  return{
    schemaVersion:"d1-409h-render-model/1",
    documentId:"timeline-rc1",
    revision:1,
    title:"RC1",
    axisMode:"adaptive",
    events:[],
    flags:[],
    profile:{portrait:{src:"blob:portrait",contentSha256:"a".repeat(64)}},
    sticky:{visibility:"hide"},
    logo:{visibility:"content",media:{src:"blob:logo",contentSha256:"b".repeat(64)}},
    interview:{visibility:"show"},
    photos:[
      {id:"photo-good",slot:0,style:"scrapbook",media:{src:"blob:good",contentSha256:"c".repeat(64)}},
      {id:"photo-bad",slot:1,style:"scrapbook",media:{src:"blob:bad",contentSha256:"d".repeat(64)}}
    ]
  };
}

test("RC1 WordPress CSP permits only same-origin, local blob, and the exact private R2 host",()=>{
  assert.match(routeSource,/connect-src \\'self\\' blob: https:\/\/eeaaf73d1670b47a162d251ca67e7cfa\.r2\.cloudflarestorage\.com/);
  assert.doesNotMatch(routeSource,/connect-src[^;]*\*/);
  assert.doesNotMatch(routeSource,/connect-src[^;]*https:\/\/(?!eeaaf73d1670b47a162d251ca67e7cfa\.r2\.cloudflarestorage\.com)/);
});

test("RC1 omits one failed photo without mutating the original render model",()=>{
  const original=model();
  const result=omitFailedMediaFromKernelModel(original,"photos[1].media");
  assert.equal(result.omitted,true);
  assert.deepEqual(result.model.photos.map(({id})=>id),["photo-good"]);
  assert.equal(original.photos.length,2);
  assert.equal(result.warning,"MEDIA_OMITTED:photos[1].media");
});

test("RC1 independently omits failed portrait and logo media",()=>{
  const portrait=omitFailedMediaFromKernelModel(model(),"profile.portrait");
  assert.equal(portrait.model.profile.portrait,null);
  assert.equal(portrait.model.photos.length,2);

  const logo=omitFailedMediaFromKernelModel(model(),"logo.media");
  assert.equal(logo.model.logo.media,null);
  assert.equal(logo.model.logo.visibility,"placeholder");
  assert.equal(logo.model.photos.length,2);
});

test("RC1 rejects unknown failure paths instead of weakening the protected kernel",()=>{
  const original=model();
  const result=omitFailedMediaFromKernelModel(original,"events[0]");
  assert.equal(result.omitted,false);
  assert.equal(result.model,original);
});

test("RC1 production document media stores only a durable object ID and checksum",()=>{
  const source=productionMediaSource(
    "object_11111111-1111-4111-8111-111111111111",
    "a".repeat(64)
  );
  assert.deepEqual(source,{
    objectId:"object_11111111-1111-4111-8111-111111111111",
    contentSha256:"a".repeat(64),
    localOnly:false,
    url:null
  });
  assert.equal("blobKey" in source,false);
  assert.equal(JSON.stringify(source).includes("blob:"),false);
});

test("RC1 save status distinguishes local durability from remote acknowledgement",()=>{
  assert.equal(remoteSyncPresentation("SYNC_PENDING").text,"SAVED LOCALLY — SYNC PENDING");
  assert.equal(remoteSyncPresentation("SYNCING").text,"SYNCING…");
  assert.equal(remoteSyncPresentation("SYNCED").text,"SAVED & SYNCED");
  assert.equal(remoteSyncPresentation("OFFLINE").text,"SAVED LOCALLY — OFFLINE");
  assert.equal(remoteSyncPresentation("CONFLICT").className,"isError");
});

test("RC1 presentation rerender signature ignores non-visual timestamps and save status",()=>{
  const document={
    id:"timeline-rc1",updatedAt:"2026-08-05T12:00:00.000Z",
    theme:"keynote-classic",mode:"guided",events:[{id:"one"}],advanced:{media:[]}
  };
  const before=timelineRenderSignature(document);
  const after=timelineRenderSignature({...document,saveStatus:"SYNCING"});
  assert.equal(after,before);
  assert.equal(timelineRenderSignature({...document,updatedAt:"2026-08-05T12:00:01.000Z"}),before);
  assert.notEqual(
    timelineRenderSignature({...document,events:[{id:"one",title:"Updated title"}]}),
    before
  );
});

test("RC1 adapter binds production Matrix return and preserves last-good previews",async()=>{
  const adapter=await readFile(
    new URL("../web/js/407f-engineering-adapter.js",import.meta.url),
    "utf8"
  );
  assert.match(adapter,/installProductionMatrixReturn/);
  assert.match(adapter,/flushPendingSave\("RETURN_TO_MATRIX"\)/);
  assert.match(adapter,/locationObject\.assign\(target\.href\)/);
  assert.match(adapter,/host\.replaceChildren\(\.\.\.next\.childNodes\)/);
  assert.match(adapter,/host\.dataset\.builderPreviewError="true"/);
  assert.match(adapter,/openSyncConflictRecovery/);
  assert.match(adapter,/KEEP THIS COPY &amp; SYNC/);
  assert.match(adapter,/USE LATEST SAVED COPY/);
  assert.match(adapter,/store\.adapter\.resolveConflict/);
});

test("RC1 visible Media workflow replaces transient source state and retires only unreferenced durable objects",async()=>{
  const adapter=await readFile(
    new URL("../web/js/407f-engineering-adapter.js",import.meta.url),
    "utf8"
  );
  assert.match(adapter,/asset\.source=persistence\.source/);
  assert.doesNotMatch(adapter,/Object\.assign\(asset\.source,persistence\.source\)/);
  assert.match(adapter,/media\.source=persistence\.source/);
  assert.match(adapter,/background\.source=persistence\.source/);
  assert.match(adapter,/MAX_PRODUCTION_MEDIA_BYTES=15\*1024\*1024/);
  assert.match(adapter,/data-media-delete-confirm/);
  assert.match(adapter,/replaceMediaLibraryItem/);
  assert.match(adapter,/deleteMediaLibraryItem/);
  assert.match(adapter,/private-media-retirement:/);
  assert.match(adapter,/!referenced\.has\(String\(objectId\)\)/);
  assert.match(adapter,/flushPendingSave\("RETIRE_PRIVATE_MEDIA"\)/);
  assert.match(adapter,/private-file deletion will retry after sync/);
});
