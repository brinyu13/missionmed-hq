// Small, strict XML tree for our generated SVG/OOXML. No DTD, external entities,
// namespace execution, network resolution, or arbitrary document instructions.
export const xmlEscape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
export const xmlDecode=value=>String(value).replace(/&#x([0-9a-f]+);|&#(\d+);|&(amp|lt|gt|quot|apos);/gi,(_,hex,decimal,name)=>hex||decimal?String.fromCodePoint(parseInt(hex||decimal,hex?16:10)):({amp:'&',lt:'<',gt:'>',quot:'"',apos:"'"}[name.toLowerCase()]));
export function parsePresentationXml(source){
  if(/<!DOCTYPE|<!ENTITY/i.test(source))throw new Error('PRESENTATION_XML_DTD_DENIED');
  const root={tag:'#document',attrs:{},children:[]},stack=[root];
  for(const token of String(source).match(/<!--[\s\S]*?-->|<\?[\s\S]*?\?>|<[^>]+>|[^<]+/g)||[]){
    if(token.startsWith('<?')||token.startsWith('<!--'))continue;
    if(token.startsWith('</')){
      const tag=token.slice(2,-1).trim();
      if(stack.length===1||stack.pop().tag!==tag)throw new Error('PRESENTATION_XML_UNBALANCED');
    }else if(token.startsWith('<')){
      const tag=token.match(/^<([^\s/>]+)/)?.[1];
      if(!tag)throw new Error('PRESENTATION_XML_TAG_INVALID');
      const attrs={};
      for(const match of token.matchAll(/([^\s=<>]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g))attrs[match[1]]=xmlDecode(match[2]??match[3]);
      const node={tag,attrs,children:[]};stack.at(-1).children.push(node);
      if(!token.endsWith('/>'))stack.push(node);
    }else stack.at(-1).children.push(xmlDecode(token));
  }
  if(stack.length!==1)throw new Error('PRESENTATION_XML_UNBALANCED');
  return root.children.find(child=>typeof child!=='string')||root;
}
export function serializePresentationXml(node){
  if(typeof node==='string')return xmlEscape(node);
  const attributes=Object.entries(node.attrs||{}).map(([key,value])=>` ${key}="${xmlEscape(value)}"`).join('');
  return node.children?.length?`<${node.tag}${attributes}>${node.children.map(serializePresentationXml).join('')}</${node.tag}>`:`<${node.tag}${attributes}/>`;
}
export function xmlNodes(node,predicate){
  const result=[];
  function visit(item){if(typeof item==='string')return;if(predicate(item))result.push(item);for(const child of item.children||[])visit(child);}
  visit(node);return result;
}
export const xmlText=node=>typeof node==='string'?node:(node.children||[]).map(xmlText).join('');
