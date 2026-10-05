import {measurePresentationText} from '../presentation/text-layout.js';
import{monthIndex,parseMonth}from"./utils.js";

export const CATEGORY_DEFINITIONS=Object.freeze([
  Object.freeze({id:"education",label:"Education",token:"cat.education",color:"#2C6E8F"}),
  Object.freeze({id:"exams",label:"Exams",token:"cat.exams",color:"#3A78C9"}),
  Object.freeze({id:"clinical",label:"US Clinical",token:"cat.clinical",color:"#C8641C"}),
  Object.freeze({id:"work",label:"Work",token:"cat.work",color:"#3F9B52"}),
  Object.freeze({id:"research",label:"Research",token:"cat.research",color:"#C9A227"}),
  Object.freeze({id:"personal",label:"Personal",token:"cat.personal",color:"#8A5BBF"})
]);

const RECOMPUTE_KINDS=new Set([
  "event-add",
  "event-delete",
  "event-date-change",
  "span-change",
  "intake-batch",
  "version-restore",
  "drag-drop"
]);

function normalizedMonth(value){
  const parsed=parseMonth(value);
  if(parsed)return parsed;
  const match=String(value??"").match(/^(\d{4})-(0[1-9]|1[0-2])(?:-\d{2})?$/);
  return match?`${match[1]}-${match[2]}`:null;
}

function eventStartMonth(event){
  return normalizedMonth(event?.startDate??event?.date??event?.startMonth);
}

function eventEndMonth(event){
  return normalizedMonth(event?.endDate??event?.endMonth);
}

function isMilestone(event){
  return event?.eventType==="milestone"||event?.kind==="milestone"||event?.type==="milestone";
}

function yearOf(month){
  return Number(month.slice(0,4));
}

function monthForYear(year,month){
  return`${year}-${String(month).padStart(2,"0")}`;
}

function unresolvedSmallSpanError(yearSegmentCount){
  const error=new RangeError(
    `D1-UXR-002 adaptive year-width allocation is unresolved for ${yearSegmentCount} normal year segment${yearSegmentCount===1?"":"s"}: the frozen 28% cap and exact-sum guarantee cannot both hold when N < 4.`
  );
  error.code="D1_UXR_002_UNRESOLVED_N_LT_4_YEAR_WIDTH_CONTRADICTION";
  error.yearSegmentCount=yearSegmentCount;
  return error;
}

function invariantError(message){
  const error=new RangeError(`D1-UXR-002 adaptive-layout invariant: ${message}`);
  error.code="D1_UXR_002_ADAPTIVE_LAYOUT_INVARIANT";
  return error;
}

export function deriveTimelineSpan(events,{currentMonth,interviewMonth=null}={}){
  const normalizedCurrent=normalizedMonth(currentMonth);
  if(!normalizedCurrent){
    throw new TypeError("deriveTimelineSpan requires currentMonth as YYYY-MM.");
  }

  const validEvents=Array.isArray(events)?events:[];
  const eventStarts=validEvents.map(eventStartMonth).filter(Boolean);
  const eventEnds=validEvents.map((event)=>eventEndMonth(event)||eventStartMonth(event)).filter(Boolean);
  const normalizedInterview=normalizedMonth(interviewMonth);

  const currentIndex=monthIndex(normalizedCurrent);
  const startIndex=eventStarts.length
    ?Math.min(...eventStarts.map((month)=>monthIndex(month)))
    :currentIndex;
  const endCandidates=[
    currentIndex,
    ...(normalizedInterview?[monthIndex(normalizedInterview)]:[]),
    ...eventEnds.map((month)=>monthIndex(month))
  ];
  const endIndex=Math.max(startIndex,...endCandidates);
  const startYear=Math.floor(startIndex/12);
  const endYear=Math.floor(endIndex/12);
  const startMonth=monthForYear(startYear,1);
  const endMonth=monthForYear(endYear,12);
  const yearCount=endYear-startYear+1;

  if(yearCount<=12){
    return{
      startMonth,
      endMonth,
      segments:Array.from({length:yearCount},(_,offset)=>{
        const year=startYear+offset;
        return{
          kind:"year",
          year,
          startMonth:monthForYear(year,1),
          endMonth:monthForYear(year,12)
        };
      })
    };
  }

  const firstNormalYear=endYear-10;
  const condensedEndYear=firstNormalYear-1;
  return{
    startMonth,
    endMonth,
    segments:[
      {
        kind:"condensed",
        startYear,
        endYear:condensedEndYear,
        startMonth,
        endMonth:monthForYear(condensedEndYear,12),
        width:64,
        label:`…${startYear}`,
        tooltip:"Condensed early years"
      },
      ...Array.from({length:11},(_,offset)=>{
        const year=firstNormalYear+offset;
        return{
          kind:"year",
          year,
          startMonth:monthForYear(year,1),
          endMonth:monthForYear(year,12)
        };
      })
    ]
  };
}

