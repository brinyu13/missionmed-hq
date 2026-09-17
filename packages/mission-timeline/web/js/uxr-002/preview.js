import {renderKeynoteClassicBoard,serializeKeynoteClassicSvg} from "./board-renderer.js";
import {DEFAULT_THEME_ID,applyThemeToTimelineRender} from "./themes.js";
import {escapeHtml} from "./utils.js";

function currentUtcMonth(now=new Date()){
  return`${now.getUTCFullYear()}-${String(now.getUTCMonth()+1).padStart(2,"0")}`;
}

function exampleDocument(){
  return{
    studentProfile:{fullName:"Your journey",interviewSeason:""},
    events:[
      {
        id:"example-medical-school",
        title:"Medical school",
        categoryId:"education",
        eventType:"duration",
        startDate:"2020-01",
        endDate:"2023-05",
        visibilityState:"INTERVIEWER_SAFE"
      },
      {
        id:"example-us-clinical",
        title:"US clinical rotations",
        categoryId:"clinical",
        eventType:"duration",
        startDate:"2023-06",
        endDate:"2024-02",
        visibilityState:"INTERVIEWER_SAFE"
      },
      {
        id:"example-research",
        title:"Research",
        categoryId:"research",
        eventType:"duration",
        startDate:"2022-08",
        endDate:"2024-05",
        visibilityState:"INTERVIEWER_SAFE"
      },
      {
        id:"example-step-2",
        title:"Step 2 CK",
        categoryId:"exams",
        eventType:"milestone",
        startDate:"2024-03",
        endDate:null,
        visibilityState:"INTERVIEWER_SAFE"
      }
    ]
  };
}

export function canonicalBoardPreview(
  document,
  {
    ghost=false,
    interactive=false,
    label="Timeline preview",
    audience="INTERVIEWER_SAFE",
    currentMonth=currentUtcMonth(),
    className="",
    eventTargetAttribute=null
  }={}
){
  const source=ghost?exampleDocument():document;
  try{
    const baseRender=renderKeynoteClassicBoard(source,{audience,currentMonth});
    const selectedTheme=source?.theme||DEFAULT_THEME_ID;
    const {scene,svg}=selectedTheme===DEFAULT_THEME_ID?baseRender:
      applyThemeToTimelineRender(baseRender,selectedTheme,{serializeScene:serializeKeynoteClassicSvg});
    const allowedTargetAttributes=new Set(["data-builder-preview-entry","data-canvas-event"]);
    const targetAttribute=allowedTargetAttributes.has(eventTargetAttribute)?eventTargetAttribute:null;
    const interactiveSvg=interactive&&targetAttribute
      ?svg.replace(/data-event-id="([^"]+)"/g,(_,id)=>`data-event-id="${id}" ${targetAttribute}="${id}" tabindex="0" role="button"`)
      :svg;
    return`<div class="board-preview ${ghost?"ghost":""} canonical-board-preview ${interactive?"is-interactive":""} ${escapeHtml(className)}" role="${interactive?"application":"img"}" ${interactive?'tabindex="0"':""} aria-label="${escapeHtml(label)}" data-renderer="${escapeHtml(scene.renderer)}" data-theme="${escapeHtml(scene.theme.id)}" data-event-count="${scene.events.length}">${interactiveSvg}</div>`;
  }catch(error){
    if(!error?.isolated)throw error;
    return`<div class="board-preview ${ghost?"ghost":""} canonical-board-preview render-isolated ${escapeHtml(className)}" role="img" aria-label="${escapeHtml(label)}" data-render-isolated="${escapeHtml(error.code)}">
      <svg viewBox="0 0 1920 1080" aria-hidden="true">
        <defs><linearGradient id="isolated-board" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#F5F7FB"/><stop offset="1" stop-color="#E9EEF6"/></linearGradient></defs>
        <rect width="1920" height="1080" fill="url(#isolated-board)"/>
        <line x1="96" y1="734.4" x2="1824" y2="734.4" stroke="#2A3442" stroke-width="2"/>
      </svg>
    </div>`;
  }
}

// M1/M2 callers retain their stable import while the implementation is now the
// canonical M3/M4 scene renderer rather than the temporary proportional sketch.
export const simpleBoardPreview=canonicalBoardPreview;

export {currentUtcMonth,exampleDocument};
