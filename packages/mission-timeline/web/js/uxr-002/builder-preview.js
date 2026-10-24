import {detailsRouteForEvent} from "./canvas.js";

const freeze=(value)=>Object.freeze(value);

export const BUILDER_PREVIEW_ZOOM_PRESETS=freeze([
  freeze({id:"fit",label:"Fit"}),
  freeze({id:"100",label:"100%"}),
  freeze({id:"150",label:"150%"})
]);

function escapeAttribute(value){
  return String(value??"").replace(/[&<>"']/g,(character)=>({
    "&":"&amp;",
    "<":"&lt;",
    ">":"&gt;",
    '"':"&quot;",
    "'":"&apos;"
  })[character]);
}

function ownerForEvent(event){
  const domain=String(event?.fields?.builderDomain||"");
  if(domain==="core"||event?.categoryId==="education"){
    return freeze({
      kind:"core-education",
      id:String(event?.fields?.builderEntryId||event?.id||"core")
    });
  }
  if(domain==="exams"||event?.categoryId==="exams"){
    return freeze({
      kind:"exam-attempt",
      id:String(event?.fields?.builderEntryId||event?.id||"")
    });
  }
  if(event?.fields?.publicationMilestone){
    return freeze({
      kind:"builder-entry",
      id:String(event?.fields?.builderEntryId||event?.id||""),
      derived:"publication"
    });
  }
  if(domain==="explanation"){
    return freeze({
      kind:"explanation",
      id:String(event?.fields?.builderEntryId||event?.id||"")
    });
  }
  return freeze({
    kind:"builder-entry",
    id:String(event?.fields?.builderEntryId||event?.id||"")
  });
}

