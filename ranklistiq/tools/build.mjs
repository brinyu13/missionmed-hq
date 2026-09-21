import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const toolDir = dirname(fileURLToPath(import.meta.url));
const projectDir = resolve(toolDir, "..");
const baseDir = join(projectDir, "app", "base");
const sourceDir = join(projectDir, "src", "dual-mode");
const configPath = join(projectDir, "config", "eras-signal-rules.2027.v1.json");
const distDir = join(projectDir, "dist");

const moduleOrder = [
  "mode-boot.js",
  "storage-namespace.js",
  "cloud-slots.js",
  "signal-rules.js",
  "signal-allocation.js",
  "rise-adapter.js",
  "app-mode-ui.js"
];

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function replaceOne(source, anchor, replacement, seam) {
  const first = source.indexOf(anchor);
  if (first < 0 || source.indexOf(anchor, first + anchor.length) >= 0) {
    throw new Error(`Expected exactly one ${seam} anchor`);
  }
  return source.slice(0, first) + replacement + source.slice(first + anchor.length);
}

async function findBase() {
  const names = (await readdir(baseDir)).filter((name) => name.endsWith(".sanitized.html"));
  if (names.length !== 1) throw new Error("Expected exactly one sanitized live base");
  return join(baseDir, names[0]);
}

function seam(label, content) {
  return `/* RLQ_DUAL:${label} START */\n${content}\n/* RLQ_DUAL:${label} END */`;
}

export function protectedRuntimeWrapper(html) {
  const encoded = Buffer.from(html, "utf8").toString("base64");
  return [
    "<?php",
    "if (!defined('ABSPATH')) {",
    "    http_response_code(404);",
    "    exit;",
    "}",
    `return base64_decode('${encoded}', true);`,
    ""
  ].join("\n");
}

export async function buildHtml({ zero = false, buildId = "test", sourceCommit = "unknown" } = {}) {
  const basePath = await findBase();
  const base = await readFile(basePath, "utf8");
  if (zero) return { html: base, basePath, baseSha256: sha256(base), configSha256: null };

  const configText = await readFile(configPath, "utf8");
  const config = JSON.parse(configText);
  const modules = [];
  for (const name of moduleOrder) modules.push(await readFile(join(sourceDir, name), "utf8"));
  const css = await readFile(join(sourceDir, "app-mode.css"), "utf8");
  const stamp = {
    id: buildId,
    sourceCommit,
    baseSha256: sha256(base),
    configSha256: sha256(configText),
    builtAt: new Date().toISOString()
  };
  const s1Script = [
    `window.__RANKLISTIQ_BUILD__ = ${JSON.stringify(stamp)};`,
    `window.RLQ_SIGNAL_CONFIG = ${JSON.stringify(config)};`,
    ...modules
  ].join("\n\n").replaceAll("</script", "<\\/script");
  const s1 = `<!-- RLQ_DUAL:S1 START -->\n<script>\n${s1Script}\n</script>\n<style>\n${css}\n</style>\n<!-- RLQ_DUAL:S1 END -->\n`;

  let html = replaceOne(base, "<!-- RLQ_WP_BFF_BOOT_P90_START -->", s1 + "<!-- RLQ_WP_BFF_BOOT_P90_START -->", "S1");
  html = replaceOne(
    html,
    "  var snapshot = {\n    programs: normalizePrograms(state.programs),",
    "  var snapshot = {\n    " + seam("S2", "application: state.application,").replaceAll("\n", "\n    ") + "\n    programs: normalizePrograms(state.programs),",
    "S2"
  );
  html = replaceOne(
    html,
    "  function hydrateFromSnapshot(snapshot){\n    return hydrateState(snapshot);\n  }",
    "  function hydrateFromSnapshot(snapshot){\n    " + seam("S3", [
      "if(window.RLQ_DUAL){",
      "  window.RLQ_DUAL.onCloudEnvelope(snapshot);",
      "  snapshot = window.RLQ_DUAL.selectHydrationPayload(snapshot);",
      "  if(!snapshot) return window.RLQ_DUAL.mode === \"application\";",
      "}"
    ].join("\n")).replaceAll("\n", "\n    ") + "\n    return hydrateState(snapshot);\n  }",
    "S3"
  );
  html = replaceOne(
    html,
    "  var envelope = buildRlqSaveEnvelope(payload);",
    "  var envelope = buildRlqSaveEnvelope(payload);\n  " + seam("S4", [
      "if(window.RLQ_DUAL){",
      "  var decorated = window.RLQ_DUAL.decorateSavePayload(envelope);",
      "  if(decorated && decorated.blocked){",
      "    return { ok:false, blocked:true, error:new Error(\"RLQ cloud sync paused: other workspace unknown, reload to retry\") };",
      "  }",
      "  envelope = decorated.payload;",
      "}"
    ].join("\n")).replaceAll("\n", "\n  "),
    "S4"
  );
  html = replaceOne(
    html,
    "    updateRankOutputSummary();\n    refreshStorageStatusUi();\n  }\n\n  /* Buttons */",
    "    updateRankOutputSummary();\n    refreshStorageStatusUi();\n    " + seam("S5", "if(window.RLQ_DUAL && typeof window.RLQ_DUAL.afterRender === \"function\") window.RLQ_DUAL.afterRender();").replaceAll("\n", "\n    ") + "\n  }\n\n  " + seam("S5_BRIDGE", "window.RLQ_ENGINE = { getState:function(){return state;}, upsertProgramFromPayload:upsertProgramFromPayload, rankedPrograms:rankedPrograms, totalScore:totalScore, activeFactors:activeFactors, saveState:saveState, renderAll:renderAll, showToast:showToast, exportCsvEscape:exportCsvEscape };").replaceAll("\n", "\n  ") + "\n\n  /* Buttons */",
    "S5"
  );
  html = replaceOne(
    html,
    "  function collectFinalizeStatsPayload(){",
    "  " + seam("S6", [
      "if(window.dataService){",
      "  window.dataService.saveRankList = async function(rankListPayload){",
      "    var nextPayload = (rankListPayload && typeof rankListPayload === \"object\") ? rankListPayload : {};",
      "    return saveRanklistToSupabase(nextPayload);",
      "  };",
      "  window.dataService.loadRankList = async function(){",
      "    return loadRanklistFromSupabase.apply(this, arguments);",
      "  };",
      "}"
    ].join("\n")).replaceAll("\n", "\n  ") + "\n\n  function collectFinalizeStatsPayload(){",
    "S6"
  );
  html = replaceOne(
    html,
    "    try{\n      notesFlushRes = await flushProgramNotesToUserProgramInterviews({\n        source: \"manual-save-click\"\n      });",
    "    try{\n      " + seam("S7", [
      "if(window.RLQ_DUAL && window.RLQ_DUAL.mode === \"application\") {",
      "  notesFlushRes = { ok:true, skipped:\"application-mode\", attempted:0, synced:0, failed:0, errors:[] };",
      "} else {",
      "  notesFlushRes = await flushProgramNotesToUserProgramInterviews({",
      "    source: \"manual-save-click\"",
      "  });",
      "}"
    ].join("\n")).replaceAll("\n", "\n      "),
    "S7"
  );

  return { html, basePath, baseSha256: sha256(base), configSha256: sha256(configText), stamp };
}

