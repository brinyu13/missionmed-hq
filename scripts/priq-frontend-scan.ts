import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";

async function filesUnder(path: string): Promise<string[]> {
  const entries = await readdir(path, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const target = resolve(path, entry.name);
    if (entry.isDirectory()) files.push(...await filesUnder(target));
    else if (entry.isFile()) files.push(target);
  }
  return files;
}

export async function builtFrontendSecretScan(env: NodeJS.ProcessEnv = process.env): Promise<boolean> {
  const actual = env.OPENAI_API_KEY;
  for (const path of await filesUnder(resolve("apps/priq-web/dist"))) {
    const bytes = await readFile(path);
    if (actual && bytes.includes(Buffer.from(actual))) return false;
    const text = bytes.toString("utf8");
    if (/OPENAI_API_KEY|api\.openai\.com|sk-[a-z0-9_-]{12,}|openai[^\n]{0,120}authorization\s*[:=]|authorization[^\n]{0,120}openai/i.test(text)) return false;
  }
  return true;
}

if (process.argv[1]?.endsWith("priq-frontend-scan.ts")) {
  builtFrontendSecretScan().then((passed) => {
    process.stdout.write(`PRIQ_FRONTEND_SECRET_SCAN: ${passed ? "PASS" : "FAIL"}\n`);
    if (!passed) process.exitCode = 1;
  }).catch(() => {
    process.stdout.write("PRIQ_FRONTEND_SECRET_SCAN: FAIL\n");
    process.exitCode = 1;
  });
}
