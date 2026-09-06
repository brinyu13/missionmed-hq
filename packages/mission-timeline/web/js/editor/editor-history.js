import {clone,nowIso,stableStringify,visibilityName,legacyVisibility} from "../core/canonical.js";

function snapshot(api,releaseState=null){
  return {
    user:clone(api.state.user),profile:clone(api.state.profile),sticky:api.state.sticky,
    timelineTitle:api.state.timelineTitle,sel:api.state.sel,canvasTheme:api.state.canvasTheme,
    categories:Object.fromEntries(Object.entries(api.CATS).map(([id,item])=>[id,{n:item.n,c:item.c}])),
    releaseEditor:releaseState?clone(releaseState.editor):null
  };
}

function restore(api,value,releaseState=null){
  api.state.user=clone(value.user);Object.assign(api.state.profile,clone(value.profile));api.state.sticky=value.sticky;
  api.state.timelineTitle=value.timelineTitle;api.state.sel=value.sel;api.state.canvasTheme=value.canvasTheme;
  Object.entries(value.categories||{}).forEach(([id,item])=>{if(api.CATS[id]){api.CATS[id].n=item.n;api.CATS[id].c=item.c;}});
  if(releaseState&&value.releaseEditor)releaseState.editor=clone(value.releaseEditor);
  api.state.saved=false;api.renderAll();
}

export class EditorHistoryManager{
  constructor(api,releaseState,{limit=80}={}){this.api=api;this.releaseState=releaseState;this.limit=limit;this.undoStack=[];this.redoStack=[];this.pending=null;this.listeners=new Set();}
  subscribe(listener){this.listeners.add(listener);listener(this.status());return()=>this.listeners.delete(listener);}
  notify(){const value=this.status();this.listeners.forEach((listener)=>listener(value));}
  status(){return {canUndo:this.undoStack.length>0,canRedo:this.redoStack.length>0,undoLabel:this.undoStack.at(-1)?.label||null,redoLabel:this.redoStack.at(-1)?.label||null,undoCount:this.undoStack.length,redoCount:this.redoStack.length};}
  begin(label){if(this.pending)return false;this.pending={label,before:snapshot(this.api,this.releaseState),startedAt:nowIso()};return true;}
  commit(){if(!this.pending)return false;const after=snapshot(this.api,this.releaseState),entry={...this.pending,after,committedAt:nowIso()};this.pending=null;if(stableStringify(entry.before)===stableStringify(after))return false;this.undoStack.push(entry);if(this.undoStack.length>this.limit)this.undoStack.shift();this.redoStack=[];this.notify();return true;}
  cancel(){this.pending=null;}
  perform(label,operation){this.begin(label);try{const result=operation();this.commit();return result;}catch(error){this.cancel();throw error;}}
  undo(){const entry=this.undoStack.pop();if(!entry)return false;this.redoStack.push(entry);restore(this.api,entry.before,this.releaseState);this.notify();return entry;}
  redo(){const entry=this.redoStack.pop();if(!entry)return false;this.undoStack.push(entry);restore(this.api,entry.after,this.releaseState);this.notify();return entry;}
  selected(){return this.api.state.user.events.find((event)=>event.id===this.api.state.sel)||null;}
  duplicateSelected(){const source=this.selected();if(!source)throw new Error("Select an event to duplicate.");return this.perform("Duplicate event",()=>{const copy=clone(source);copy.id=`${source.id}-copy-${Date.now().toString(36)}`;copy.t=`${source.t} copy`;copy.s=this.api.miStr(this.api.mi(source.s)+1);if(copy.e)copy.e=this.api.miStr(this.api.mi(source.e)+1);copy.lane=Number.isInteger(source.lane)?source.lane+1:null;copy.origin="manual-duplicate";this.api.state.user.events.push(copy);this.api.state.sel=copy.id;this.releaseState.editor.sourceDatesByEvent[copy.id]={startDate:copy.s,endDate:copy.e||null};this.api.renderAll();return copy;});}
  softDeleteSelected(){const source=this.selected();if(!source)throw new Error("Select an event to remove.");return this.perform("Remove event",()=>{this.releaseState.editor.deletedEvents.push({event:clone(source),deletedAt:nowIso(),reason:"USER_REMOVE"});this.api.state.user.events=this.api.state.user.events.filter((event)=>event.id!==source.id);this.api.state.sel=null;this.api.renderAll();return source;});}
  recoverLastDeleted(){if(!this.releaseState.editor.deletedEvents.length)throw new Error("No removed event is available to recover.");return this.perform("Recover event",()=>{const record=this.releaseState.editor.deletedEvents.pop(),existing=this.api.state.user.events.some((event)=>event.id===record.event.id);const event={...clone(record.event),id:existing?`${record.event.id}-recovered-${Date.now().toString(36)}`:record.event.id};this.api.state.user.events.push(event);this.api.state.sel=event.id;this.api.renderAll();return event;});}
  resetSelectedToSource(){const event=this.selected();if(!event)throw new Error("Select an event to reset.");const source=event.sourceDates||this.releaseState.editor.sourceDatesByEvent[event.id];if(!source)throw new Error("No source-date checkpoint exists for this event.");return this.perform("Reset source dates",()=>{event.s=source.startDate;event.e=event.mile?null:source.endDate;event.lane=null;event.manualOffset=null;this.api.renderAll();return event;});}
  setSelectedVisibility(value){const event=this.selected();if(!event)throw new Error("Select an event to change visibility.");const normalized=visibilityName(value);return this.perform("Change event visibility",()=>{event.visibilityState=normalized;event.vis=legacyVisibility(normalized);this.api.renderAll();return event;});}
  changeLane(delta){const event=this.selected();if(!event)throw new Error("Select an event to change lanes.");return this.perform("Change event lane",()=>{event.lane=Math.max(0,(Number.isInteger(event.lane)?event.lane:0)+delta);event.manualOffset={...(event.manualOffset||{}),laneLocked:true};this.api.renderAll();return event;});}
  resetCategories(){return this.perform("Reset category key",()=>{Object.entries(this.releaseState.editor.categoryDefaults||{}).forEach(([id,item])=>{if(this.api.CATS[id]){this.api.CATS[id].n=item.label;this.api.CATS[id].c=item.color;}});this.api.renderAll();});}
}

export function captureEditorSnapshot(api,releaseState=null){return snapshot(api,releaseState);}
