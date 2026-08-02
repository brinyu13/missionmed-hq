import {projectTimelineDocument} from "./domain-visual-adapter.js";

const MASTER_URL=new URL(
  "../../presentation/d1-409h-a1/D1-409H_FINAL_VISUAL_MASTER.html?defer=1",
  import.meta.url
).href;
const INSTANCES=new Map();
let tokenSequence=0;
const HostHTMLElement=typeof HTMLElement==="undefined"?class{}:HTMLElement;

function escapeAttribute(value){
  return String(value??"").replace(/[&<>'"]/g,(character)=>({
    "&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"
  })[character]);
}

function monthIndex(year,month){return Number(year)*12+(Number(month)||1)-1;}

class D1411AKernelElement extends HostHTMLElement{
  constructor(){
    super();
    this._record=null;
    this._kernel=null;
    this._resizeObserver=null;
    this._childCleanup=[];
    this._gesture=null;
    this._hitLayer=null;
    this._hitSources=[];
    this.attachShadow({mode:"open"});
  }

  connectedCallback(){
    this.style.display="block";
    this.style.width="100%";
    this.style.aspectRatio="16 / 9";
    if(this.clientWidth>0){this._mount().catch((error)=>this._fail(error));return;}
    this._resizeObserver=new ResizeObserver(()=>{
      if(this.clientWidth<=0)return;
      this._resizeObserver?.disconnect();
      this._resizeObserver=null;
      this._mount().catch((error)=>this._fail(error));
    });
    this._resizeObserver.observe(this);
  }

  disconnectedCallback(){
    this._resizeObserver?.disconnect();
    this._resizeObserver=null;
    for(const cleanup of this._childCleanup.splice(0))cleanup();
    this._kernel?.destroy?.();
    this._kernel=null;
    INSTANCES.delete(this.dataset.kernelToken);
  }

  async _mount(){
    this._record=INSTANCES.get(this.dataset.kernelToken)||null;
    if(!this._record)throw new Error("D1-411A kernel projection is unavailable.");
    this.shadowRoot.innerHTML=`<style>
      :host{display:block;position:relative;width:100%;aspect-ratio:16/9;overflow:hidden;background:#c8d8e1}
      iframe{display:block;width:100%;height:100%;border:0;background:#c8d8e1}
      output{position:absolute;inset:0;display:grid;place-items:center;background:#c8d8e1;color:#19334f;font:700 12px/1.5 system-ui,sans-serif;letter-spacing:.08em;text-transform:uppercase}
      :host([data-ready="true"]) output{display:none}
    </style><iframe title="${escapeAttribute(this._record.label)}" src="${escapeAttribute(MASTER_URL)}"></iframe><output role="status">Loading canonical timeline…</output>`;
    const iframe=this.shadowRoot.querySelector("iframe");
    await new Promise((resolve,reject)=>{
      iframe.addEventListener("load",resolve,{once:true});
      iframe.addEventListener("error",()=>reject(new Error("Canonical timeline frame failed to load.")),{once:true});
    });
    const child=iframe.contentWindow;
    const K=child?.D1409H;
    if(!K||K.kernelId!=="D1-409H-A1")throw new Error("Protected D1-409H-A1 kernel was not loaded.");
    await K.ready();
    const response=await K.rerender(this._record.projection.model,{
      renderId:this._record.renderId,
      reason:this._record.reason
    });
    await K.whenStable(this._record.renderId);
    if(!this.isConnected){K.destroy?.();return;}
    this._kernel=K;
    this.dataset.ready="true";
    this.dataset.fingerprint=response.fingerprint;
    this.dataset.renderId=this._record.renderId;
    this.dataset.protectedKernel=K.kernelId;
    this.dataset.projectionWarnings=JSON.stringify(this._record.projection.warnings||[]);
    this.dataset.projectionDropped=JSON.stringify(this._record.projection.dropped||[]);
    this.resize();
    this._installChildInteractions(iframe);
    this._resizeObserver=new ResizeObserver(()=>this.resize());
    this._resizeObserver.observe(this);
    this.dispatchEvent(new CustomEvent("d1-411a:ready",{
      bubbles:true,
      composed:true,
      detail:{
        surface:this._record.surface,
        renderId:this._record.renderId,
        fingerprint:response.fingerprint,
        warnings:this._record.projection.warnings,
        dropped:this._record.projection.dropped
      }
    }));
  }

