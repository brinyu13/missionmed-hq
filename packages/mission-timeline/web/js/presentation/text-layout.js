// One measured wrapping contract for SVG layout and resolved native text.
let canvasContext;
export function measurePresentationText(text,size=22,family='Arial',weight=400){
  if(typeof document!=='undefined'){
    canvasContext ||= document.createElement('canvas').getContext('2d');
    if(canvasContext){canvasContext.font=`${weight} ${size}px ${family}`;return canvasContext.measureText(String(text)).width;}
  }
  // Deterministic server/test approximation. Native acceptance requires loaded fonts.
  return Array.from(String(text)).reduce((sum,char)=>sum+(/\s/.test(char)?.28:/[ilI.,'!|]/.test(char)?.28:/[MW@#]/.test(char)?.9:/[^\u0000-\u00ff]/.test(char)?1:.56)*size,0);
}
export function wrapPresentationText(text,{width,size=22,family='Arial',weight=400,wrap='wrap',measureText=measurePresentationText}={}){
  if(!(Number(width)>0)||!(Number(size)>0))throw new TypeError('Text needs a positive width and font size.');
  const paragraphs=String(text??'').split(/\r?\n/);
  if(wrap==='nowrap')return[paragraphs.join(' ')];
  const fits=value=>measureText(value,size,family,weight)<=width;
  const segments=value=>typeof Intl.Segmenter==='function'?[...new Intl.Segmenter(undefined,{granularity:'grapheme'}).segment(value)].map(s=>s.segment):Array.from(value);
  const lines=[];
  for(const paragraph of paragraphs){
    let line='';const words=paragraph.split(/\s+/).filter(Boolean);
    if(!words.length){lines.push('');continue;}
    for(const word of words){
      const candidate=line?`${line} ${word}`:word;
      if(fits(candidate)){line=candidate;continue;}
      if(line){lines.push(line);line='';}
      if(fits(word)){line=word;continue;}
      for(const segment of segments(word)){
        if(line&&!fits(line+segment)){lines.push(line);line='';}
        line+=segment;
      }
    }
    if(line)lines.push(line);
  }
  return lines;
}
export function fitPresentationText(text,{width,height,size=24,minSize=10,lineHeight=1.2,fit='auto',wrap='wrap',family='Arial',weight=400,measureText=measurePresentationText}={}){
  const minimum=Math.min(size,Math.max(1,minSize));let fontSize=size,lines;
  const layout=()=>{lines=wrapPresentationText(text,{width,size:fontSize,family,weight,wrap,measureText});return{width:Math.max(0,...lines.map(l=>measureText(l,fontSize,family,weight))),height:lines.length*fontSize*lineHeight};};
  let bounds=layout();
  while(fit!=='fixed'&&fontSize>minimum&&(bounds.width>width||bounds.height>height)){fontSize=Math.max(minimum,fontSize-1);bounds=layout();}
  return{lines,fontSize,...bounds,fits:bounds.width<=width+.01&&bounds.height<=height+.01};
}