export function eventDensityForYear(events,year,{spanEndMonth}={}){
  if(!Number.isInteger(year))return 0;
  const yearStart=year*12;
  const yearEnd=yearStart+11;
  const normalizedSpanEnd=normalizedMonth(spanEndMonth);
  const spanEndIndex=normalizedSpanEnd?monthIndex(normalizedSpanEnd):yearEnd;
  let overlapMonths=0;

  for(const event of Array.isArray(events)?events:[]){
    const startMonth=eventStartMonth(event);
    if(!startMonth)continue;
    const start=monthIndex(startMonth);

    if(isMilestone(event)){
      if(start>=yearStart&&start<=yearEnd)overlapMonths+=1;
      continue;
    }

    const explicitEnd=eventEndMonth(event);
    const end=event?.openEnded
      ?spanEndIndex
      :(explicitEnd?monthIndex(explicitEnd):start);
    if(end<start)continue;
    overlapMonths+=Math.max(0,Math.min(end,yearEnd)-Math.max(start,yearStart)+1);
  }

  return overlapMonths/12;
}

// The locked portable renderer keeps every labelled year and reserves 80px
// before distributing the remaining width. Its legacy integer allocator uses
// a different span/condensation contract; feed demand into the portable scale
// rather than copying those allocated widths and applying the floor twice.
// Fixed-budget native role constraints over the existing linear year cells.
// Every source month keeps its true fraction; this allocates space, never dates.
export function allocateFounderRoleYearWidths(events,{firstYear,lastYear,measureText,contentWidth=1918,spanEndMonth,minYearWidth=80,minArrowWidth=52,measureInstitutionText,balanceYears=false,minimumStartX=null}={}){
  const years=Array.from({length:lastYear-firstYear+1},(_,index)=>firstYear+index),budget=contentWidth*.96;
  const floor=Math.min(minYearWidth,budget/years.length),widths=new Map(years.map(year=>[year,floor]));
  const constraints=[],pressure=new Map(years.map(year=>[year,0]));
  for(const event of events||[]){
    const startValue=eventStartMonth(event);if(!startValue)continue;
    const start=monthIndex(startValue),end=isMilestone(event)?start:monthIndex(event.openEnded?normalizedMonth(spanEndMonth)||eventEndMonth(event)||monthForYear(lastYear,12):eventEndMonth(event)||startValue);
    if(end<start)continue;
    const startYear=Math.floor(start/12),role=isMilestone(event)?[event.display?.label??event.title,event.display?.institution??event.siteName].filter(Boolean).join(' — '):String(event.display?.role??event.title??'');
    if(pressure.has(startYear))pressure.set(startYear,pressure.get(startYear)+1+Number(measureText(role,18,400))/160);
    if(isMilestone(event))continue;
    const coefficients=new Map(years.map(year=>[year,Math.max(0,Math.min(end,year*12+11)-Math.max(start,year*12)+1)/12]).filter(([,fraction])=>fraction));
    for(const [year,fraction] of coefficients)pressure.set(year,pressure.get(year)+fraction*.05);
    const required=Number(measureText(role,18,400))+19.454+4;
    if(coefficients.size&&Number.isFinite(required)&&required>minArrowWidth+.01)constraints.push({eventId:String(event.id),coefficients,required:required+1}); // native pixel rounding reserve
    if(typeof measureInstitutionText==='function'){
      const institution=String(event.display?.institution??event.siteName??'');
      const wordWidth=Math.max(0,...institution.split(/\s+/).map(word=>Number(measureInstitutionText(word))||0));
      // The institution ends twelve pixels before the dated arrow; preserve
      // the existing twenty-four-pixel left board margin plus painted room.
      const required=wordWidth+38-contentWidth*.02;
      const preceding=new Map(years.map(year=>[year,Math.max(0,Math.min(start-1,year*12+11)-year*12+1)/12]).filter(([,fraction])=>fraction));
      if(preceding.size&&required>0)constraints.push({eventId:String(event.id),field:'institution',coefficients:preceding,required});
    }
    const minimumX=Number(minimumStartX?.get(String(event.id)));
    if(Number.isFinite(minimumX)&&minimumX>contentWidth*.02+1){
      const preceding=new Map(years.map(year=>[year,Math.max(0,Math.min(start-1,year*12+11)-year*12+1)/12]).filter(([,fraction])=>fraction));
      if(preceding.size)constraints.push({eventId:String(event.id),field:'institution-furniture',coefficients:preceding,required:minimumX-contentWidth*.02-1});
    }
  }
  const available=constraint=>[...constraint.coefficients].reduce((sum,[year,fraction])=>sum+fraction*widths.get(year),0);
  let remaining=Math.max(0,budget-floor*years.length);
  constraints.sort((a,b)=>b.required/Math.max(...b.coefficients.values())-a.required/Math.max(...a.coefficients.values()));
  for(let pass=0;pass<8;pass++){
    let moved=false;
    for(const constraint of constraints){
      let deficit=constraint.required-available(constraint);if(deficit<=.1)continue;
      const coefficients=[...constraint.coefficients],maximum=Math.max(...coefficients.map(([,fraction])=>fraction));
      const targets=balanceYears?coefficients.filter(([,fraction])=>fraction>=maximum*.8):coefficients;
      const [target,coefficient]=targets.sort((a,b)=>balanceYears
        ?widths.get(a[0])/a[1]-widths.get(b[0])/b[1]||b[1]-a[1]||a[0]-b[0]
        :b[1]-a[1]||(pressure.get(b[0])||0)-(pressure.get(a[0])||0)||a[0]-b[0])[0];
      const addition=Math.min(remaining,deficit/coefficient);
      if(addition>.001){widths.set(target,widths.get(target)+addition);remaining-=addition;deficit-=addition*coefficient;moved=true;}
      if(deficit<=.1)continue;
      // Transfer only spare width that keeps every other constraint satisfied.
      for(const donor of years.slice().sort((a,b)=>widths.get(b)-widths.get(a))){
        const gain=coefficient-(constraint.coefficients.get(donor)||0);if(donor===target||gain<=0)continue;
        let spare=widths.get(donor)-floor;
        for(const other of constraints){if(other===constraint)continue;const loss=(other.coefficients.get(donor)||0)-(other.coefficients.get(target)||0);if(loss>0)spare=Math.min(spare,Math.max(0,available(other)-other.required)/loss);}
        const transfer=Math.min(spare,deficit/gain);if(transfer<=.001)continue;
        widths.set(donor,widths.get(donor)-transfer);widths.set(target,widths.get(target)+transfer);deficit-=transfer*gain;moved=true;
        if(deficit<=.1)break;
      }
    }
    if(!moved)break;
  }
  const totalPressure=[...pressure.values()].reduce((sum,value)=>sum+value,0);
  for(const year of years)widths.set(year,widths.get(year)+remaining*(totalPressure?pressure.get(year)/totalPressure:1/years.length));
  return {widths,constraints:constraints.map(constraint=>({eventId:constraint.eventId,...(constraint.field?{field:constraint.field}:{}),required:constraint.required,available:available(constraint),deficit:Math.max(0,constraint.required-available(constraint))}))};
}