  _installChildInteractions(iframe){
    const childDocument=iframe.contentDocument;
    if(!childDocument)return;
    const interaction=(event)=>{
      const detail=event.detail||{};
      const domainId=this._record.projection.visualToDomain.get(detail.objectId)||null;
      this.dispatchEvent(new CustomEvent("d1-411a:interaction",{
        bubbles:true,
        composed:true,
        detail:{...detail,domainId,surface:this._record.surface}
      }));
    };
    childDocument.addEventListener("d1-409h:interaction",interaction);
    this._childCleanup.push(()=>childDocument.removeEventListener("d1-409h:interaction",interaction));

    const objects=[...childDocument.querySelectorAll(
      ".arrow[data-object-id],.flag[data-object-id],.photoTile[data-object-id],#profile-photo-well[data-object-id],#logo-mount[data-object-id],#sticky-note[data-object-id]"
    )];
    if(this._record.interactive){
      const focusStyle=childDocument.createElement("style");
      focusStyle.dataset.hostAccessibility="d1-411b";
      focusStyle.textContent='.d1411AHitLayer{position:absolute;inset:0;z-index:1000;pointer-events:none}.d1411AHit{position:absolute;border:0;padding:0;background:transparent;color:transparent;pointer-events:auto}.d1411AHit:focus-visible{outline:3px solid #191c21;outline-offset:2px;background:rgba(255,255,255,.08)}';
      childDocument.head.append(focusStyle);
      this._childCleanup.push(()=>focusStyle.remove());
      const board=childDocument.getElementById("board");
      this._hitLayer=childDocument.createElement("div");
      this._hitLayer.className="d1411AHitLayer";
      this._hitLayer.setAttribute("data-d1-411a-hit-layer","true");
      board.append(this._hitLayer);
      this._hitSources=objects;
      this._refreshHits(childDocument);
      const forwardHit=(event)=>{
        if(event.type==="click"&&event.detail===0)return;
        const hit=event.target.closest?.("[data-d1-411a-hit]");
        if(!hit)return;
        const source=childDocument.querySelector(
          `[data-object-id="${CSS.escape(hit.dataset.sourceObjectId)}"]`
        );
        source?.dispatchEvent(new MouseEvent(event.type,{bubbles:true}));
      };
      this._hitLayer.addEventListener("click",forwardHit);
      this._hitLayer.addEventListener("dblclick",forwardHit);
      this._childCleanup.push(()=>this._hitLayer?.removeEventListener("click",forwardHit));
      this._childCleanup.push(()=>this._hitLayer?.removeEventListener("dblclick",forwardHit));
      const hits=()=>[...this._hitLayer.querySelectorAll("[data-d1-411a-hit]")];
      const keydown=(event)=>{
        const current=event.target.closest?.("[data-d1-411a-hit]");
        if(!current)return;
        const visualId=current.dataset.sourceObjectId;
        const domainId=this._record.projection.visualToDomain.get(visualId)||null;
        const modelEvent=this._record.projection.model.events.find(
          (item)=>item.id===visualId
        );
        if(event.key==="Escape"&&this._record.surface==="full-preview"){
          event.preventDefault();
          this.dispatchEvent(new CustomEvent("d1-411a:command",{
            bubbles:true,composed:true,
            detail:{surface:this._record.surface,domainId,command:"close-preview"}
          }));
          return;
        }
        if(this._record.editable&&domainId&&event.metaKey&&event.key.toLowerCase()==="z"){
          event.preventDefault();
          this.dispatchEvent(new CustomEvent("d1-411a:command",{
            bubbles:true,composed:true,
            detail:{surface:this._record.surface,domainId,command:event.shiftKey?"redo":"undo"}
          }));
          return;
        }
        if(this._record.editable&&domainId&&["Delete","Backspace"].includes(event.key)){
          event.preventDefault();
          this.dispatchEvent(new CustomEvent("d1-411a:command",{
            bubbles:true,composed:true,
            detail:{surface:this._record.surface,domainId,command:"delete"}
          }));
          return;
        }
        if(
          this._record.editable&&domainId&&modelEvent&&
          ["ArrowLeft","ArrowRight","ArrowUp","ArrowDown"].includes(event.key)&&
          (event.shiftKey||event.altKey)
        ){
          event.preventDefault();
          const horizontal=event.key==="ArrowLeft"||event.key==="ArrowRight";
          const direction=event.key==="ArrowLeft"||event.key==="ArrowUp"?-1:1;
          const lane=Math.max(0,Math.min(6,Number(modelEvent.lane||0)+direction));
          this.dispatchEvent(new CustomEvent("d1-411a:gesture",{
            bubbles:true,composed:true,
            detail:{
              surface:this._record.surface,
              domainId,
              kind:event.altKey&&horizontal?"resize-end":horizontal?"move":"lane",
              monthDelta:horizontal?direction:0,
              targetLane:horizontal?null:lane
            }
          }));
          return;
        }
        const currentHits=hits();
        const index=Math.max(0,currentHits.indexOf(current));
        const direction={ArrowRight:1,ArrowDown:1,ArrowLeft:-1,ArrowUp:-1}[event.key];
        if(direction){
          event.preventDefault();
          const next=(index+direction+currentHits.length)%currentHits.length;
          currentHits.forEach((node,i)=>node.tabIndex=i===next?0:-1);
          currentHits[next]?.focus();
          return;
        }
        if(["Enter"," "].includes(event.key)){
          event.preventDefault();
          const source=childDocument.querySelector(
            `[data-object-id="${CSS.escape(current.dataset.sourceObjectId)}"]`
          );
          source?.dispatchEvent(new MouseEvent("dblclick",{bubbles:true}));
        }
      };
      childDocument.addEventListener("keydown",keydown);
      this._childCleanup.push(()=>childDocument.removeEventListener("keydown",keydown));
    }

    const dragover=(event)=>{
      if(!this._record.acceptsMedia)return;
      const types=[...(event.dataTransfer?.types||[])];
      if(!types.includes("application/x-missionmed-media-id"))return;
      event.preventDefault();
      event.dataTransfer.dropEffect="copy";
    };
    const drop=(event)=>{
      if(!this._record.acceptsMedia)return;
      const id=event.dataTransfer?.getData("application/x-missionmed-media-id");
      if(!id)return;
      event.preventDefault();
      const board=childDocument.getElementById("board");
      const bounds=board.getBoundingClientRect();
      const scale=bounds.width/1920;
      this.dispatchEvent(new CustomEvent("d1-411a:media-drop",{
        bubbles:true,composed:true,
        detail:{
          id,
          surface:this._record.surface,
          x:(event.clientX-bounds.left)/scale,
          y:(event.clientY-bounds.top)/scale
        }
      }));
    };
    childDocument.addEventListener("dragover",dragover);
    childDocument.addEventListener("drop",drop);
    this._childCleanup.push(()=>childDocument.removeEventListener("dragover",dragover));
    this._childCleanup.push(()=>childDocument.removeEventListener("drop",drop));

    if(this._record.editable){
      const pointerdown=(event)=>this._beginGesture(event,childDocument);
      const pointermove=(event)=>this._moveGesture(event,childDocument);
      const pointerup=(event)=>this._endGesture(event,childDocument);
      childDocument.addEventListener("pointerdown",pointerdown);
      childDocument.addEventListener("pointermove",pointermove);
      childDocument.addEventListener("pointerup",pointerup);
      childDocument.addEventListener("pointercancel",pointerup);
      this._childCleanup.push(()=>childDocument.removeEventListener("pointerdown",pointerdown));
      this._childCleanup.push(()=>childDocument.removeEventListener("pointermove",pointermove));
      this._childCleanup.push(()=>childDocument.removeEventListener("pointerup",pointerup));
      this._childCleanup.push(()=>childDocument.removeEventListener("pointercancel",pointerup));
    }
  }

