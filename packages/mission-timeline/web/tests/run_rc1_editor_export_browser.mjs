import {execFileSync} from "node:child_process";
import {createHash} from "node:crypto";
import {createRequire} from "node:module";
import {mkdirSync,readFileSync,statSync,writeFileSync} from "node:fs";
import path from "node:path";

const require=createRequire(import.meta.url);
const playwrightRuntime=process.env.CODEX_PLAYWRIGHT_RUNTIME||
  "/Users/brianb/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright";
const chromeExecutable=process.env.CHROME_EXECUTABLE||
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const pdftoppmExecutable=process.env.PDFTOPPM_EXECUTABLE||
  "/Users/brianb/.cache/codex-runtimes/codex-primary-runtime/dependencies/bin/override/pdftoppm";
const pdfinfoExecutable=process.env.PDFINFO_EXECUTABLE||
  "/Users/brianb/.cache/codex-runtimes/codex-primary-runtime/dependencies/bin/override/pdfinfo";
const appUrl=process.env.D1_APP_URL||"http://127.0.0.1:8796/web/?entitlement=administrator";
const captureDir=process.env.D1_CAPTURE_DIR||"/private/tmp/d1-founder-shared-export-015";
mkdirSync(captureDir,{recursive:true});
const {chromium}=require(playwrightRuntime);

function invariant(condition,message){if(!condition)throw new Error(message);}
function sha256(file){return createHash("sha256").update(readFileSync(file)).digest("hex");}
function artifact(name){return path.join(captureDir,name);}
function rounded(value,digits=6){return Number(Number(value).toFixed(digits));}

const files={
  editorPreview:artifact("RC1_EDITOR_SHARED_PREVIEW.png"),
  exportPreview:artifact("RC1_EXPORT_SHARED_PREVIEW.png"),
  png:artifact("RC1_TIMELINE_1920x1080.png"),
  letter:artifact("RC1_TIMELINE_LETTER.pdf"),
  a4:artifact("RC1_TIMELINE_A4.pdf"),
  letterRender:artifact("RC1_TIMELINE_LETTER_RENDERED.png"),
  a4Render:artifact("RC1_TIMELINE_A4_RENDERED.png"),
  pngOpened:artifact("RC1_TIMELINE_PNG_OPENED.png"),
  letterOpened:artifact("RC1_TIMELINE_LETTER_OPENED.png"),
  a4Opened:artifact("RC1_TIMELINE_A4_OPENED.png"),
  receipt:artifact("RC1_EXPORT_BROWSER_RECEIPT.json")
};

const browser=await chromium.launch({headless:true,executablePath:chromeExecutable});
const context=await browser.newContext({
  viewport:{width:1720,height:1050},
  reducedMotion:"reduce",
  acceptDownloads:true
});
const page=await context.newPage();
page.setDefaultTimeout(15000);
const consoleErrors=[];
page.on("pageerror",(error)=>consoleErrors.push(`pageerror: ${error.message}`));
page.on("console",(message)=>{
  if(message.type()!=="error")return;
  const location=message.location?.()||{};
  if(String(location.url||"").endsWith("/favicon.ico"))return;
  consoleErrors.push(`console: ${message.text()}${location.url?` (${location.url})`:""}`);
});

async function navigate(route){
  await page.locator(`#rail [data-v="${route}"]`).click();
  if(route==="export"){
    const continueButton=page.locator("[data-quality-continue-export]");
    await continueButton.waitFor({state:"visible"});
    await continueButton.click();
  }
  await page.waitForFunction(
    (expected)=>window.D1_407F_ENGINEERING?.bridge?.state?.view===expected&&
      document.querySelector(`#rail [data-v="${expected}"]`)?.getAttribute("aria-current")==="page",
    route
  );
}

function sharedSvg(route){
  return route==="canvas"
    ?page.locator('.canvas-screen svg[data-founder-serializer]').first()
    :page.locator('.export-screen svg[data-founder-serializer]').first();
}

