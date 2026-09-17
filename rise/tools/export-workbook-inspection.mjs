#!/usr/bin/env node
import { createHash } from "node:crypto";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { once } from "node:events";
import { fileURLToPath } from "node:url";

import ExcelJS from "exceljs";
import { loadPinnedSourceAuthorizations } from "../src/source-authorization.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const defaultDatasetConfigPath = path.resolve(here, "../config/dataset.v1.json");

export const SPECIALTY_TABS = Object.freeze([
  "Internal Medicine",
  "Family Medicine",
  "Pediatrics",
  "General Surgery",
  "Neurology",
  "Psychiatry",
  "Aerospace Medicine",
  "Anesthesiology",
  "Colon and Rectal Surgery",
  "Dermatology",
  "Diagnostic Radiology",
  "Emergency Medicine",
  "Interventional Radiology",
  "Medical Genetics and Genomics",
  "Neurological Surgery",
  "Nuclear Medicine",
  "Obstetrics and Gynecology",
  "Occup & Environmental Med",
  "Ophthalmology",
  "Orthopaedic Surgery",
  "Osteopathic NMM",
  "Otolaryngology-HNS",
  "Pathology",
  "Physical Medicine & Rehab",
  "Plastic Surgery",
  "Public Health-Preventive Med",
  "Radiation Oncology",
  "Thoracic Surgery",
  "Transitional Year",
  "Urology",
  "Vascular Surgery",
]);

function normalizedCellValue(value) {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value !== "object") return value;
  if ("result" in value) return normalizedCellValue(value.result);
  if (Array.isArray(value.richText)) return value.richText.map((item) => item.text ?? "").join("");
  if (typeof value.text === "string") return value.text;
  if (typeof value.hyperlink === "string") return value.hyperlink;
  throw new Error(`Unsupported spreadsheet cell value: ${JSON.stringify(value)}`);
}

function worksheetValues(worksheet) {
  let lastRow = worksheet.rowCount;
  while (lastRow > 2) {
    const rowHasValue = Array.from({ length: 196 }, (_, index) =>
      normalizedCellValue(worksheet.getCell(lastRow, index + 1).value),
    ).some((value) => value !== "");
    if (rowHasValue) break;
    lastRow -= 1;
  }
  const values = [];
  for (let rowIndex = 1; rowIndex <= lastRow; rowIndex += 1) {
    values.push(Array.from({ length: 196 }, (_, columnIndex) =>
      normalizedCellValue(worksheet.getCell(rowIndex, columnIndex + 1).value)));
  }
  return values;
}

async function writeLine(stream, value) {
  if (!stream.write(`${JSON.stringify(value)}\n`)) await once(stream, "drain");
}