export async function writeBuild({ buildId } = {}) {
  let sourceCommit = "unknown";
  try {
    sourceCommit = execFileSync("git", ["rev-parse", "HEAD"], { cwd: resolve(projectDir, ".."), encoding: "utf8" }).trim();
  } catch (_error) {}
  const resolvedBuildId = buildId || `${new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z")}-g${sourceCommit.slice(0, 8)}`;
  const result = await buildHtml({ buildId: resolvedBuildId, sourceCommit });
  await mkdir(distDir, { recursive: true });
  const filename = `rank_list_engine.${resolvedBuildId}.html`;
  const outputPath = join(distDir, filename);
  const outputSha256 = sha256(result.html);
  const runtimeFilename = `rank_list_engine.${resolvedBuildId}.runtime.php`;
  const runtimePath = join(distDir, runtimeFilename);
  const runtime = protectedRuntimeWrapper(result.html);
  const runtimeSha256 = sha256(runtime);
  await writeFile(outputPath, result.html, "utf8");
  await writeFile(`${outputPath}.sha256`, `${outputSha256}  ${filename}\n`, "utf8");
  await writeFile(runtimePath, runtime, "utf8");
  await writeFile(`${runtimePath}.sha256`, `${runtimeSha256}  ${runtimeFilename}\n`, "utf8");
  await writeFile(join(distDir, "build-manifest.json"), JSON.stringify({ ...result.stamp, output: filename, outputSha256, runtime: runtimeFilename, runtimeSha256 }, null, 2) + "\n", "utf8");
  return { outputPath, outputSha256, runtimePath, runtimeSha256, ...result.stamp };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const buildIdIndex = process.argv.indexOf("--build-id");
  const buildId = buildIdIndex >= 0 ? process.argv[buildIdIndex + 1] : undefined;
  const result = await writeBuild({ buildId });
  process.stdout.write(JSON.stringify(result) + "\n");
}
