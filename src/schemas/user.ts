import { Static, Type } from '@sinclair/typebox';

const UpdateProfileBodySchema = Type.Object(
  {
    displayName: Type.String({ minLength: 1, maxLength: 120, pattern: '\\S' }),
  },
  { additionalProperties: false },
);

const UserProfileResponseSchema = Type.Object({
  id: Type.String({ format: 'uuid' }),
  email: Type.String({ format: 'email' }),
  displayName: Type.Union([Type.String(), Type.Null()]),
  totalPoints: Type.Integer({ minimum: 0 }),
});

const UserStatsResponseSchema = Type.Object({
  totalPoints: Type.Integer({ minimum: 0 }),
  completionsCount: Type.Integer({ minimum: 0 }),
  redemptionsCount: Type.Integer({ minimum: 0 }),
  pointsEarned: Type.Integer({ minimum: 0 }),
  pointsSpent: Type.Integer({ minimum: 0 }),
});

type UpdateProfileBody = Static<typeof UpdateProfileBodySchema>;
type UserProfileResponse = Static<typeof UserProfileResponseSchema>;
type UserStatsResponse = Static<typeof UserStatsResponseSchema>;

export {
  UpdateProfileBody,
  UpdateProfileBodySchema,
  UserProfileResponse,
  UserProfileResponseSchema,
  UserStatsResponse,
  UserStatsResponseSchema,
};