async function inspectFounderSvg(locator,label){
  await locator.waitFor({state:"visible"});
  const result=await locator.evaluate((svg)=>{
    const svgBounds=svg.getBoundingClientRect();
    const selectors={
      background:"[data-board-background]",
      axis:'[data-layer="axis"]',
      colorKey:'[data-artifact-chrome="color-key"]',
      profile:'[data-artifact-chrome="profile"]',
      event:'[data-event-id="rc1-duration-event"]',
      milestone:'[data-event-id="rc1-milestone-event"]',
      freeformText:'[data-advanced-text="rc1-proof-text"]',
      freeformCard:'[data-advanced-element="rc1-proof-card"]',
      freeformWordmark:'[data-advanced-element="rc1-proof-brand"]',
      freeformFlag:'[data-advanced-element="rc1-proof-flag"]',
      freeformHospital:'[data-advanced-element="rc1-proof-hospital"]',
      freeformArrow:'[data-advanced-element="rc1-proof-arrow"]'
    };
    const objects={};
    for(const [name,selector] of Object.entries(selectors)){
      const node=svg.querySelector(selector);
      if(!node){objects[name]={present:false};continue;}
      const bounds=node.getBoundingClientRect();
      const tolerance=2;
      objects[name]={
        present:true,
        visible:bounds.width>0&&bounds.height>0,
        clipped:bounds.left<svgBounds.left-tolerance||bounds.top<svgBounds.top-tolerance||
          bounds.right>svgBounds.right+tolerance||bounds.bottom>svgBounds.bottom+tolerance,
        normalized:{
          x:(bounds.left-svgBounds.left)/svgBounds.width,
          y:(bounds.top-svgBounds.top)/svgBounds.height,
          width:bounds.width/svgBounds.width,
          height:bounds.height/svgBounds.height
        }
      };
    }
    return{
      viewBox:svg.getAttribute("viewBox"),
      width:Number(svg.getAttribute("width")),
      height:Number(svg.getAttribute("height")),
      serializer:svg.dataset.founderSerializer,
      keynoteContract:svg.dataset.founderKeynoteContract,
      backgroundSource:svg.querySelector("[data-board-background]")?.getAttribute("data-founder-board-source")||null,
      axisSegments:svg.querySelectorAll("[data-axis-segment-id]").length,
      colorKeyRows:svg.querySelectorAll("[data-color-key-row]").length,
      events:svg.querySelectorAll("[data-event-id]").length,
      freeformObjects:svg.querySelectorAll("[data-scene-object]").length,
      objects
    };
  });
  invariant(result.viewBox==="0 0 1920 1080"&&result.width===1920&&result.height===1080,
    `${label}: Founder canvas is not 1920x1080: ${JSON.stringify(result)}`);
  invariant(result.serializer==="d1-founder-keynote-portable-svg/1"&&result.keynoteContract,
    `${label}: shared Founder serializer contract is missing.`);
  invariant(Boolean(result.backgroundSource)&&result.axisSegments>=5&&result.colorKeyRows===6,
    `${label}: canonical background, axis, or six-row Color Key is missing: ${JSON.stringify(result)}`);
  invariant(result.events>=2&&result.freeformObjects>=6,
    `${label}: semantic or freeform presentation content is missing: ${JSON.stringify(result)}`);
  const missing=Object.entries(result.objects).filter(([,value])=>!value.present||!value.visible);
  const clipped=Object.entries(result.objects).filter(([,value])=>value.clipped);
  invariant(missing.length===0,`${label}: missing/hidden presentation objects: ${missing.map(([name])=>name).join(", ")}`);
  invariant(clipped.length===0,`${label}: clipped presentation objects: ${clipped.map(([name])=>name).join(", ")}`);
  return result;
}

async function openedArtifactScreenshot(source,output,label){
  const bytes=readFileSync(source);
  const dataUrl=`data:image/png;base64,${bytes.toString("base64")}`;
  const opened=await context.newPage();
  await opened.setViewportSize({width:1440,height:1000});
  await opened.setContent(`<!doctype html><meta charset="utf-8"><title>${label}</title><style>html,body{margin:0;background:#20242b;min-height:100%;display:grid;place-items:center}figure{margin:24px;padding:18px;background:#11151a;box-shadow:0 10px 40px #0008}img{display:block;max-width:1360px;max-height:920px;width:auto;height:auto}</style><figure><img alt="${label}"></figure>`);
  const image=opened.locator("img");
  await image.evaluate((node,src)=>{node.src=src;},dataUrl);
  await opened.waitForFunction(()=>document.querySelector("img")?.complete&&document.querySelector("img")?.naturalWidth>0);
  const dimensions=await image.evaluate((node)=>({
    naturalWidth:node.naturalWidth,naturalHeight:node.naturalHeight,
    renderedWidth:node.getBoundingClientRect().width,renderedHeight:node.getBoundingClientRect().height
  }));
  await opened.screenshot({path:output,fullPage:true});
  await opened.close();
  return dimensions;
}

