function factor(id,label,points,applies=true){return applies?{id,label,points}:null;}

export function scoreConfidence({record,dateRange,classification,privacy}){
  const factors=[
    factor("section","Recognized source section",14,record.section&&record.section!=="unknown"),
    factor("date","Recognized start date",18,!!dateRange?.start?.timelineMonth),
    factor("precision","Month or day date precision",12,["MONTH","DAY"].includes(dateRange?.start?.precision)),
    factor("title","Clear event title",14,!!record.title&&record.title.length>=3),
    factor("organization","Organization or institution present",8,!!record.organization),
    factor("taxonomy","Canonical event taxonomy match",16,classification.canonicalType!=="UNCLASSIFIED"),
    factor("range","Complete or explicitly open-ended range",8,classification.timelineKind==="milestone"||!!dateRange?.end||dateRange?.openEnded),
    factor("provenance","Source block provenance available",10,(record.sourceBlocks||[]).length>0),
    factor("inferred","Inferred date detail",-14,!!dateRange?.inferred),
    factor("missing_date","Missing start date",-28,!dateRange?.start?.timelineMonth),
    factor("unclassified","Unclassified event",-30,classification.canonicalType==="UNCLASSIFIED"),
    factor("privacy","Privacy-sensitive content",-12,!!privacy?.sensitive),
    factor("date_order","Invalid date order",-40,dateRange?.validOrder===false)
  ].filter(Boolean);
  let score=Math.max(0,Math.min(100,50+factors.reduce((sum,item)=>sum+item.points,0)));
  let level=score>=80?"HIGH":score>=60?"MEDIUM":score>=40?"LOW":"NEEDS_REVIEW";
  if(!dateRange?.start?.timelineMonth){score=Math.min(score,35);level="NEEDS_REVIEW";}
  if(privacy?.sensitive||classification.canonicalType==="UNCLASSIFIED"||dateRange?.validOrder===false)level="NEEDS_REVIEW";
  return {score,level,factors,summary:factors.map((item)=>(item.points>=0?"+":"")+item.points+" "+item.label)};
}