export function deriveFounderYearAllocation(events,{
  firstYear,lastYear,measureText,contentWidth=1918,spanEndMonth
}={}){
  if(!Number.isInteger(firstYear)||!Number.isInteger(lastYear)||lastYear<firstYear||
    !Number.isFinite(contentWidth)||contentWidth<=0||typeof measureText!=="function"){
    throw new TypeError("Founder year allocation requires valid years, width and text measurement.");
  }
  const source=(Array.isArray(events)?events:[]).slice().sort((a,b)=>
    String(a.id).localeCompare(String(b.id))||String(eventStartMonth(a)).localeCompare(String(eventStartMonth(b)))
  );
  const demands=new Map();
  const openEnd=normalizedMonth(spanEndMonth)||monthForYear(lastYear,12);
  for(let year=firstYear;year<=lastYear;year++){
    const density=eventDensityForYear(source,year,{spanEndMonth:openEnd});
    let labelPressure=0,milestonePressure=0,insideRoleWidth=0;
    for(const event of source){
      const startMonth=eventStartMonth(event);
      if(!startMonth)continue;
      const start=monthIndex(startMonth),end=isMilestone(event)?start:
        event.openEnded?monthIndex(openEnd):monthIndex(eventEndMonth(event)||startMonth);
      if(end<start)continue;
      const overlap=Math.max(0,Math.min(end,year*12+11)-Math.max(start,year*12)+1);
      if(!overlap)continue;
      const label=[event.display?.role??event.title,event.display?.institution??event.siteName].filter(Boolean).join(" — ");
      const measured=Number(measureText(label,18,400));
      if(event.display&&!isMilestone(event)&&Math.floor(start/12)===year&&Math.floor(end/12)===year){
        // Existing native arrow head (19.454px) and inside padding (4px)
        // join the measured role; its dates still occupy their true fraction.
        const role=Number(measureText(event.display.role||'',18,400));
        if(Number.isFinite(role))insideRoleWidth=Math.max(insideRoleWidth,(role+19.454+4)*12/(end-start+1));
      }
      const pressure=Number.isFinite(measured)?Math.max(0,measured)/160:0;
      // A multi-year label shares its pressure across its actual span; a short
      // label or milestone competes for space within its own year.
      labelPressure+=pressure*overlap/(end-start+1);
      if(isMilestone(event))milestonePressure+=1;
    }
    const displayed=source.some(event=>event.display);
    demands.set(year,displayed
      ?Math.max(1+Math.min(1,density)*.25+labelPressure+milestonePressure,insideRoleWidth-80)
      :Math.min(8,1+density+labelPressure+milestonePressure));
  }
  let roleWidths=null,autoYearFloor=null;
  if(source.some(event=>event.display)){
    const allocated=allocateFounderRoleYearWidths(source,{firstYear,lastYear,measureText,contentWidth,spanEndMonth:openEnd});
    roleWidths=allocated.widths;
    autoYearFloor=Math.min(contentWidth*.96/(lastYear-firstYear+1),Math.max(...[...roleWidths.keys()].map(year=>measurePresentationText(String(year),23,"Futura,'Trebuchet MS',Arial,sans-serif",700)))+20);
    for(const [year,width] of roleWidths)demands.set(year,Math.max(.001,width-autoYearFloor));
  }
  const total=[...demands.values()].reduce((sum,weight)=>sum+weight,0);
  const count=demands.size,minPercent=Math.min(96/count,80/contentWidth*100);
  const flexible=96-minPercent*count;
  let cursor=2;
  const effective=[...demands].map(([year,weight])=>{
    const start=cursor;cursor+=minPercent+flexible*weight/total;
    return{id:String(year),weight:roleWidths?roleWidths.get(year)*total/(contentWidth*.96):(cursor-start)*total/96};
  });
  // Normalize the whole snapshot together; clipping each large busy weight
  // would flatten its painted proportions when the user freezes the axis.
  const factor=Math.min(1,8/Math.max(...effective.map(segment=>segment.weight)));
  const segmentWeights=effective.map(segment=>({...segment,weight:Math.max(.25,segment.weight*factor)}));
  // The effective weights include the portable floor. Freeze these exact
  // proportions when the first authored geometry command commits, including
  // when the compositor returns early without a placement refinement.
  return{
    autoYearWeights:demands,...(autoYearFloor!==null?{autoYearFloor}:{}),
    composedAxis:{mode:"manual",startYear:firstYear,endYear:lastYear,
      includeFuture:false,segmentWeights}
  };
}