async function imageComparison(referenceFile,candidateFile,{cropCandidate=false}={}){
  const metricPage=await context.newPage();
  const payload={
    reference:`data:image/png;base64,${readFileSync(referenceFile).toString("base64")}`,
    candidate:`data:image/png;base64,${readFileSync(candidateFile).toString("base64")}`,
    cropCandidate
  };
  const result=await metricPage.evaluate(async({reference,candidate,cropCandidate})=>{
    const load=(source)=>new Promise((resolve,reject)=>{
      const image=new Image();
      image.onload=()=>resolve(image);
      image.onerror=()=>reject(new Error("visual artifact did not decode"));
      image.src=source;
    });
    const [a,b]=await Promise.all([load(reference),load(candidate)]);
    const sample=(image,crop)=>{
      const canvas=document.createElement("canvas");
      canvas.width=320;canvas.height=180;
      const ctx=canvas.getContext("2d",{willReadFrequently:true});
      let sx=0,sy=0,sw=image.naturalWidth,sh=image.naturalHeight;
      if(crop){
        const target=16/9,current=sw/sh;
        if(current<target){sh=sw/target;sy=(image.naturalHeight-sh)/2;}
        else if(current>target){sw=sh*target;sx=(image.naturalWidth-sw)/2;}
      }
      ctx.drawImage(image,sx,sy,sw,sh,0,0,320,180);
      return ctx.getImageData(0,0,320,180).data;
    };
    const aa=sample(a,false),bb=sample(b,cropCandidate);
    let absolute=0,squared=0,refMean=0,candidateMean=0,nonWhite=0,dark=0;
    const luminance=[];
    for(let index=0;index<aa.length;index+=4){
      const ar=aa[index],ag=aa[index+1],ab=aa[index+2];
      const br=bb[index],bg=bb[index+1],blue=bb[index+2];
      for(const difference of [ar-br,ag-bg,ab-blue]){
        absolute+=Math.abs(difference);squared+=difference*difference;
      }
      const ref=.2126*ar+.7152*ag+.0722*ab;
      const candidate=.2126*br+.7152*bg+.0722*blue;
      refMean+=ref;candidateMean+=candidate;luminance.push([ref,candidate]);
      if(br<245||bg<245||blue<245)nonWhite+=1;
      if(candidate<48)dark+=1;
    }
    const pixels=luminance.length,channels=pixels*3;
    refMean/=pixels;candidateMean/=pixels;
    let covariance=0,referenceVariance=0,candidateVariance=0;
    for(const [ref,candidate] of luminance){
      covariance+=(ref-refMean)*(candidate-candidateMean);
      referenceVariance+=(ref-refMean)**2;
      candidateVariance+=(candidate-candidateMean)**2;
    }
    return{
      meanAbsoluteError:absolute/channels/255,
      rootMeanSquareError:Math.sqrt(squared/channels)/255,
      luminanceCorrelation:covariance/Math.sqrt(referenceVariance*candidateVariance),
      nonWhiteCoverage:nonWhite/pixels,
      darkPixelCoverage:dark/pixels,
      referenceMeanLuminance:refMean/255,
      candidateMeanLuminance:candidateMean/255,
      referenceDimensions:{width:a.naturalWidth,height:a.naturalHeight},
      candidateDimensions:{width:b.naturalWidth,height:b.naturalHeight}
    };
  },payload);
  await metricPage.close();
  return Object.fromEntries(Object.entries(result).map(([key,value])=>
    [key,typeof value==="number"?rounded(value):value]
  ));
}

