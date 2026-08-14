import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import ExcelJS from "exceljs";

import { exportWorkbookInspection, SPECIALTY_TABS } from "../tools/export-workbook-inspection.mjs";

async function authorizationFixture(filePath) {
  const grantPath = `${filePath}.grant`;
  const grant = "Synthetic AMA FREIDA source-owner grant fixture.\n";
  await fs.writeFile(grantPath, grant);
  const sourceOwnerGrantSha256 = createHash("sha256").update(grant).digest("hex");
  const source = `${JSON.stringify({
    schemaVersion: 1,
    status: "approved",
    provider: "AMA",
    product: "FREIDA",
    authorizationId: "fixture-authorization",
    writtenAuthorizationReference: "fixture-reference",
    sourceOwnerGrantSha256,
    allowedUses: ["create_or_supplement_missionmed_rise_database"],
    effectiveFrom: "2026-01-01",
    validThrough: "2099-12-31",
    missionMedReview: {
      decision: "approved",
      decisionRecordId: "fixture-decision",
      reviewerSubject: "fixture-reviewer",
      reviewedAt: "2026-01-02",
    },
  })}\n`;
  await fs.writeFile(filePath, source);
  return { authorizationSha256: createHash("sha256").update(source).digest("hex"), grantPath };
}

test("workbook inspection export is dependency-complete and preserves sparse column alignment", async () => {
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), "rise-export-test-"));
  const workbookPath = path.join(temp, "fixture.xlsx");
  const inspectionPath = path.join(temp, "fixture.inspect.ndjson");
  const authorizationPath = path.join(temp, "freida-authorization.json");
  const { authorizationSha256, grantPath } = await authorizationFixture(authorizationPath);
  const workbook = new ExcelJS.Workbook();
  for (const sheetName of SPECIALTY_TABS) {
    const sheet = workbook.addWorksheet(sheetName);
    sheet.getCell(1, 1).value = "GROUP";
    for (let column = 1; column <= 196; column += 1) sheet.getCell(2, column).value = `Header ${column}`;
    sheet.getCell(3, 1).value = sheetName;
    sheet.getCell(3, 196).value = `Tail ${sheetName}`;
  }
  await workbook.xlsx.writeFile(workbookPath);
  const workbookSha256 = createHash("sha256").update(await fs.readFile(workbookPath)).digest("hex");
  const canonicalContent = createHash("sha256");
  for (const sheetName of SPECIALTY_TABS) {
    const group = ["GROUP", ...Array.from({ length: 195 }, () => "")];
    const headers = Array.from({ length: 196 }, (_, index) => `Header ${index + 1}`);
    const row = [sheetName, ...Array.from({ length: 194 }, () => ""), `Tail ${sheetName}`];
    canonicalContent.update(JSON.stringify({ sheet: sheetName, values: [group, headers, row] }));
  }
  const canonicalContentSha256 = canonicalContent.digest("hex");
  const result = await exportWorkbookInspection(workbookPath, inspectionPath, {
    datasetConfig: {
      canonicalWorkbook: "fixture.xlsx",
      referenceLocalWorkbookSha256: workbookSha256,
      canonicalContentSha256,
      canonicalSpecialtyTabs: [...SPECIALTY_TABS],
      requiredSourceAuthorizations: [{
        source: "FREIDA",
        required: true,
        approvedRecordSha256: authorizationSha256,
      }],
    },
    freidaAuthorizationPath: authorizationPath,
    freidaGrantPath: grantPath,
  });
  assert.equal(result.specialtyTabs, 31);
  const records = (await fs.readFile(inspectionPath, "utf8")).trim().split("\n").map(JSON.parse);
  const tables = records.filter((record) => record.kind === "table");
  const metadata = records.find((record) => record.kind === "workbook");
  assert.equal(tables.length, 31);
  assert.equal(tables[0].values[2].length, 196);
  assert.equal(tables[0].values[2][1], "");
  assert.equal(tables[0].values[2][195], `Tail ${SPECIALTY_TABS[0]}`);
  const digest = createHash("sha256");
  for (const table of tables) digest.update(JSON.stringify({ sheet: table.sheet, values: table.values }));
  assert.equal(metadata.schemaVersion, 2);
  assert.deepEqual(metadata.sourceAuthorizationSha256s, [authorizationSha256]);
  assert.equal(metadata.sourceSha256, workbookSha256);
  assert.equal(metadata.contentSha256, canonicalContentSha256);
  assert.equal(metadata.contentSha256, digest.digest("hex"));
  await fs.rm(temp, { recursive: true, force: true });
});

test("workbook export is blocked before reading source bytes when authorization is unapproved", async () => {
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), "rise-export-policy-test-"));
  try {
    await assert.rejects(
      exportWorkbookInspection(
        path.join(temp, "must-not-be-read.xlsx"),
        path.join(temp, "must-not-exist.ndjson"),
        {
          datasetConfig: {
            requiredSourceAuthorizations: [{ source: "FREIDA", required: true, approvedRecordSha256: null }],
          },
        },
      ),
      (error) => error.code === "RISE_SOURCE_POLICY_BLOCKED" && error.details?.source === "FREIDA",
    );
  } finally {
    await fs.rm(temp, { recursive: true, force: true });
  }
});

test("workbook export verifies source-owner grant bytes before reading source bytes", async () => {
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), "rise-export-grant-test-"));
  const authorizationPath = path.join(temp, "freida-authorization.json");
  const { authorizationSha256 } = await authorizationFixture(authorizationPath);
  try {
    await assert.rejects(
      exportWorkbookInspection(
        path.join(temp, "must-not-be-read.xlsx"),
        path.join(temp, "must-not-exist.ndjson"),
        {
          datasetConfig: {
            requiredSourceAuthorizations: [{ source: "FREIDA", required: true, approvedRecordSha256: authorizationSha256 }],
          },
          freidaAuthorizationPath: authorizationPath,
        },
      ),
      (error) => error.code === "RISE_SOURCE_POLICY_BLOCKED" && /grant file is required/.test(error.message),
    );
  } finally {
    await fs.rm(temp, { recursive: true, force: true });
  }
});
