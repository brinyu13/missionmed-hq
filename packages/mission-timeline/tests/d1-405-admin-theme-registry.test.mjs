import assert from "node:assert/strict";
import test from "node:test";

import {
  ADMIN_THEME_PACKAGE_BOUNDARY,
  ADMIN_THEME_PACKAGE_SCHEMA_VERSION,
  ADMIN_THEME_PERMISSION,
  ADMIN_THEME_PREVIEW_CONTRACT,
  buildAdminThemePreviewRequest,
  createAdminThemeRegistry,
  importAdminThemePackage,
  validateAdminThemePackage
} from "../web/js/uxr-002/admin-theme-registry.js";
import {defaultDocument} from "../web/js/uxr-002/store.js";

const sha="a".repeat(64);

function themePackage(version="1.0.0"){
  return{
    schemaVersion:ADMIN_THEME_PACKAGE_SCHEMA_VERSION,
    id:"missionmed-admin-editorial",
    version,
    compatibility:{
      minimumRendererVersion:"1.0.0",
      maximumRendererVersion:"1.9.9"
    },
    definition:{
      id:"admin-editorial",
      name:"Admin Editorial",
      descriptor:"Structured and calm.",
      board:{kind:"flat",color:"#FFFFFF"},
      axis:{color:"#191C21",width:2,lineCap:"butt",endSerifHeight:0},
      ticks:{color:"#565D66"},
      yearLabel:{
        color:"#191C21",
        fontSize:20,
        fontWeight:700,
        fontFamily:"Inter, sans-serif",
        letterSpacing:"0"
      },
      ink:"#191C21",
      categories:{
        education:"#2C6E8F",
        exams:"#3A78C9",
        clinical:"#C8641C",
        work:"#3F9B52",
        research:"#8B6D13",
        personal:"#76509E"
      },
      flagPlate:{
        shape:"plate",
        fill:"#191C21",
        border:"#191C21",
        borderWidth:1,
        ink:"#FFFFFF",
        radius:6
      },
      arrowShadow:{enabled:false,value:null},
      headline:{
        color:"#191C21",
        fontSize:24,
        fontWeight:700,
        fontFamily:"Inter, sans-serif",
        rule:null
      },
      geometry:{arrowCornerRadius:3,flagCornerRadius:6}
    },
    assets:[
      {
        id:"editorial-mark",
        mimeType:"image/webp",
        sha256:sha,
        bytes:2048
      }
    ]
  };
}

test("M10 admin theme packages are structured, versioned, compatible, and never executable",()=>{
  const validation=validateAdminThemePackage(themePackage());
  assert.equal(validation.valid,true,validation.errors.join("\n"));
  assert.equal(validation.executableContentAccepted,false);
  assert.equal(ADMIN_THEME_PACKAGE_BOUNDARY.structuredDataOnly,true);
  assert.equal(ADMIN_THEME_PACKAGE_BOUNDARY.arbitraryCss,false);
  assert.equal(ADMIN_THEME_PACKAGE_BOUNDARY.arbitraryJavaScript,false);
  assert.equal(ADMIN_THEME_PACKAGE_BOUNDARY.productionAdminBackend,false);

  const unsafe=themePackage();
  unsafe.definition.board.css="body{display:none}";
  const rejected=validateAdminThemePackage(unsafe);
  assert.equal(rejected.valid,false);
  assert.ok(rejected.errors.some((message)=>message.includes("structured data only")));
});

test("M10 registry preserves the five frozen themes and falls back safely for unknown ids",()=>{
  const registry=createAdminThemeRegistry();
  assert.equal(registry.frozenThemeIds.length,5);
  assert.deepEqual(registry.importedThemeIds,[]);
  const fallback=registry.resolve("not-installed");
  assert.equal(fallback.fallbackUsed,true);
  assert.equal(fallback.resolvedThemeId,"keynote-classic");
  assert.equal(fallback.theme.id,"keynote-classic");
});

test("M10 import boundary enforces permission, asset approval, version advance, and one registry",async()=>{
  await assert.rejects(
    importAdminThemePackage(themePackage(),{
      permissionBoundary:()=>false,
      assetResolver:async()=>({approved:true,sha256:sha})
    }),
    new RegExp(ADMIN_THEME_PERMISSION)
  );
  const imported=await importAdminThemePackage(themePackage(),{
    actor:{id:"admin-1"},
    permissionBoundary:({permission})=>permission===ADMIN_THEME_PERMISSION,
    assetResolver:async(asset)=>({approved:true,sha256:asset.sha256})
  });
  assert.deepEqual(imported.importedThemeIds,["admin-editorial"]);
  const resolved=imported.resolve("admin-editorial");
  assert.equal(resolved.fallbackUsed,false);
  assert.equal(resolved.theme.board.css,"#FFFFFF");
  assert.equal(resolved.theme.package.version,"1.0.0");

  await assert.rejects(
    importAdminThemePackage(themePackage("1.0.0"),{
      permissionBoundary:()=>true,
      assetResolver:async(asset)=>({approved:true,sha256:asset.sha256}),
      registry:imported
    }),
    /must advance/
  );
});

test("M10 preview seam uses the canonical renderer contract and remains local-only",()=>{
  const request=buildAdminThemePreviewRequest(themePackage(),defaultDocument());
  assert.equal(request.contract,ADMIN_THEME_PREVIEW_CONTRACT);
  assert.equal(request.renderer,"D1-UXR-002-Keynote-Classic");
  assert.equal(request.contentSource,"example");
  assert.equal(request.executableContent,false);
  assert.equal(request.externalApiCalls,false);
  assert.equal(request.productionWrites,false);
  assert.equal(request.fallbackThemeId,"keynote-classic");
});
