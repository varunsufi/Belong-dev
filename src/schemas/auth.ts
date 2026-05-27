import { Static, Type } from '@sinclair/typebox';

const RegisterBodySchema = Type.Object(
  {
    email: Type.String({
      maxLength: 255,
      pattern: '^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$',
    }),
    password: Type.String({ minLength: 8, maxLength: 128 }),
    displayName: Type.String({ minLength: 1, maxLength: 120, pattern: '\\S' }),
  },
  { additionalProperties: false },
);

const LoginBodySchema = Type.Object(
  {
    email: Type.String({
      maxLength: 255,
      pattern: '^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$',
    }),
    password: Type.String({ minLength: 8, maxLength: 128 }),
  },
  { additionalProperties: false },
);

const RefreshTokenBodySchema = Type.Object(
  {
    refreshToken: Type.String({ minLength: 1 }),
  },
  { additionalProperties: false },
);

const RegisteredUserResponseSchema = Type.Object({
  email: Type.String({ format: 'email' }),
  displayName: Type.String(),
});

const TokenPairSchema = Type.Object({
  accessToken: Type.String(),
  refreshToken: Type.String(),
});

type LoginBody = Static<typeof LoginBodySchema>;
type RegisteredUserResponse = Static<typeof RegisteredUserResponseSchema>;
type RefreshTokenBody = Static<typeof RefreshTokenBodySchema>;
type RegisterBody = Static<typeof RegisterBodySchema>;
type TokenPair = Static<typeof TokenPairSchema>;

export {
  LoginBody,
  LoginBodySchema,
  RegisteredUserResponse,
  RegisteredUserResponseSchema,
  RefreshTokenBody,
  RefreshTokenBodySchema,
  RegisterBody,
  RegisterBodySchema,
  TokenPair,
  TokenPairSchema,
};
