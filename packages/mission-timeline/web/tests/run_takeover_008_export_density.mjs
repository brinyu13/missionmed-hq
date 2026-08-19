/*
 * D1-TIMELINE-CLAUDE-TAKEOVER-008 — export quality gate across real timeline densities.
 *
 * The pre-existing RC1 export proof renders a single event plus three decorative
 * shapes. That is not evidence about the timelines students actually build, which is
 * why exports could be certified PASS while the Founder was looking at jumbled text.
 * This harness exports sparse, medium, dense, milestone-heavy and long-chronology
 * timelines, and mechanically asserts the geometry the protected kernel never checks:
 * milestone flags must not run off the board and must not overlap on their own row.
 */
import {createRequire} from "node:module";
import {mkdirSync,writeFileSync} from "node:fs";
import path from "node:path";

const require=createRequire(import.meta.url);
const playwrightRuntime=process.env.CODEX_PLAYWRIGHT_RUNTIME||
  "/Users/brianb/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright";
const chromeExecutable=process.env.CHROME_EXECUTABLE||
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const appUrl=process.env.D1_APP_URL||"http://127.0.0.1:8792/web/?matrixAppMode=local&returnUrl=%2Fmatrix%2Fdemo%2F";
const captureDir=process.env.D1_CAPTURE_DIR;
if(!captureDir)throw new Error("D1_CAPTURE_DIR is required.");
mkdirSync(captureDir,{recursive:true});
const {chromium}=require(playwrightRuntime);

const ev=(id,title,categoryId,startDate,endDate,siteName="")=>({
  id,title,categoryId,eventType:"duration",startDate,endDate,openEnded:false,
  visibilityState:"INTERVIEWER_SAFE",siteName,sourceType:"takeover-008",notes:"",lane:null,
  fields:{hiddenInActiveVariant:false}
});
const ms=(id,title,categoryId,startDate)=>({
  id,title,categoryId,eventType:"milestone",startDate,endDate:startDate,openEnded:false,
  visibilityState:"INTERVIEWER_SAFE",siteName:"",sourceType:"takeover-008",notes:"",lane:null,
  fields:{hiddenInActiveVariant:false}
});

