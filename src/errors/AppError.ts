export type AppErrorCode =
  | 'CHALLENGE_NOT_FOUND'
  | 'EMAIL_ALREADY_EXISTS'
  | 'FORBIDDEN'
  | 'INVALID_ACCESS_TOKEN'
  | 'INVALID_CREDENTIALS'
  | 'INVALID_REFRESH_TOKEN'
  | 'INSUFFICIENT_POINTS'
  | 'REWARD_NOT_FOUND'
  | 'VALIDATION_ERROR'
  | 'INTERNAL_SERVER_ERROR';

const defaultMessages: Record<AppErrorCode, string> = {
  CHALLENGE_NOT_FOUND: 'Challenge not found',
  EMAIL_ALREADY_EXISTS: 'An account with this email already exists',
  FORBIDDEN: 'Forbidden',
  INVALID_ACCESS_TOKEN: 'Invalid access token',
  INVALID_CREDENTIALS: 'Invalid email or password',
  INVALID_REFRESH_TOKEN: 'Invalid refresh token',
  INSUFFICIENT_POINTS: 'Insufficient points to redeem this reward',
  REWARD_NOT_FOUND: 'Reward not found',
  VALIDATION_ERROR: 'Request validation failed',
  INTERNAL_SERVER_ERROR: 'Internal server error',
};

const defaultStatusCodes: Record<AppErrorCode, number> = {
  CHALLENGE_NOT_FOUND: 404,
  EMAIL_ALREADY_EXISTS: 409,
  FORBIDDEN: 403,
  INVALID_ACCESS_TOKEN: 401,
  INVALID_CREDENTIALS: 401,
  INVALID_REFRESH_TOKEN: 401,
  INSUFFICIENT_POINTS: 422,
  REWARD_NOT_FOUND: 404,
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
