#!/usr/bin/env python3
"""Build an additive RISE release from dated ACGME ADS Public report exports."""
from __future__ import annotations
import argparse, csv, hashlib, json, re
from pathlib import Path

CURRENT_URL = "https://apps.acgme.org/ads/Public/Reports/Report/1"
NEW_URL = "https://apps.acgme.org/ads/Public/Reports/Report/8"
ID = re.compile(r"^\[([0-9]{10})\]")
DATE = re.compile(r"\b([0-9]{2}/[0-9]{2}/[0-9]{4})\b")
LOCATION = re.compile(r"^\s*([A-Za-z][A-Za-z .'’&/-]+), ([A-Z]{2}) ([0-9]{5})(?:-[0-9]{4})?\b")

def sha(value): return hashlib.sha256(value).hexdigest()
def json_bytes(value): return (json.dumps(value, indent=2, ensure_ascii=False) + "\n").encode()
def stable_id(prefix, key):
    raw = bytearray(hashlib.sha256(b"missionmed-rise-identity-v1\0"+prefix.encode()+b"\0"+key.encode()).digest()[:16])
    raw[6]=(raw[6]&15)|80; raw[8]=(raw[8]&63)|128; x=raw.hex()
    return f"{prefix}_{x[:8]}-{x[8:12]}-{x[12:16]}-{x[16:20]}-{x[20:]}"
def blocks(text):
    current=None
    for line in text.splitlines():
        if ID.match(line):
            if current: yield current
            current=[line]
        elif current is not None: current.append(line)
    if current: yield current
def name_from(lines, width):
    values=[]
    for index,line in enumerate(lines):
        value=line[:width].strip()
        if index==0: value=ID.sub("",value).strip()
        if (value and not value.startswith("©") and "programs found" not in value
            and "Program Number / Name" not in value and "Program Code / Name" not in value):
            values.append(value)
    return re.sub(r"\s+"," "," ".join(values)).strip()
def reports(directory, newly=False):
    rows,sums={},{}
    pattern="[0-9][0-9][0-9]-20[0-9][0-9].txt" if newly else "[0-9][0-9][0-9].txt"
    for source in sorted(Path(directory).glob(pattern)):
        code=source.stem.split("-")[0]; year=source.stem.split("-")[-1] if newly else None
        if newly and f"{year}-{int(year)+1}" not in ("2025-2026","2026-2027"): continue
        pdf=source.with_suffix(".pdf"); sums[source.stem]=sha((pdf if pdf.exists() else source).read_bytes())
        for group in blocks(source.read_text(errors="replace")):
            pid=ID.match(group[0]).group(1)
            if not pid.startswith(code): continue
            location=next((match for line in group if (match:=LOCATION.search(line[33:76]))),None)
            date=DATE.search(group[0])
            rows[pid]={"acgmeProgramId":pid,"programName":name_from(group,50 if newly else 33),"reportCode":code,
              "sourceUrl":NEW_URL if newly else CURRENT_URL,"sourceSha256":sums[source.stem]}
            if newly: rows[pid].update({"academicYear":f"{year}-{int(year)+1}","accreditationStatus":"Initial Accreditation" if "Initial Accreditation" in group[0] else "Accredited","effectiveDate":date.group(1) if date else None})
            else: rows[pid].update({"city":location.group(1).strip() if location else None,"state":location.group(2) if location else None,"zip":location.group(3) if location else None})
    return rows,sums
def ident(row,namespace):
    return next((x.get("value") for x in row.get("identifiers",[]) if x.get("namespace")==namespace),None)
