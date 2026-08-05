import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import test from "node:test";

import {productionPrivacyControlMarkup} from "../web/js/407f-engineering-adapter.js";

test("first-use consent is contextual, premium, private, and does not expose its internal version",()=>{
  const markup=productionPrivacyControlMarkup({
    role:"STUDENT",remoteSyncConsent:false,
    consentAction:"https://missionmed.example/timeline/",consentNonce:"nonce-value",
    matrixUrl:"https://missionmed.example/member-dashboard/",
  });
  assert.match(markup,/Keep your Timeline with you\./);
  assert.match(markup,/Your work is already safe on this device\./);
  assert.match(markup,/timeline_remote_sync_action" value="grant/);
  assert.match(markup,/required type="checkbox"/);
  assert.match(markup,/TURN ON SECURE SAVING/);
  assert.match(markup,/Not now — return to Matrix/);
  assert.doesNotMatch(markup,/d1-500-v1|Consent version|Agree and open Timeline Builder/);
});

test("existing consent is recognized and exposes a bounded withdrawal control",()=>{
  const markup=productionPrivacyControlMarkup({
    role:"STUDENT",remoteSyncConsent:true,
    consentAction:"https://missionmed.example/timeline/",consentNonce:"nonce-value",
  });
  assert.match(markup,/Secure saving is on/);
  assert.match(markup,/timeline_remote_sync_action" value="withdraw/);
  assert.match(markup,/Turn off secure saving/);
  assert.equal(productionPrivacyControlMarkup({role:"PROGRAM_ADMIN"}),"");
});

test("boot failures preserve local-work truth and offer Retry plus Return to Matrix",async()=>{
  const adapter=await readFile(new URL("../web/js/407f-engineering-adapter.js",import.meta.url),"utf8");
  const index=await readFile(new URL("../web/index.html",import.meta.url),"utf8");
  assert.match(adapter,/Your Timeline needs a fresh connection\./);
  assert.match(adapter,/Your work on this device is still safe\./);
  assert.match(adapter,/retry\.textContent="Retry"/);
  assert.match(adapter,/back\.textContent="Return to Matrix"/);
  assert.match(adapter,/gate\.dataset\.errorCode/);
  assert.match(index,/#d1HydrationGate\.d1Recovery/);
});
