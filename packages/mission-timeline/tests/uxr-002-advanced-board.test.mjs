import assert from "node:assert/strict";
import test from "node:test";

import {renderAdvancedBoard} from "../web/js/uxr-002/advanced-board.js";

function baseRenderer(){
  return{
    scene:{events:[],accessibility:{ariaLabel:"Timeline",description:"Timeline"}},
    svg:'<svg><rect data-board-background="true" width="1920" height="1080" fill="#fff"/><text data-board-headline="true" x="40" y="60" fill="#111" font-family="Inter" font-size="48" font-weight="700">Journey</text></svg>'
  };
}

test("Guided rendering remains byte-for-byte owned by the canonical renderer",()=>{
  const rendered=renderAdvancedBoard({mode:"guided"},{},{baseRenderer});
  assert.equal(rendered.svg,baseRenderer().svg);
  assert.equal(rendered.advanced,undefined);
});

test("Advanced rendering composes local background, media, text, and headline typography without network behavior",()=>{
  const document={
    mode:"advanced",
    advanced:{
      background:{kind:"upload",mediaId:"background",dim:20,scrim:"black"},
      media:[{id:"logo",kind:"logo",x:1736,y:64,width:120,height:60,layerIndex:0}],
      textBlocks:[{id:"note",text:"My story",x:960,y:900,font:"Georgia",size:32,weight:600,color:"#191C21",alignment:"center",layerIndex:1}],
      headlineTypography:{font:"Nunito",size:52,weight:700,color:"#2A3442",alignment:"left"}
    }
  };
  const rendered=renderAdvancedBoard(document,{},{
    baseRenderer,
    resolveObjectUrl:(id)=>`blob:local-${id}`
  });
  assert.match(rendered.svg,/href="blob:local-background"/);
  assert.match(rendered.svg,/data-background-scrim="true"/);
  assert.match(rendered.svg,/data-advanced-media="logo"[^>]+href="blob:local-logo"/);
  assert.match(rendered.svg,/data-advanced-text="note"/);
  assert.match(rendered.svg,/font-family="Nunito"/);
  assert.deepEqual(rendered.advanced,{
    visible:true,
    backgroundKind:"upload",
    mediaCount:1,
    textCount:1,
    elementCount:0
  });
});

test("Advanced preset and flat-color backgrounds remain app-owned descriptors",()=>{
  const preset=renderAdvancedBoard({
    mode:"advanced",
    advanced:{background:{kind:"preset",preset:"gradient-dawn"},media:[],textBlocks:[]}
  },{},{baseRenderer});
  assert.match(preset.svg,/background:linear-gradient/);
  assert.doesNotMatch(preset.svg,/url\s*\(/i);

  const color=renderAdvancedBoard({
    mode:"advanced",
    advanced:{background:{kind:"color",color:"#B98A2E"},media:[],textBlocks:[]}
  },{},{baseRenderer});
  assert.match(color.svg,/data-board-background="true"[^>]+fill="#B98A2E"/);
});
