import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import test from "node:test";

import {TimelineProductionAuthClient} from "../web/js/production/timeline-auth-client.js";

test("012A production auth client sends Timeline Rescue through the owner-authenticated same-origin API",async()=>{
  const calls=[];
  const client=new TimelineProductionAuthClient({
    fetchImpl:async(url,options)=>{
      calls.push({url:String(url),options});
      return new Response(JSON.stringify({rescue:{format:"PDF",candidates:[]}}),{
        status:200,headers:{"content-type":"application/json"}
      });
    },
    locationObject:{origin:"https://missionmed.test",reload(){}},
    documentObject:{addEventListener(){},removeEventListener(){}},
    globalObject:{},
  });
  client.bootstrapState={apiBase:"https://missionmed.test/timeline/api/v1"};
  client.token="owner-token";
  client.claims={exp:Math.floor(Date.now()/1000)+600};
  const payload={source:{objectId:"object_1",filename:"existing.pdf",mimeType:"application/pdf",sha256:"a".repeat(64)}};
  const result=await client.rescueTimeline("timeline_1",payload);
  assert.equal(result.rescue.format,"PDF");
  assert.equal(calls.length,1);
  assert.equal(calls[0].url,"https://missionmed.test/timeline/api/v1/documents/timeline_1/intake/rescue");
  assert.equal(calls[0].options.method,"POST");
  assert.equal(calls[0].options.headers.authorization,"Bearer owner-token");
  assert.deepEqual(JSON.parse(calls[0].options.body),payload);
  client.close();
});

test("012A production UI exposes real Rescue input, review gating, and honest Keynote guidance",async()=>{
  const [entry,intake,review]=await Promise.all([
    readFile(new URL("../web/js/407f-engineering-adapter.js",import.meta.url),"utf8"),
    readFile(new URL("../web/js/uxr-002/intake-d1-408-adapter.js",import.meta.url),"utf8"),
    readFile(new URL("../web/js/uxr-002/intake.js",import.meta.url),"utf8"),
  ]);
  /* AAA-019 (09 §1): the front door is "I already have a Timeline" — on Home and in the
     intake — with student-language Keynote guidance and an honest local degrade. */
  assert.match(entry,/I ALREADY HAVE A TIMELINE/);
  assert.match(entry,/data-timeline-rescue-file/);
  assert.match(entry,/File → Export To → PowerPoint…/);
  assert.match(entry,/You review each suggestion before adding it to a new MissionMed layout/);
  assert.match(entry,/Photos, notes and original positions are not restored/);
  assert.match(review,/Only the entries you accept and their supported profile details are added/);
  assert.match(review,/Photos, notes and original object positions from the uploaded file are not restored/);
  assert.match(review,/Your original file stays unchanged/);
  assert.match(entry,/Timeline Rescue needs the MissionMed server/);
  assert.match(entry,/homeRescueFile/);
  assert.match(intake,/input\.file\?\.timelineRescue===true/);
  assert.match(intake,/apiClient\.rescueTimeline/);
  assert.match(intake,/decision:"undecided"/);
  assert.match(intake,/rescueReviewRequired:true/);
  assert.doesNotMatch(intake,/safeToAutoAccept:true/);
});
