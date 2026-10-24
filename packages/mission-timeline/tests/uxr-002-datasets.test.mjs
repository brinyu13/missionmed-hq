import assert from "node:assert/strict";
import test from "node:test";

import {
  browserCountryRows,
  createCountryProvider,
  createRuntimeDatasets
} from "../web/js/uxr-002/datasets.js";

test("runtime countries are local browser region names with stable code identities",async()=>{
  const rows=browserCountryRows();
  const unitedStates=rows.find(({code})=>code==="US");
  assert.equal(unitedStates?.value,"United States");
  assert.equal(rows.some(({code})=>code==="ZZ"),false);

  const provider=createCountryProvider();
  assert.equal(provider.localOnly,true);
  assert.equal(provider.networkRequests,false);
  assert.deepEqual(
    (await provider.search("United States")).map(({code})=>code),
    ["US"]
  );
  assert.equal((await provider.search("u")).length,0);
});

test("runtime datasets expose only rights-compatible local providers",()=>{
  const datasets=createRuntimeDatasets();
  assert.deepEqual(Object.keys(datasets),["countries","schools"]);
  assert.equal(typeof datasets.countries.search,"function");
  assert.equal(typeof datasets.schools.search,"function");
  assert.equal(datasets.schools.localOnly,true);
  assert.equal(datasets.schools.networkRequests,false);
  assert.equal(datasets.specialties,undefined);
  assert.equal(datasets.institutions,undefined);
});
