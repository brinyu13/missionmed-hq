import assert from "node:assert/strict";
import test from "node:test";

import {readPdfTextContent} from "../web/js/ingestion/pdf-text-stream-reader.js";

test("uses PDF.js native text reader when the stream is async iterable",async()=>{
  const expected={items:[{str:"native"}],styles:{},lang:"en"};
  let nativeCalls=0;
  const page={
    streamTextContent(){
      return{
        async *[Symbol.asyncIterator](){yield expected;}
      };
    },
    async getTextContent(){
      nativeCalls+=1;
      return expected;
    }
  };

  assert.equal(await readPdfTextContent(page,{}),expected);
  assert.equal(nativeCalls,1);
});

test("reads PDF.js chunks through getReader when Safari lacks async iteration",async()=>{
  const chunks=[
    {lang:"en",styles:{f1:{fontFamily:"Inter"}},items:[{str:"Mission"}]},
    {styles:{f2:{fontFamily:"Nunito"}},items:[{str:"Med"}]}
  ];
  let index=0;
  let released=false;
  const page={
    streamTextContent(){
      return{
        getReader(){
          return{
            async read(){
              if(index>=chunks.length)return{done:true,value:undefined};
              return{done:false,value:chunks[index++]};
            },
            releaseLock(){released=true;}
          };
        }
      };
    },
    async getTextContent(){
      throw new Error("Safari fallback must not call getTextContent");
    }
  };

  const result=await readPdfTextContent(page,{});
  assert.deepEqual(result.items,[{str:"Mission"},{str:"Med"}]);
  assert.deepEqual(Object.keys(result.styles),["f1","f2"]);
  assert.equal(result.lang,"en");
  assert.equal(released,true);
});

test("fails closed when the PDF text stream supports neither interface",async()=>{
  await assert.rejects(
    readPdfTextContent({streamTextContent:()=>({})},{}),
    /PDF text stream is unavailable/
  );
});