def build_new(pid,designation,current,new,template,checked):
    rid=stable_id("rise_prg",f"FREIDA_PROGRAM:{pid}"); psid=stable_id("rise_ps",f"{rid}:{designation}")
    memberships=[{"id":stable_id("rise_bm",f'{psid}:{x["browseSpecialty"]}'),"programSpecialtyId":psid,
      "browseSpecialtyId":stable_id("rise_sp",x["browseSpecialty"]),"browseSpecialty":x["browseSpecialty"],"relationship":x["relationship"]} for x in template.get("browseMemberships",[])]
    acc={"currentUniverseState":"CURRENT_ACGME_PUBLIC","status":new.get("accreditationStatus") if new else "Accredited",
      "effectiveDate":new.get("effectiveDate") if new else None,"academicYear":new.get("academicYear") if new else None,
      "newlyAccredited":bool(new),"sourceCheckedAt":checked,"sourceUrl":CURRENT_URL}
    fields={}
    for label,value in (("Accreditation Status",acc["status"]),("Accreditation Effective Date",acc["effectiveDate"])):
        if value: fields[label]={"knowledge":{"state":"known","value":value},"authority":"ACGME_ADS_PUBLIC",
          "assertionClass":"authoritative_public_accreditation_registry","period":{"kind":"source_check","label":checked},
          "retrievedAt":checked,"wording":f"{label}: {value}","context":"Current ACGME ADS Public accreditation registry."}
    return {"id":rid,"programSpecialtyId":psid,"lifecycle":"active","researchStatus":"RESEARCH_PENDING",
      "display":{"programName":(new or current)["programName"],"institution":(new or current)["programName"].removesuffix(" Program"),"hospital":None,
        "city":current.get("city") or "Location not published","state":current.get("state") or "","zip":current.get("zip")},
      "designation":designation,"kind":template.get("kind","single"),"entryFormat":template.get("entryFormat","unknown"),
      "components":template.get("components",[]),"browseMemberships":memberships,
      "identifiers":[{"namespace":"ACGME_PROGRAM","value":pid},{"namespace":"FREIDA_PROGRAM","value":pid}],"fields":fields,
      "evidence":{"knownClaims":len(fields),"knownEvidenceLabeledClaims":len(fields),"knownSelectedClaims":0,
        "evidenceLabeledClaims":len(fields),"quarantinedClaims":0,"coveragePercent":0,"selectedFieldCount":0,
        "absentSelectedClaims":0,"unknownSelectedClaims":0,"matchableClaims":0},
      "intelligence":{"knownRegistryFieldCount":len(fields)},"accreditation":acc,
      "source":{"sourceDocumentId":f"acgme_ads_public_{checked}","authority":"ACGME_ADS_PUBLIC",
        "assertionClass":"authoritative_public_accreditation_registry","urls":[CURRENT_URL]+([NEW_URL] if new else []),
        "retrievedAt":checked,"sourceUpdatedAt":acc["effectiveDate"],"surveyReceivedAt":None,"missionMedVerifiedAt":checked,
        "missionMedVerifiedBy":"P1-RISE-5015 deterministic ACGME public registry reconciliation"}}
def write_csv(path,headers,rows):
    with path.open("w",newline="",encoding="utf-8") as handle:
        writer=csv.DictWriter(handle,fieldnames=headers); writer.writeheader(); writer.writerows(rows)
