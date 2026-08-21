import {monthIndex} from "./date-normalizer.js";
import {similarity} from "./duplicate-detector.js";
import {stableHash} from "./provenance.js";

/*
 * The server AI quality layer only exists when a provider is configured, and even then it
 * never sees the second copy of an entry that the local parser produced twice. These
 * deterministic checks run on the mapped review candidates in EVERY mode so within-document
 * duplicates, contradictions, and dropped source lines reach the student either way.
 * Suggestions RECOMMEND. A suggestion carries a `proposal` only when the change is derivable
 * from the student's own document; anything that would require inventing a fact stays a
 * question instead.
 */

const TYPE_ORDER=["POSSIBLE_DUPLICATE","CHRONOLOGY_REVIEW","CATEGORY_REVIEW","MISSING_END_DATE","LABEL_READABILITY","SOURCE_ITEM_NOT_INCLUDED","VISUAL_OVERLAP"];
const ONGOING_WORDING=/\b(?:present|current(?:ly)?|ongoing|to date|till date|till now|until now)\b/i;
const LONG_TITLE=70;

function suggestion(type,severity,{candidateIds=[],eventIds=[],sourceBlockIds=[],reason,recommendation,proposal=null}){
  return{
    id:"cvq-"+stableHash([type,...candidateIds,...eventIds,...sourceBlockIds,reason].join("|")),
    type,severity,
    candidateIds:[...candidateIds],
    eventIds:[...eventIds],
    sourceBlockIds:[...sourceBlockIds],
    reason,recommendation,
    source:"DETERMINISTIC",
    actionMode:"ACCEPT_EDIT_DISMISS",
    proposal
  };
}

function institutionOf(candidate){
  const fields=candidate?.fields||{};
  return String(fields.institution||fields.medicalSchool||fields.organization||fields.employer||fields.siteName||"").trim();
}

function evidenceText(candidate){
  return [candidate?.sourceSnippet,...(candidate?.provenance||[]).map((item)=>item?.sourceExcerpt)].filter(Boolean).join(" ");
}

function blockIdsOf(candidate){
  return [...new Set((candidate?.provenance||[]).map((item)=>String(item?.sourceBlockId||"")).filter(Boolean))];
}

const TRAILING_FILLER=/\s+(?:in|on|of|the|a|an|and|or|for|to|at|with|among|by|from|into|during|under|over)$/i;
export function shortenTitle(value){
  const cleaned=String(value||"").replace(/\s+/g," ").trim();
  const head=cleaned.split(/\s+[–—-]\s+|\s*\|\s*|;\s+/)[0].trim();
  let short=head.length>=12?head:cleaned;
  if(short.length>60){
    const words=short.slice(0,60).split(" ");
    if(words.length>1)words.pop();
    short=words.join(" ");
  }
  short=short.replace(/[\s,:;.–—-]+$/,"").trim();
  while(TRAILING_FILLER.test(short))short=short.replace(TRAILING_FILLER,"");
  return short.replace(/[\s,:;.–—-]+$/,"").trim();
}

function duplicatePairs(candidates){
  const found=[];
  for(let left=0;left<candidates.length;left++)for(let right=left+1;right<candidates.length;right++){
    const a=candidates[left],b=candidates[right];
    if(a.categoryId!==b.categoryId)continue;
    const titleScore=similarity(a.title,b.title);
    const siteScore=similarity(institutionOf(a),institutionOf(b));
    if(titleScore<0.6&&!(titleScore>=0.4&&siteScore>=0.6))continue;
    const startA=monthIndex(a.startDate),startB=monthIndex(b.startDate);
    const sameStart=startA!=null&&startB!=null&&Math.abs(startA-startB)<=1;
    const endA=monthIndex(a.endDate||a.startDate),endB=monthIndex(b.endDate||b.startDate);
    const sameEnd=endA==null||endB==null||Math.abs(endA-endB)<=1;
    if(sameStart&&sameEnd){found.push({a,b,kind:"DUPLICATE",titleScore,siteScore});continue;}
    if(startA!=null&&startB!=null&&!sameStart&&titleScore>=0.75)found.push({a,b,kind:"CONFLICT",titleScore,siteScore});
  }
  return found;
}

