import assert from "node:assert/strict";
import test from "node:test";

import {
  buildKeynoteClassicScene,
  serializeKeynoteClassicSvg
} from "../web/js/uxr-002/board-renderer.js";
import {
  LOCKED_407F_GEOMETRY,
  LOCKED_407F_SOURCE_SHA256
} from "../web/js/uxr-002/locked-407f-artifact.js";
import {
  THEME_DEFINITIONS,
  applyThemeToScene
} from "../web/js/uxr-002/themes.js";

const timeline={
  studentProfile:{
    fullName:"Sofia Ramirez",
    medicalSchool:"Universidad de Guadalajara",
    degree:"MD",
    currentUsWorkAuthorization:"U.S. Citizen",
    specialtyGoal:"Internal Medicine",
    interviewSeason:"2026-11"
  },
  metadata:{
    interview:{
      date:"2026-11",
      programName:"Mission University Medical Center",
      label:"MY BIG INTERVIEW",
      specialtyLabel:"Internal Medicine"
    }
  },
  events:[
    {
      id:"work",
      title:"Medical Officer",
      categoryId:"work",
      eventType:"duration",
      startDate:"2018-01",
      endDate:"2019-09",
      siteName:"India",
      visibilityState:"INTERVIEWER_SAFE"
    },
    {
      id:"exam",
      title:"Step 2 CK",
      categoryId:"exams",
      eventType:"duration",
      startDate:"2019-11",
      endDate:"2020-06",
      visibilityState:"INTERVIEWER_SAFE"
    },
    {
      id:"rotation",
      title:"Internal Medicine",
      categoryId:"clinical",
      eventType:"duration",
      startDate:"2021-02",
      endDate:"2021-08",
      siteName:"St Peters, NJ",
      visibilityState:"INTERVIEWER_SAFE",
      fields:{lorSubmitted:true}
    },
    {
      id:"family",
      title:"Raising Daughter",
      categoryId:"personal",
      eventType:"duration",
      startDate:"2022-03",
      endDate:null,
      openEnded:true,
      visibilityState:"INTERVIEWER_SAFE"
    },
    {
      id:"milestone",
      title:"ECFMG Certified",
      categoryId:"education",
      eventType:"milestone",
      startDate:"2020-09",
      endDate:null,
      visibilityState:"INTERVIEWER_SAFE"
    },
    {
      id:"explanation",
      title:"Family context",
      categoryId:"personal",
      eventType:"annotation",
      startDate:"2022-03",
      endDate:"2022-03",
      visibilityState:"INTERVIEWER_SAFE",
      fields:{
        builderDomain:"explanation",
        explanationText:"Balanced rotations while caring for a new baby.",
        target:{kind:"event",eventId:"family"},
        leaderEnabled:true
      }
    }
  ]
};

function scene(){
  return buildKeynoteClassicScene(timeline,{currentMonth:"2026-07"});
}

function geometrySignature(value){
  return{
    axis:[value.axis.x1,value.axis.x2,value.axis.y],
    arrows:value.arrows.map((arrow)=>[
      arrow.id,
      arrow.x,
      arrow.x2,
      arrow.centerY,
      arrow.shaftHeight,
      arrow.headLength,
      arrow.headHeight,
      arrow.path
    ]),
    flags:value.flags.map((flag)=>[
      flag.id,
      flag.anchorX,
      flag.plate.x,
      flag.plate.y,
      flag.pole.y2
    ]),
    explanations:value.explanations.map((item)=>[
      item.id,
      item.x,
      item.y,
      item.width,
      item.height,
      item.target.x,
      item.target.y
    ])
  };
}

test("Founder artifact contract restores the recognizable 407F PowerPoint composition",()=>{
  const rendered=scene();
  const svg=serializeKeynoteClassicSvg(rendered);
  assert.equal(rendered.board.width,1920);
  assert.equal(rendered.board.height,1080);
  assert.equal(rendered.axis.y,64);
  assert.ok(rendered.arrows.every((arrow)=>arrow.centerY>rendered.axis.y));
  assert.ok(rendered.arrows.every((arrow,index)=>
    index===0||arrow.centerY>rendered.arrows[index-1].centerY
  ));
  assert.match(svg,/data-artifact-language="407f-powerpoint-keynote"/);
  assert.match(svg,new RegExp(`data-locked-407f-source-sha256="${LOCKED_407F_SOURCE_SHA256}"`));
  assert.deepEqual(LOCKED_407F_GEOMETRY,{
    width:1920,
    height:1080,
    axisTop:64,
    axisHeight:34,
    laneTop:132,
    lanePitch:46,
    condensedLanePitch:32,
    arrowHeight:30,
    capWidth:9,
    headWidth:15,
    minimumArrowWidth:52,
    horizontalInsetPercent:2
  });
  assert.match(svg,/--kbPlaque:url/);
  assert.match(svg,/data-axis-language="407f-powerpoint"/);
  assert.match(svg,/--axisSprite:url/);
  assert.match(svg,/--sc:url/);
  assert.match(svg,/--sb:url/);
  assert.match(svg,/--sh:url/);
  assert.match(svg,/class="locked407F-aloc"/);
  assert.match(svg,/class="locked407F-fmark"/);
  assert.match(svg,/data-artifact-chrome="color-key"/);
  assert.match(svg,/data-artifact-chrome="profile"/);
  assert.match(svg,/data-artifact-chrome="photo-frames"/);
  assert.match(svg,/data-interview-destination="407f-ribbon"/);
  assert.match(svg,/data-event-kind="explanation"/);
  assert.match(svg,/--kbSticky:url/);
  assert.match(svg,/locked407F-explanationLeader/);
  assert.match(svg,/data-lor-submitted="true"/);
  assert.match(svg,/data-lor-legend="true"/);
  assert.doesNotMatch(svg,/data-axis-language="generic-horizontal"/);
});

test("Founder artifact contract keeps event ownership and accessibility intact",()=>{
  const rendered=scene();
  const svg=serializeKeynoteClassicSvg(rendered);
  for(const id of ["work","exam","rotation","family","milestone","explanation"]){
    assert.match(svg,new RegExp(`data-event-id="${id}"`));
  }
  assert.deepEqual(
    rendered.accessibility.tabOrder,
    ["work","exam","milestone","rotation","family","explanation"]
  );
  assert.equal(rendered.laneLayout.presentationPolicy,"407f-chronological-stair-step");
  assert.equal(rendered.events.length,6);
});

test("Founder artifact contract makes all five themes surface-only over one geometry",()=>{
  const source=scene();
  const signature=geometrySignature(source);
  for(const theme of THEME_DEFINITIONS){
    const themed=applyThemeToScene(source,theme.id);
    assert.deepEqual(geometrySignature(themed),signature,theme.id);
    assert.equal(themed.events.length,source.events.length,theme.id);
    assert.equal(themed.explanations.length,source.explanations.length,theme.id);
    assert.match(
      serializeKeynoteClassicSvg(themed),
      /data-artifact-language="407f-powerpoint-keynote"/,
      theme.id
    );
  }
});