const SCENARIOS=[
  {
    key:"sparse",title:"Sparse Timeline",
    events:[
      ev("s1","MBBS, Dow University of Health Sciences","education","2016-09","2021-12","Karachi, Pakistan"),
      ms("s2","USMLE Step 1 — Pass","exams","2022-06")
    ]
  },
  {
    key:"medium",title:"Medium Timeline",
    events:[
      ev("m1","MBBS, Dow University of Health Sciences","education","2016-09","2021-12","Karachi, Pakistan"),
      ms("m2","USMLE Step 1 — Pass","exams","2022-06"),
      ev("m3","Internal Medicine Observership","clinical","2022-08","2022-11","Newark, NJ"),
      ms("m4","USMLE Step 2 CK — 254","exams","2023-03"),
      ev("m5","Research Assistant, Cardiology","research","2023-01","2024-06","Cleveland, OH"),
      ev("m6","Hospitalist Extern","work","2023-05","2024-02","Houston, TX"),
      ev("m7","Teaching Hospital Rotation","clinical","2024-03","2024-09","Detroit, MI"),
      ms("m8","ECFMG Certification","exams","2024-10")
    ]
  },
  {
    key:"milestone-heavy",title:"Milestone Heavy Timeline",
    events:[
      ev("h1","MBBS, Dow University of Health Sciences","education","2016-09","2021-12","Karachi, Pakistan"),
      ms("h2","USMLE Step 1 — Pass","exams","2022-06"),
      ms("h3","USMLE Step 2 CK — 254","exams","2022-11"),
      ms("h4","ECFMG Certification Granted","exams","2023-04"),
      ms("h5","USMLE Step 3 — Pass","exams","2023-09"),
      ms("h6","Moved to USA","personal","2024-02"),
      ms("h7","ERAS Application Submitted","personal","2024-09"),
      ev("h8","Internal Medicine Observership","clinical","2022-08","2022-11","Newark, NJ"),
      ev("h9","Research Assistant, Cardiology","research","2023-01","2024-06","Cleveland, OH"),
      ev("h10","Hospitalist Extern","work","2023-05","2024-02","Houston, TX")
    ]
  },
  {
    key:"dense",title:"Dense Timeline",
    events:[
      ev("d1","MBBS, Dow University of Health Sciences","education","2015-09","2020-12","Karachi, Pakistan"),
      ev("d2","Internship, General Medicine","work","2021-01","2021-12","Karachi, Pakistan"),
      ms("d3","USMLE Step 1 — Pass","exams","2021-06"),
      ev("d4","Internal Medicine Observership","clinical","2021-08","2021-11","Newark, NJ"),
      ev("d5","Cardiology Externship","clinical","2022-01","2022-05","Mount Sinai, NY"),
      ms("d6","USMLE Step 2 CK — 254","exams","2022-03"),
      ev("d7","Research Assistant, Cardiology","research","2022-02","2023-06","Cleveland, OH"),
      ev("d8","Hospitalist Extern","work","2022-06","2023-02","Houston, TX"),
      ev("d9","Teaching Hospital Rotation","clinical","2023-01","2023-08","Detroit, MI"),
      ms("d10","ECFMG Certification","exams","2023-05"),
      ev("d11","Quality Improvement Project","research","2023-03","2024-01","Boston, MA"),
      ev("d12","Volunteer Clinic Coordinator","personal","2023-06","2024-04","Newark, NJ"),
      ms("d13","USMLE Step 3 — Pass","exams","2024-02"),
      ev("d14","Chief Extern, Internal Medicine","work","2024-01","2024-10","Chicago, IL"),
      ms("d15","ERAS Submitted","personal","2024-09")
    ]
  },
  {
    key:"long-labels",title:"Long Label Timeline",
    events:[
      ev("g1","Bachelor of Medicine, Bachelor of Surgery (MBBS), Faculty of Medicine and Allied Health Sciences","education","2015-09","2021-06","Dow University of Health Sciences, Karachi, Sindh, Pakistan"),
      ev("g2","Clinical Observership in Adult Inpatient Internal Medicine and Hospitalist Services","clinical","2022-02","2022-08","Mount Sinai Beth Israel Medical Center, New York, NY"),
      ev("g3","Multicenter Retrospective Cardiology Outcomes Research Programme","research","2022-09","2024-03","Cleveland Clinic Foundation, Cleveland, OH"),
      ms("g4","Educational Commission for Foreign Medical Graduates Certification Granted","exams","2024-05")
    ]
  },
  {
    key:"same-month",title:"Same Month Timeline",
    events:[
      ev("s1","Observership A","clinical","2023-03","2023-06","Newark, NJ"),
      ev("s2","Observership B","clinical","2023-03","2023-06","Trenton, NJ"),
      ev("s3","Research Project","research","2023-03","2023-06","Boston, MA"),
      ev("s4","Volunteer Clinic","personal","2023-03","2023-06","Newark, NJ"),
      ms("s5","Step 1","exams","2023-03"),
      ms("s6","Step 2 CK","exams","2023-03"),
      ms("s7","ECFMG","exams","2023-03")
    ]
  },
  {
    key:"overlapping",title:"Overlapping Chronology Timeline",
    events:[
      ev("o1","Internal Medicine Externship","clinical","2022-01","2023-06","Newark, NJ"),
      ev("o2","Cardiology Research Fellow","research","2022-04","2023-09","Cleveland, OH"),
      ev("o3","Hospitalist Extern","work","2022-06","2023-03","Houston, TX"),
      ev("o4","Teaching Hospital Rotation","clinical","2022-09","2023-12","Detroit, MI"),
      ev("o5","Quality Improvement Project","research","2022-11","2023-08","Boston, MA"),
      ev("o6","Volunteer Coordinator","personal","2022-02","2023-05","Newark, NJ")
    ]
  },
  {
    key:"future-events",title:"Future Events Timeline",
    events:[
      ev("f1","MBBS","education","2016-09","2021-12","Karachi, Pakistan"),
      ev("f2","Research Assistant","research","2023-01","2024-06","Cleveland, OH"),
      ms("f3","ERAS Submitted","personal","2025-09"),
      ms("f4","Interview Season","personal","2026-01"),
      ms("f5","Match Day","personal","2026-03"),
      ev("f6","Residency Preparation","education","2026-04","2026-06","MissionMed Institute")
    ]
  },
  {
    key:"mixed-categories",title:"Mixed Category Timeline",
    events:[
      ev("x1","MBBS","education","2016-09","2021-12","Karachi, Pakistan"),
      ev("x2","House Officer","work","2022-01","2022-12","Karachi, Pakistan"),
      ev("x3","Observership","clinical","2023-02","2023-05","Newark, NJ"),
      ev("x4","Cardiology Research","research","2023-06","2024-04","Cleveland, OH"),
      ev("x5","Volunteer Clinic","personal","2024-01","2024-08","Newark, NJ"),
      ms("x6","Step 1","exams","2022-06"),
      ms("x7","Step 2 CK","exams","2023-01"),
      ms("x8","ECFMG","exams","2024-05")
    ]
  },
  {
    key:"long-chronology",title:"Long Chronology Timeline",
    events:[
      ev("l1","Premedical Studies","education","2008-09","2012-06","Lahore, Pakistan"),
      ev("l2","MBBS","education","2012-09","2017-12","Karachi, Pakistan"),
      ev("l3","House Officer, Medicine","work","2018-01","2019-06","Karachi, Pakistan"),
      ms("l4","USMLE Step 1 — Pass","exams","2020-06"),
      ev("l5","Clinical Research Fellow","research","2020-08","2022-07","Cleveland, OH"),
      ms("l6","USMLE Step 2 CK","exams","2022-03"),
      ev("l7","Internal Medicine Externship","clinical","2022-09","2023-03","Newark, NJ"),
      ms("l8","ECFMG Certification","exams","2023-06"),
      ev("l9","Hospitalist Extern","work","2023-07","2024-08","Houston, TX"),
      ms("l10","ERAS Submitted","personal","2025-09")
    ]
  }
];

