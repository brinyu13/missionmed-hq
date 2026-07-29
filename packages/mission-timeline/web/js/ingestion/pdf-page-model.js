function normalizedSpace(value){return String(value||"").replace(/\s+/g," ").trim();}

export function textItemsToLines(items){
  const rows=[];
  (items||[]).forEach((item,index)=>{
    const text=normalizedSpace(item.str);
    if(!text)return;
    const transform=item.transform||[1,0,0,1,0,0];
    const x=Number(transform[4]||0);
    const y=Number(transform[5]||0);
    let row=rows.find((candidate)=>Math.abs(candidate.y-y)<=2.4);
    if(!row){row={y,items:[]};rows.push(row);}
    row.items.push({text,x,index,hasEOL:!!item.hasEOL});
  });
  return rows.sort((a,b)=>b.y-a.y).map((row)=>{
    const sorted=row.items.sort((a,b)=>a.x-b.x||a.index-b.index);
    return normalizedSpace(sorted.map((item)=>item.text).join(" "));
  }).filter(Boolean);
}

export function buildDocumentPage({sourceDocumentId,pageNumber,textContent,viewport}){
  const lines=textItemsToLines(textContent?.items||[]);
  const text=lines.join("\n");
  return {
    id:sourceDocumentId+":page:"+pageNumber,
    sourceDocumentId,
    pageNumber,
    width:Math.round(viewport?.width||0),
    height:Math.round(viewport?.height||0),
    lines,
    text,
    charCount:text.length,
    extractionMethod:"PDFJS_TEXT_LAYER"
  };
}