  _refreshHits(childDocument){
    if(!this._hitLayer||!this._record?.interactive)return;
    const board=childDocument.getElementById("board");
    const boardBounds=board.getBoundingClientRect();
    const scale=boardBounds.width/1920||1;
    // The protected kernel may replace its event nodes during a resize-driven
    // rerender. Re-resolve those exact protected nodes instead of retaining
    // detached references; the overlay is engineering interaction chrome only.
    this._hitSources=[...childDocument.querySelectorAll(
      ".arrow[data-object-id],.flag[data-object-id],.photoTile[data-object-id],#profile-photo-well[data-object-id],#logo-mount[data-object-id],#sticky-note[data-object-id]"
    )];
    this._hitLayer.textContent="";
    this._hitSources.forEach((source,index)=>{
      const bounds=source.getBoundingClientRect();
      if(!bounds.width||!bounds.height)return;
      const width=Math.max(bounds.width,44)/scale;
      const height=Math.max(bounds.height,44)/scale;
      const x=(bounds.left-boardBounds.left)/scale-(width-bounds.width/scale)/2;
      const y=(bounds.top-boardBounds.top)/scale-(height-bounds.height/scale)/2;
      const hit=childDocument.createElement("button");
      hit.type="button";
      hit.className="d1411AHit";
      hit.setAttribute("data-d1-411a-hit","true");
      hit.dataset.sourceObjectId=source.dataset.objectId;
      hit.tabIndex=index===0?0:-1;
      hit.setAttribute("aria-label",source.textContent?.trim()?.replace(/\s+/g," ")||"Timeline item");
      hit.style.left=`${x}px`;hit.style.top=`${y}px`;
      hit.style.width=`${width}px`;hit.style.height=`${height}px`;
      this._hitLayer.append(hit);
    });
  }