export function enhanceBuilderPreviewSvg(svg,document,{interactive=true}={}){
  let result=String(svg||"")
    .replace('role="img"','role="group"')
    .replace(
      /<svg\b(?![^>]*\bpreserveAspectRatio=)/,
      '<svg preserveAspectRatio="xMidYMid meet"'
    );
  if(!interactive){
    result=result.replace(/; use Tab to move between events/g,"");
  }
  const events=[...(document?.events||[])];
  const interviewDate=String(
    document?.metadata?.interview?.date||
    document?.studentProfile?.interviewSeason||
    ""
  );
  const chronologicalTargets=[
    ...events.map((event)=>({
      kind:"event",
      id:String(event?.id||""),
      date:String(event?.startDate||"")
    })),
    ...(interviewDate?[{
      kind:"interview",
      id:"interview-target",
      date:interviewDate
    }]:[])
  ].sort((left,right)=>
    left.date.localeCompare(right.date)||
    left.kind.localeCompare(right.kind)||
    left.id.localeCompare(right.id)
  );
  const ownerOrderByEventId=new Map();
  let interviewOwnerOrder=chronologicalTargets.length;
  chronologicalTargets.forEach((target,ownerOrder)=>{
    if(target.kind==="interview"){
      interviewOwnerOrder=ownerOrder;
    }else{
      ownerOrderByEventId.set(target.id,ownerOrder);
    }
  });
  const interviewNeedle='data-event-kind="interview-marker"';
  const visibleOwnerOrders=events
    .filter((event)=>{
      const eventId=String(event?.id||"");
      return eventId&&result.includes(
        `data-event-id="${escapeAttribute(eventId)}"`
      );
    })
    .map((event)=>
      ownerOrderByEventId.get(String(event?.id||""))??chronologicalTargets.length
    );
  if(result.includes(interviewNeedle)){
    visibleOwnerOrders.push(interviewOwnerOrder);
  }
  const initialOwnerOrder=visibleOwnerOrders.length
    ?Math.min(...visibleOwnerOrders)
    :-1;
  for(const event of events){
    const eventId=String(event?.id||"");
    if(!eventId)continue;
    const needle=`data-event-id="${escapeAttribute(eventId)}"`;
    if(!result.includes(needle))continue;
    const owner=ownerForEvent(event);
    const ownerOrder=ownerOrderByEventId.get(eventId)??chronologicalTargets.length;
    const attributes=[
      needle,
      "data-builder-preview-event",
      `data-owner-kind="${escapeAttribute(owner.kind)}"`,
      `data-owner-id="${escapeAttribute(owner.id)}"`,
      `data-owner-order="${ownerOrder}"`,
      ...(owner.derived?[`data-owner-derived="${escapeAttribute(owner.derived)}"`]:[]),
      ...(interactive?[
        'role="button"',
        `tabindex="${ownerOrder===initialOwnerOrder?"0":"-1"}"`,
        'focusable="true"'
      ]:[])
    ].join(" ");
    result=result.replace(needle,attributes);
    const retakeTarget=String(event?.actionChip?.targetAttemptId||"");
    if(retakeTarget){
      const chipNeedle=
        `data-study-action-chip="${escapeAttribute(retakeTarget)}"`;
      if(result.includes(chipNeedle)){
        result=result.replace(chipNeedle,[
          chipNeedle,
          "data-builder-preview-retake",
          `data-retake-target="${escapeAttribute(retakeTarget)}"`,
          `data-owner-order="${ownerOrder+.5}"`,
          ...(interactive?[
            'role="button"',
            `aria-label="${escapeAttribute(
              `${event.actionChip.label||"Set retake date"} for ${event.title||"exam"}`
            )}"`,
            'tabindex="-1"',
            'focusable="true"'
          ]:[])
        ].join(" "));
      }
    }
  }
  if(result.includes(interviewNeedle)){
    result=result.replace(interviewNeedle,[
      interviewNeedle,
      "data-builder-preview-interview",
      'data-owner-kind="interview-target"',
      'data-owner-id="interview-target"',
      `data-owner-order="${interviewOwnerOrder}"`,
      ...(interactive?[
        'role="button"',
        `tabindex="${interviewOwnerOrder===initialOwnerOrder?"0":"-1"}"`,
        'focusable="true"'
      ]:[])
    ].join(" "));
  }
  const staticOrder=chronologicalTargets.length+1;
  const interactiveOwner=(kind,id,order,label,initial=false)=>[
    "data-builder-preview-owner",
    `data-owner-kind="${escapeAttribute(kind)}"`,
    `data-owner-id="${escapeAttribute(id)}"`,
    `data-owner-order="${order}"`,
    ...(interactive?[
      'role="button"',
      `aria-label="${escapeAttribute(label)}"`,
      `tabindex="${initial?"0":"-1"}"`
    ]:[])
  ].join(" ");
  const initialStatic=initialOwnerOrder<0;
  result=result.replace(
    'data-artifact-chrome="title"',
    `data-artifact-chrome="title" ${interactiveOwner(
      "core-profile","title",staticOrder,"Edit timeline title",initialStatic
    )}`
  );
  result=result.replace(
    'data-artifact-chrome="profile"',
    `data-artifact-chrome="profile" ${interactiveOwner(
      "core-profile","profile",staticOrder+1,"Edit profile details"
    )}`
  );
  result=result.replace(
    'data-profile-photo-slot="true"',
    `data-profile-photo-slot="true" ${interactiveOwner(
      "media-library","profile-photo",staticOrder+2,"Choose profile photo"
    )}`
  );
  result=result.replace(
    /data-artifact-photo-frame="([^"]+)"/g,
    (_match,id)=>`data-artifact-photo-frame="${escapeAttribute(id)}" ${interactiveOwner(
      "media-library",`photo-${id}`,staticOrder+3+Number(id||0),`Choose photo ${id}`
    )}`
  );
  result=result.replace(
    'data-interview-destination="407f-ribbon"',
    `data-interview-destination="407f-ribbon" ${interactiveOwner(
      "interview-target","interview-target",staticOrder+8,"Edit interview destination"
    )}`
  );
  result=result.replace(
    /data-advanced-media="([^"]+)"/g,
    (_match,id)=>`data-advanced-media="${escapeAttribute(id)}" ${interactiveOwner(
      "media-library",id,staticOrder+9,"Edit Media asset"
    )}`
  );
  return result;
}