export function restoreFounderYearAllocation(scene,{contentWidth=1918}={}){
  if(!scene?.autoYearWeights||typeof scene.autoYearWeights.get==="function")return scene;
  const weights=scene.composedAxis?.segmentWeights;
  if(!Array.isArray(weights)||!weights.length){
    throw new TypeError("Automatic year weights need their saved composed axis for recovery.");
  }
  const total=weights.reduce((sum,item)=>sum+Number(item.weight),0);
  const minPercent=Math.min(96/weights.length,(scene.autoYearFloor??80)/contentWidth*100);
  const flexible=96-minPercent*weights.length;
  // Theme projection and JSON transport can strip Map methods. Recover the
  // latest effective proportions, including a compositor-refined axis, by
  // removing the same fixed floor before recreating its demand Map.
  return{...scene,autoYearWeights:new Map(weights.map(item=>[
    Number(item.id),flexible>1e-8
      ?Math.max(Number.EPSILON,(Number(item.weight)-minPercent*total/96)*96/flexible):1
  ]))};
}

function distributeRealRemainder(values,weights,budget,minWidth,maxWidth){
  const epsilon=1e-7;
  let next=values.slice();

  for(let pass=0;pass<3;pass+=1){
    next=next.map((value)=>Math.min(maxWidth,Math.max(minWidth,value)));
    const remainder=budget-next.reduce((sum,value)=>sum+value,0);
    if(Math.abs(remainder)<=epsilon)return next;

    const eligible=next
      .map((value,index)=>({value,index}))
      .filter(({value})=>remainder>0?value<maxWidth-epsilon:value>minWidth+epsilon);
    if(!eligible.length)break;

    const eligibleWeight=eligible.reduce((sum,{index})=>sum+weights[index],0);
    for(const {index} of eligible){
      next[index]+=remainder*(weights[index]/eligibleWeight);
    }
  }

  next=next.map((value)=>Math.min(maxWidth,Math.max(minWidth,value)));
  for(let guard=0;guard<values.length+2;guard+=1){
    const remainder=budget-next.reduce((sum,value)=>sum+value,0);
    if(Math.abs(remainder)<=epsilon)return next;
    const eligible=next
      .map((value,index)=>({value,index}))
      .filter(({value})=>remainder>0?value<maxWidth-epsilon:value>minWidth+epsilon);
    if(!eligible.length)break;

    const equalShare=remainder/eligible.length;
    let changed=false;
    for(const {index} of eligible){
      const adjusted=Math.min(maxWidth,Math.max(minWidth,next[index]+equalShare));
      if(Math.abs(adjusted-next[index])>epsilon)changed=true;
      next[index]=adjusted;
    }
    if(!changed)break;
  }

  const unresolved=budget-next.reduce((sum,value)=>sum+value,0);
  if(Math.abs(unresolved)>epsilon){
    throw invariantError("the bounded clamp passes could not distribute the full width.");
  }
  return next;
}

