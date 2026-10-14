/* TL-AAA-STABILIZE-20261013 — one Volunteer rule for every category chooser.
 *
 * Volunteer is a first-class category the student can choose, but it is NOT a
 * seventh persisted categoryId: an accepted volunteer experience is a Work-domain
 * event (`categoryId:"work"`) whose source facts say it is volunteering
 * (`fields.canonicalType:"VOLUNTEER_EXPERIENCE"`, `fields.experienceType:"Volunteer"`),
 * exactly the shape the CV import already produces, and the Founder display rules
 * paint it in the distinct Volunteer key colour. Keeping a single shape means the
 * review, the wizard, Edit Timeline, Guardian, the dynamic key, the PDF and the
 * editable PPTX all agree, and no existing Work record is reclassified unless the
 * student explicitly chooses Volunteer for it.
 */
export const VOLUNTEER_CATEGORY_ID="volunteer";
export const VOLUNTEER_CANONICAL_TYPE="VOLUNTEER_EXPERIENCE";
export const VOLUNTEER_CATEGORY_LABEL="Volunteer";
export const VOLUNTEER_CATEGORY_COLOR="#307B72";
const text=value=>String(value??"").trim();
const VOLUNTEER_WORDING=/^(volunteer|volunteer experience|volunteering|community service)$/i;

/** True when the record's own source facts mark it as volunteering. */
export function isVolunteerRecord(record){
  if(!record||typeof record!=="object")return false;
  const fields=record.fields&&typeof record.fields==="object"?record.fields:{};
  return text(fields.canonicalType).toUpperCase()===VOLUNTEER_CANONICAL_TYPE||
    VOLUNTEER_WORDING.test(text(record.experienceType||fields.experienceType))||
    text(fields.kind)==="Volunteer"||text(record.kind)==="Volunteer";
}

/** The category a chooser should show as selected: "volunteer" or the persisted id. */
export function chooserCategoryId(record){
  return isVolunteerRecord(record)?VOLUNTEER_CATEGORY_ID:text(record?.categoryId);
}

/** Base categories plus Volunteer directly after Work (the domain that owns it). */
export function categoriesWithVolunteer(categories=[]){
  if(categories.some(({id})=>id===VOLUNTEER_CATEGORY_ID))return categories.slice();
  const volunteer={id:VOLUNTEER_CATEGORY_ID,label:VOLUNTEER_CATEGORY_LABEL,color:VOLUNTEER_CATEGORY_COLOR,token:"cat.volunteer",icon:"hand"};
  const index=categories.findIndex(({id})=>id==="work");
  const next=categories.slice();
  next.splice(index>=0?index+1:next.length,0,volunteer);
  return next;
}

/** Translate a chooser value into the persisted category plus volunteer source facts.
 *  Returns {categoryId, fields} to merge; never touches dates, titles or provenance. */
export function resolveChosenCategory(chosen,record={}){
  const fields={...(record.fields&&typeof record.fields==="object"?record.fields:{})};
  const wasVolunteer=isVolunteerRecord(record);
  if(text(chosen)===VOLUNTEER_CATEGORY_ID){
    fields.canonicalType=VOLUNTEER_CANONICAL_TYPE;
    fields.experienceType="Volunteer";
    if(text(fields.kind)&&text(fields.kind)!=="Volunteer")fields.kind="Volunteer";
    return {categoryId:"work",fields,volunteer:true};
  }
  const categoryId=text(chosen);
  if(wasVolunteer){
    // The student explicitly moved this record out of Volunteer: the volunteer
    // marker must go with it, or the board would keep painting it as Volunteer.
    // Blank values (not deleted keys) so consumers that merge field patches also drop the marker.
    fields.canonicalType=categoryId==="work"?"WORK_EXPERIENCE":"";
    if(VOLUNTEER_WORDING.test(text(fields.experienceType)))fields.experienceType="";
    if(text(fields.kind)==="Volunteer")fields.kind="";
  }
  return {categoryId,fields,volunteer:false};
}
