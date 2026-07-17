import { mkdir, open, readFile, rename, rm } from "node:fs/promises";
import path from "node:path";
import { stableJson } from "../canonical.mjs";
import { MemoryCieRepository } from "./memoryRepository.mjs";

export class FileCieRepository extends MemoryCieRepository {
  #filePath;

  constructor(filePath, initialState = null) {
    super(initialState);
    this.#filePath = path.resolve(filePath);
  }

  static async open(filePath) {
    let initial = null;
    try {
      initial = JSON.parse(await readFile(filePath, "utf8"));
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
    return new FileCieRepository(filePath, initial);
  }

  async transaction(work) {
    return super.transaction(async (repository) => {
      const result = await work(repository);
      await this.#persist();
      return result;
    });
  }

  async #persist() {
    await mkdir(path.dirname(this.#filePath), { recursive: true });
    const temporary = `${this.#filePath}.${process.pid}.tmp`;
    const handle = await open(temporary, "w", 0o600);
    try {
      await handle.writeFile(`${stableJson(this.exportState())}\n`, "utf8");
      await handle.sync();
    } finally {
      await handle.close();
    }
    try {
      await rename(temporary, this.#filePath);
    } catch (error) {
      await rm(temporary, { force: true });
      throw error;
    }
  }
}