function roundWidthsLeftToRight(values,budget,minWidth,maxWidth){
  const rounded=values.map((value)=>Math.round(value));
  const integerMinimum=Math.floor(minWidth);
  const integerMaximum=Math.ceil(maxWidth);
  let remainder=budget-rounded.reduce((sum,value)=>sum+value,0);

  while(remainder!==0){
    let changed=false;
    for(let index=0;index<rounded.length&&remainder!==0;index+=1){
      if(remainder>0&&rounded[index]<integerMaximum){
        rounded[index]+=1;
        remainder-=1;
        changed=true;
      }else if(remainder<0&&rounded[index]>integerMinimum){
        rounded[index]-=1;
        remainder+=1;
        changed=true;
      }
    }
    if(!changed){
      throw invariantError("integer rounding could not preserve the exact-sum guarantee.");
    }
  }
  return rounded;
}

export function allocateAdaptiveYearWidths(segments,{innerWidth}={}){
  if(!Array.isArray(segments))throw new TypeError("segments must be an array.");
  if(!Number.isInteger(innerWidth)||innerWidth<=0){
    throw new TypeError("innerWidth must be a positive integer.");
  }

  const cloned=segments.map((segment)=>({...segment}));
  const normalIndexes=[];
  let fixedWidth=0;
  for(let index=0;index<cloned.length;index+=1){
    const segment=cloned[index];
    if(segment.kind==="condensed"){
      segment.width=64;
      fixedWidth+=64;
    }else if(segment.kind==="year"){
      normalIndexes.push(index);
    }else{
      throw new TypeError(`Unsupported timeline segment kind: ${String(segment.kind)}`);
    }
  }

  const yearSegmentCount=normalIndexes.length;
  if(yearSegmentCount<4)throw unresolvedSmallSpanError(yearSegmentCount);

  const budget=innerWidth-fixedWidth;
  if(budget<=0)throw invariantError("fixed condensed width consumes the available inner width.");

  const minimum=Math.max(88,innerWidth*.05);
  const maximum=innerWidth*.28;
  if(yearSegmentCount*minimum>budget+1e-7||yearSegmentCount*maximum<budget-1e-7){
    throw invariantError("the frozen minimum and maximum bounds cannot contain the available width.");
  }

  const weights=normalIndexes.map((index)=>{
    const density=Number(cloned[index].density??0);
    return 1+(Number.isFinite(density)?Math.max(0,density):0);
  });
  const weightTotal=weights.reduce((sum,weight)=>sum+weight,0);
  const raw=weights.map((weight)=>weight/weightTotal*budget);
  const bounded=distributeRealRemainder(raw,weights,budget,minimum,maximum);
  const integerWidths=roundWidthsLeftToRight(bounded,budget,minimum,maximum);

  normalIndexes.forEach((segmentIndex,index)=>{
    cloned[segmentIndex].width=integerWidths[index];
  });

  if(cloned.reduce((sum,segment)=>sum+segment.width,0)!==innerWidth){
    throw invariantError("integer segment widths do not sum exactly to innerWidth.");
  }
  return cloned;
}

