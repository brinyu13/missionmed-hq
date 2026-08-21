export async function readPdfTextContent(page,options){
  const stream=page.streamTextContent(options);
  if(typeof stream?.[Symbol.asyncIterator]==="function"){
    return page.getTextContent(options);
  }
  if(typeof stream?.getReader!=="function"){
    throw new TypeError("PDF text stream is unavailable in this browser.");
  }

  const reader=stream.getReader();
  const result={items:[],styles:Object.create(null),lang:null};
  try{
    for(;;){
      const {value,done}=await reader.read();
      if(done)break;
      if(!value)continue;
      result.lang??=value.lang??null;
      Object.assign(result.styles,value.styles||{});
      if(Array.isArray(value.items))result.items.push(...value.items);
    }
  }finally{
    reader.releaseLock?.();
  }
  return result;
}
