import { readFile } from "node:fs/promises";
import { JSDOM } from "jsdom";

async function main(): Promise<void> {
  const html = await readFile("apps/priq-web/public/index.html", "utf8");
  const document = new JSDOM(html).window.document;
  const failures: string[] = [];
  const required = ["v-today", "v-student", "v-program", "v-copilot", "v-lab", "v-panel", "modal", "preview"];
  for (const id of required) if (!document.getElementById(id)) failures.push(`missing #${id}`);
  for (const button of document.querySelectorAll("button")) {
    const name = `${button.getAttribute("aria-label") ?? ""}${button.textContent ?? ""}`.trim();
    if (!name) failures.push("unnamed button");
  }
  const navButtons = [...document.querySelectorAll("button[data-v]")];
  if (navButtons.length < 6) failures.push("six primary navigation buttons required");
  if (!document.querySelector("meta[name=viewport]")) failures.push("viewport meta missing");
  if (failures.length) throw new Error(`PRIQ_A11Y_STATIC_FAILED\n${failures.join("\n")}`);
  process.stdout.write(`PRIQ_A11Y_STATIC_OK buttons=${document.querySelectorAll("button").length} primaryNav=${navButtons.length}\n`);
}

void main();
