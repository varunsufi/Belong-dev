const SWAGGER_TAGS = {
  PublicAuth: 'Public Auth',
  System: 'System',
} as const;

const SWAGGER_TAG_DEFINITIONS = [
  { name: SWAGGER_TAGS.PublicAuth, description: 'Authentication endpoints' },
  { name: SWAGGER_TAGS.System, description: 'System and health endpoints' },
];


export { SWAGGER_TAG_DEFINITIONS, SWAGGER_TAGS };
