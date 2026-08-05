import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {createRequire} from "node:module";
import {existsSync,readFileSync} from "node:fs";

const require=createRequire(import.meta.url);
const playwrightRuntime=process.env.CODEX_PLAYWRIGHT_RUNTIME||
  "/Users/brianb/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright";
const chromeExecutable=process.env.CHROME_EXECUTABLE||
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const appUrl=new URL(process.env.D1_APP_URL||"http://127.0.0.1:8793/web/");
const harnessUrl=new URL(
  "/web/presentation/d1-409h-a1/D1-409H_FINAL_VISUAL_MASTER.html?defer=1",
  appUrl
);
const {chromium}=require(playwrightRuntime);

assert(existsSync(chromeExecutable),`Chrome executable not found: ${chromeExecutable}`);

const protectedRoot=new URL("../presentation/d1-409h-a1/",import.meta.url);
const protectedHashes={
  "D1-409H_FINAL_VISUAL_MASTER.html":"bb471c57223c4a8d6c44d2398cc3c2a0da4467b61e7a2d779323c5be38e52c24",
  "D1-409H_VISUAL_MASTER.css":"4efd5088696a93914d5f6c3b7e14e98426239453b16712f152eb5bfe68598ef7",
  "D1-409H_VISUAL_MASTER.js":"ca9a28688e7dd29f0e008b58efae85555af860b8150fa9493165faf851165bb8"
};

for(const [name,expected] of Object.entries(protectedHashes)){
  const actual=createHash("sha256").update(readFileSync(new URL(name,protectedRoot))).digest("hex");
  assert.equal(actual,expected,`protected D1-409H hash changed: ${name}`);
}

const browser=await chromium.launch({headless:true,executablePath:chromeExecutable});
const context=await browser.newContext({viewport:{width:1280,height:900},reducedMotion:"reduce"});
const localImageFixture=Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64"
);
await context.route(/\/web\/presentation\/d1-409h-a1\/assets\/(?:tex|photos)\//,async(route)=>{
  await route.fulfill({status:200,contentType:"image/png",body:localImageFixture});
});
const page=await context.newPage();
const requests=[];
const failures=[];
const httpErrors=[];

page.on("request",(request)=>requests.push(request.url()));
page.on("pageerror",(error)=>failures.push(`pageerror:${error.message}`));
page.on("console",(message)=>{
  if(message.type()==="error"&&!message.text().includes("Failed to load resource")){
    failures.push(`console:${message.text()}`);
  }
});
page.on("response",(response)=>{
  if(response.status()>=400)httpErrors.push({status:response.status(),url:response.url()});
});

