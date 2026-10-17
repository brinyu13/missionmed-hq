import {createHash} from "node:crypto";
import {mkdir,readFile,writeFile} from "node:fs/promises";
import {dirname,resolve} from "node:path";
import {fileURLToPath} from "node:url";

const packageRoot=resolve(dirname(fileURLToPath(import.meta.url)),"..");
const canonicalPath="/Users/brianb/MissionMed_AI_Sandbox/CLAUDE_FILES/(D1)-MacProTimeline-Fable5-DefinitiveFullProductPrototype-407F.html";
const outputRoot=resolve(packageRoot,"web/assets/locked_407f");
const canonical=await readFile(canonicalPath,"utf8");
const assetsStart=canonical.indexOf("const ASSETS=");
const spritesStart=canonical.indexOf("const SPR402=",assetsStart);
if(assetsStart<0||spritesStart<0){
  throw new Error("The locked 407F ASSETS object was not found.");
}
const assetsTerminator=canonical.lastIndexOf("};",spritesStart);
if(assetsTerminator<assetsStart){
  throw new Error("The locked 407F ASSETS object terminator was not found.");
}
const assetsSource=canonical
  .slice(assetsStart+"const ASSETS=".length,assetsTerminator+1)
  .trim()
  .replace(/;$/,"");
const assets=Function(`"use strict";return (${assetsSource});`)();
const spritesEnd=canonical.indexOf("\nconst SPRCAT=",spritesStart);
if(spritesEnd<0){
  throw new Error("The locked 407F SPR402 object was not found.");
}
const spritesSource=canonical
  .slice(spritesStart+"const SPR402=".length,spritesEnd)
  .trim()
  .replace(/;$/,"");
const sprites=JSON.parse(spritesSource);
const names={
  board:"board_texture_locked_407f.jpg",
  plaque:"title_plaque_locked_407f.png",
  paper:"profile_paper_locked_407f.png",
  sticky:"sticky_note_locked_407f.png",
  pin:"pushpin_locked_407f.png",
  flag:"usa_flag_locked_407f.png",
  key:"color_key_locked_407f.png"
};
const sha256=(value)=>createHash("sha256").update(value).digest("hex");
const manifest={
  authority:{
    path:canonicalPath,
    sha256:sha256(canonical)
  },
  extraction:"verbatim data URLs from the locked 407F ASSETS and SPR402 objects",
  assets:{},
  sprites:{}
};

await mkdir(outputRoot,{recursive:true});
const writeDataUrl=async(source,filename)=>{
  const comma=source.indexOf(",");
  if(!source.startsWith("data:image/")||comma<0){
    throw new Error(`Locked 407F source for ${filename} is not an image data URL.`);
  }
  const bytes=Buffer.from(source.slice(comma+1),"base64");
  await writeFile(resolve(outputRoot,filename),bytes);
  return{
    filename,
    bytes:bytes.length,
    sha256:sha256(bytes)
  };
};
for(const [key,filename] of Object.entries(names)){
  const source=String(assets[key]||"");
  manifest.assets[key]=await writeDataUrl(source,filename);
}
for(const [category,parts] of Object.entries(sprites)){
  if(typeof parts==="string"){
    const filename=`${category}_locked_407f.png`;
    manifest.sprites[category]=await writeDataUrl(parts,filename);
    continue;
  }
  manifest.sprites[category]={};
  for(const [part,source] of Object.entries(parts)){
    const filename=part==="body"&&category==="axis"
      ?"axis_body_locked_407f.png"
      :`${category}_${part}_locked_407f.png`;
    manifest.sprites[category][part]=await writeDataUrl(source,filename);
  }
}
await writeFile(
  resolve(outputRoot,"manifest.json"),
  `${JSON.stringify(manifest,null,2)}\n`,
  "utf8"
);
await writeFile(
  resolve(outputRoot,"data-urls.js"),
  [
    "/* Generated verbatim from the locked 407F ASSETS and SPR402 objects. */",
    `export const LOCKED_407F_DATA_URLS=${JSON.stringify({assets,sprites})};`,
    ""
  ].join("\n"),
  "utf8"
);
