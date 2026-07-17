export class CieError extends Error {
  constructor(status, code, message, details = null) {
    super(message);
    this.name = "CieError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function invariant(condition, status, code, message, details = null) {
  if (!condition) throw new CieError(status, code, message, details);
}