export function buildQualitySuggestions(candidates,{sourceBlocks=[],now=new Date()}={}){
  const list=(candidates||[]).filter((candidate)=>candidate&&typeof candidate==="object");
  const output=[];
  const nowIndex=now.getUTCFullYear()*12+now.getUTCMonth();

  for(const {a,b,kind} of duplicatePairs(list)){
    if(kind==="DUPLICATE"){
      output.push(suggestion("POSSIBLE_DUPLICATE","REVIEW",{
        candidateIds:[a.id,b.id],
        sourceBlockIds:[...blockIdsOf(a),...blockIdsOf(b)],
        reason:`“${a.title}” and “${b.title}” were read from this document as two entries covering the same dates.`,
        recommendation:"Open both, keep the one that reads better, and reject the other. Nothing is removed until you decide."
      }));
      continue;
    }
    output.push(suggestion("CHRONOLOGY_REVIEW","REVIEW",{
      candidateIds:[a.id,b.id],
      sourceBlockIds:[...blockIdsOf(a),...blockIdsOf(b)],
      reason:`“${a.title}” appears twice in this document with different dates (${a.startDate||"no start"} and ${b.startDate||"no start"}).`,
      recommendation:"Check the document and correct whichever start date is wrong before accepting either entry."
    }));
  }

  for(const candidate of list){
    const start=monthIndex(candidate.startDate);
    const end=monthIndex(candidate.endDate);
    if(start!=null&&end!=null&&end<start){
      output.push(suggestion("CHRONOLOGY_REVIEW","REVIEW",{
        candidateIds:[candidate.id],
        sourceBlockIds:blockIdsOf(candidate),
        reason:`“${candidate.title}” ends (${candidate.endDate}) before it starts (${candidate.startDate}).`,
        recommendation:"Fix the start or the end month. We will not guess which one the document meant."
      }));
    }
    if(start!=null&&start>nowIndex+1){
      output.push(suggestion("CHRONOLOGY_REVIEW","REVIEW",{
        candidateIds:[candidate.id],
        sourceBlockIds:blockIdsOf(candidate),
        reason:`“${candidate.title}” starts in ${candidate.startDate}, which is in the future.`,
        recommendation:"Confirm the year. A future start is usually a typo or a planned rotation."
      }));
    }
    const ongoing=ONGOING_WORDING.test(evidenceText(candidate));
    if(candidate.startDate&&!candidate.endDate&&candidate.openEnded!==true&&(candidate.eventType==="duration"||ongoing)){
      output.push(suggestion("MISSING_END_DATE",ongoing?"INFO":"REVIEW",{
        candidateIds:[candidate.id],
        sourceBlockIds:blockIdsOf(candidate),
        reason:ongoing
          ?`“${candidate.title}” has no end month, and the document says it is still going.`
          :`“${candidate.title}” has a start month but no end month.`,
        recommendation:ongoing
          ?"Mark it as ongoing so the timeline draws it up to today."
          :"Add the end month, or mark it ongoing if you are still there.",
        proposal:ongoing?{
          candidateId:candidate.id,
          patch:{eventType:"duration",openEnded:true,endDate:null},
          label:"Mark as ongoing",
          evidence:"The source text for this entry says present/ongoing."
        }:null
      }));
    }
    const unmapped=candidate.fields?.mappingReviewRequired===true||String(candidate.fields?.canonicalType||"").toUpperCase()==="UNCLASSIFIED";
    if(unmapped){
      output.push(suggestion("CATEGORY_REVIEW","REVIEW",{
        candidateIds:[candidate.id],
        sourceBlockIds:blockIdsOf(candidate),
        reason:`We could not tell which part of your story “${candidate.title}” belongs to.`,
        recommendation:"Pick the category yourself. We never guess a category for you."
      }));
    }
    const title=String(candidate.title||"");
    if(title.length>LONG_TITLE){
      const short=shortenTitle(title);
      output.push(suggestion("LABEL_READABILITY","INFO",{
        candidateIds:[candidate.id],
        sourceBlockIds:blockIdsOf(candidate),
        reason:`“${title.slice(0,80)}…” is too long to read on a timeline card.`,
        recommendation:"Shorten the label. The full text stays in the source evidence.",
        proposal:short&&short!==title&&short.length>=6?{
          candidateId:candidate.id,
          patch:{title:short},
          label:`Shorten to “${short}”`,
          evidence:"Trimmed from your own wording - no words were added."
        }:null
      }));
    }
  }

  const used=new Set(list.flatMap(blockIdsOf));
  const dropped=(sourceBlocks||[]).filter((block)=>
    block&&!used.has(String(block.id))&&
    /\b(?:19|20)\d{2}\b/.test(String(block.text||""))&&
    String(block.text||"").trim().length>=12
  ).slice(0,10);
  for(const block of dropped){
    output.push(suggestion("SOURCE_ITEM_NOT_INCLUDED","INFO",{
      sourceBlockIds:[String(block.id)],
      reason:`A dated line was read from your document but produced no suggestion: “${String(block.text).slice(0,120)}”.`,
      recommendation:"If it belongs on your timeline, add it in the builder after this import."
    }));
  }

  const deduped=[...new Map(output.map((item)=>[item.id,item])).values()];
  return deduped.sort((left,right)=>
    (left.severity===right.severity?0:left.severity==="REVIEW"?-1:1)||
    TYPE_ORDER.indexOf(left.type)-TYPE_ORDER.indexOf(right.type)
  );
}