export function monthPositionInSegments(month,segments,{margin=96}={}){
  const normalized=normalizedMonth(month);
  if(!normalized)throw new TypeError("month must be a valid YYYY-MM value.");
  if(!Array.isArray(segments)||!segments.length){
    throw new TypeError("segments must be a non-empty array.");
  }
  const target=monthIndex(normalized);
  let x=Number(margin)||0;

  for(const segment of segments){
    const startMonth=normalizedMonth(
      segment.startMonth??(Number.isInteger(segment.year)?monthForYear(segment.year,1):null)
    );
    const endMonth=normalizedMonth(
      segment.endMonth??(Number.isInteger(segment.year)?monthForYear(segment.year,12):null)
    );
    const width=Number(segment.width);
    if(!startMonth||!endMonth||!Number.isFinite(width)||width<0){
      throw new TypeError("Every positioned segment requires valid bounds and a non-negative width.");
    }

    const start=monthIndex(startMonth);
    const end=monthIndex(endMonth);
    if(target<start)return x;
    if(target<=end){
      const monthCount=end-start+1;
      return x+(target-start)/monthCount*width;
    }
    x+=width;
  }
  return x;
}

export function tickModeForYear(width){
  return Number(width)/12<7?"quarters":"months";
}

function intervalForEvent(event){
  const startMonth=eventStartMonth(event);
  const start=startMonth?monthIndex(startMonth):Number.POSITIVE_INFINITY;
  const explicitEnd=eventEndMonth(event);
  const end=event?.openEnded&&!explicitEnd
    ?Number.MAX_SAFE_INTEGER
    :(explicitEnd?monthIndex(explicitEnd):start);
  return{start,end:Math.max(start,end)};
}

function intervalsHaveClearMonth(first,second){
  return first.end+1<second.start||second.end+1<first.start;
}