export function resolveBuilderPreviewOwner(document,{
  ownerKind,
  ownerId,
  eventId
}={}){
  const kind=String(ownerKind||"");
  if(kind==="interview-target"){
    return freeze({
      kind,
      ownerId:"interview-target",
      eventId:null,
      step:7,
      stepId:"review",
      focusSelector:"[data-interview-config]"
    });
  }
  if(kind==="core-profile"){
    return freeze({
      kind,
      ownerId:String(ownerId||"profile"),
      eventId:null,
      step:1,
      stepId:"core",
      focusSelector:String(ownerId)==="title"
        ?'[data-core="name"]'
        :'[data-school-search],[data-core="school"]'
    });
  }
  if(kind==="media-library"){
    return freeze({
      kind,
      ownerId:String(ownerId||"media"),
      eventId:null,
      step:null,
      stepId:"media",
      focusSelector:"[data-media-upload]"
    });
  }
  const event=(document?.events||[]).find(
    (candidate)=>String(candidate?.id||"")===String(eventId||"")
  );
  if(!event)return null;
  const resolvedOwner=ownerForEvent(event);
  if(kind&&kind!==resolvedOwner.kind)return null;
  if(ownerId&&String(ownerId)!==resolvedOwner.id)return null;
  const routedEvent=resolvedOwner.derived==="publication"
    ?(document?.events||[]).find((candidate)=>
      !candidate?.fields?.publicationMilestone&&
      String(candidate?.fields?.builderEntryId||"")===resolvedOwner.id
    )
    :event;
  if(!routedEvent)return null;
  const route=detailsRouteForEvent(routedEvent);
  const ownerRoute=resolvedOwner.kind==="explanation"
    ?{
      ...route,
      step:7,
      stepId:"review",
      builderDomain:"explanation"
    }
    :route;
  const focusSelector=resolvedOwner.kind==="exam-attempt"
    ?`[data-exam-card="${escapeAttribute(resolvedOwner.id)}"]`
    :resolvedOwner.kind==="core-education"
      ?'[data-school-search],[data-core="school"]'
      :resolvedOwner.kind==="explanation"
        ?`[data-explanation-editor="${escapeAttribute(resolvedOwner.id)}"]`
        :`[data-domain-form="${escapeAttribute(route.stepId)}"]`;
  return freeze({
    ...ownerRoute,
    kind:resolvedOwner.kind,
    ownerId:resolvedOwner.id,
    eventId:String(routedEvent.id||""),
    focusSelector,
    derived:resolvedOwner.derived||null
  });
}

export function builderPreviewTargetAttributes(target){
  if(!target?.closest)return null;
  const retake=target.closest("[data-builder-preview-retake]");
  if(retake){
    return freeze({
      retakeTarget:String(retake.dataset?.retakeTarget||""),
      ownerKind:"exam-retake",
      ownerId:String(retake.dataset?.retakeTarget||""),
      eventId:""
    });
  }
  const staticOwner=target.closest("[data-builder-preview-owner]");
  if(staticOwner){
    return freeze({
      ownerKind:String(staticOwner.dataset?.ownerKind||""),
      ownerId:String(staticOwner.dataset?.ownerId||""),
      eventId:String(staticOwner.dataset?.eventId||"")
    });
  }
  const owner=target.closest(
    "[data-builder-preview-event],[data-builder-preview-interview]"
  );
  if(!owner)return null;
  return freeze({
    ownerKind:String(owner.dataset?.ownerKind||""),
    ownerId:String(owner.dataset?.ownerId||""),
    eventId:String(owner.dataset?.eventId||"")
  });
}

export function builderPreviewFocusableTargets(root){
  return root?.querySelectorAll
    ?[...root.querySelectorAll(
      "[data-builder-preview-event],[data-builder-preview-interview],[data-builder-preview-retake],[data-builder-preview-owner]"
    )].filter((target)=>!target.hasAttribute("data-builder-preview-proxied-source")).sort((left,right)=>
      Number(left.dataset?.ownerOrder||0)-Number(right.dataset?.ownerOrder||0)
    )
    :[];
}

export function moveBuilderPreviewFocus(root,current,direction){
  const targets=builderPreviewFocusableTargets(root);
  if(!targets.length)return null;
  const prior=Math.max(0,targets.indexOf(current));
  const next=direction==="first"
    ?0
    :direction==="last"
      ?targets.length-1
      :direction==="previous"
        ?(prior-1+targets.length)%targets.length
        :(prior+1)%targets.length;
  targets.forEach((target,index)=>target.setAttribute("tabindex",index===next?"0":"-1"));
  targets[next].focus?.();
  return targets[next];
}