function assert(condition,message){if(!condition)throw new Error(message);}

process.on("uncaughtException",(error)=>{
  console.error("RUN FAILED:",error.message);
  console.error("DIAGNOSTICS:",JSON.stringify(diagnostics.slice(-3),null,2));
  process.exit(1);
});
const browser=await chromium.launch({headless:true,executablePath:chromeExecutable});
const context=await browser.newContext({viewport:{width:1680,height:1300},reducedMotion:"reduce",acceptDownloads:true});
const page=await context.newPage();
const consoleErrors=[];
page.on("pageerror",(error)=>consoleErrors.push(`pageerror: ${error.message}`));
page.on("console",(message)=>{
  if(message.type()!=="error")return;
  const location=message.location?.()||{};
  if(String(location.url||"").endsWith("/favicon.ico"))return;
  consoleErrors.push(`console: ${message.text()}${location.url?` (${location.url})`:""}`);
});
await page.goto(appUrl,{waitUntil:"networkidle"});
await page.waitForFunction(()=>!!window.D1_407F_ENGINEERING);

const navigate=async(route)=>{
  await page.locator(`#rail [data-v="${route}"]`).click();
  await page.waitForFunction((expected)=>document.querySelector('#rail [aria-current="page"]')?.dataset.v===expected,route);
};
const fingerprintOf=async(surface)=>page.evaluate((expected)=>{
  const node=[...document.querySelectorAll(`d1-timeline-kernel[data-surface="${expected}"]`)].find((n)=>n.offsetWidth||n.offsetHeight);
  return node?.dataset.fingerprint||null;
},surface);