def reconcile(a):
    base_path=Path(a.base_index); base=json.loads(base_path.read_text())
    current,current_sums=reports(a.current_dir); newly,new_sums=reports(a.newly_dir,True)
    existing={(ident(r,"ACGME_PROGRAM") or ident(r,"FREIDA_PROGRAM")):r for r in base["programs"]}; existing.pop(None,None)
    by_code,templates={},{}
    for pid,row in existing.items():
        code,designation=pid[:3],row["designation"]
        if code in by_code and by_code[code]!=designation: raise SystemExit(f"designation collision for prefix {code}")
        by_code[code]=designation; templates.setdefault(designation,row)
    missing_report_codes=sorted(set(by_code)-set(current_sums))
    if missing_report_codes:
        raise SystemExit(f"current ACGME source set is incomplete; missing report codes: {','.join(missing_report_codes)}")
    current_ids,rise_ids=set(current),set(existing); missing=sorted(current_ids-rise_ids); absent=sorted(rise_ids-current_ids)
    if not current_ids or len(current_ids) < max(1, int(len(rise_ids) * 0.9)):
        raise SystemExit(f"current ACGME source count is implausibly low: {len(current_ids)}/{len(rise_ids)}")
    additions=[]
    for pid in missing:
        designation=by_code.get(pid[:3])
        if not designation: raise SystemExit(f"unsupported ACGME prefix {pid[:3]}")
        additions.append(build_new(pid,designation,current[pid],newly.get(pid),templates[designation],a.checked_at))
    programs=base["programs"]+additions
    for row in programs:
        pid=ident(row,"ACGME_PROGRAM") or ident(row,"FREIDA_PROGRAM")
        if pid in current:
            new=newly.get(pid); prior=row.get("accreditation",{})
            row["accreditation"]={**prior,"currentUniverseState":"CURRENT_ACGME_PUBLIC","status":new.get("accreditationStatus") if new else prior.get("status"),
              "effectiveDate":new.get("effectiveDate") if new else prior.get("effectiveDate"),"academicYear":new.get("academicYear") if new else None,
              "newlyAccredited":bool(new),"sourceCheckedAt":a.checked_at,"sourceUrl":CURRENT_URL}
        elif pid in absent: row["accreditation"]={**row.get("accreditation",{}),"currentUniverseState":"REVIEW_REQUIRED_NOT_IN_CURRENT_ACGME_PUBLIC_REPORT","newlyAccredited":False,"sourceCheckedAt":a.checked_at,"sourceUrl":CURRENT_URL}
    digest=sha(json.dumps({"base":sha(base_path.read_bytes()),"current":current_sums,"new":new_sums,"checked":a.checked_at},sort_keys=True,separators=(",",":")).encode())
    release=f"rise_registry_acgme_{a.checked_at}_{digest[:12]}"
    base.update({"indexId":f"rise_index_{release}_{digest[12:24]}","registryReleaseId":release,"registryReleaseManifestSha256":digest,"activationStatus":"offline_shadow_only","programs":programs})
    base["source"]["acgmeCurrentUniverse"]={"source":"ACGME ADS Public","sourceUrl":CURRENT_URL,"newlyAccreditedSourceUrl":NEW_URL,
      "checkedAt":a.checked_at,"academicYear":"2026-2027","scopedCurrentProgramCount":len(current_ids),
      "currentReportChecksumsSha256":sha(json.dumps(current_sums,sort_keys=True).encode()),
      "newReportChecksumsSha256":sha(json.dumps(new_sums,sort_keys=True).encode()),"status":"PASS"}
    base["counts"].update({"uniquePrograms":len(programs),"programSpecialties":len(programs),
      "browseMemberships":sum(len(r.get("browseMemberships",[])) for r in programs),
      "additionalBrowseMemberships":sum(max(0,len(r.get("browseMemberships",[]))-1) for r in programs),
      "externalIdentifiers":sum(len(r.get("identifiers",[])) for r in programs),"acgmeCurrentScopedPrograms":len(current_ids),
      "newlyAccreditedPrograms":sum(bool(r.get("accreditation",{}).get("newlyAccredited")) for r in programs),
      "addedByAcgmeRefresh":len(additions),"notInCurrentAcgmeReviewRequired":len(absent)})
    base["filters"]["states"]=sorted(set(base["filters"]["states"])|{r["display"]["state"] for r in additions if r["display"]["state"]})
    base["releaseGate"].update({"registryCountsReconciled":True,"acgmeCurrentUniverseReconciled":True,"destructiveChangesApplied":False})
    out=Path(a.output_dir); out.mkdir(parents=True,exist_ok=True); index=json_bytes(base); index_sha=sha(index)
    manifest={"schemaVersion":1,"indexId":base["indexId"],"immutable":True,"builderVersion":"rise-acgme-current-overlay/1.0.0",
      "registryReleaseId":release,"registryContentSha256":digest,"dataClassification":base["dataClassification"],
      "sourceRightsApproved":base["releaseGate"]["sourceRightsApproved"],"sourceRights":base["releaseGate"]["sourceRights"],
      "programCount":len(programs),"activeAcgmeScopedProgramCount":len(current_ids),"selectedFieldCount":len(base["selectedFields"]),"apiIndexSha256":index_sha}
    manifest_bytes=json_bytes(manifest)
    receipt={"schemaVersion":1,"immutable":True,"action":"activate","revoked":False,"registryReleaseId":release,
      "apiIndexSha256":index_sha,"indexManifestSha256":sha(manifest_bytes),"decisionRecordId":"DR-305",
      "approvedBySubject":"founder-directive:P1-RISE-5015","approvedAt":f"{a.checked_at}T00:00:00.000Z"}
    snapshot={"schemaVersion":1,"source":"ACGME ADS Public","checkedAt":a.checked_at,"academicYear":"2026-2027",
      "supportedReportCodes":sorted(by_code),"currentPrograms":[current[k] for k in sorted(current)],
      "newlyAccredited":[newly[k] for k in sorted(newly)],"checksums":{"current":current_sums,"newlyAccredited":new_sums}}
    (out/"api-index.json").write_bytes(index); (out/"index-manifest.json").write_bytes(manifest_bytes)
    (out/"activation-receipt.json").write_bytes(json_bytes(receipt)); (out/"acgme-current-registry-snapshot.json").write_bytes(json_bytes(snapshot))
    diffs=[]
    for pid in sorted(current_ids&rise_ids):
        old,new,changed=existing[pid],current[pid],[]
        if old["display"].get("programName")!=new["programName"]: changed.append("program_name")
        if new.get("state") and old["display"].get("state")!=new["state"]: changed.append("state")
        if new.get("city") and old["display"].get("city")!=new["city"]: changed.append("city")
        if changed: diffs.append({"acgme_program_id":pid,"classification":"STALE_IDENTITY_REVIEW_REQUIRED","fields":"|".join(changed),"rise_program_name":old["display"].get("programName",""),"acgme_program_name":new["programName"],"rise_location":f'{old["display"].get("city","")}, {old["display"].get("state","")}',"acgme_location":f'{new.get("city") or ""}, {new.get("state") or ""}'})
    for pid in missing: diffs.append({"acgme_program_id":pid,"classification":"MISSING_ADDED","fields":"all","rise_program_name":"","acgme_program_name":current[pid]["programName"],"rise_location":"","acgme_location":f'{current[pid].get("city") or ""}, {current[pid].get("state") or ""}'})
    for pid in absent: diffs.append({"acgme_program_id":pid,"classification":"NOT_IN_CURRENT_REPORT_REVIEW_REQUIRED","fields":"current_status","rise_program_name":existing[pid]["display"].get("programName",""),"acgme_program_name":"","rise_location":f'{existing[pid]["display"].get("city","")}, {existing[pid]["display"].get("state","")}',"acgme_location":""})
    diff_headers=["acgme_program_id","classification","fields","rise_program_name","acgme_program_name","rise_location","acgme_location"]
    write_csv(out/"acgme-current-universe-diff.csv",diff_headers,diffs)
    added=[{"acgme_program_id":ident(r,"ACGME_PROGRAM"),"canonical_rise_program_id":r["id"],"program_specialty_id":r["programSpecialtyId"],"program_name":r["display"]["programName"],"specialty":r["designation"],"city":r["display"]["city"],"state":r["display"]["state"],"accreditation_status":r["accreditation"]["status"],"effective_date":r["accreditation"]["effectiveDate"] or "","academic_year":r["accreditation"]["academicYear"] or "","newly_accredited":str(r["accreditation"]["newlyAccredited"]).lower()} for r in additions]
    write_csv(out/"missing-programs-added.csv",list(added[0]) if added else ["acgme_program_id"],added)
    qh=["acgme_program_id","program_specialty_id","program_name","specialty","state","research_state","priority_domains","paid_research_launched"]
    write_csv(out/"new-program-research-queue.csv",qh,[{"acgme_program_id":r["acgme_program_id"],"program_specialty_id":r["program_specialty_id"],"program_name":r["program_name"],"specialty":r["specialty"],"state":r["state"],"research_state":"ELIGIBLE","priority_domains":"eligibility|exams|visa|YOG|USCE|deadline|leadership|positions|curriculum|start_year|official_url","paid_research_launched":"false"} for r in added])
    (out/"CHECKSUMS.txt").write_text("\n".join(f"{sha(p.read_bytes())}  {p.name}" for p in sorted(out.iterdir()) if p.is_file() and p.name!="CHECKSUMS.txt")+"\n")
    return {"sourceCurrentCount":len(current_ids),"preFixRiseCount":len(rise_ids),"missingAddedCount":len(additions),"mergedProgramCount":len(programs),
      "newlyAccreditedCount":base["counts"]["newlyAccreditedPrograms"],"notInCurrentReportReviewRequired":len(absent),
      "staleIdentityReviewRequired":sum(d["classification"]=="STALE_IDENTITY_REVIEW_REQUIRED" for d in diffs),
      "releaseId":release,"apiIndexSha256":index_sha,"indexManifestSha256":sha(manifest_bytes),"activationReceiptSha256":sha(json_bytes(receipt))}
if __name__=="__main__":
    parser=argparse.ArgumentParser()
    for key in ("current-dir","newly-dir","base-index","output-dir","checked-at"): parser.add_argument("--"+key,required=True)
    print(json.dumps(reconcile(parser.parse_args()),indent=2))
