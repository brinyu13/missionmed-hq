/*
 * Small in-memory cache for presentation surfaces. A recalculation may fail,
 * but it must never replace a valid Timeline with a blank/loading board.
 */

const DEFAULT_LIMIT=24;

export class LastGoodRenderCache{
  constructor({limit=DEFAULT_LIMIT}={}){
    this.limit=Math.max(1,Number(limit)||DEFAULT_LIMIT);
    this.entries=new Map();
  }

  get(key){
    const normalized=String(key||"default");
    const value=this.entries.get(normalized)||null;
    if(value){
      this.entries.delete(normalized);
      this.entries.set(normalized,value);
    }
    return value;
  }

  commit(key,value){
    const normalized=String(key||"default");
    const record=Object.freeze({...value,committedAt:Date.now()});
    this.entries.delete(normalized);
    this.entries.set(normalized,record);
    while(this.entries.size>this.limit){
      this.entries.delete(this.entries.keys().next().value);
    }
    return record;
  }

  clear(key){
    if(key==null)this.entries.clear();
    else this.entries.delete(String(key));
  }
}

export const timelineLastGoodRenderCache=new LastGoodRenderCache();
