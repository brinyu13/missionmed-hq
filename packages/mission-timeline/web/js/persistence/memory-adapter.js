import {clone} from "../core/canonical.js";

export class MemoryPersistenceAdapter{
  constructor(){this.kind="MEMORY_TEST_ADAPTER";this.stores=new Map();this.failNextWrite=false;}
  async open(){return this;}
  store(name){if(!this.stores.has(name))this.stores.set(name,new Map());return this.stores.get(name);}
  async get(store,key){return clone(this.store(store).get(key));}
  async put(store,value,key=value?.id){
    if(this.failNextWrite){this.failNextWrite=false;throw new Error("SIMULATED_PERSISTENCE_FAILURE");}
    if(key==null)throw new Error("Persistence key is required.");
    this.store(store).set(key,clone(value));return clone(value);
  }
  async delete(store,key){this.store(store).delete(key);}
  async list(store,predicate=()=>true){return [...this.store(store).values()].map(clone).filter(predicate);}
  async clear(store){this.store(store).clear();}
  async atomicPut(entries){
    if(this.failNextWrite){this.failNextWrite=false;throw new Error("SIMULATED_PERSISTENCE_FAILURE");}
    const backups=entries.map(({store})=>[store,new Map(this.store(store))]);
    try{entries.forEach(({store,key,value})=>this.store(store).set(key,clone(value)));}
    catch(error){backups.forEach(([store,map])=>this.stores.set(store,map));throw error;}
  }
  async putBlob(key,blob,metadata={}){this.store("blobs").set(key,{id:key,blob,metadata:clone(metadata)});return key;}
  async getBlob(key){return this.store("blobs").get(key)?.blob||null;}
  async deleteBlob(key){this.store("blobs").delete(key);}
  simulateWriteFailure(){this.failNextWrite=true;}
}