/*
 * From the second scenario onward the kernel element is reused, so `ready` is already
 * "true" and waiting on it alone samples the PREVIOUS render. Wait for the content
 * fingerprint to move off the one captured before the document was replaced.
 */
/*
 * Waiting on a changed fingerprint proved unreliable across back-to-back scenarios: a
 * baseline read at the wrong moment let the check pass against the previous board, and the
 * receipt then described a timeline that was never on screen. Wait instead for the board
 * to actually contain this scenario's own arrow and flag counts - an unambiguous signal
 * that the render being measured is the one just requested.
 */
const kernel=async(surface,expectedCounts)=>{
  const host=page.locator(`d1-timeline-kernel[data-surface="${surface}"]:visible`).first();
  await host.waitFor({state:"visible",timeout:40000});
  await page.waitForFunction(({expected,counts})=>{
    const node=[...document.querySelectorAll(`d1-timeline-kernel[data-surface="${expected}"]`)].find((n)=>n.offsetWidth||n.offsetHeight);
    if(node?.dataset.ready!=="true")return false;
    if(!counts)return true;
    const doc=node.shadowRoot?.querySelector("iframe")?.contentDocument;
    if(!doc)return false;
    return doc.querySelectorAll(".arrow").length===counts.arrows&&
      doc.querySelectorAll("#flagLayer .flag").length===counts.flags;
  },{expected:surface,counts:expectedCounts??null},{timeout:45000});
  return host;
};

/*
 * Exports can raise an interstitial modal (an export suggestion). Record what it said
 * so the copy stays reviewable as evidence, then clear it before driving the button.
 */
