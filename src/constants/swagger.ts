const SWAGGER_TAGS = {
  PublicAuth: 'Public Auth',
  AdminChallenges: 'Admin Challenges',
  System: 'System',
} as const;

const SWAGGER_TAG_DEFINITIONS = [
  { name: SWAGGER_TAGS.PublicAuth, description: 'Authentication endpoints' },
  { name: SWAGGER_TAGS.AdminChallenges, description: 'Admin challenge management endpoints' },
  { name: SWAGGER_TAGS.System, description: 'System and health endpoints' },
];

const BEARER_AUTH_SECURITY = [{ bearerAuth: [] }];

const BEARER_AUTH_SECURITY_SCHEME = {
  type: 'http',
  scheme: 'bearer',
  bearerFormat: 'JWT',
} as const;

export { BEARER_AUTH_SECURITY, BEARER_AUTH_SECURITY_SCHEME, SWAGGER_TAG_DEFINITIONS, SWAGGER_TAGS };
