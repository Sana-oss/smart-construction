export class AppError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = new.target.name;
  }
}
export class ValidationError extends AppError {
  constructor(message: string) { super('validation', message); }
}
export class NotFoundError extends AppError {
  constructor(message: string) { super('not_found', message); }
}
export class ForbiddenError extends AppError {
  constructor(message: string) { super('forbidden', message); }
}
export class ConflictError extends AppError {
  constructor(message: string) { super('conflict', message); }
}
