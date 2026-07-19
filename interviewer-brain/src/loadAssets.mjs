import { readFile } from "node:fs/promises";
import { validateInterviewPlan, validatePersonaPack } from "./contracts.mjs";

export async function loadPersona(path) { return validatePersonaPack(JSON.parse(await readFile(path, "utf8"))); }
export async function loadPlan(path) { return validateInterviewPlan(JSON.parse(await readFile(path, "utf8"))); }