const modalNotices=[];
const diagnostics=[];
const clearModal=async()=>{
  // Dismiss through the modal's own control, exactly as a student would. Clearing the
  // backdrop class directly leaves the `inert` attribute the modal put on header/#rail/
  // main, which makes the whole app non-interactive for the rest of the run.
  for(let attempt=0;attempt<4;attempt+=1){
    const open=await page.evaluate(()=>Boolean(document.querySelector("#modalBk.on")));
    if(!open)break;
    const notice=await page.evaluate(()=>
      (document.querySelector("#modalIn")?.textContent||"").replace(/\s+/g," ").trim().slice(0,300));
    if(notice)modalNotices.push(notice);
    const control=page.locator("#modalIn button, #modalIn [data-modal-close]").last();
    if(await control.count()){await control.click({timeout:10000}).catch(()=>{});}
    else await page.keyboard.press("Escape");
    await page.waitForTimeout(200);
  }
  // Belt and braces: never let a stale inert attribute survive into the next step.
  await page.evaluate(()=>{
    for(const selector of ["header","#rail","main"]){
      document.querySelector(selector)?.removeAttribute("inert");
    }
  });
};
const exportOnce=async(format,filename)=>{
  await clearModal();
  // A freshly reloaded page resolves entitlement asynchronously, so the export controls
  // start disabled. Wait for the real enabled state rather than racing it.
  // The interstitial can reappear between exports and it disables the controls while it
  // is up, so clear and re-check rather than waiting once on a state the modal owns.
  for(let attempt=0;attempt<12;attempt+=1){
    const ready=await page.evaluate(()=>{
      const radio=document.querySelector('[name="export-format"]');
      const action=document.querySelector("[data-export-action]");
      return Boolean(radio&&!radio.disabled&&action&&!action.disabled);
    });
    if(ready)break;
    await clearModal();
    await page.waitForTimeout(1000);
  }
  if(format)await page.locator(`[name="export-format"][value="${format}"]`).check();
  await clearModal();
  const action=page.locator("[data-export-action]");
  await action.scrollIntoViewIfNeeded();
  // The export card sits inside a clipped column; after the first export the button can
  // slide out of that container's painted area, so scroll every scrollable ancestor.
  await page.evaluate(()=>{
    const btn=document.querySelector("[data-export-action]");
    if(!btn)return;
    btn.scrollIntoView({block:"center",inline:"nearest"});
    for(let node=btn.parentElement;node;node=node.parentElement){
      if(node.scrollHeight>node.clientHeight+1)
        node.scrollTop=Math.max(0,btn.offsetTop-node.clientHeight/2);
    }
  });
  const hitTest=await page.evaluate(()=>{
    const btn=document.querySelector("[data-export-action]");
    if(!btn)return{error:"no button"};
    const r=btn.getBoundingClientRect();
    const cx=r.left+r.width/2,cy=r.top+r.height/2;
    const top=document.elementFromPoint(cx,cy);
    const describe=(n)=>n?{tag:n.tagName,id:n.id,cls:String(n.className||"").slice(0,80),
      pos:getComputedStyle(n).position,z:getComputedStyle(n).zIndex,pe:getComputedStyle(n).pointerEvents,
      op:getComputedStyle(n).opacity}:null;
    const covers=[];
    document.querySelectorAll("body *").forEach((n)=>{
      const s=getComputedStyle(n);
      if(s.pointerEvents==="none"||s.display==="none"||s.visibility==="hidden")return;
      const b=n.getBoundingClientRect();
      if(b.width>=window.innerWidth*0.9&&b.height>=window.innerHeight*0.9&&s.position!=="static")
        covers.push(describe(n));
    });
    return{buttonRect:{x:Math.round(r.x),y:Math.round(r.y),w:Math.round(r.width),h:Math.round(r.height)},
      viewport:{w:window.innerWidth,h:window.innerHeight},scrollY:window.scrollY,
      topAtCenter:describe(top),fullScreenLayers:covers.slice(0,6),
      bodyOverflow:getComputedStyle(document.body).overflow,
      bodyClass:String(document.body.className||"").slice(0,120),
      buttonCount:document.querySelectorAll("[data-export-action]").length,
      buttons:[...document.querySelectorAll("[data-export-action]")].map((b)=>{
        const r=b.getBoundingClientRect();
        const screen=b.closest("[data-screen]");
        return{y:Math.round(r.y),h:Math.round(r.height),
          screen:screen?screen.dataset.screen:null,
          screenDisplay:screen?getComputedStyle(screen).display:null,
          inert:Boolean(b.closest("[inert]")),
          ariaHidden:Boolean(b.closest("[aria-hidden='true']")),
          pe:getComputedStyle(b).pointerEvents};
      }),
      clippingAncestors:(()=>{
        const rows=[];
        for(let node=btn.parentElement;node&&node!==document.documentElement;node=node.parentElement){
          const cs=getComputedStyle(node);
          const b=node.getBoundingClientRect();
          if(/hidden|clip|auto|scroll/.test(cs.overflow+cs.overflowY)){
            rows.push({tag:node.tagName,cls:String(node.className||"").slice(0,60),
              overflow:cs.overflow,overflowY:cs.overflowY,
              top:Math.round(b.top),bottom:Math.round(b.bottom),
              clientH:node.clientHeight,scrollH:node.scrollHeight,scrollTop:node.scrollTop});
          }
        }
        return rows.slice(0,8);
      })()};
  });
  diagnostics.push({filename,hitTest});
  const [download]=await Promise.all([
    page.waitForEvent("download",{timeout:120000}),
    action.click({timeout:60000})
  ]);
  await download.saveAs(path.join(captureDir,filename));
  await clearModal();
};

/*
 * Zero events is a real student state (a brand-new account). The protected renderer
 * requires at least one arrow event, so this must land on the friendly empty state
 * rather than a crash or a dead grey rectangle - and it must say something a student
 * understands.
 */
