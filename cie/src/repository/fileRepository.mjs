import { mkdir, open, readFile, rename, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { sha256, stableJson } from "../canonical.mjs";
import { CieError, invariant } from "../errors.mjs";
import { MemoryCieRepository } from "./memoryRepository.mjs";

const FILE_FORMAT = "missionmed.cie.file-repository.v2";
const ANCHOR_FORMAT = "missionmed.cie.file-repository-anchor.v1";
const WITNESS_FORMAT = "missionmed.cie.file-repository-witness.v1";
const JOURNAL_FORMAT = "missionmed.cie.file-repository-journal.v1";

async function readJson(filePath, allowMissing = false) {
  try {
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch (error) {
    if (allowMissing && error.code === "ENOENT") return null;
    if (error instanceof SyntaxError) throw new CieError(500, "FILE_REPOSITORY_TAMPERED", "CIE repository JSON is invalid");
    throw error;
  }
}

function validateEnvelope(value) {
  invariant(value?.file_format === FILE_FORMAT && Number.isSafeInteger(value.generation) && value.generation > 0 && value.state, 500, "FILE_REPOSITORY_FORMAT_INVALID", "CIE repository envelope is invalid");
  const expected = sha256({ file_format: value.file_format, generation: value.generation, state: value.state });
  invariant(value.root_hash === expected, 500, "FILE_REPOSITORY_TAMPERED", "CIE repository root hash does not match its state");
  return value;
}

function validateAnchor(value, envelope) {
  invariant(value?.file_format === ANCHOR_FORMAT && value.generation === envelope.generation && value.root_hash === envelope.root_hash, 500, "FILE_REPOSITORY_ROLLBACK_DETECTED", "CIE repository anchor does not match its state");
}

function defaultWitnessPath(filePath) {
  return path.join(os.homedir(), ".missionmed", "cie-local-witnesses", `${sha256(path.resolve(filePath))}.jsonl`);
}

async function readWitness(filePath, repositoryKey) {
  let bytes;
  try {
    bytes = await readFile(filePath, "utf8");
  } catch (error) {
    if (error.code === "ENOENT") return { entries: [], last: null };
    throw error;
  }
  const entries = bytes.split("\n").filter(Boolean).map((line) => {
    try {
      return JSON.parse(line);
    } catch {
      throw new CieError(500, "FILE_REPOSITORY_WITNESS_TAMPERED", "CIE rollback witness JSON is invalid");
    }
  });
  let previousHash = null;
  let previousGeneration = 0;
  for (const entry of entries) {
    invariant(entry?.file_format === WITNESS_FORMAT && entry.repository_key === repositoryKey, 500, "FILE_REPOSITORY_WITNESS_TAMPERED", "CIE rollback witness identity is invalid");
    invariant(entry.generation === previousGeneration + 1 && entry.previous_entry_hash === previousHash, 500, "FILE_REPOSITORY_WITNESS_TAMPERED", "CIE rollback witness chain is invalid");
    const unsigned = {
      file_format: entry.file_format,
      repository_key: entry.repository_key,
      generation: entry.generation,
      root_hash: entry.root_hash,
      previous_entry_hash: entry.previous_entry_hash
    };
    invariant(entry.entry_hash === sha256(unsigned), 500, "FILE_REPOSITORY_WITNESS_TAMPERED", "CIE rollback witness hash is invalid");
    previousHash = entry.entry_hash;
    previousGeneration = entry.generation;
  }
  return { entries, last: entries.at(-1) || null };
}

function validateWitness(witness, envelope) {
  invariant(witness?.last && witness.last.generation === envelope.generation && witness.last.root_hash === envelope.root_hash, 500, "FILE_REPOSITORY_ROLLBACK_DETECTED", "CIE repository state is behind its external rollback witness");
}

async function appendWitness(filePath, entry) {
  await mkdir(path.dirname(filePath), { recursive: true });
  const handle = await open(filePath, "a", 0o600);
  try {
    await handle.writeFile(`${stableJson(entry)}\n`, "utf8");
    await handle.sync();
  } finally {
    await handle.close();
  }
}

async function replaceDurable(filePath, value) {
  await mkdir(path.dirname(filePath), { recursive: true });
  const temporary = await writeDurable(filePath, value);
  await rename(temporary, filePath);
}

function validateJournal(value, repositoryKey) {
  invariant(value?.file_format === JOURNAL_FORMAT && value.repository_key === repositoryKey, 500, "FILE_REPOSITORY_JOURNAL_TAMPERED", "CIE recovery journal identity is invalid");
  const unsigned = { ...value };
  delete unsigned.journal_hash;
  invariant(value.journal_hash === sha256(unsigned), 500, "FILE_REPOSITORY_JOURNAL_TAMPERED", "CIE recovery journal hash is invalid");
  validateEnvelope(value.envelope);
  validateAnchor(value.anchor, value.envelope);
  invariant(value.witness_entry?.generation === value.envelope.generation && value.witness_entry.root_hash === value.envelope.root_hash, 500, "FILE_REPOSITORY_JOURNAL_TAMPERED", "CIE recovery journal witness is invalid");
  return value;
}

function matchesGeneration(value, generation, rootHash) {
  if (generation === 0) return value === null;
  return Boolean(value && value.generation === generation && value.root_hash === rootHash);
}

async function recoverPending(filePath, witnessPath, repositoryKey) {
  const journalPath = `${filePath}.journal`;
  const journalValue = await readJson(journalPath, true);
  if (!journalValue) return;
  const journal = validateJournal(journalValue, repositoryKey);
  const envelope = await readJson(filePath, true);
  const anchor = await readJson(`${filePath}.anchor`, true);
  const witness = await readWitness(witnessPath, repositoryKey);
  if (envelope) validateEnvelope(envelope);
  if (anchor && envelope && anchor.generation === envelope.generation) validateAnchor(anchor, envelope);
  const componentMatches = (value) => matchesGeneration(value, journal.previous_generation, journal.previous_root_hash)
    || matchesGeneration(value, journal.envelope.generation, journal.envelope.root_hash);
  invariant(componentMatches(envelope) && componentMatches(anchor), 500, "FILE_REPOSITORY_JOURNAL_CONFLICT", "CIE recovery journal conflicts with repository state");
  invariant(componentMatches(witness.last), 500, "FILE_REPOSITORY_JOURNAL_CONFLICT", "CIE recovery journal conflicts with rollback witness");

  await replaceDurable(filePath, journal.envelope);
  await replaceDurable(`${filePath}.anchor`, journal.anchor);
  if (!matchesGeneration(witness.last, journal.envelope.generation, journal.envelope.root_hash)) {
    await appendWitness(witnessPath, journal.witness_entry);
  }
  await rm(journalPath, { force: true });
}

async function acquireLock(lockPath) {
  const create = async () => {
    const handle = await open(lockPath, "wx", 0o600);
    await handle.writeFile(`${process.pid}\n`, "utf8");
    await handle.sync();
    return handle;
  };
  try {
    return await create();
  } catch (error) {
    if (error.code !== "EEXIST") throw error;
    const existingPid = Number((await readFile(lockPath, "utf8")).trim());
    invariant(Number.isSafeInteger(existingPid) && existingPid > 0, 500, "FILE_REPOSITORY_LOCK_TAMPERED", "CIE repository lock is invalid");
    let active = true;
    try {
      process.kill(existingPid, 0);
    } catch (probeError) {
      if (probeError.code === "ESRCH") active = false;
      else throw probeError;
    }
    invariant(!active, 409, "FILE_REPOSITORY_BUSY", "Another CIE writer owns the local repository");
    await rm(lockPath, { force: true });
    return create();
  }
}

async function writeDurable(filePath, value) {
  const temporary = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  const handle = await open(temporary, "wx", 0o600);
  try {
    await handle.writeFile(`${stableJson(value)}\n`, "utf8");
    await handle.sync();
  } finally {
    await handle.close();
  }
  return temporary;
}

export class FileCieRepository extends MemoryCieRepository {
  #filePath;
  #anchorPath;
  #lockPath;
  #witnessPath;
  #repositoryKey;
  #witnessEntryHash;
  #generation;
  #rootHash;
  #stateHash;
  #faultInjectionStage;

  constructor(filePath, initialState = null, metadata = {}) {
    super(initialState);
    this.#filePath = path.resolve(filePath);
    this.#anchorPath = `${this.#filePath}.anchor`;
    this.#lockPath = `${this.#filePath}.lock`;
    this.#witnessPath = metadata.witnessPath || defaultWitnessPath(this.#filePath);
    this.#repositoryKey = sha256(this.#filePath);
    this.#witnessEntryHash = metadata.witnessEntryHash || null;
    this.#generation = metadata.generation || 0;
    this.#rootHash = metadata.rootHash || null;
    this.#stateHash = sha256(this.exportState());
    this.#faultInjectionStage = metadata.faultInjectionStage || null;
  }

  static async open(filePath, options = {}) {
    const resolved = path.resolve(filePath);
    const witnessPath = path.resolve(options.witnessPath || defaultWitnessPath(resolved));
    const repositoryKey = sha256(resolved);
    await recoverPending(resolved, witnessPath, repositoryKey);
    const envelope = await readJson(resolved, true);
    const anchor = await readJson(`${resolved}.anchor`, true);
    const witness = await readWitness(witnessPath, repositoryKey);
    invariant(Boolean(envelope) === Boolean(anchor), 500, "FILE_REPOSITORY_ROLLBACK_DETECTED", "CIE repository state and anchor must both exist");
    if (!envelope) {
      invariant(!witness.last, 500, "FILE_REPOSITORY_ROLLBACK_DETECTED", "CIE repository state is missing but its rollback witness remains");
      return new FileCieRepository(resolved, null, { witnessPath, faultInjectionStage: options.faultInjectionStage });
    }
    validateEnvelope(envelope);
    validateAnchor(anchor, envelope);
    validateWitness(witness, envelope);
    return new FileCieRepository(resolved, envelope.state, {
      generation: envelope.generation,
      rootHash: envelope.root_hash,
      witnessPath,
      witnessEntryHash: witness.last.entry_hash,
      faultInjectionStage: options.faultInjectionStage
    });
  }

  async transaction(work) {
    await mkdir(path.dirname(this.#filePath), { recursive: true });
    let lock;
    try {
      lock = await acquireLock(this.#lockPath);
    } catch (error) {
      throw error;
    }
    try {
      await this.#assertCurrentGeneration();
      return await super.transaction(async (repository) => {
        const result = await work(repository);
        await this.#persistIfChanged();
        return result;
      });
    } finally {
      await lock?.close();
      await rm(this.#lockPath, { force: true });
    }
  }

  async #assertCurrentGeneration() {
    await recoverPending(this.#filePath, this.#witnessPath, this.#repositoryKey);
    const envelope = await readJson(this.#filePath, true);
    const anchor = await readJson(this.#anchorPath, true);
    const witness = await readWitness(this.#witnessPath, this.#repositoryKey);
    invariant(Boolean(envelope) === Boolean(anchor), 500, "FILE_REPOSITORY_ROLLBACK_DETECTED", "CIE repository state and anchor must both exist");
    if (!envelope) {
      invariant(this.#generation === 0 && this.#rootHash === null && !witness.last, 409, "FILE_REPOSITORY_STALE", "CIE repository state was removed or rolled back");
      return;
    }
    validateEnvelope(envelope);
    validateAnchor(anchor, envelope);
    validateWitness(witness, envelope);
    invariant(envelope.generation === this.#generation && envelope.root_hash === this.#rootHash, 409, "FILE_REPOSITORY_STALE", "CIE repository changed since this writer opened it");
  }

  async #persistIfChanged() {
    const state = this.exportState();
    const stateHash = sha256(state);
    if (stateHash === this.#stateHash) return;
    const generation = this.#generation + 1;
    const unsigned = { file_format: FILE_FORMAT, generation, state };
    const rootHash = sha256(unsigned);
    const envelope = { ...unsigned, root_hash: rootHash };
    const anchor = { file_format: ANCHOR_FORMAT, generation, root_hash: rootHash };
    const witnessUnsigned = {
      file_format: WITNESS_FORMAT,
      repository_key: this.#repositoryKey,
      generation,
      root_hash: rootHash,
      previous_entry_hash: this.#witnessEntryHash
    };
    const witnessEntry = { ...witnessUnsigned, entry_hash: sha256(witnessUnsigned) };
    const journalUnsigned = {
      file_format: JOURNAL_FORMAT,
      repository_key: this.#repositoryKey,
      previous_generation: this.#generation,
      previous_root_hash: this.#rootHash,
      envelope,
      anchor,
      witness_entry: witnessEntry
    };
    const journal = { ...journalUnsigned, journal_hash: sha256(journalUnsigned) };
    const stateTemporary = await writeDurable(this.#filePath, envelope);
    let anchorTemporary;
    try {
      anchorTemporary = await writeDurable(this.#anchorPath, anchor);
      await replaceDurable(`${this.#filePath}.journal`, journal);
      if (this.#faultInjectionStage === "journal") throw new Error("Synthetic fault after CIE journal commit");
      await rename(stateTemporary, this.#filePath);
      if (this.#faultInjectionStage === "state") throw new Error("Synthetic fault after CIE state commit");
      await rename(anchorTemporary, this.#anchorPath);
      if (this.#faultInjectionStage === "anchor") throw new Error("Synthetic fault after CIE anchor commit");
      await appendWitness(this.#witnessPath, witnessEntry);
      if (this.#faultInjectionStage === "witness") throw new Error("Synthetic fault after CIE witness commit");
      await rm(`${this.#filePath}.journal`, { force: true });
    } catch (error) {
      await rm(stateTemporary, { force: true });
      if (anchorTemporary) await rm(anchorTemporary, { force: true });
      throw error;
    }
    this.#generation = generation;
    this.#rootHash = rootHash;
    this.#witnessEntryHash = witnessEntry.entry_hash;
    this.#stateHash = stateHash;
  }
}
