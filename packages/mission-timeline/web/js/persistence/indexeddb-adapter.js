const STORE_NAMES=["documents","versions","checkpoints","blobs","artifacts","exports","syncRecords","migrations","settings"];

function requestResult(request){
  return new Promise((resolve,reject)=>{request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error||new Error("IndexedDB request failed."));});
}

function transactionDone(tx){
  return new Promise((resolve,reject)=>{tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error||new Error("IndexedDB transaction failed."));tx.onabort=()=>reject(tx.error||new Error("IndexedDB transaction aborted."));});
}

export class IndexedDbAdapter{
  constructor({name="missionmed-timeline-local-v1",version=1}={}){this.kind="INDEXED_DB";this.name=name;this.version=version;this.db=null;}
  async open(){
    if(this.db)return this;
    if(!globalThis.indexedDB)throw new Error("INDEXED_DB_UNAVAILABLE");
    const request=indexedDB.open(this.name,this.version);
    request.onupgradeneeded=()=>STORE_NAMES.forEach((name)=>{if(!request.result.objectStoreNames.contains(name))request.result.createObjectStore(name,{keyPath:"id"});});
    this.db=await requestResult(request);
    return this;
  }
  tx(store,mode="readonly"){if(!this.db)throw new Error("IndexedDB adapter is not open.");return this.db.transaction(store,mode);}
  async get(store,key){const tx=this.tx(store);const value=await requestResult(tx.objectStore(store).get(key));await transactionDone(tx);return value;}
  async put(store,value,key=value?.id){
    if(key==null)throw new Error("Persistence key is required.");
    const tx=this.tx(store,"readwrite");
    const record=value?.id===key?value:{...value,id:key};
    await requestResult(tx.objectStore(store).put(record));await transactionDone(tx);return record;
  }
  async delete(store,key){const tx=this.tx(store,"readwrite");await requestResult(tx.objectStore(store).delete(key));await transactionDone(tx);}
  async list(store,predicate=()=>true){const tx=this.tx(store);const values=await requestResult(tx.objectStore(store).getAll());await transactionDone(tx);return values.filter(predicate);}
  async clear(store){const tx=this.tx(store,"readwrite");await requestResult(tx.objectStore(store).clear());await transactionDone(tx);}
  async atomicPut(entries){
    const stores=[...new Set(entries.map((entry)=>entry.store))];
    const tx=this.db.transaction(stores,"readwrite");
    entries.forEach(({store,key,value})=>tx.objectStore(store).put(value?.id===key?value:{...value,id:key}));
    await transactionDone(tx);
  }
  async putBlob(key,blob,metadata={}){return this.put("blobs",{id:key,blob,metadata});}
  async getBlob(key){return (await this.get("blobs",key))?.blob||null;}
  async deleteBlob(key){return this.delete("blobs",key);}
  close(){if(this.db)this.db.close();this.db=null;}
}

export {STORE_NAMES};
