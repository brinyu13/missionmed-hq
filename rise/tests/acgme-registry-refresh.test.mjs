import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

const tool = path.resolve(import.meta.dirname, "../tools/refresh-acgme-registry.py");

test("ACGME reconciliation preserves identity and research and is idempotent", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "rise-acgme-"));
  const current = path.join(root, "current"), newly = path.join(root, "newly");
  fs.mkdirSync(current); fs.mkdirSync(newly);
  const old = {
    id:"rise_prg_existing",programSpecialtyId:"rise_ps_existing",lifecycle:"active",
    display:{programName:"Existing Program",institution:"Existing",hospital:null,city:"Austin",state:"TX",zip:"78701"},
    designation:"Neurology",kind:"single",entryFormat:"unknown",
    components:[{specialtyId:"rise_sp_neuro",label:"Neurology",ordinal:0}],
    browseMemberships:[{id:"rise_bm_existing",programSpecialtyId:"rise_ps_existing",browseSpecialtyId:"rise_sp_neuro",browseSpecialty:"Neurology",relationship:"EXACT_DESIGNATION"}],
    identifiers:[{namespace:"ACGME_PROGRAM",value:"1804800001"},{namespace:"FREIDA_PROGRAM",value:"1804800001"}],
    fields:{"Program Director":{knowledge:{state:"known",value:"Preserved PD"}}},evidence:{knownClaims:1},source:{authority:"FREIDA"}
  };
  const base={schemaVersion:1,indexId:"old",registryReleaseId:"old",registryReleaseManifestSha256:"a".repeat(64),
    activationStatus:"offline_shadow_only",dataClassification:"source_controlled_registry",
    releaseGate:{registryCountsReconciled:true,sourceRightsApproved:true,sourceRights:[]},
    source:{canonicalContentSha256:"b".repeat(64),datasetVersion:"fixture",retrievalDate:"2026-01-01"},
    counts:{uniquePrograms:1,programSpecialties:1,browseMemberships:1,additionalBrowseMemberships:0,externalIdentifiers:2},
    filters:{states:["TX"],specialties:["Neurology"],designations:["Neurology"]},selectedFields:["Program Director"],programs:[old]};
  fs.writeFileSync(path.join(current,"180.txt"),[
    "[1804800001] Existing Program           1 Main St                               Jane Doe, MD     Continued        01/01/2026",
    "                                 Austin, TX 78701",
    "[1804800002] New Neurology Program     2 Main St                               John Doe, MD     Initial          07/01/2026",
    "                                 Dallas, TX 75201",""].join("\n"));
  fs.writeFileSync(path.join(newly,"180-2026.txt"),
    "[1804800002] New Neurology Program                       John Doe, MD       Initial Accreditation       07/01/2026 Neurology Texas\n");
  const basePath=path.join(root,"base.json"); fs.writeFileSync(basePath,JSON.stringify(base));
  for (const name of ["one","two"]) execFileSync("python3",[tool,"--current-dir",current,"--newly-dir",newly,"--base-index",basePath,"--output-dir",path.join(root,name),"--checked-at","2026-09-20"]);
  const result=JSON.parse(fs.readFileSync(path.join(root,"one","api-index.json")));
  assert.equal(result.programs.length,2);
  assert.equal(result.programs[0].id,old.id);
  assert.equal(result.programs[0].fields["Program Director"].knowledge.value,"Preserved PD");
  assert.equal(result.programs[1].accreditation.newlyAccredited,true);
  assert.equal(result.programs[1].researchStatus,"RESEARCH_PENDING");
  assert.deepEqual(fs.readFileSync(path.join(root,"one","api-index.json")),fs.readFileSync(path.join(root,"two","api-index.json")));
});

test("ACGME reconciliation fails closed when the current report set is incomplete", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "rise-acgme-empty-"));
  const current = path.join(root, "current"), newly = path.join(root, "newly");
  fs.mkdirSync(current); fs.mkdirSync(newly);
  const base = {
    schemaVersion:1, indexId:"old", registryReleaseId:"old", registryReleaseManifestSha256:"a".repeat(64),
    activationStatus:"offline_shadow_only", dataClassification:"source_controlled_registry",
    releaseGate:{registryCountsReconciled:true,sourceRightsApproved:true,sourceRights:[]}, source:{},
    counts:{uniquePrograms:1,programSpecialties:1,browseMemberships:1,additionalBrowseMemberships:0,externalIdentifiers:2},
    filters:{states:["TX"],specialties:["Neurology"],designations:["Neurology"]}, selectedFields:[],
    programs:[{id:"rise_prg_existing",programSpecialtyId:"rise_ps_existing",designation:"Neurology",kind:"single",entryFormat:"unknown",components:[],browseMemberships:[],display:{programName:"Existing",institution:"Existing",city:"Austin",state:"TX",zip:"78701"},identifiers:[{namespace:"ACGME_PROGRAM",value:"1804800001"},{namespace:"FREIDA_PROGRAM",value:"1804800001"}],fields:{},evidence:{},source:{}}]
  };
  const basePath=path.join(root,"base.json"); fs.writeFileSync(basePath,JSON.stringify(base));
  assert.throws(() => execFileSync("python3",[tool,"--current-dir",current,"--newly-dir",newly,"--base-index",basePath,"--output-dir",path.join(root,"out"),"--checked-at","2026-09-20"],{stdio:"pipe"}), /Command failed/);
  assert.equal(fs.existsSync(path.join(root,"out","api-index.json")),false);
});
