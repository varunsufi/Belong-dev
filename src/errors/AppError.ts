export type AppErrorCode =
  | 'EMAIL_ALREADY_EXISTS'
  | 'FORBIDDEN'
  | 'INVALID_ACCESS_TOKEN'
  | 'INVALID_CREDENTIALS'
  | 'INVALID_REFRESH_TOKEN'
  | 'VALIDATION_ERROR'
  | 'INTERNAL_SERVER_ERROR';

const defaultMessages: Record<AppErrorCode, string> = {
  EMAIL_ALREADY_EXISTS: 'An account with this email already exists',
  FORBIDDEN: 'Forbidden',
  INVALID_ACCESS_TOKEN: 'Invalid access token',
  INVALID_CREDENTIALS: 'Invalid email or password',
  INVALID_REFRESH_TOKEN: 'Invalid refresh token',
  VALIDATION_ERROR: 'Request validation failed',
  INTERNAL_SERVER_ERROR: 'Internal server error',
};

const defaultStatusCodes: Record<AppErrorCode, number> = {
  EMAIL_ALREADY_EXISTS: 409,
  FORBIDDEN: 403,
  INVALID_ACCESS_TOKEN: 401,
  INVALID_CREDENTIALS: 401,
  INVALID_REFRESH_TOKEN: 401,
  VALIDATION_ERROR: 400,
  INTERNAL_SERVER_ERROR: 500,
};

export class AppError extends Error {
  readonly code: AppErrorCode;
  readonly statusCode: number;

  constructor(code: AppErrorCode, message = defaultMessages[code], statusCode = defaultStatusCodes[code]) {
    super(message);
    this.code = code;
    this.statusCode = statusCode;
  }
}