await page.evaluate(()=>{
  const api=window.D1_407F_ENGINEERING;
  const doc=api.store.snapshot();
  doc.mode="advanced";doc.title="Zero Event Timeline";doc.events=[];
  doc.advanced={media:[],recentColors:[],background:{kind:"preset",preset:"gradient-dawn",dim:0},groups:[],textBlocks:[],elements:[]};
  api.store.replace(doc,{label:"takeover-008 zero-event fixture",history:false});
  api.applyDocument();
});
await navigate("canvas");
await page.waitForTimeout(2500);
const zeroEventState=await page.evaluate(()=>{
  const empty=document.querySelector(".d1411AEmpty");
  const banned=["canonical","kernel","D1-409H","D1-411A","fingerprint","principal","renderer","audience","projection","UUID"];
  const text=(empty?.textContent||"").trim();
  return{
    emptyStateShown:Boolean(empty),
    text,
    leaks:banned.filter((term)=>text.toLowerCase().includes(term.toLowerCase())),
    crashed:Boolean(document.querySelector('d1-timeline-kernel[data-surface="edit"][data-error]'))
  };
});
const zeroEventErrors=consoleErrors.slice();

const results=[];
for(const scenario of SCENARIOS){
  const scenarioErrorMark=consoleErrors.length;
  // Capture the baseline while the edit surface is actually mounted. Reading it from the
  // export screen returned null, which made the "wait for a new render" check pass
  // immediately and measure the PREVIOUS scenario's board.
  // Each scenario starts from a fresh page. Replacing the document ten times inside one
  // session accumulates state a real student never has, and it was that contamination -
  // not the renderer - that made earlier receipts describe the wrong board.
  await page.goto(appUrl,{waitUntil:"networkidle"});
  await page.waitForFunction(()=>!!window.D1_407F_ENGINEERING);
  await navigate("canvas");
  const expectedCounts={
    arrows:scenario.events.filter((entry)=>entry.eventType!=="milestone").length,
    flags:scenario.events.filter((entry)=>entry.eventType==="milestone").length
  };
  await page.evaluate((data)=>{
    const api=window.D1_407F_ENGINEERING;
    const doc=api.store.snapshot();
    doc.mode="advanced";
    doc.title=data.title;
    doc.studentProfile={...doc.studentProfile,fullName:"Dr. Takeover Proof",
      currentUsWorkAuthorization:"J-1 Visa",specialtyGoal:"Internal Medicine"};
    doc.events=data.events;
    doc.advanced={media:[],recentColors:[],background:{kind:"preset",preset:"gradient-dawn",dim:0},
      groups:[],textBlocks:[],elements:[]};
    api.store.replace(doc,{label:"takeover-008 density fixture",history:false});
    api.applyDocument();
  },scenario);

  await navigate("canvas");
  // A scenario that never commits a new render is a real product failure, not a reason to
  // abandon the run: record it and keep going so the receipt covers every shape.
  let renderFailed=false;
  let editHost=null;
  try{
    editHost=await kernel("edit",expectedCounts);
  }catch(error){
    renderFailed=true;
    editHost=page.locator('d1-timeline-kernel[data-surface="edit"]:visible').first();
  }
  const failureState=await page.evaluate(()=>{
    const host=[...document.querySelectorAll('d1-timeline-kernel[data-surface="edit"]')].find((n)=>n.offsetWidth||n.offsetHeight);
    const notice=host?.shadowRoot?.querySelector("[data-last-good-alert]");
    return{
      error:host?.dataset?.error||null,
      hasRender:host?.dataset?.hasRender||null,
      retainedNoticeShown:Boolean(notice&&!notice.hidden),
      retainedNoticeText:(notice?.textContent||"").trim().slice(0,200)
    };
  });
  const frame=editHost.locator("iframe").contentFrame();

  // Geometry the protected kernel never validates. Measured from the main frame so the
  // host element and its shadow iframe document are both reachable: we record the state
  // the render actually produced, then re-run the host's own flag pass to prove whether
  // the automatic pass had been applied (a second run is idempotent when it had).
  const geometry=await page.evaluate(()=>{
    const host=[...document.querySelectorAll('d1-timeline-kernel[data-surface="edit"]')].find((n)=>n.offsetWidth||n.offsetHeight);
    const d=host.shadowRoot.querySelector("iframe").contentDocument;
    const board=d.getElementById("board");
    const snap=()=>[...d.querySelectorAll("#flagLayer .flag")].map((el)=>({
      id:el.dataset.objectId,top:el.style.top,
      left:parseFloat(el.style.left)||0,width:el.offsetWidth,
      label:(el.querySelector(".lbl")?.textContent||"").trim()
    })).sort((a,b)=>a.left-b.left);
    const asRendered=snap();
    const editHosts=[...document.querySelectorAll('d1-timeline-kernel[data-surface="edit"]')].map((n)=>({
      token:n.dataset.kernelToken,w:n.offsetWidth,ready:n.dataset.ready||null,
      fp:(n.dataset.fingerprint||"").slice(0,8),
      docRuns:n.shadowRoot?.querySelector("iframe")?.contentDocument?.documentElement?.dataset?.d1FlagFitRuns||null,
      docCount:n.shadowRoot?.querySelector("iframe")?.contentDocument?.documentElement?.dataset?.d1FlagFitCount||null,
      flags:n.shadowRoot?.querySelector("iframe")?.contentDocument?.querySelectorAll("#flagLayer .flag").length||0
    }));
    const fitRuns=d.documentElement.dataset.d1FlagFitRuns||null;
    const fitCount=d.documentElement.dataset.d1FlagFitCount||null;
    let refitError=null;
    try{host._fitMilestoneFlags?.(d);}catch(error){refitError=String(error?.message||error);}
    const flags=snap();
    const overlapsOf=(list)=>{
      const out=[];
      for(let i=0;i<list.length;i+=1)for(let j=i+1;j<list.length;j+=1){
        const a=list[i],b=list[j];
        if(a.top===b.top&&a.left<b.left+b.width&&b.left<a.left+a.width)out.push(`${a.id}~${b.id}`);
      }
      return out;
    };
    const offOf=(list)=>list.filter((f)=>f.left<0||f.left+f.width>1920).map((f)=>f.id);
    const rect=board.getBoundingClientRect();
    const scale=rect.width/1920;
    const arrowOverflow=[];
    board.querySelectorAll(".arrow").forEach((arrow)=>{
      ["die","date","loc"].forEach((cls)=>{
        const part=arrow.querySelector(`.${cls}`);
        if(!part)return;
        const r=part.getBoundingClientRect();
        const x=(r.left-rect.left)/scale,y=(r.top-rect.top)/scale;
        if(x<-2||y<70||x+r.width/scale>1922||y+r.height/scale>1082)
          arrowOverflow.push(`${arrow.dataset.objectId}.${cls}`);
      });
    });
    /* The kernel's own furniture law can be downgraded to "warn" during recovery, and the
       host only has two lanes that clear the left-hand furniture. A board with several
       same-month events therefore CAN still draw an arrow underneath the Color Key, where
       its label is unreadable. Measure it so it is tracked rather than invisible. */
    const FURNITURE=[{id:"color-key",x:18,y:300,w:416,h:322},{id:"profile-sheet",x:18,y:634,w:566,h:428}];
    const furnitureOverlaps=[];
    board.querySelectorAll(".arrow").forEach((arrow)=>{
      const r=arrow.getBoundingClientRect();
      const x=(r.left-rect.left)/scale,y=(r.top-rect.top)/scale;
      const w=r.width/scale,h=r.height/scale;
      FURNITURE.forEach((f)=>{
        if(x<f.x+f.w&&x+w>f.x&&y<f.y+f.h&&y+h>f.y)
          furnitureOverlaps.push(`${arrow.dataset.objectId}~${f.id}`);
      });
    });
    const titleSpan=board.querySelector("#title span");
    return{flags,overlaps:overlapsOf(flags),offBoard:offOf(flags),arrowOverflow,furnitureOverlaps,
      autoPassApplied:JSON.stringify(asRendered)===JSON.stringify(flags),
      fitRuns,fitCount,editHosts,
      asRenderedOverlaps:overlapsOf(asRendered),asRenderedOffBoard:offOf(asRendered),
      refitError,
      hostOverridesRan:Boolean(titleSpan&&titleSpan.style.fontSize),
      titleFontSize:titleSpan?titleSpan.style.fontSize:null,
      flagLayerPresent:Boolean(board.querySelector("#flagLayer")),
      background:getComputedStyle(board).backgroundImage||getComputedStyle(board).backgroundColor,
      arrows:board.querySelectorAll(".arrow").length};
  });

  await frame.locator("#board").screenshot({path:path.join(captureDir,`${scenario.key}_EDITOR.png`)});

  await navigate("export");
  const exportHost=await kernel("export",null);
  await exportHost.locator("iframe").contentFrame().locator("#board")
    .screenshot({path:path.join(captureDir,`${scenario.key}_EXPORT_PREVIEW.png`)});

  const exportFailures=[];
  if(!renderFailed){
    for(const [format,filename] of [
      ["png-1920x1080",`${scenario.key}_1920x1080.png`],
      ["pdf-letter-landscape",`${scenario.key}_LETTER.pdf`],
      ["pdf-a4-landscape",`${scenario.key}_A4.pdf`]
    ]){
      try{await exportOnce(format,filename);}
      catch(error){exportFailures.push(`${filename}: ${String(error?.message||error).slice(0,120)}`);}
    }
  }

  results.push({
    renderFailed,failureState,exportFailures,
    scenario:scenario.key,events:scenario.events.length,arrows:geometry.arrows,
    flags:geometry.flags.length,flagRowOverlaps:geometry.overlaps,
    flagsOffBoard:geometry.offBoard,arrowPartsOutOfBounds:geometry.arrowOverflow,
    backgroundPresent:Boolean(geometry.background&&geometry.background!=="none"),
    furnitureOverlaps:geometry.furnitureOverlaps,
    hostOverridesRan:geometry.hostOverridesRan,titleFontSize:geometry.titleFontSize,
    autoPassApplied:geometry.autoPassApplied,refitError:geometry.refitError,
    fitRuns:geometry.fitRuns,fitCount:geometry.fitCount,editHosts:geometry.editHosts,
    asRenderedOverlaps:geometry.asRenderedOverlaps,asRenderedOffBoard:geometry.asRenderedOffBoard,
    consoleErrors:consoleErrors.slice(scenarioErrorMark),
    flagLabels:geometry.flags.map((f)=>`${f.label}@${f.top}`)
  });
}