export async function exportWorkbookInspection(sourcePath, outputPath, {
  datasetConfig,
  freidaAuthorizationPath,
  residencyExplorerAuthorizationPath,
  freidaGrantPath,
  residencyExplorerGrantPath,
} = {}) {
  const sourceAuthorizations = await loadPinnedSourceAuthorizations({
    datasetConfig,
    pathsBySource: {
      FREIDA: freidaAuthorizationPath,
      "Residency Explorer": residencyExplorerAuthorizationPath,
    },
    grantPathsBySource: {
      FREIDA: freidaGrantPath,
      "Residency Explorer": residencyExplorerGrantPath,
    },
  });
  const expectedTabs = datasetConfig?.canonicalSpecialtyTabs;
  if (
    typeof datasetConfig?.canonicalWorkbook !== "string" ||
    !/^[a-f0-9]{64}$/.test(datasetConfig?.referenceLocalWorkbookSha256 ?? "") ||
    !/^[a-f0-9]{64}$/.test(datasetConfig?.canonicalContentSha256 ?? "") ||
    !Array.isArray(expectedTabs) ||
    JSON.stringify(expectedTabs) !== JSON.stringify(SPECIALTY_TABS)
  ) {
    throw new Error("Dataset configuration is missing exact canonical workbook, hash, content, or specialty-tab bindings");
  }
  if (path.basename(sourcePath) !== datasetConfig.canonicalWorkbook) {
    throw new Error("Workbook filename does not match the canonical dataset configuration");
  }
  const sourceBytes = await fsp.readFile(sourcePath);
  const sourceSha256 = createHash("sha256").update(sourceBytes).digest("hex");
  if (sourceSha256 !== datasetConfig.referenceLocalWorkbookSha256) {
    throw new Error("Workbook bytes do not match the canonical dataset configuration");
  }
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(sourceBytes);
  await fsp.mkdir(path.dirname(outputPath), { recursive: true });
  const output = fs.createWriteStream(outputPath, { encoding: "utf8", flags: "wx" });
  try {
    const contentHash = createHash("sha256");
    for (const sheetName of SPECIALTY_TABS) {
      const worksheet = workbook.getWorksheet(sheetName);
      if (!worksheet) throw new Error(`Missing specialty worksheet: ${sheetName}`);
      const values = worksheetValues(worksheet);
      if (values.length < 3 || values[1]?.length !== 196) {
        throw new Error(`${sheetName}: expected two headers and 196 columns`);
      }
      const record = { kind: "table", sheet: sheetName, values };
      contentHash.update(JSON.stringify({ sheet: sheetName, values }));
      await writeLine(output, record);
    }
    const contentSha256 = contentHash.digest("hex");
    if (contentSha256 !== datasetConfig.canonicalContentSha256) {
      throw new Error("Workbook tables do not match the canonical dataset content hash");
    }
    await writeLine(output, {
      kind: "workbook",
      schemaVersion: 2,
      sourceArtifact: path.basename(sourcePath),
      sourceSha256,
      contentSha256,
      specialtyTabs: SPECIALTY_TABS.length,
      exporter: "exceljs/4.4.0",
      sourceAuthorizationSha256s: Object.values(sourceAuthorizations).map((record) => record.sha256).sort(),
    });
    output.end();
    await once(output, "finish");
    return { outputPath, sourceSha256, contentSha256, specialtyTabs: SPECIALTY_TABS.length };
  } catch (error) {
    output.destroy();
    await fsp.rm(outputPath, { force: true });
    throw error;
  }
}

function parseArgs(argv) {
  const result = {};
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key?.startsWith("--") || !value) throw new Error("Arguments must be --key value pairs");
    result[key.slice(2)] = value;
  }
  return result;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  let args;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (error) {
    process.stderr.write(`${JSON.stringify({ error: error.message, code: "RISE_INSPECTION_ARGUMENTS_INVALID" })}\n`);
    process.exitCode = 2;
  }
  if (args && (!args.source || !args.out)) {
    process.stderr.write(
      "Usage: node rise/tools/export-workbook-inspection.mjs --source <canonical.xlsx> --out <inspection.ndjson> [--freida-authorization <authorization.json>] [--freida-grant <grant-file>] [--residency-explorer-authorization <authorization.json>] [--residency-explorer-grant <grant-file>]\n",
    );
    process.exitCode = 2;
  } else if (args) {
    if (args["dataset-config"]) {
      process.stderr.write(`${JSON.stringify({ error: "Runtime dataset-config overrides are prohibited", code: "RISE_GOVERNANCE_OVERRIDE_PROHIBITED" })}\n`);
      process.exitCode = 2;
    } else fsp.readFile(defaultDatasetConfigPath, "utf8")
      .then((source) => JSON.parse(source))
      .then((datasetConfig) => exportWorkbookInspection(path.resolve(args.source), path.resolve(args.out), {
        datasetConfig,
        freidaAuthorizationPath: args["freida-authorization"]
          ? path.resolve(args["freida-authorization"])
          : undefined,
        residencyExplorerAuthorizationPath: args["residency-explorer-authorization"]
          ? path.resolve(args["residency-explorer-authorization"])
          : undefined,
        freidaGrantPath: args["freida-grant"] ? path.resolve(args["freida-grant"]) : undefined,
        residencyExplorerGrantPath: args["residency-explorer-grant"]
          ? path.resolve(args["residency-explorer-grant"])
          : undefined,
      }))
      .then((result) => process.stdout.write(`${JSON.stringify(result)}\n`))
      .catch((error) => {
        process.stderr.write(`${JSON.stringify({
          error: error.message,
          code: error.code ?? "RISE_INSPECTION_EXPORT_FAILED",
        })}\n`);
        process.exitCode = 1;
      });
  }
}
