import {createHash} from "node:crypto";
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync
} from "node:fs";
import {join,relative,resolve} from "node:path";
import {fileURLToPath} from "node:url";

const packageRoot=resolve(fileURLToPath(new URL("../",import.meta.url)));
const repositoryRoot=resolve(packageRoot,"../..");
const sourceRoot=join(packageRoot,"web");
const outputRoot=join(repositoryRoot,"_BUILD_TEMP/D1-404_TIMELINE_407F");
const applicationRoot=join(outputRoot,"web");
const prohibitedRuntimePaths=[
  "tests",
  "node_modules",
  ".DS_Store",
  "TimelineBuilder_v5.5_PreLaunch.html"
];

function sha256(path){
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function files(directory){
  return readdirSync(directory,{withFileTypes:true}).flatMap((entry)=>{
    const path=join(directory,entry.name);
    return entry.isDirectory()?files(path):[path];
  });
}

function visibleHtmlText(source){
  return source
    .replace(/<script\b[\s\S]*?<\/script>/gi," ")
    .replace(/<style\b[\s\S]*?<\/style>/gi," ")
    .replace(/<!--[\s\S]*?-->/g," ")
    .replace(/<[^>]+>/g," ")
    .replace(/&(?:nbsp|amp|lt|gt|quot|#39);/gi," ")
    .replace(/\s+/g," ")
    .trim();
}

if(!existsSync(join(sourceRoot,"index.html"))){
  throw new Error(`D1-404 source entry is missing: ${join(sourceRoot,"index.html")}`);
}

rmSync(outputRoot,{recursive:true,force:true});
mkdirSync(outputRoot,{recursive:true});
cpSync(sourceRoot,applicationRoot,{
  recursive:true,
  filter:(source)=>!prohibitedRuntimePaths.some((name)=>source.split("/").includes(name))
});

const indexPath=join(applicationRoot,"index.html");
const index=readFileSync(indexPath,"utf8");
if(!index.includes('src="./js/407f-engineering-adapter.js"')){
  throw new Error("Built candidate does not activate the canonical 407F engineering adapter.");
}
if(/src=["']\.\/js\/(?:app|uxr-002\/app)\.js["']/i.test(index)){
  throw new Error("Built candidate reactivates a superseded shell entry.");
}

const prohibitedTerms=[
  "fixture",
  "quarantine",
  "engine",
  "dupe",
  "command",
  "stress",
  "sprite",
  "OP D1"
];
const visibleText=visibleHtmlText(index);
const prohibitedVisible=prohibitedTerms.filter((term)=>
  new RegExp(`\\b${term.replace(" ","\\s+")}\\b`,"i").test(visibleText)
);
if(prohibitedVisible.length){
  throw new Error(`Prohibited visible language in build: ${prohibitedVisible.join(", ")}`);
}

const records=files(applicationRoot)
  .map((path)=>({
    path:relative(outputRoot,path),
    bytes:statSync(path).size,
    sha256:sha256(path)
  }))
  .sort((left,right)=>left.path.localeCompare(right.path));

const manifest={
  schemaVersion:"d1-404-local-candidate-build.1",
  classification:"LOCAL_DEPLOYMENT_CANDIDATE",
  canonicalPresentation:"407F",
  deployed:false,
  productionWrites:false,
  matrixWrites:false,
  sourceRoot,
  fileCount:records.length,
  files:records
};
writeFileSync(
  join(outputRoot,"manifest.json"),
  `${JSON.stringify(manifest,null,2)}\n`
);

process.stdout.write(
  `${outputRoot}\n${records.length} runtime files\nmanifest sha256 ${sha256(join(outputRoot,"manifest.json"))}\n`
);