function previousLane(previousLaneById,id){
  const value=previousLaneById instanceof Map
    ?previousLaneById.get(id)
    :previousLaneById?.[id];
  return Number.isInteger(value)&&value>=0?value:null;
}

export function assignStableLanes(events,{previousLaneById={}}={}){
  const source=Array.isArray(events)?events:[];
  const seenIds=new Set();
  const sorted=source
    .map((event,index)=>{
      if(event?.id==null)throw new TypeError("Every event requires an id.");
      if(seenIds.has(event.id))throw new TypeError(`Duplicate event id: ${event.id}`);
      seenIds.add(event.id);
      const interval=intervalForEvent(event);
      return{event,index,interval,milestone:isMilestone(event)};
    })
    .sort((left,right)=>{
      if(left.milestone!==right.milestone)return left.milestone?1:-1;
      if(left.interval.start!==right.interval.start)return left.interval.start-right.interval.start;
      const leftDuration=left.interval.end-left.interval.start;
      const rightDuration=right.interval.end-right.interval.start;
      if(leftDuration!==rightDuration)return rightDuration-leftDuration;
      return left.index-right.index;
    });

  const arrows=sorted.filter(({milestone})=>!milestone);
  const lanes=[];
  const laneById={};
  const canUseLane=(item,laneIndex)=>{
    const occupants=lanes[laneIndex]??[];
    return occupants.every((occupant)=>intervalsHaveClearMonth(item.interval,occupant.interval));
  };
  const place=(item,laneIndex)=>{
    if(!lanes[laneIndex])lanes[laneIndex]=[];
    lanes[laneIndex].push(item);
    laneById[item.event.id]=laneIndex;
  };

  const unassigned=[];
  for(const item of arrows){
    const prior=previousLane(previousLaneById,item.event.id);
    if(prior!=null&&canUseLane(item,prior))place(item,prior);
    else unassigned.push(item);
  }

  for(const item of unassigned){
    const existingLaneCount=lanes.length;
    const legal=[];
    for(let laneIndex=0;laneIndex<existingLaneCount;laneIndex+=1){
      if(canUseLane(item,laneIndex))legal.push(laneIndex);
    }

    const affinity=legal.filter((laneIndex)=>
      (lanes[laneIndex]??[]).some((occupant)=>
        occupant.event.categoryId===item.event.categoryId
      )
    );
    // The protected board has exactly seven lanes; emitting more produced lanes the
    // renderer could only collapse back onto lane 6, stacking events on one another.
    const laneIndex=Math.min(6,(affinity[0]??legal[0]??existingLaneCount));
    place(item,laneIndex);
  }

  for(const {event,milestone} of sorted){
    if(milestone)laneById[event.id]=null;
  }

  return{
    order:sorted.map(({event})=>event.id),
    laneById,
    laneCount:arrows.length?lanes.length:0
  };
}

export function placeAlternatingFlags(flags){
  const sorted=(Array.isArray(flags)?flags:[])
    .map((flag,index)=>({
      flag,
      index,
      month:monthIndex(eventStartMonth(flag))
    }))
    .sort((left,right)=>{
      const leftMonth=left.month??Number.POSITIVE_INFINITY;
      const rightMonth=right.month??Number.POSITIVE_INFINITY;
      return leftMonth-rightMonth||left.index-right.index;
    });

  let previousMonth=null;
  let alternate=false;
  return sorted.map(({flag,month})=>{
    if(previousMonth!=null&&month!=null&&Math.abs(month-previousMonth)<1){
      alternate=!alternate;
    }else{
      alternate=false;
    }
    previousMonth=month;
    return{id:flag.id,height:alternate?52:34};
  });
}

export function condensedMetrics(laneCount){
  if(Number(laneCount)>6){
    return{
      condensed:true,
      laneHeight:28,
      arrowShaftHeight:22,
      labelFontSize:11
    };
  }
  return{condensed:false};
}

export function shouldRecomputeLayout({kind,dragActive=false}={}){
  return!dragActive&&RECOMPUTE_KINDS.has(kind);
}