try{
  const response=await page.goto(harnessUrl.href,{waitUntil:"networkidle"});
  assert(response?.ok(),`local Timeline route failed: ${response?.status()}`);
  const csp=String((await response.allHeaders())["content-security-policy"]||"");
  assert.match(csp,/connect-src 'self' blob: https:\/\/eeaaf73d1670b47a162d251ca67e7cfa\.r2\.cloudflarestorage\.com/,"CSP does not permit private Timeline R2 media");
  assert.doesNotMatch(csp,/connect-src[^;]*\*/,"CSP widened connect-src with a wildcard");

  const result=await page.evaluate(async()=>{
    const {createD1411AKernelManager}=await import("/web/js/d1-411a/kernel-host.js");
    const pngBytes=Uint8Array.from(atob(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII="
    ),(character)=>character.charCodeAt(0));
    const goodBlob=new Blob([pngBytes],{type:"image/png"});
    const goodUrl=URL.createObjectURL(goodBlob);
    const digest=await crypto.subtle.digest("SHA-256",pngBytes);
    const goodSha=[...new Uint8Array(digest)]
      .map((byte)=>byte.toString(16).padStart(2,"0"))
      .join("");
    const missingUrl=`${location.origin}/web/tests/fixtures/rc1-intentionally-missing.png`;
    const mediaUrls=new Map([
      ["photo-good",goodUrl],
      ["photo-missing",missingUrl]
    ]);
    const manager=createD1411AKernelManager({resolveObjectUrl:(id)=>mediaUrls.get(id)||null});
    const timeline={
      schemaVersion:"d1-timeline-document/1",
      id:"timeline-rc1-browser-media",
      ownerId:"student-rc1",
      title:"RC1 Media Recovery Timeline",
      studentProfile:{fullName:"RC1 Student",specialtyGoal:"Internal Medicine"},
      events:[
        {id:"medical-school",title:"Medical School",categoryId:"education",eventType:"duration",startDate:"2017-08",endDate:"2021-05",visibilityState:"INTERVIEWER_SAFE",fields:{}},
        {id:"residency-application",title:"Residency Application",categoryId:"work",eventType:"duration",startDate:"2023-06",endDate:"2024-03",visibilityState:"INTERVIEWER_SAFE",fields:{}}
      ],
      exams:[],
      advanced:{media:[
        {id:"photo-good",type:"media",role:"photo",placed:true,source:{src:goodUrl,mime:"image/png",contentSha256:goodSha}},
        {id:"photo-missing",type:"media",role:"photo",placed:true,source:{src:missingUrl,mime:"image/png",contentSha256:"0".repeat(64)}}
      ]},
      metadata:{interview:{}},
      presentationOverrides:{}
    };
    const rendered=manager.render(timeline,{surface:"builder",audience:"EVERYTHING",reason:"rc1-media-fail-soft-regression"});
    const fixture=document.createElement("main");
    fixture.id="rc1-media-fail-soft-fixture";
    fixture.style.cssText="width:1200px;min-height:675px";
    fixture.innerHTML=rendered.html;
    document.body.replaceChildren(fixture);
    const host=fixture.querySelector("d1-timeline-kernel");
    await new Promise((resolve,reject)=>{
      const timeout=setTimeout(()=>reject(new Error(`kernel timeout: ${host.dataset.error||"unknown"}`)),12000);
      host.addEventListener("d1-411a:ready",()=>{clearTimeout(timeout);resolve();},{once:true});
      host.addEventListener("d1-411a:error",(event)=>{clearTimeout(timeout);reject(event.detail?.error||new Error("kernel failed"));},{once:true});
    });
    const frame=host.shadowRoot.querySelector("iframe");
    const frameDocument=frame.contentDocument;
    const warning=host.shadowRoot.querySelector("[data-media-warning]");
    const warnings=JSON.parse(host.dataset.projectionWarnings||"[]");
    const renderedEventText=[...frameDocument.querySelectorAll(".arrow[data-object-id]")]
      .map((node)=>node.textContent.replace(/\s+/g," ").trim());
    const photos=[...frameDocument.querySelectorAll(".photoTile[data-object-id]")]
      .map((node)=>({id:node.dataset.objectId,src:node.querySelector("img")?.src||""}));
    const outcome={
      ready:host.dataset.ready,
      error:host.dataset.error||"",
      protectedKernel:host.dataset.protectedKernel,
      warningHidden:warning.hidden,
      warningText:warning.textContent,
      warnings,
      renderedEventText,
      photos,
      eventCount:frameDocument.querySelectorAll(".arrow[data-object-id]").length,
      photoCount:photos.length,
      validBlobUrl:goodUrl
    };
    URL.revokeObjectURL(goodUrl);
    return outcome;
  });

  assert.equal(result.ready,"true","fail-soft render did not reach ready state");
  assert.equal(result.error,"","fail-soft render exposed a fatal error");
  assert.equal(result.protectedKernel,"D1-409H-A1","render left the protected kernel");
  assert.equal(result.eventCount,2,"media failure removed timeline events");
  assert(result.renderedEventText.some((text)=>text.includes("Medical School")),"medical-school text was lost");
  assert(result.renderedEventText.some((text)=>text.includes("Residency Application")),"residency text was lost");
  assert.equal(result.photoCount,1,"invalid media did not omit exactly one photo");
  assert.equal(result.photos[0].id,"ph-photo-good","valid media was not preserved");
  assert.equal(result.photos[0].src,result.validBlobUrl,"valid media source changed during recovery");
  assert.equal(result.warningHidden,false,"fail-soft warning was not exposed");
  assert.match(result.warningText,/1 unavailable media asset was omitted/);
  assert(result.warnings.includes("MEDIA_OMITTED:photos[1].media"),`missing omission warning: ${JSON.stringify(result.warnings)}`);

  const offOrigin=requests.filter((requestUrl)=>{
    const url=new URL(requestUrl);
    return !["blob:","data:"].includes(url.protocol)&&url.origin!==appUrl.origin;
  });
  assert.deepEqual(offOrigin,[],`off-origin requests observed: ${offOrigin.join(", ")}`);
  const unexpectedHttpErrors=httpErrors.filter(({url})=>
    !new URL(url).pathname.endsWith("/web/tests/fixtures/rc1-intentionally-missing.png")&&
    !new URL(url).pathname.endsWith("/favicon.ico")
  );
  assert.equal(
    httpErrors.filter(({url})=>new URL(url).pathname.endsWith("/web/tests/fixtures/rc1-intentionally-missing.png")).length,
    1,
    `expected one failed-media request: ${JSON.stringify(httpErrors)}`
  );
  assert.deepEqual(unexpectedHttpErrors,[],`unexpected HTTP errors: ${JSON.stringify(unexpectedHttpErrors)}`);
  assert.deepEqual(failures,[],`unexpected browser errors: ${failures.join(" | ")}`);

  console.log(JSON.stringify({
    ok:true,
    protectedHashes:Object.keys(protectedHashes).length,
    eventCount:result.eventCount,
    validMedia:result.photoCount,
    omittedWarning:result.warnings.find((warning)=>warning.startsWith("MEDIA_OMITTED:")),
    offOriginRequests:offOrigin.length
  },null,2));
}finally{
  await context.close();
  await browser.close();
}
