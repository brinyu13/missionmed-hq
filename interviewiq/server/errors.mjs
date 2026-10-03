export class AppError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.name = 'AppError'; this.status = status; this.code = code;
    if (details !== undefined) this.details = details;
  }
}
export function requireValue(condition, code, message, status = 422, details) {
  if (!condition) throw new AppError(status, code, message, details);
}
export function notFound() { return new AppError(404, 'not_found', 'This record is unavailable.'); }