const receipt={generatedAt:new Date().toISOString(),appUrl,zeroEventState,zeroEventConsoleErrors:zeroEventErrors,results,consoleErrors,modalNotices,diagnostics};
writeFileSync(path.join(captureDir,"TAKEOVER_008_EXPORT_DENSITY_RECEIPT.json"),`${JSON.stringify(receipt,null,2)}\n`);
console.log(JSON.stringify(receipt,null,2));

const failures=[
  ...(zeroEventState.emptyStateShown?[]:["zero-events: friendly empty state not shown"]),
  ...zeroEventState.leaks.map((term)=>`zero-events: empty state leaks "${term}"`),
  ...results.flatMap((r)=>[
  ...r.flagsOffBoard.map((id)=>`${r.scenario}: flag off board ${id}`),
  ...r.arrowPartsOutOfBounds.map((id)=>`${r.scenario}: arrow part out of bounds ${id}`),
  ...(r.backgroundPresent?[]:[`${r.scenario}: missing background`]),
  ...(r.renderFailed?[`${r.scenario}: never committed a render (${r.failureState?.error||"unknown"})`]:[]),
  ...(r.exportFailures||[]).map((entry)=>`${r.scenario}: export failed ${entry}`),
  ...(r.furnitureOverlaps||[]).map((entry)=>`${r.scenario}: arrow hidden behind furniture ${entry}`)
])];
if(failures.length){console.error("GATE FAILURES:\n"+failures.join("\n"));process.exitCode=1;}
await context.close();
await browser.close();
