// Source-only bounded UTF-8 MyERAS import parser. No network, credentials, database or AI.
export const MYERAS_HEADER=Object.freeze(['program_name','specialty','track','institution','city','state','program_identifier','application_status','signal_status','interview_status','source','exported_at']);
export const MAX_BYTES=262144,MAX_ROWS=2000;
const fail=code=>{const e=new Error(code);e.code=code;throw e;};
export function parseMyerasCsv(input){
 const bytes=typeof input==='string'?new TextEncoder().encode(input):input;
 if(!(bytes instanceof Uint8Array)||bytes.byteLength===0||bytes.byteLength>MAX_BYTES)fail('invalid_csv_size');
 let text;try{text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);}catch{fail('invalid_csv_utf8');}
 // Reject hidden controls and bidirectional overrides. The only structural controls are CR/LF.
 if(/[\u0000-\u0009\u000b\u000c\u000e-\u001f\u007f\u202a-\u202e\u2066-\u2069]/u.test(text))fail('unsafe_csv_control');
 const rows=[];let row=[],cell='',quoted=false,afterQuote=false,start=true;
 const endCell=()=>{if(cell.length>2000)fail('csv_cell_too_long');row.push(cell);if(row.length>MYERAS_HEADER.length)fail('unexpected_csv_columns');cell='';start=true;afterQuote=false;};
 const endRow=()=>{endCell();if(!(row.length===1&&row[0]==='')){rows.push(row);if(rows.length>MAX_ROWS+1)fail('csv_row_limit');}row=[];};
 for(let i=0;i<text.length;i++){
  const ch=text[i];if(quoted){if(ch==='"'){if(text[i+1]==='"'){cell+='"';i++;}else{quoted=false;afterQuote=true;}}else cell+=ch;}
  else if(ch==='"'){if(!start||afterQuote)fail('malformed_csv_quotes');quoted=true;start=false;}
  else if(ch===','){endCell();}
  else if(ch==='\n'||ch==='\r'){if(ch==='\r'&&text[i+1]==='\n')i++;endRow();}
  else{if(afterQuote)fail('malformed_csv_quotes');cell+=ch;start=false;}
  if(cell.length>2000)fail('csv_cell_too_long');
 }
 if(quoted)fail('malformed_csv_quotes');if(cell!==''||row.length||afterQuote)endRow();
 if(!rows.length||JSON.stringify(rows.shift())!==JSON.stringify(MYERAS_HEADER))fail('unexpected_csv_header');
 if(!rows.length)fail('empty_csv_programs');
 const unique=new Map();let duplicates=0;
 for(const values of rows){
  if(values.length!==MYERAS_HEADER.length)fail('malformed_csv_columns');
  for(const value of values){if(/[\r\n]/u.test(value)||/^[\s\ufeff]*[=+@-]/u.test(value))fail('unsafe_csv_cell');}
  const original=Object.fromEntries(MYERAS_HEADER.map((k,i)=>[k,values[i]]));
  if(!original.program_name.trim()||original.program_name.length>500)fail('missing_csv_program_name');
  if(original.source!=='MYERAS')fail('invalid_csv_source');
  if(original.exported_at&&!Number.isFinite(Date.parse(original.exported_at)))fail('invalid_csv_export_time');
  // Identical program rows dedupe only; conflicting status/track/identity remains for explicit review.
  const key=JSON.stringify(values.slice(0,-1));const prior=unique.get(key);
  if(prior){duplicates++;if(!prior.exportedAt.includes(original.exported_at))prior.exportedAt.push(original.exported_at);}
  else unique.set(key,{rowNumber:unique.size+1,original,exportedAt:[original.exported_at],resolutionState:'NOT_FOUND',choice:'MAYBE_LATER'});
 }
 return {schema:'iiq-myeras-import-v1',rowCount:rows.length,uniqueCount:unique.size,duplicateCount:duplicates,programs:[...unique.values()]};
}