  _pointMonth(event,childDocument){
    const segments=[...childDocument.querySelectorAll("#axis .yseg")];
    for(const segment of segments){
      const bounds=segment.getBoundingClientRect();
      if(event.clientX<bounds.left||event.clientX>bounds.right)continue;
      const year=Number(segment.textContent?.trim());
      const ratio=Math.max(0,Math.min(.999,(event.clientX-bounds.left)/bounds.width));
      return monthIndex(year,Math.floor(ratio*12)+1);
    }
    return null;
  }

  _beginGesture(event,childDocument){
    if(event.button!==0)return;
    const proxy=event.target.closest?.("[data-d1-411a-hit]");
    const sourceId=proxy?.dataset?.sourceObjectId;
    const node=sourceId
      ?childDocument.querySelector(`.arrow[data-object-id="${CSS.escape(sourceId)}"]`)
      :event.target.closest?.(".arrow[data-object-id]");
    if(!node)return;
    const board=childDocument.getElementById("board");
    const boardBounds=board.getBoundingClientRect();
    const scale=boardBounds.width/1920;
    if(scale<.4)return;
    const visualId=node.dataset.objectId;
    const domainId=this._record.projection.visualToDomain.get(visualId);
    const modelEvent=this._record.projection.model.events.find((item)=>item.id===visualId);
    if(!domainId||!modelEvent)return;
    const bounds=node.getBoundingClientRect();
    const edge=18*scale;
    const kind=event.clientX-bounds.left<=edge
      ?"resize-start"
      :bounds.right-event.clientX<=edge
        ?"resize-end"
        :"move";
    this._gesture={
      pointerId:event.pointerId,
      domainId,
      visualId,
      kind,
      startX:event.clientX,
      startY:event.clientY,
      startMonth:this._pointMonth(event,childDocument),
      startLane:modelEvent.lane
    };
    (proxy||node).setPointerCapture?.(event.pointerId);
    event.preventDefault();
  }

  _moveGesture(event){
    if(!this._gesture||event.pointerId!==this._gesture.pointerId)return;
    this._gesture.lastX=event.clientX;
    this._gesture.lastY=event.clientY;
    event.preventDefault();
  }

  _endGesture(event,childDocument){
    const gesture=this._gesture;
    if(!gesture||event.pointerId!==gesture.pointerId)return;
    this._gesture=null;
    const dx=(gesture.lastX??event.clientX)-gesture.startX;
    const dy=(gesture.lastY??event.clientY)-gesture.startY;
    if(Math.hypot(dx,dy)<5)return;
    const endMonth=this._pointMonth(event,childDocument);
    let kind=gesture.kind;
    let targetLane=null;
    if(kind==="move"&&Math.abs(dy)>24&&Math.abs(dy)>Math.abs(dx)*.6){
      kind="lane";
      const laneY=[196,252,316,382,448,506,564];
      const board=childDocument.getElementById("board").getBoundingClientRect();
      const scale=board.width/1920;
      const y=(event.clientY-board.top)/scale;
      targetLane=laneY.reduce((best,value,index)=>
        Math.abs(value-y)<Math.abs(laneY[best]-y)?index:best,0);
    }
    this.dispatchEvent(new CustomEvent("d1-411a:gesture",{
      bubbles:true,composed:true,
      detail:{
        surface:this._record.surface,
        domainId:gesture.domainId,
        kind,
        monthDelta:gesture.startMonth!=null&&endMonth!=null?endMonth-gesture.startMonth:0,
        targetLane
      }
    }));
  }