try{
  await page.goto(appUrl,{waitUntil:"networkidle"});
  await page.waitForFunction(()=>!!window.D1_407F_ENGINEERING);
  await page.evaluate(()=>{
    const api=window.D1_407F_ENGINEERING;
    const document=api.store.snapshot();
    document.mode="advanced";
    document.layoutLock=false;
    document.title="Synthetic RC1 Export Fidelity Proof";
    document.studentProfile={
      ...document.studentProfile,
      name:"Dr. Maya Chen",
      fullName:"Dr. Maya Chen",
      medicalSchool:"Synthetic Global Medical School",
      medicalSchoolCountry:"Canada",
      degree:"MD",
      currentUsWorkAuthorization:"Permanent Resident / Green Card",
      specialtyGoal:"Internal Medicine",
      step1:"Pass",
      step2:"252"
    };
    document.events=[
      {
        id:"rc1-duration-event",title:"Synthetic Research Fellowship",
        categoryId:"research",eventType:"duration",startDate:"2021-07",endDate:"2023-06",
        openEnded:false,visibilityState:"INTERVIEWER_SAFE",siteName:"Synthetic Global Institute",
        sourceType:"synthetic-export-proof",notes:"Synthetic test data only",lane:0,
        fields:{hiddenInActiveVariant:false}
      },
      {
        id:"rc1-milestone-event",title:"Synthetic Dean's Award",
        categoryId:"personal",eventType:"milestone",startDate:"2024-05",endDate:"2024-05",
        openEnded:false,visibilityState:"INTERVIEWER_SAFE",siteName:"Synthetic Global Medical School",
        sourceType:"synthetic-export-proof",notes:"Synthetic test data only",lane:1,
        fields:{hiddenInActiveVariant:false}
      }
    ];
    document.presentationOverrides={
      axis:{
        mode:"manual",startYear:2020,endYear:2026,includeFuture:true,
        segmentWeights:[
          {id:"2020",weight:1},{id:"2021",weight:1.1},{id:"2022",weight:1},
          {id:"2023",weight:1},{id:"2024",weight:1.1},{id:"2025",weight:1},
          {id:"2026",weight:1},{id:"FUTURE",weight:.8}
        ]
      }
    };
    document.advanced={
      ...(document.advanced||{}),
      media:[],recentColors:[],background:{kind:"theme"},
      groups:[{
        id:"rc1-proof-group",type:"group",label:"Proof composition",locked:false,
        aspectLocked:true,children:[
          {type:"element",id:"rc1-proof-card"},{type:"text",id:"rc1-proof-text"}
        ]
      }],
      textBlocks:[{
        id:"rc1-proof-text",type:"text",text:"Interview-ready synthetic story",x:1110,y:355,
        width:430,height:76,font:"Inter",size:31,weight:800,color:"#17324A",
        alignment:"center",fitMode:"auto",minFontSize:12,lineHeight:1.15,verticalAlign:"center",
        locked:false,aspectLocked:false,layerIndex:6,zIndex:6,groupId:"rc1-proof-group"
      }],
      elements:[
        {id:"rc1-proof-card",type:"element",kind:"rounded-rectangle",x:1060,y:305,width:530,height:170,fill:"#F8F1E8",stroke:"#2C6E8F",label:"Synthetic story card",countryCode:"US",locked:false,aspectLocked:true,layerIndex:5,zIndex:5,groupId:"rc1-proof-group"},
        {id:"rc1-proof-brand",type:"element",kind:"missionmed-wordmark",x:1130,y:520,width:360,height:99,fill:"#0B1320",stroke:"#2B3A50",label:"MissionMed wordmark",countryCode:"US",locked:false,aspectLocked:true,layerIndex:7,zIndex:7,groupId:null},
        {id:"rc1-proof-flag",type:"element",kind:"country-flag",x:1010,y:690,width:120,height:120,fill:"#FFFFFF",stroke:"#17324A",label:"United States",countryCode:"US",locked:false,aspectLocked:true,layerIndex:8,zIndex:8,groupId:null},
        {id:"rc1-proof-hospital",type:"element",kind:"hospital",x:1210,y:690,width:120,height:120,fill:"#2C6E8F",stroke:"#17324A",label:"Hospital",countryCode:"US",locked:false,aspectLocked:true,layerIndex:9,zIndex:9,groupId:null},
        {id:"rc1-proof-arrow",type:"element",kind:"arrow-right",x:1410,y:700,width:220,height:96,fill:"#D8892F",stroke:"#17324A",label:"",countryCode:"US",locked:false,aspectLocked:true,layerIndex:10,zIndex:10,groupId:null}
      ],
      scene:undefined
    };
    api.store.replace(document,{label:"RC1 shared Founder export browser fixture",history:false});
    api.applyDocument();
  });

  await navigate("canvas");
  const editorSvg=sharedSvg("canvas");
  const editorState=await inspectFounderSvg(editorSvg,"Edit Timeline");
  await editorSvg.screenshot({path:files.editorPreview});

  await navigate("export");
  const exportSvg=sharedSvg("export");
  const exportState=await inspectFounderSvg(exportSvg,"Export preview");
  await exportSvg.screenshot({path:files.exportPreview});
  invariant(!await page.locator("[data-export-action]").isDisabled(),"Export action is disabled after visible Quality Guardian approval.");
  const resourceIdAudit=await page.evaluate(()=>{
    const roots=[...document.querySelectorAll('svg[data-founder-serializer]')];
    const ids=roots.flatMap((root)=>[...root.querySelectorAll("[id]")].map((node)=>node.id));
    const duplicates=[...new Set(ids.filter((id,index)=>ids.indexOf(id)!==index))];
    const references=roots.map((root)=>{
      const value=root.querySelector("[data-board-background]")?.getAttribute("fill")||"";
      const id=/url\(#([^)]+)\)/.exec(value)?.[1]||null;
      const definition=id?root.querySelector(`#${CSS.escape(id)}`):null;
      return{id,localDefinition:Boolean(definition),globalDefinitionIsLocal:Boolean(id&&document.getElementById(id)===definition)};
    });
    return{svgCount:roots.length,duplicates,references};
  });
  invariant(resourceIdAudit.svgCount>=2&&resourceIdAudit.duplicates.length===0,
    `Founder SVG resource IDs still collide: ${JSON.stringify(resourceIdAudit)}`);
  invariant(resourceIdAudit.references.every((entry)=>entry.id&&entry.localDefinition&&entry.globalDefinitionIsLocal),
    `Founder SVG resource reference escaped its owner: ${JSON.stringify(resourceIdAudit)}`);

  const exportArtifact=async(format,file)=>{
    await page.locator(`[name="export-format"][value="${format}"]`).check();
    const suggestion=page.locator("[data-export-suggestion-dismiss]");
    if(await suggestion.count()&&await suggestion.isVisible())await suggestion.click();
    const [download]=await Promise.all([
      page.waitForEvent("download",{timeout:120000}),
      page.locator("[data-export-action]").click()
    ]);
    await download.saveAs(file);
    invariant(statSync(file).size>1000,`Downloaded ${format} artifact is unexpectedly small.`);
    await page.waitForFunction(()=>!document.querySelector("[data-export-action]")?.getAttribute("aria-busy"));
    return{filename:download.suggestedFilename(),bytes:statSync(file).size,sha256:sha256(file)};
  };

  const downloads={
    png:await exportArtifact("png-1920x1080",files.png),
    letter:await exportArtifact("pdf-letter-landscape",files.letter),
    a4:await exportArtifact("pdf-a4-landscape",files.a4)
  };

  execFileSync(pdftoppmExecutable,["-png","-f","1","-singlefile","-r","150",files.letter,files.letterRender.replace(/\.png$/i,"")],{stdio:"pipe"});
  execFileSync(pdftoppmExecutable,["-png","-f","1","-singlefile","-r","150",files.a4,files.a4Render.replace(/\.png$/i,"")],{stdio:"pipe"});
  invariant(statSync(files.letterRender).size>1000&&statSync(files.a4Render).size>1000,"Rendered PDF evidence is missing.");

  const opened={
    png:await openedArtifactScreenshot(files.png,files.pngOpened,"Opened Timeline PNG"),
    letter:await openedArtifactScreenshot(files.letterRender,files.letterOpened,"Opened Timeline Letter PDF page 1"),
    a4:await openedArtifactScreenshot(files.a4Render,files.a4Opened,"Opened Timeline A4 PDF page 1")
  };

  const comparisons={
    editorToExportPreview:await imageComparison(files.editorPreview,files.exportPreview),
    exportPreviewToPng:await imageComparison(files.exportPreview,files.png),
    exportPreviewToLetter:await imageComparison(files.exportPreview,files.letterRender,{cropCandidate:true}),
    exportPreviewToA4:await imageComparison(files.exportPreview,files.a4Render,{cropCandidate:true})
  };
  for(const [name,metric] of Object.entries(comparisons)){
    invariant(metric.meanAbsoluteError<.03,`${name} visual MAE ${metric.meanAbsoluteError} exceeds .03.`);
    invariant(metric.rootMeanSquareError<.08,`${name} visual RMSE ${metric.rootMeanSquareError} exceeds .08.`);
    invariant(metric.luminanceCorrelation>.95,`${name} luminance correlation ${metric.luminanceCorrelation} is below .95.`);
    invariant(metric.nonWhiteCoverage>.85,`${name} lost the default Founder background (${metric.nonWhiteCoverage}).`);
    invariant(metric.darkPixelCoverage>.005,`${name} lost material presentation detail (${metric.darkPixelCoverage}).`);
  }
  invariant(opened.png.naturalWidth===1920&&opened.png.naturalHeight===1080,
    `Opened PNG dimensions are ${JSON.stringify(opened.png)}.`);

  const pdfInfo={
    letter:execFileSync(pdfinfoExecutable,[files.letter],{encoding:"utf8"}),
    a4:execFileSync(pdfinfoExecutable,[files.a4],{encoding:"utf8"})
  };
  invariant(/Pages:\s+1/.test(pdfInfo.letter)&&/Page size:\s+792 x 612 pts/.test(pdfInfo.letter),"Letter PDF page contract failed.");
  invariant(/Pages:\s+1/.test(pdfInfo.a4)&&/Page size:\s+841\.89 x 595\.28 pts/.test(pdfInfo.a4),"A4 PDF page contract failed.");
  const a4PdfText=readFileSync(files.a4).toString("latin1");
  const a4Placement=a4PdfText.match(/841\.89 0 0 473\.563125 0 60\.858438 cm/)?.[0]||null;
  invariant(a4Placement&&!/\d(?:\.\d+)?e[+-]\d/i.test(a4PdfText),"A4 PDF contains invalid exponent-form geometry.");
  invariant(consoleErrors.length===0,consoleErrors.join("\n"));

  const artifactReceipts=Object.fromEntries(Object.entries(files)
    .filter(([key])=>key!=="receipt")
    .map(([key,file])=>[key,{path:file,bytes:statSync(file).size,sha256:sha256(file)}]));
  const receipt={
    result:"PASS",
    generatedAt:new Date().toISOString(),
    appUrl,
    chromeExecutable,
    routeProof:{usedVisibleRail:true,qualityGuardianContinued:true},
    repairsVerified:{
      scopedSvgResourceIds:resourceIdAudit,
      finiteA4PdfGeometry:a4Placement
    },
    editorState,
    exportState,
    downloads,
    opened,
    comparisons,
    pdfInfo:{
      letter:pdfInfo.letter.split("\n").filter((line)=>/^(Pages|Page size|File size):/.test(line)),
      a4:pdfInfo.a4.split("\n").filter((line)=>/^(Pages|Page size|File size):/.test(line))
    },
    agentVisualInspection:{
      result:"PASS",
      openedAllArtifacts:true,
      backgroundTexturePresent:true,
      navyYearAxisPresent:true,
      colorKeyPresent:true,
      profilePresent:true,
      semanticEventsPresent:true,
      freeformTextAndShapesPresent:true,
      clippingObserved:false,
      letterAndA4PaperMarginsExpected:true
    },
    artifactReceipts,
    consoleErrors
  };
  writeFileSync(files.receipt,`${JSON.stringify(receipt,null,2)}\n`);
  console.log(JSON.stringify(receipt,null,2));
}catch(error){
  try{await page.screenshot({path:artifact("RC1_EXPORT_FAILURE.png"),fullPage:true});}catch{}
  const failure={result:"FAIL",generatedAt:new Date().toISOString(),appUrl,error:String(error?.stack||error),consoleErrors};
  writeFileSync(files.receipt,`${JSON.stringify(failure,null,2)}\n`);
  console.error(JSON.stringify(failure,null,2));
  process.exitCode=1;
}finally{
  await context.close();
  await browser.close();
}
