function ascii(value){return new TextEncoder().encode(value);}
function concat(parts){const size=parts.reduce((sum,part)=>sum+part.length,0),out=new Uint8Array(size);let offset=0;parts.forEach((part)=>{out.set(part,offset);offset+=part.length;});return out;}
function pad(value,width){return String(value).padStart(width,"0");}
function pdfNumber(value){
  const number=Number(value);
  if(!Number.isFinite(number))throw new TypeError("PDF geometry must be finite.");
  if(Math.abs(number)<1e-9)return"0";
  return String(Number(number.toFixed(6)));
}

export async function buildImagePdf(pages,{title="Mission Timeline",author="MissionMed Timeline Builder"}={}){
  if(!pages.length)throw new Error("At least one PDF page is required.");
  const objects=[],pageRefs=[];let nextId=3;
  for(let index=0;index<pages.length;index++){
    const page=pages[index],pageId=nextId++,imageId=nextId++,contentId=nextId++;pageRefs.push(`${pageId} 0 R`);
    const pageWidth=page.pageWidth||792,pageHeight=page.pageHeight||612;
    objects.push({id:pageId,bytes:ascii(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pdfNumber(pageWidth)} ${pdfNumber(pageHeight)}] /Resources << /XObject << /Im${index} ${imageId} 0 R >> >> /Contents ${contentId} 0 R >>`)});
    const jpeg=page.jpegBytes instanceof Uint8Array?page.jpegBytes:new Uint8Array(page.jpegBytes);
    objects.push({id:imageId,bytes:concat([ascii(`<< /Type /XObject /Subtype /Image /Width ${page.pixelWidth} /Height ${page.pixelHeight} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`),jpeg,ascii("\nendstream")])});
    const placement=page.imagePlacement||fitImageToPage({
      pixelWidth:page.pixelWidth,
      pixelHeight:page.pixelHeight,
      pageWidth,
      pageHeight
    });
    const stream=`q\n1 1 1 rg\n0 0 ${pdfNumber(pageWidth)} ${pdfNumber(pageHeight)} re f\nQ\nq\n${pdfNumber(placement.width)} 0 0 ${pdfNumber(placement.height)} ${pdfNumber(placement.x)} ${pdfNumber(placement.y)} cm\n/Im${index} Do\nQ\n`;
    objects.push({id:contentId,bytes:ascii(`<< /Length ${ascii(stream).length} >>\nstream\n${stream}endstream`)});
  }
  const infoId=nextId++;objects.push({id:1,bytes:ascii("<< /Type /Catalog /Pages 2 0 R >>")});objects.push({id:2,bytes:ascii(`<< /Type /Pages /Kids [${pageRefs.join(" ")}] /Count ${pages.length} >>`)});objects.push({id:infoId,bytes:ascii(`<< /Title (${title.replace(/[()]/g,"")}) /Author (${author.replace(/[()]/g,"")}) /Creator (D1-409 Local Export Engine) >>`)});
  objects.sort((a,b)=>a.id-b.id);const parts=[ascii("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n")],offsets=[0];let length=parts[0].length;
  objects.forEach((object)=>{offsets[object.id]=length;const bytes=concat([ascii(`${object.id} 0 obj\n`),object.bytes,ascii("\nendobj\n")]);parts.push(bytes);length+=bytes.length;});
  const xrefOffset=length;const maxId=infoId;let xref=`xref\n0 ${maxId+1}\n0000000000 65535 f \n`;for(let id=1;id<=maxId;id++)xref+=`${pad(offsets[id]||0,10)} 00000 n \n`;
  parts.push(ascii(xref+`trailer\n<< /Size ${maxId+1} /Root 1 0 R /Info ${infoId} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`));return new Blob(parts,{type:"application/pdf"});
}

export function fitImageToPage({pixelWidth,pixelHeight,pageWidth=792,pageHeight=612}={}){
  const sourceWidth=Number(pixelWidth);
  const sourceHeight=Number(pixelHeight);
  const targetWidth=Number(pageWidth);
  const targetHeight=Number(pageHeight);
  if(
    !Number.isFinite(sourceWidth)||sourceWidth<=0||
    !Number.isFinite(sourceHeight)||sourceHeight<=0||
    !Number.isFinite(targetWidth)||targetWidth<=0||
    !Number.isFinite(targetHeight)||targetHeight<=0
  )throw new TypeError("PDF image and page dimensions must be positive finite numbers.");
  const scale=Math.min(targetWidth/sourceWidth,targetHeight/sourceHeight);
  const width=sourceWidth*scale;
  const height=sourceHeight*scale;
  return Object.freeze({
    x:(targetWidth-width)/2,
    y:(targetHeight-height)/2,
    width,
    height
  });
}

export async function canvasJpegPage(canvas,{pageWidth=792,pageHeight=612,quality=.94}={}){
  const blob=await new Promise((resolve,reject)=>canvas.toBlob((value)=>value?resolve(value):reject(new Error("JPEG conversion failed.")),"image/jpeg",quality));
  return {
    jpegBytes:new Uint8Array(await blob.arrayBuffer()),
    pixelWidth:canvas.width,
    pixelHeight:canvas.height,
    pageWidth,
    pageHeight,
    imagePlacement:fitImageToPage({
      pixelWidth:canvas.width,
      pixelHeight:canvas.height,
      pageWidth,
      pageHeight
    })
  };
}