  resize(){
    if(!this._kernel)return null;
    const width=this.clientWidth||1920;
    const height=width*9/16;
    const result=this._kernel.resize({containerWidth:width,containerHeight:height});
    const childDocument=this.shadowRoot?.querySelector("iframe")?.contentDocument;
    if(childDocument&&this._hitLayer)this._refreshHits(childDocument);
    return result;
  }

  diagnostics(){return this._kernel?.diagnostics?.()||null;}

  async exportBoard(request){
    if(!this._kernel)throw new Error("Timeline export is not ready.");
    await this._kernel.whenStable(this._record.renderId);
    return this._kernel.exportBoard(request);
  }

  _fail(error){
    this.dataset.ready="false";
    this.dataset.error=String(error?.code||error?.message||error);
    if(this.shadowRoot){
      this.shadowRoot.innerHTML=`<output role="alert">Timeline could not be rendered safely: ${escapeAttribute(error?.message||error)}</output>`;
    }
    this.dispatchEvent(new CustomEvent("d1-411a:error",{
      bubbles:true,composed:true,detail:{surface:this._record?.surface,error}
    }));
  }
}

if(typeof customElements!=="undefined"&&!customElements.get("d1-timeline-kernel")){
  customElements.define("d1-timeline-kernel",D1411AKernelElement);
}

export function createD1411AKernelManager({resolveObjectUrl=()=>null}={}){
  let generation=0;
  let current=null;
  const documentRevisions=new Map();

  const ensureProjection=(document,audience)=>{
    const signature=JSON.stringify(document);
    const updatedAt=Date.parse(String(document?.updatedAt||""));
    let revision=Number.isSafeInteger(updatedAt)&&updatedAt>=0
      ?updatedAt
      :documentRevisions.get(signature);
    if(revision==null){revision=++generation;documentRevisions.set(signature,revision);}
    current=projectTimelineDocument(document,{
      revision,
      audience,
      resolveObjectUrl
    });
    if(documentRevisions.size>12)documentRevisions.delete(documentRevisions.keys().next().value);
    return current;
  };

  const render=(document,{
    surface="preview",
    audience="EVERYTHING",
    interactive=false,
    editable=false,
    acceptsMedia=false,
    reason="preview"
  }={})=>{
    const projection=ensureProjection(document,audience);
    if(!projection.model.events.length){
      return{
        kind:"d1-411a-empty",
        html:'<div class="d1411AEmpty" role="status"><strong>No timeline events are visible for this audience.</strong><span>Add an event or change its visibility in Builder.</span></div>',
        projection,
        warnings:projection.warnings,
        dropped:projection.dropped,
        scene:{events:[],accessibility:{ariaLabel:"Timeline has no visible events"}}
      };
    }
    const token=`d1-411a-${++tokenSequence}`;
    const renderId=`${surface}-${projection.model.documentId}-${projection.model.revision}`;
    INSTANCES.set(token,{
      projection,
      surface,
      interactive:!!interactive,
      editable:!!editable,
      acceptsMedia:!!acceptsMedia,
      reason,
      renderId,
      label:`${surface} timeline preview`
    });
    const html=`<d1-timeline-kernel data-kernel-token="${escapeAttribute(token)}" data-surface="${escapeAttribute(surface)}" data-interactive="${interactive}" data-editable="${editable}" data-accepts-media="${acceptsMedia}"></d1-timeline-kernel>`;
    return{
      kind:"d1-411a-kernel",
      html,
      projection,
      warnings:projection.warnings,
      dropped:projection.dropped,
      scene:{events:[],accessibility:{ariaLabel:"Canonical MissionMed timeline"}}
    };
  };

  const elements=(surface=null)=>typeof document==="undefined"?[]:[...document.querySelectorAll("d1-timeline-kernel")]
    .filter((element)=>surface==null||element.dataset.surface===surface);

  return{
    id:"D1-411A-PRESENTATION-KERNEL-HOST",
    render,
    elements,
    projection:()=>current,
    async whenStable(surface){
      const targets=elements(surface);
      await Promise.all(targets.map((element)=>new Promise((resolve,reject)=>{
        if(element.dataset.ready==="true")return resolve(element.diagnostics());
        if(element.dataset.error)return reject(new Error(element.dataset.error));
        const ready=()=>{cleanup();resolve(element.diagnostics());};
        const failed=(event)=>{cleanup();reject(event.detail?.error||new Error("Kernel render failed."));};
        const timeout=setTimeout(()=>{
          cleanup();
          reject(new Error(`Kernel ${surface||"surface"} did not become stable within 10 seconds.`));
        },10000);
        const cleanup=()=>{
          clearTimeout(timeout);
          element.removeEventListener("d1-411a:ready",ready);
          element.removeEventListener("d1-411a:error",failed);
        };
        element.addEventListener("d1-411a:ready",ready,{once:true});
        element.addEventListener("d1-411a:error",failed,{once:true});
      })));
      return targets.map((element)=>element.diagnostics());
    }
  };
}

