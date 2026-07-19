export class BrainContractError extends Error {
  constructor(code, message, details = undefined) {
    super(message);
    this.name = "BrainContractError";
    this.code = code;
    this.details = details;
  }
}

export function fail(code, message, details) {
  throw new BrainContractError(code, message, details);
}

export function invariant(condition, code, message, details) {
  if (!condition) fail(code, message, details);
}
