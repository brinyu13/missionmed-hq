import{CATEGORY_DEFINITIONS}from"./adaptive-layout.js";

export const APP_VERSION="D1-UXR-002";
export const DOCUMENT_SCHEMA="d1-uxr-002.1";
export const AUTOSAVE_DELAY=800;
export const HISTORY_LIMIT=50;

export const NAV_ITEMS=Object.freeze([
  {id:"home",label:"Home",icon:"house"},
  {id:"builder",label:"Builder",icon:"list-checks"},
  {id:"canvas",label:"Canvas",icon:"presentation"},
  {id:"export",label:"Export",icon:"download"}
]);

export const BUILDER_STEPS=Object.freeze([
  {id:"core",title:"Core Info",purpose:"Who you are and where you trained."},
  {id:"exams",title:"Exams",purpose:"Your exam story — scores and results first, dates second."},
  {id:"clinical",title:"US Clinical Rotations",purpose:"One rotation at a time. We'll fill in what we can."},
  {id:"work",title:"Work Experience",purpose:"Clinical or not, US or abroad — work belongs on the story."},
  {id:"research",title:"Research",purpose:"Projects, posters, and papers — with your author position."},
  {id:"personal",title:"Personal",purpose:"The life behind the CV — moves, family, service, anything that shaped the journey."},
  {id:"review",title:"Review & finish",purpose:"Everything in one place. Fix anything, then open your canvas."}
]);

const CATEGORY_ICONS=Object.freeze({
  education:"graduation-cap",
  exams:"badge-check",
  clinical:"stethoscope",
  work:"briefcase-medical",
  research:"microscope",
  personal:"heart"
});

export const CATEGORIES=Object.freeze(CATEGORY_DEFINITIONS.map(({id,label,color})=>Object.freeze({
  id,
  label,
  color,
  icon:CATEGORY_ICONS[id]
})));

export const HOME_COPY=Object.freeze({
  heading:"Turn your medical journey into an interview-ready timeline.",
  subline:"Answer guided questions about your school, exams, rotations, work, and research. Timeline Builder draws the Keynote-style timeline for you — no design work.",
  strip:"1 · ADD YOUR JOURNEY   2 · REFINE ON THE CANVAS   3 · EXPORT FOR INTERVIEWS",
  intakeTitle:"Start from your CV or MyERAS",
  intakeBody:"Upload your CV or MyERAS export. We'll read it, suggest timeline events, and you approve each one before it appears.",
  assurance:"Nothing appears on your timeline until you approve it."
});

export const VISIBILITY=Object.freeze({
  INTERVIEWER_SAFE:"INTERVIEWER_SAFE",
  ADVISOR_ONLY:"ADVISOR_ONLY"
});