export function createD1411AKernelExportAdapter({kernelManager}={}){
  if(!kernelManager)throw new TypeError("A D1-411A kernel manager is required.");
  const download=(blob,filename)=>{
    const url=URL.createObjectURL(blob);
    const anchor=document.createElement("a");
    anchor.href=url;anchor.download=filename;anchor.hidden=true;
    document.body.append(anchor);anchor.click();anchor.remove();
    setTimeout(()=>URL.revokeObjectURL(url),5000);
    return{downloaded:true,verification:"browser-download-dispatched"};
  };
  return{
    id:"d1-411a-same-kernel-export",
    executionMode:"local",
    metadata:{
      executionMode:"local",
      externalApiCalls:false,
      productionWrites:false,
      renderer:"D1-409H-A1",
      contract:"D1-411A"
    },
    async generate(request){
      await kernelManager.whenStable("export");
      const element=kernelManager.elements("export")[0];
      if(!element)throw new Error("The export preview kernel is not mounted.");
      const expectedFingerprint=element.dataset.fingerprint;
      const expectedRenderId=element.dataset.renderId;
      const output=request?.renderInput?.output||{};
      const format=output.kind==="PDF"?"pdf":"png";
      const pixelRatio=format==="pdf"
        ?2
        :Number(output.width||1920)>1920?2:1;
      let result=await element.exportBoard({
        format,
        pixelRatio,
        pageWidth:792,
        pageHeight:445.5
      });
      if(
        result.fingerprint!==expectedFingerprint||
        result.renderId!==expectedRenderId
      ){
        throw new Error("The exported artifact does not match the mounted Export preview.");
      }
      if(
        format==="png"&&
        Number(output.width)>0&&
        Number(output.height)>0&&
        (result.width!==Number(output.width)||result.height!==Number(output.height))
      ){
        const bitmap=await createImageBitmap(result.blob);
        const canvas=document.createElement("canvas");
        canvas.width=Number(output.width);canvas.height=Number(output.height);
        canvas.getContext("2d").drawImage(bitmap,0,0,canvas.width,canvas.height);
        bitmap.close?.();
        const blob=await new Promise((resolve)=>canvas.toBlob(resolve,"image/png"));
        if(!blob)throw new Error("The same-DOM PNG could not be resized.");
        result={...result,blob,width:canvas.width,height:canvas.height};
      }
      return{
        ...result,
        executionMode:"local",
        simulated:false,
        mimeType:result.blob.type,
        byteSize:result.blob.size,
        renderer:"D1-409H-A1",
        pdfTagged:false
      };
    },
    async download(artifact,{filename}={}){
      let blob=artifact?.blob;
      if(!(blob instanceof Blob)&&typeof blob?.arrayBuffer==="function"){
        blob=new Blob([await blob.arrayBuffer()],{type:String(blob.type||artifact?.mimeType||"")});
      }
      if(!(blob instanceof Blob))throw new TypeError("A generated Blob is required.");
      return{...download(blob,filename),filename,byteSize:blob.size};
    }
  };
}
